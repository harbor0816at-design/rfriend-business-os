'use strict';
(function(){
 const $=id=>document.getElementById(id),h=v=>erpEsc(v??''),dt=v=>v?String(v).replace('T',' ').slice(0,16):'未记录';
 const canManage=()=>['admin','operations','finance'].includes(profile?.role);
 const canReceive=()=>['admin','operations','warehouse'].includes(profile?.role);
 const status={received:'已到齐',cancelled:'已取消',missing_eta:'缺预计日期',overdue:'逾期未到',partial_overdue:'部分到仓但逾期',due_today:'今日应到',partial_due_today:'部分到仓/今日应到',due_soon:'3天内应到',partial_received:'部分到仓',on_track:'正常在途'};
 const danger=new Set(['missing_eta','overdue','partial_overdue']);
 let data=[],po=[],products=[],filtered=[];
 const table=(headers,rows)=>'<div class="erp-scroll"><table><thead><tr>'+headers.map(x=>'<th>'+h(x)+'</th>').join('')+'</tr></thead><tbody>'+
 (rows.join('')||'<tr><td colspan="'+headers.length+'" class="erp-empty">暂无采购明细</td></tr>')+'</tbody></table></div>';
 async function rpc(name,body){
  const res=await authorized('/rest/v1/rpc/'+name,{method:'POST',body});
  ['purchase_tracking','purchase_delivery_alerts','purchase_orders','purchase_items','purchase_lines_details','imei_trace','imei_register','stock_balances'].forEach(x=>ERP_CACHE.delete(x));
  return res;
 }
 function editor(title,body,save){
  const m=erpModal('<form id="procForm">'+body+'<div class="erp-actions" style="margin-top:16px"><button type="submit" class="primary">确认保存</button></div><p id="procMsg"></p></form>',title);
  const form=m.querySelector('form');
  form.onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(form)),btn=form.querySelector('button'),msg=m.querySelector('#procMsg');btn.disabled=true;
   try{await save(v);msg.style.color='#128257';msg.textContent='已保存';m.remove();await erpProcurementTracking()}
   catch(err){msg.style.color='#b03432';msg.textContent=errorMessage(err);btn.disabled=false}
  };
 }
 function eta(row){
  editor('调整采购预计到仓时间 · '+row.po_number,
   '<p>'+h(row.product_name)+' / '+h(row.model)+' / '+h(row.color)+' / '+h(row.storage_version)+'</p>'+
   '<label>新的预计到仓日期 <input class="control" name="eta" type="date" required value="'+h(row.expected_arrival_at||'')+'"></label>'+
   '<label>调整原因 <textarea class="control" name="reason" minlength="8" required rows="3"></textarea></label>',
   v=>rpc('rfriend_erp_update_purchase_eta',{p_purchase_item_id:row.id,p_eta:v.eta,p_reason:v.reason}));
 }
 function receipt(row){
  const cat=products.find(x=>x.id===row.product_id)?.category;
  if(['phone','tablet'].includes(cat)){
   editor('逐台 IMEI 确认实际到仓',
    '<p>'+h(row.product_name)+' · 剩余 '+row.outstanding_qty+' 台</p>'+
    '<label>IMEI<input name="imei" class="control" required pattern="[0-9]{15}" placeholder="15位数字"></label>'+
    '<label>仓库收货凭证<input name="reference" class="control" minlength="5" required></label>',
    v=>rpc('rfriend_erp_receive_purchase_imei',{p_purchase_item_id:row.id,p_imei:v.imei,p_reference:v.reference}));
  }else{
   editor('非串码商品收货',
    '<p>'+h(row.product_name)+' · 剩余 '+row.outstanding_qty+' 件</p>'+
    '<label>本次到仓数量<input name="qty" type="number" class="control" min="1" max="'+row.outstanding_qty+'" required></label>'+
    '<label>收货凭证<input name="reference" class="control" minlength="5" required></label>',
    v=>rpc('rfriend_erp_receive_purchase_line',{p_item_id:row.id,p_quantity:Number(v.qty),p_idempotency_key:'po-line-'+row.id+'-'+v.reference.trim()}));
  }
 }
 function addLine(poRow){
  const valid=products.filter(p=>p.is_active&&p.model&&p.color);
  const items=valid.map(p=>'<option value="'+h(p.id)+'">'+h(p.product_name)+' / '+h(p.model)+' / '+h(p.color)+' / '+h(p.storage_version||'不适用')+'</option>').join('');
  editor('采购单添加具体机型 · '+poRow.po_number,
   '<label>型号 / 颜色 / 内存<select name="product" class="control" required>'+items+'</select></label>'+
   '<label>采购数量<input name="quantity" class="control" type="number" min="1" step="1" required></label>'+
   '<label>预计到仓时间<input name="eta" class="control" type="date" required></label>'+
   '<label>采购单价 EUR<input name="unit_cost" class="control" type="number" min="0" step=".01" required value="0"></label>',
   v=>rpc('rfriend_erp_purchase_add_line_v2',{p_po_id:poRow.id,p_product_id:v.product,
     p_quantity:Number(v.quantity),p_expected_arrival_at:v.eta,p_unit_cost_eur:Number(v.unit_cost)}));
 }
 async function progress(poRow){
  const next={draft:'submitted',submitted:'approved',approved:'ordered'}[poRow.status];
  if(!next)return;
  if(next==='approved'&&!['admin','finance'].includes(profile?.role)){alert('只有管理员或财务可以审批采购单');return}
  if(!confirm('将采购单 '+poRow.po_number+' 流转为 '+next+'？'))return;
  try{await rpc('rfriend_erp_advance_status',{p_entity:'purchase_orders',p_id:poRow.id,p_status:next,p_note:'采购审批流转'});await erpProcurementTracking()}
  catch(e){alert(errorMessage(e))}
 }
 function renderRows(){
  const q=($('poSearch')?.value||'').trim().toLowerCase(),filter=$('poFilter')?.value||'all';
  filtered=data.filter(x=>(filter==='all'||filter==='alerts'&&
   ['missing_eta','due_today','partial_due_today','overdue','partial_overdue','due_soon'].includes(x.delivery_alert)||
   x.delivery_alert===filter)&&(!q||[x.po_number,x.product_name,x.model,x.color,x.storage_version,x.sku,x.supplier].some(z=>String(z||'').toLowerCase().includes(q))));
  const ranked={overdue:0,partial_overdue:0,missing_eta:1,due_today:2,partial_due_today:2,due_soon:3,partial_received:4,on_track:5,received:6,cancelled:7};
  filtered.sort((a,b)=>(ranked[a.delivery_alert]??8)-(ranked[b.delivery_alert]??8)||
   (a.expected_arrival_at||'9999').localeCompare(b.expected_arrival_at||'9999'));
  const rows=filtered.map((x,i)=>'<tr><td>'+h(x.po_number)+'<small class="v5-subline">'+h(x.supplier)+'</small></td>'+
   '<td><strong>'+h(x.product_name)+'</strong><small class="v5-subline">型号：'+h(x.model)+' / '+h(x.color)+' / '+h(x.storage_version)+
   '</small><small class="v5-subline">SKU: '+h(x.sku)+'</small></td>'+
   '<td>'+h(x.warehouse_name)+'</td>'+
   '<td>'+dt(x.ordered_at||x.created_at)+(x.ordered_at?'':'<small class="v5-subline">仅建单，尚未下单</small>')+'</td>'+
   '<td>'+x.ordered_qty+'</td><td>'+x.received_qty+'</td><td><strong>'+x.outstanding_qty+'</strong></td>'+
   '<td>'+h(x.expected_arrival_at||'待维护')+'</td>'+
   '<td>'+(x.received_qty?('首批：'+dt(x.first_received_at)+'<small class="v5-subline">最近到仓：'+dt(x.last_received_at)+'</small>'):'尚未入库')+'</td>'+
   '<td><span class="erp-sla '+(danger.has(x.delivery_alert)?'erp-sla-high':'')+'">'+h(status[x.delivery_alert])+'</span>'+
   (x.overdue_days?'<small class="v5-subline">逾期 '+x.overdue_days+' 天</small>':'')+'</td>'+
   '<td>'+(canManage()&&x.outstanding_qty?'<button class="btn etaEdit" data-i="'+i+'">修改 ETA</button>':'')+
   (canReceive()&&x.outstanding_qty&&['ordered','part_received'].includes(x.po_status)?'<button class="btn poReceive" data-i="'+i+'">确认收货</button>':'')+'</td></tr>');
  $('poLines').innerHTML=table(['采购订单','产品名称 / 型号 / 颜色 / 内存','到货仓库','下单时间','采购数量','已到仓','未到仓','预计到仓','实际到仓时间','到仓预警','操作'],rows);
  $('poLines').querySelectorAll('.etaEdit').forEach(b=>b.onclick=()=>eta(filtered[Number(b.dataset.i)]));
  $('poLines').querySelectorAll('.poReceive').forEach(b=>b.onclick=()=>receipt(filtered[Number(b.dataset.i)]));
  $('poDownload').onclick=()=>erpDownload('purchase-arrivals-and-alerts',filtered);
 }
 window.erpProcurementTracking=async function(){
  $('content').innerHTML='<div class="erp-topline">采购管理 · 机型、数量、下单时间、预计/实际到仓、逾期预警</div>'+
   '<div class="message">下单时间以采购单正式订货记录为准；实际到仓从仓库入库流水提取首批及最近收货时间。未入库不填虚构日期；部分入库持续追踪剩余数量。</div>'+
   '<div class="cards" id="poMetrics"></div>'+
   '<section class="panel"><div class="erp-header"><h3>采购到仓跟踪</h3><div class="erp-toolbar">'+
   '<input class="control" id="poSearch" placeholder="搜索商品名称 / 型号 / 订单号">'+
   '<select class="control" id="poFilter"><option value="all">全部采购</option><option value="alerts">需要关注</option>'+
   '<option value="overdue">逾期未到</option><option value="partial_overdue">部分到货逾期</option><option value="due_today">今日应到</option>'+
   '<option value="missing_eta">缺 ETA</option><option value="received">全部到仓</option></select>'+
   '<button class="btn" id="poDownload">↓ 导出采购追踪</button></div></div><div id="poLines">读取中…</div></section>'+
   '<section class="panel"><div class="erp-header"><h3>采购单审批与创建</h3>'+ (canManage()?'<button id="poNew" class="btn primary">＋ 新建采购单</button>':'')+'</div><div id="poSummary">读取中…</div></section>';
  try{
   [data,po,products]=await Promise.all(['purchase_tracking','purchase_orders','product_catalog'].map(k=>erpData(k,true)));
   if(!$('poLines'))return;
   const pending=data.filter(x=>x.outstanding_qty>0),overdue=pending.filter(x=>x.overdue_days>0);
   $('poMetrics').innerHTML=erpMetric('采购总数量',data.reduce((a,x)=>a+Number(x.ordered_qty||0),0),'按具体 SKU 采购行')+
     erpMetric('尚未到仓',pending.reduce((a,x)=>a+x.outstanding_qty,0),'未收货件数')+
     erpMetric('已逾期采购',overdue.length,'采购明细行')+
     erpMetric('今日应到',pending.filter(x=>['due_today','partial_due_today'].includes(x.delivery_alert)).length,'未到齐明细');
   $('poSearch').oninput=renderRows;$('poFilter').onchange=renderRows;renderRows();
   $('poSummary').innerHTML=table(['采购单号','供应商','状态','创建时间','正式下单时间','采购操作'],
    po.map((x,i)=>'<tr><td>'+h(x.po_number)+'</td><td>'+h(x.supplier)+'</td><td>'+h(x.status)+'</td><td>'+dt(x.created_at)+'</td><td>'+dt(x.ordered_at)+'</td><td>'+
      (canManage()&&x.status==='draft'?'<button class="btn poAddLine" data-i="'+i+'">＋ 添加机型</button>':'')+
      (canManage()&&['draft','submitted','approved'].includes(x.status)?'<button class="btn poAdvance" data-i="'+i+'">流转审批</button>':'')+
      '</td></tr>'));
   $('poSummary').querySelectorAll('.poAddLine').forEach(b=>b.onclick=()=>addLine(po[Number(b.dataset.i)]));
   $('poSummary').querySelectorAll('.poAdvance').forEach(b=>b.onclick=()=>progress(po[Number(b.dataset.i)]));
   $('poNew')?.addEventListener('click',()=>erpOpenCreate('purchase_orders'));
  }catch(err){if($('poLines'))$('poLines').textContent='采购数据读取失败：'+errorMessage(err)}
 };
})();
