'use strict';
/* Original product descriptions and field-specific reconciliation, one case may require multiple fixes. */
(function(){
 const $=id=>document.getElementById(id);
 const h=x=>erpEsc(x??'');
 const tags={time:'下单时间',product:'商品名称／型号',amount:'订单金额',order_number:'订单编号',
  duplicate_order:'订单号重复',return_status:'退货／异常状态',order_status:'订单状态',
  logistics:'物流单号',quantity:'商品数量'};
 const pretty=x=>tags[x]||x;
 const table=(headers,rows,empty='没有符合条件的记录')=>'<div class="erp-scroll"><table><thead><tr>'+
 headers.map(x=>'<th>'+h(x)+'</th>').join('')+'</tr></thead><tbody>'+
 (rows.length?rows.join(''):'<tr><td class="erp-empty" colspan="'+headers.length+'">'+h(empty)+'</td></tr>')+
 '</tbody></table></div>';
 const date=x=>x?String(x).replace('T',' ').slice(0,16):'待确认';
 function nameCell(x){return '<div class="v5-product-text">'+h(x.product_names||'商品名称待确认（源文件缺失）')+'</div>'+
  (x.original_sku_text?'<small class="v5-subline">原始 SKU：'+h(x.original_sku_text)+'</small>':'')+
  (x.product_name_source==='source_description'?'<small class="v5-subline">原始来源商品描述，尚未映射标准商品档案</small>':'');}
 function flags(fields){return (fields||[]).length?
  fields.map(f=>'<span class="v5-review-tag">'+h(pretty(f))+'</span>').join(''):
  '<span class="v5-review-tag">人工复核</span>';}
 async function assignment(row){
  let staff=[];try{staff=await authorized('/rest/v1/rpc/rfriend_erp_assignable_staff',{method:'POST',body:{}})}catch(e){}
  const roles=[['operations','运营'],['support','客服'],['finance','财务'],['warehouse','仓库'],['admin','管理员']];
  const m=erpModal('<p>订单：'+h(row.order_number)+' · 来源：'+h(row.source_file_id||'—')+
   (row.source_row?' / 行 '+h(row.source_row):'')+'</p>'+
   '<p><strong>具体需要核实：</strong>'+flags(row.fields_to_verify)+'</p>'+
   '<p><strong>商品：</strong>'+h(row.product_names)+'</p>'+
   '<form id="v5CaseForm"><div class="v5-fields">'+
   '<label>完整异常说明<textarea class="control" required minlength="8" maxlength="4000" name="anomaly" rows="4">'+
    h(row.anomaly_detail||row.notes||((row.fields_to_verify||[]).map(pretty).join('、')+'待核实'))+'</textarea></label>'+
   '<label>处理责任岗位<select class="control" name="role" required>'+roles.map(([id,label])=>
    '<option value="'+id+'" '+(row.assigned_role===id?'selected':'')+'>'+label+'</option>').join('')+'</select></label>'+
   '<label>具体负责人<select class="control" name="assignee"><option value="">按岗位待分派</option>'+
    staff.map(s=>'<option value="'+h(s.user_id)+'" data-role="'+h(s.role)+'" '+(row.assignee_id===s.user_id?'selected':'')+'>'+h(s.email)+' ['+h(s.role)+']</option>').join('')+
   '</select></label></div><div class="erp-actions" style="margin-top:15px"><button type="submit" class="primary">确认异常并流转给负责人</button></div>'+
   '<p id="v5CaseMsg"></p></form>','订单待确认事项 · '+row.order_number);
  m.querySelector('#v5CaseForm').onsubmit=async e=>{
   e.preventDefault();const o=Object.fromEntries(new FormData(e.target)),btn=e.target.querySelector('button'),msg=m.querySelector('#v5CaseMsg');
   if(o.assignee&&staff.find(s=>s.user_id===o.assignee)?.role!==o.role){msg.textContent='所选员工不属于此负责岗位';return}
   btn.disabled=true;
   try{
    await authorized('/rest/v1/rpc/rfriend_erp_assign_review_case',{method:'POST',body:{
     p_case_id:row.id,p_anomaly:o.anomaly,p_assigned_role:o.role,p_assignee:o.assignee||null}});
    for(const k of ['order_review_details_v5','review_queue','reconciliation_cases','work_tasks'])ERP_CACHE.delete(k);
    msg.style.color='#128257';msg.textContent='已记录异常内容，创建/更新负责人待办任务';
    setTimeout(()=>{m.remove();render()},300);
   }catch(err){msg.textContent=errorMessage(err);msg.style.color='#bd3737';btn.disabled=false}
  };
 }
 async function reviewPage(){
  el('content').innerHTML='<div class="erp-topline">订单数据质量 · 逐单明确待确认字段 / 关联商品名称 / 负责人流转</div>'+
   '<div class="message">异常分为下单时间、商品、金额、订单号、重复单、退货状态等。一条记录可以同时需要复核多个字段，页面显示源文件依据，不把缺失值自动补造成正确值。</div>'+
   '<div class="cards" id="v5ReviewMetrics"></div>'+
   '<div class="erp-toolbar"><input class="control" id="v5ReviewSearch" placeholder="查订单号 / 商品名称 / 原始 SKU / 源文件" style="min-width:285px">'+
    '<select class="control" id="v5ReviewField"><option value="">所有待核字段</option>'+
     Object.entries(tags).map(([k,label])=>'<option value="'+k+'">'+label+'</option>').join('')+'</select>'+
    '<select class="control" id="v5ReviewStatus"><option value="">全部状态</option><option value="open">待处理</option><option value="in_review">正在复核</option><option value="resolved">已处理</option></select>'+
    '<button class="btn" id="v5ReviewExport">↓ 导出复核清单</button></div>'+
   '<section class="panel"><h3>逐单异常核对清单</h3><div id="v5ReviewTable">加载中…</div></section>';
  try{
   const cases=await erpData('order_review_details_v5',true);
   if(!$('v5ReviewTable'))return;
   const byField=k=>cases.filter(c=>(c.fields_to_verify||[]).includes(k)).length;
   $('v5ReviewMetrics').innerHTML=erpMetric('需要复核',cases.filter(c=>['open','in_review'].includes(c.case_status)).length,'按异常记录')+
    erpMetric('金额异常',byField('amount'),'包括原始金额无效')+
    erpMetric('时间异常',byField('time'),'原始时间缺失／无效')+
    erpMetric('商品异常',byField('product'),'商品名称/SKU待确认');
   let filtered=cases;
   function draw(){
    const q=($('v5ReviewSearch')?.value||'').trim().toLowerCase(),f=$('v5ReviewField').value,status=$('v5ReviewStatus').value;
    filtered=cases.filter(x=>(!f||(x.fields_to_verify||[]).includes(f))&&(!status||x.case_status===status)&&
     (!q||[x.order_number,x.product_names,x.original_sku_text,x.source_file_id,x.issue_category,x.anomaly_detail].some(v=>String(v||'').toLowerCase().includes(q))));
    $('v5ReviewTable').innerHTML=table(['订单号 / 渠道','实际商品名称','需确认字段','金额 / 原始时间','异常详情 / 来源','状态 / 负责人','处理'],
     filtered.slice(0,500).map((x,i)=>'<tr><td>'+h(x.order_number)+'<small class="v5-subline">'+h(x.channel_code)+'</small></td>'+
      '<td>'+nameCell(x)+'</td><td class="v5-review-fields">'+flags(x.fields_to_verify)+'</td>'+
      '<td>'+h(x.source_amount_eur??'金额待确认')+' €<small class="v5-subline">'+h(x.source_date||'时间待确认')+'</small></td>'+
      '<td><div class="v5-product-text">'+h(x.anomaly_detail||x.notes||'未填写异常说明')+'</div>'+
      '<small class="v5-subline">'+h(x.source_file_id||'未知来源')+' / '+h(x.source_sheet||'')+' / 第'+h(x.source_row||'?')+'行</small></td>'+
      '<td>'+h(x.case_status)+'<small class="v5-subline">'+h(x.assigned_role||'未指派')+'</small></td>'+
      '<td>'+(['open','in_review'].includes(x.case_status)?'<button class="btn v5ReviewAction" data-i="'+i+'">核实 / 指派</button>':'—')+'</td></tr>'));
    $('v5ReviewTable').querySelectorAll('.v5ReviewAction').forEach(b=>b.onclick=()=>assignment(filtered[Number(b.dataset.i)]));
    if(filtered.length>500)$('v5ReviewTable').insertAdjacentHTML('beforeend','<p class="erp-mini">展示前500条，导出包含当前筛选全部 '+filtered.length+' 条。</p>');
   }
   for(const id of ['v5ReviewSearch','v5ReviewField','v5ReviewStatus'])$(id).addEventListener('input',draw);
   $('v5ReviewExport').onclick=()=>erpDownload('order-review-fields',filtered);
   draw();
  }catch(err){if($('v5ReviewTable'))$('v5ReviewTable').textContent='异常记录读取失败：'+errorMessage(err)}
 }
 async function ordersPage(){
  el('content').innerHTML='<div class="erp-topline">销售订单 · 商品名称 / 型号 / 颜色 / 内存及来源信息</div>'+
   '<div class="message">优先展示原始订单商品描述（包含套装赠品）。只有标准商品关联已核实的记录才显示标准名称；SKU、订单号和 IMEI 为辅助追踪字段，不能替代商品名称。</div>'+
   '<div class="erp-toolbar"><input class="control" id="v5OrderSearch" placeholder="搜索商品名称 / 订单号 / SKU / 渠道" style="min-width:290px">'+
    '<select class="control" id="v5OrderChannel"><option value="">全部渠道</option></select>'+
    '<button class="btn" id="v5OrderExport">↓ 导出订单和商品名称</button></div>'+
   '<section class="panel"><h3>历史订单明细</h3><div id="v5OrderSummary"></div><div id="v5OrderTable">读取中…</div></section>';
  try{
   const data=await erpData('order_products_v5',true);
   if(!$('v5OrderTable'))return;
   const channels=[...new Set(data.map(x=>x.channel_code).filter(Boolean))].sort();
   $('v5OrderChannel').insertAdjacentHTML('beforeend',channels.map(c=>'<option value="'+h(c)+'">'+h(c)+'</option>').join(''));
   let filtered=data;let page=0;
   function draw(){
    const q=($('v5OrderSearch')?.value||'').trim().toLowerCase(),channel=$('v5OrderChannel').value;
    filtered=data.filter(x=>(!channel||x.channel_code===channel)&&(!q||[x.external_order_id,x.channel_code,x.product_names,x.original_sku_text].some(v=>String(v||'').toLowerCase().includes(q))));
    const start=page*60;
    $('v5OrderSummary').innerHTML='<p class="erp-mini">当前筛选：'+filtered.length+' 单；商品名称来自订单商品档案或实际源文件。</p>';
    $('v5OrderTable').innerHTML=table(['下单时间','渠道','订单号','实际商品名称（含颜色/内存）','来源','订单金额','状态'],
     filtered.slice(start,start+60).map(x=>'<tr><td>'+h(date(x.ordered_at))+'</td><td>'+h(x.channel_code)+'</td>'+
      '<td>'+h(x.external_order_id)+'</td><td>'+nameCell(x)+'</td>'+
      '<td>'+h(x.product_name_source==='catalog'?'已匹配标准商品':x.product_name_source==='source_description'?'原始订单商品描述':'商品待确认')+'</td>'+
      '<td>'+h(x.total_eur??'待确认')+' €</td><td>'+h(x.order_status)+'</td></tr>'))+
      '<div class="erp-pagination"><button id="v5OrderPrev" class="btn" '+(page===0?'disabled':'')+'>上一页</button>'+
       '<span>第 '+(page+1)+' / '+Math.max(1,Math.ceil(filtered.length/60))+' 页</span>'+
       '<button id="v5OrderNext" class="btn" '+(start+60>=filtered.length?'disabled':'')+'>下一页</button></div>';
    $('v5OrderPrev').onclick=()=>{page--;draw()};
    $('v5OrderNext').onclick=()=>{page++;draw()};
   }
   $('v5OrderSearch').oninput=()=>{page=0;draw()};
   $('v5OrderChannel').onchange=()=>{page=0;draw()};
   $('v5OrderExport').onclick=()=>erpDownload('orders-with-real-product-names',filtered);
   draw();
  }catch(err){if($('v5OrderTable'))$('v5OrderTable').textContent='订单商品明细读取失败：'+errorMessage(err)}
 }
 window.erpV5OrderPage=async function(page){
  if(page==='intake'){await reviewPage();return true}
  if(page==='orders'){await ordersPage();return true}
  return false;
 };
})();