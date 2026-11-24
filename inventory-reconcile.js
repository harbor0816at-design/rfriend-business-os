'use strict';
/* Weekly stock reconciliation, source comparison and maker-checker adjustments. */
(function(){
 const $=id=>document.getElementById(id),esc=x=>erpEsc(x??'');
 let records=[],warehouseList=[],products=[],currentWeek='',lastStock=[],lastCount=[],lastReq=[];
 const weeks=()=>[...new Set(lastStock.map(x=>x.week_start))].sort().reverse();
 const k=(w,p,s)=>JSON.stringify([w,p,s]);
 const allowedWrite=()=>['admin','operations','warehouse'].includes(profile?.role);
 const allowedApprove=()=>['admin','operations'].includes(profile?.role);
 const selectOptions=(items,current)=>items.map(([v,n])=>'<option value="'+esc(v)+'"'+(String(current)===String(v)?' selected':'')+'>'+esc(n)+'</option>').join('');
 function formRow(label,control){return '<div class="erp-field"><label>'+esc(label)+'</label>'+control+'</div>'}
 const select=(name,options,required=false)=>'<select name="'+name+'" '+(required?'required':'')+'>'+selectOptions(options,'')+'</select>';
 const input=(name,type='text',required=false,extras='')=>'<input name="'+name+'" type="'+type+'" '+(required?'required':'')+' '+extras+'>';
 function closeAndRefresh(modal){modal.remove();for(const x of ['inventory_external_counts','inventory_adjustment_requests','inventory_weekly_snapshots','stock_balances','inventory_movements'])ERP_CACHE.delete(x);erpInventory();}
 function uploadWarehouseCSV(){
 const m=erpModal('<p>支持 CSV 按周导入 byrd / 0815 / 办公室 / 二手机仓或实盘的独立库存数量。'+
 '必须包含列：<code>warehouse_code,sku,quality_status,source,observed_qty,reference</code>；系统只保存核验数据，不直接调整 ERP 库存。</p>'+
 '<div class="erp-toolbar"><button id="invDownloadTemplate" class="btn">↓ 下载 CSV 模板</button></div>'+
 '<input type="file" id="invImportFile" accept=".csv,text/csv">'+
 '<div id="invImportPreview" style="margin-top:14px"></div>','批量导入仓库 / 实盘库存');
 m.querySelector('#invDownloadTemplate').onclick=()=>{
  const example='warehouse_code,sku,quality_status,source,observed_qty,reference\r\n0815,EXAMPLE_SKU,sellable,0815,5,weekly-warehouse-report';
  const blob=new Blob(['\ufeff'+example],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='rfriend-weekly-inventory-template.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),300);
 };
 m.querySelector('#invImportFile').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
   const parsed=erpCsvParse((await file.text()).replace(/^\ufeff/,''));
   const cols=parsed[0]?.map(x=>x.trim().toLowerCase())||[];
   const needed=['warehouse_code','sku','quality_status','source','observed_qty','reference'];
   const missing=needed.filter(k=>!cols.includes(k));
   if(missing.length)throw Error('缺少字段：'+missing.join(', '));
   if(parsed.length<2)throw Error('没有数据行');
   const wIndex=new Map(warehouseList.map(w=>[w.code.toLowerCase(),w.id]));
   const pIndex=new Map(products.map(p=>[p.sku.toLowerCase(),p.id]));
   const rows=[],errors=[];
   parsed.slice(1).forEach((values,i)=>{
    const raw=Object.fromEntries(cols.map((name,j)=>[name,String(values[j]||'').trim()]));
    const warehouse_id=wIndex.get(raw.warehouse_code.toLowerCase());
    const product_id=pIndex.get(raw.sku.toLowerCase());
    const qty=Number(raw.observed_qty);
    const valid=warehouse_id&&product_id&&['sellable','quarantine','repair','scrap','demo'].includes(raw.quality_status)&&
     ['byrd','0815','office','used','physical','other'].includes(raw.source)&&
     Number.isSafeInteger(qty)&&qty>=0;
    if(!valid)errors.push('第 '+(i+2)+' 行：仓库 / SKU / 状态 / 数量 / 来源不合法');
    else rows.push({warehouse_id,product_id,quality_status:raw.quality_status,source:raw.source,observed_qty:qty,reference:raw.reference||null});
   });
   // Do not silently apply duplicate count records; every key must have a single observation.
   const seen=new Set();
   for(const v of rows){const key=JSON.stringify([v.warehouse_id,v.product_id,v.quality_status,v.source]);if(seen.has(key))errors.push('CSV 中重复的仓库/SKU/状态/来源：'+key);seen.add(key)}
   const preview=m.querySelector('#invImportPreview');
   preview.innerHTML='<p>解析 '+(parsed.length-1)+' 行；有效 '+rows.length+' 行；错误 '+errors.length+' 行。</p>'+
    (errors.length?'<div class="erp-blocked">'+errors.slice(0,15).map(esc).join('<p>')+'</div>':'')+
    '<div class="erp-scroll"><table><thead><tr><th>仓库 ID</th><th>商品 ID</th><th>状态</th><th>来源</th><th>数量</th></tr></thead><tbody>'+
    rows.slice(0,10).map(x=>'<tr><td>'+esc(x.warehouse_id)+'</td><td>'+esc(x.product_id)+'</td><td>'+esc(x.quality_status)+'</td><td>'+esc(x.source)+'</td><td>'+x.observed_qty+'</td></tr>').join('')+
    '</tbody></table></div>'+
    (errors.length?'':'<div class="erp-actions" style="margin-top:14px"><button id="invConfirmImport" class="primary">确认批量提交本周核验</button></div><p id="invImportStatus"></p>');
   if(!errors.length)preview.querySelector('#invConfirmImport').onclick=async()=>{
    if(!confirm('确定提交 '+rows.length+' 条独立库存核验数据？本操作不会调整 ERP 库存。'))return;
    const btn=preview.querySelector('#invConfirmImport'),note=preview.querySelector('#invImportStatus');btn.disabled=true;
    let done=0;
    try{
     for(let i=0;i<rows.length;i+=100){
      const part=rows.slice(i,i+100);
      await authorized('/rest/v1/rpc/rfriend_erp_bulk_record_external_counts',{method:'POST',body:{p_rows:part}});
      done+=part.length;note.textContent='已导入 '+done+' / '+rows.length;
     }
     note.style.color='#128257';note.textContent='全部 '+done+' 条核验数据导入成功；正在重新核对差异…';
     setTimeout(()=>closeAndRefresh(m),600);
    }catch(err){note.style.color='#b03432';note.textContent='已提交 '+done+' 条，失败：'+errorMessage(err)+'。请核对后再导入。';btn.disabled=false;}
   };
  }catch(err){m.querySelector('#invImportPreview').textContent='CSV 读取失败：'+errorMessage(err)}
 };
}
function observableForm(target=null){
  if(!allowedWrite())return;
  const wOptions=warehouseList.map(x=>[x.id,x.name||x.code]);
  const pOptions=products.map(x=>[x.id,x.sku+' · '+x.name]);
  const quality=[['sellable','可售'],['quarantine','隔离'],['repair','维修'],['scrap','报废'],['demo','展示']];
  const srcs=[['physical','实物盘点'],['byrd','byrd 仓库反馈'],['0815','0815 仓库反馈'],['office','办公室反馈'],['used','二手机仓库反馈'],['other','其他独立来源']];
  const html='<div class="message warn">独立盘点/仓库反馈仅用于交叉核验，不自动调整 ERP 库存。请保留来源凭证。</div>'+
    '<form id="stockObserve"><div class="erp-fields">'+formRow('仓库',select('warehouse',wOptions,true))+
    formRow('SKU / 产品',select('product',pOptions,true))+
    formRow('质量状态',select('quality',quality,true))+
    formRow('独立数据来源',select('source',srcs,true))+
    formRow('核对数量',input('qty','number',true,'min="0" step="1"'))+
    formRow('仓库报表编号 / 盘点凭证',input('reference','text',false,'maxlength="500"'))+
    '</div><div class="erp-actions" style="margin-top:16px"><button type="submit" class="primary">保存本周核验数据</button></div><p id="stockObserveMessage"></p></form>';
  const m=erpModal(html,'库存交叉核验 · 录入独立来源');
  const form=m.querySelector('#stockObserve');
  if(target){form.elements.warehouse.value=target.warehouse_id;form.elements.product.value=target.product_id;form.elements.quality.value=target.quality_status}
  form.onsubmit=async e=>{
   e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),btn=form.querySelector('button'),note=m.querySelector('#stockObserveMessage');btn.disabled=true;
   try{
    await authorized('/rest/v1/rpc/rfriend_erp_record_external_count',{method:'POST',body:{
      p_warehouse_id:v.warehouse,p_product_id:v.product,p_quality_status:v.quality,p_source:v.source,
      p_observed_qty:Number(v.qty),p_reference:v.reference||null}});
    note.textContent='本周独立来源核验记录已保存';note.style.color='#128257';setTimeout(()=>closeAndRefresh(m),300);
   }catch(err){note.textContent=errorMessage(err);note.style.color='#b03432';btn.disabled=false}
  };
 }
 function adjustmentForm(target=null){
  if(!allowedWrite())return;
  const html='<div class="message warn">手工库存调整先生成申请，不直接改库存。需不同的管理员或运营人员审批；审核时服务器复查当前库存并记录调整流水。</div>'+
   '<form id="stockAdjust"><div class="erp-fields">'+
   formRow('仓库',select('warehouse',warehouseList.map(x=>[x.id,x.name||x.code]),true))+
   formRow('SKU',select('product',products.map(x=>[x.id,x.sku+' · '+x.name]),true))+
   formRow('质量状态',select('quality',[['sellable','可售'],['quarantine','隔离'],['repair','维修'],['scrap','报废'],['demo','展示']],true))+
   formRow('目标实际库存数量',input('target','number',true,'min="0" step="1"'))+
   formRow('调整原因（至少 8 个字符）',input('reason','text',true,'minlength="8" maxlength="2000"'))+
   formRow('盘点 / WMS 凭证',input('evidence','text',false,'maxlength="500"'))+
   '</div><div class="erp-actions" style="margin-top:16px"><button type="submit" class="primary">提交调整申请</button></div><p id="stockAdjustMsg"></p></form>';
  const m=erpModal(html,'手工库存调整申请');
  const form=m.querySelector('#stockAdjust');
  if(target){form.elements.warehouse.value=target.warehouse_id;form.elements.product.value=target.product_id;form.elements.quality.value=target.quality_status;form.elements.target.value=target.on_hand}
  form.onsubmit=async e=>{
   e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),btn=form.querySelector('button'),note=m.querySelector('#stockAdjustMsg');btn.disabled=true;
   try{
    const result=await authorized('/rest/v1/rpc/rfriend_erp_request_inventory_adjustment',{method:'POST',body:{
     p_warehouse_id:v.warehouse,p_product_id:v.product,p_quality_status:v.quality,p_target_qty:Number(v.target),
     p_reason:v.reason,p_evidence:v.evidence||null}});
    note.style.color='#128257';note.textContent='申请已登记：'+result.id+'，待其他授权人员审批。';
    setTimeout(()=>closeAndRefresh(m),450);
   }catch(err){note.style.color='#b03432';note.textContent=errorMessage(err);btn.disabled=false}
  };
 }
 async function review(req,approved){
  if(!allowedApprove()||!confirm('确认'+(approved?'批准':'拒绝')+'这笔库存调整？'+(approved?'批准后会实际修改 ERP 库存。':'')))return;
  try{
   await authorized('/rest/v1/rpc/rfriend_erp_review_inventory_adjustment',{method:'POST',body:{p_request_id:req.id,p_approve:approved}});
   for(const x of ['inventory_adjustment_requests','stock_balances','inventory_movements'])ERP_CACHE.delete(x);
   await erpInventory();
  }catch(e){alert('审核失败：'+errorMessage(e))}
 }
 const sourceLabel={byrd:'byrd', '0815':'0815',office:'办公室',physical:'实物盘点',used:'二手机仓',other:'其他独立来源'};
 function tableData(){
  const where=$('invWarehouse')?.value||'',skuSearch=($('invSku')?.value||'').toLowerCase(),quality=$('invQuality')?.value||'';
  const snap=lastStock.filter(x=>x.week_start===currentWeek);
  const observations=lastCount.filter(x=>x.week_start===currentWeek);
  const lookup=new Map(snap.map(x=>[k(x.warehouse_id,x.product_id,x.quality_status),x]));
  const obsMap=new Map();
  for(const o of observations){
   const key=k(o.warehouse_id,o.product_id,o.quality_status);
   if(!obsMap.has(key))obsMap.set(key,[]);obsMap.get(key).push(o);
  }
  const keys=new Set([...lookup.keys(),...obsMap.keys()]);
  const wh=new Map(warehouseList.map(x=>[x.id,x.name||x.code]));
  const pro=new Map(products.map(x=>[x.id,x]));
  const data=[];
  for(const key of keys){
   const [warehouse_id,product_id,quality_status]=JSON.parse(key);
   const p=pro.get(product_id)||{},arr=obsMap.get(key)||[],snapshot=lookup.get(key);
   const line={warehouse_id,product_id,quality_status,warehouse:wh.get(warehouse_id)||warehouse_id,
    sku:p.sku||'未知SKU',product:p.product_name||'—',model:p.model||'待核',color:p.color||'待核',storage:p.storage_version||'待核',on_hand:snapshot?.erp_on_hand??0,reserved:snapshot?.erp_reserved??0,
    captured_at:snapshot?.captured_at||null};
   for(const o of arr.length?arr:[null])data.push({...line,source:o?.source||'',external_qty:o?.observed_qty??null,
    observed_at:o?.observed_at||null,delta:o?o.observed_qty-line.on_hand:null,reference:o?.reference||''});
  }
  return data.filter(o=>(!where||o.warehouse_id===where)&&(!quality||o.quality_status===quality)&&
   (!skuSearch||(o.sku+' '+o.product+' '+o.model+' '+o.color+' '+o.storage).toLowerCase().includes(skuSearch)))
   .sort((a,b)=>a.warehouse.localeCompare(b.warehouse)||a.sku.localeCompare(b.sku)||a.source.localeCompare(b.source));
 }
 function draw(){
  const data=tableData(),stockRows=new Set(data.map(x=>k(x.warehouse_id,x.product_id,x.quality_status)));
  const checked=new Set(data.filter(x=>x.external_qty!==null).map(x=>k(x.warehouse_id,x.product_id,x.quality_status)));
  const mismatches=data.filter(x=>x.delta!==null&&x.delta!==0),unverified=[...stockRows].filter(x=>!checked.has(x));
  const qty=data.filter(x=>x.source==='').reduce((a,x)=>a+x.on_hand,0)+
   data.filter(x=>x.source).filter((x,i,arr)=>arr.findIndex(y=>k(y.warehouse_id,y.product_id,y.quality_status)===k(x.warehouse_id,x.product_id,x.quality_status))===i)
   .filter(x=>!data.some(y=>k(y.warehouse_id,y.product_id,y.quality_status)===k(x.warehouse_id,x.product_id,x.quality_status)&&y.source==='')).reduce((a,x)=>a+x.on_hand,0);
  $('inventoryMetrics').innerHTML=erpMetric('本周 ERP 库存',qty.toLocaleString('de-AT'),'当前筛选的周快照（件）')+
    erpMetric('已独立核验',checked.size.toLocaleString('de-AT')+'/'+stockRows.size.toLocaleString('de-AT'),'按仓库 × SKU × 质量状态')+
    erpMetric('发现差异',mismatches.length.toLocaleString('de-AT'),'不同来源差异记录')+
    erpMetric('待盘点项',unverified.length.toLocaleString('de-AT'),'尚无独立来源');
  const body=data.slice(0,500).map((o,i)=>'<tr><td>'+esc(o.warehouse)+'</td><td>'+esc(o.sku)+'</td><td>'+esc(o.quality_status)+'</td>'+
    '<td>'+esc(o.product)+'</td><td>'+esc(o.model)+'</td><td>'+esc(o.color)+'</td><td>'+esc(o.storage)+'</td><td>'+o.on_hand+'</td><td>'+o.reserved+'</td><td>'+esc(sourceLabel[o.source]||'未核验')+'</td>'+
    '<td>'+(o.external_qty===null?'—':o.external_qty)+'</td><td class="'+(o.delta!==null&&o.delta!==0?'erp-negative':'')+'">'+
    (o.delta===null?'待核验':o.delta===0?'一致':(o.delta>0?'+':'')+o.delta)+'</td>'+
    '<td class="erp-actions">'+(allowedWrite()?'<button class="btn invRecord" data-index="'+i+'">核验</button><button class="btn invAdjust" data-index="'+i+'">调整</button>':'—')+'</td></tr>').join('');
  $('inventoryResults').innerHTML='<div class="erp-scroll"><table><thead><tr>'+
   ['仓库','SKU','质量状态','商品名称','型号','颜色','内存版本','ERP 快照','预留','独立来源','来源数量','差额','操作'].map(x=>'<th>'+x+'</th>').join('')+
   '</tr></thead><tbody>'+(body||'<tr><td colspan="13" class="erp-empty">本周无库存快照或不符合筛选条件</td></tr>')+
   '</tbody></table></div><div class="erp-mini">共 '+data.length+' 条对账记录；页面显示前 500 条，可导出完整结果。</div>';
  $('inventoryResults').querySelectorAll('.invRecord').forEach(btn=>btn.onclick=()=>observableForm(data[Number(btn.dataset.index)]));
  $('inventoryResults').querySelectorAll('.invAdjust').forEach(btn=>btn.onclick=()=>adjustmentForm(data[Number(btn.dataset.index)]));
  $('inventoryExport').onclick=()=>erpDownload('weekly-stock-reconciliation-'+currentWeek,data);
  const pending=lastReq.filter(x=>x.request_status==='pending');
  $('inventoryRequests').innerHTML='<div class="erp-scroll"><table><thead><tr><th>提交时间</th><th>仓库</th><th>SKU</th><th>状态</th><th>原值 → 目标</th><th>原因</th><th>操作</th></tr></thead><tbody>'+
   (pending.length?pending.map(x=>'<tr><td>'+esc(x.requested_at?.slice(0,16))+'</td><td>'+
    esc(warehouseList.find(w=>w.id===x.warehouse_id)?.name||'—')+'</td><td>'+
    esc(products.find(p=>p.id===x.product_id)?.sku||'—')+'</td><td>待审批</td><td>'+x.expected_on_hand+' → '+x.target_on_hand+
    '</td><td>'+esc(x.reason)+'</td><td>'+ (allowedApprove()?'<button class="btn invReview" data-id="'+esc(x.id)+'" data-action="approve">批准</button>'+
    '<button class="btn invReview" data-id="'+esc(x.id)+'" data-action="reject">拒绝</button>':'等待财务/运营审核')+'</td></tr>').join(''):'<tr><td colspan="7" class="erp-empty">无待审批调整</td></tr>')+'</tbody></table></div>';
  $('inventoryRequests').querySelectorAll('.invReview').forEach(btn=>btn.onclick=()=>{const row=pending.find(x=>x.id===btn.dataset.id);if(row)review(row,btn.dataset.action==='approve')});
  const totals=weeks().slice(0,8).map(week=>{
   const rows=lastStock.filter(x=>x.week_start===week);
   return '<tr><td>'+esc(week)+'</td><td>'+rows.length+'</td><td>'+rows.reduce((a,x)=>a+Number(x.erp_on_hand||0),0).toLocaleString('de-AT')+
   '</td><td>'+esc(rows[0]?.captured_at?.slice(0,16)||'—')+'</td></tr>';
  }).join('');
  $('inventoryTrend').innerHTML='<div class="erp-scroll"><table><thead><tr><th>周一日期</th><th>库存行</th><th>ERP 快照总数量</th><th>最后捕获</th></tr></thead><tbody>'+
  (totals||'<tr><td colspan="4">暂无周快照</td></tr>')+'</tbody></table></div>';
 }
 window.erpInventory=async function(){
  $('content').innerHTML='<div class="erp-topline">库存 · 多来源核验 / 差异追踪 / 周滚动快照 / 手工调整审批</div>'+
   '<div class="message">每周一自动截取 ERP 库存快照。核验须录入仓库反馈或实物盘点，缺少独立来源的记录显示“待核验”；调整必须由其他授权人员审批后才影响库存。</div>'+
   '<div class="cards" id="inventoryMetrics"></div>'+
   '<section class="panel"><div class="erp-header"><h3>库存交叉核验</h3><div class="erp-actions">'+
   (allowedWrite()?'<button class="btn" id="inventoryRefresh">↻ 重新捕获本周库存</button><button class="btn" id="inventoryObserve">＋ 录入盘点 / WMS 反馈</button><button class="btn" id="inventoryImport">⇪ 批量导入 WMS/实盘 CSV</button><button class="btn primary" id="inventoryAdjust">＋ 手工库存调整</button>':'')+
   '<button class="btn" id="inventoryExport">↓ 导出差异报表</button></div></div>'+
   '<div class="erp-toolbar" id="inventoryFilters">正在读取库存…</div><div id="inventoryResults"></div></section>'+
   '<div class="erp-grid"><section class="panel"><h3>本周待审批库存调整</h3><div id="inventoryRequests"></div></section>'+
   '<section class="panel"><h3>库存周度滚动快照（最近 8 周）</h3><div id="inventoryTrend"></div></section></div>';
  try{
   [lastStock,lastCount,lastReq,warehouseList,products]=await Promise.all([
    erpData('inventory_weekly_snapshots',true),erpData('inventory_external_counts',true),
    erpData('inventory_adjustment_requests',true),erpData('warehouses'),erpData('product_catalog')]);
   if(!$('inventoryFilters'))return;
   currentWeek=currentWeek&&weeks().includes(currentWeek)?currentWeek:weeks()[0]||'';
   $('inventoryFilters').innerHTML='<label>库存周次 <select id="invWeek" class="control">'+
    selectOptions(weeks().map(v=>[v,v]),currentWeek)+'</select></label>'+
    '<label>仓库 <select id="invWarehouse" class="control">'+selectOptions([['','全部仓库'],...warehouseList.map(x=>[x.id,x.name])],'')+'</select></label>'+
    '<label>质量 <select id="invQuality" class="control">'+selectOptions([['','全部'],['sellable','可售'],['quarantine','隔离'],['repair','维修'],['scrap','报废'],['demo','展示']],'')+'</select></label>'+
    '<label>搜索 SKU <input id="invSku" class="control" placeholder="SKU / 型号"></label>';
   $('invWeek').onchange=e=>{currentWeek=e.target.value;draw()};
   for(const id of ['invWarehouse','invQuality'])$(id).onchange=draw;
   $('invSku').oninput=draw;
   $('inventoryObserve')?.addEventListener('click',()=>observableForm());
   $('inventoryImport')?.addEventListener('click',uploadWarehouseCSV);
   $('inventoryAdjust')?.addEventListener('click',()=>adjustmentForm());
   $('inventoryRefresh')?.addEventListener('click',async()=>{
    try{await authorized('/rest/v1/rpc/rfriend_erp_refresh_weekly_inventory',{method:'POST',body:{}});ERP_CACHE.delete('inventory_weekly_snapshots');await erpInventory()}
    catch(err){alert('库存快照刷新失败：'+errorMessage(err))}
   });
   draw();
  }catch(err){if($('inventoryResults'))$('inventoryResults').innerHTML='<div class="erp-blocked">库存接口错误：'+esc(errorMessage(err))+'</div>'}
 };
 const parentRender=window.erpRenderPage;
 window.erpRenderPage=async function(){
  if(profile&&erpSelectedPage==='inventory'){
   erpRenderNav();$('heading').textContent=erpTitle('inventory');
   if($('subtitle'))$('subtitle').textContent='多仓库存 / 周滚动核验 / 库存调整';
   await erpInventory();return;
  }
  return parentRender();
 };
})();
