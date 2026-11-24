'use strict';
/* Rfriend Business OS v4 business extensions: approved v3 visual language is preserved.
 Server-side role gates remain authoritative; this layer never edits stock or performs payment refunds directly. */
(function(){
 const $=id=>document.getElementById(id),h=x=>erpEsc(x??''), role=()=>profile?.role||'';
 let staff=[],lastData={};
 const forms={
  input:(name,label,type='text',required=true,value='')=>'<label class="erp-field">'+h(label)+
   '<input class="control" name="'+name+'" type="'+type+'" '+(required?'required':'')+' value="'+h(value)+'"></label>',
  select:(name,label,items,required=true,value='')=>'<label class="erp-field">'+h(label)+'<select class="control" name="'+name+'" '+(required?'required':'')+'>'+
   items.map(([key,title])=>'<option value="'+h(key)+'"'+(value===key?' selected':'')+'>'+h(title)+'</option>').join('')+
   '</select></label>'
 };
 const names={
  presales:'售前',aftersales:'售后',quality:'品质问题',complaint:'投诉',
  whatsapp:'WhatsApp',email:'邮件',phone:'电话',internal:'内部',new:'新建',
  assigned:'已指派',in_progress:'处理中',waiting_customer:'等待客户',resolved:'已解决',closed:'已关闭'
 };
 const cn=x=>names[x]||x||'—';
 function bar(title,right='',note=''){
  return '<div class="erp-topline">生产业务数据 · '+h(title)+'</div>'+
   (note?'<div class="message">'+h(note)+'</div>':'')+
   '<div class="erp-toolbar">'+right+'</div>';
 }
 function table(headers,rows,empty='没有符合条件的记录'){
  return '<div class="erp-scroll"><table><thead><tr>'+headers.map(x=>'<th>'+h(x)+'</th>').join('')+'</tr></thead><tbody>'+
   (rows.length?rows.join(''):'<tr><td class="erp-empty" colspan="'+headers.length+'">'+h(empty)+'</td></tr>')+'</tbody></table></div>';
 }
 function modalForm(title,body,handler){
  const m=erpModal('<form id="v4Form"><div class="erp-fields">'+body+'</div><div class="erp-actions" style="margin-top:18px">'+
   '<button type="submit" class="primary">确认保存</button></div><p id="v4Feedback"></p></form>',title);
  m.querySelector('form').onsubmit=async e=>{
   e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));
   const btn=m.querySelector('[type=submit]'),out=m.querySelector('#v4Feedback');btn.disabled=true;
   try{await handler(values);out.style.color='#128257';out.textContent='已保存到 ERP 正式数据库';
    setTimeout(()=>{m.remove();render()},250);
   }catch(err){out.style.color='#b03432';out.textContent=errorMessage(err);btn.disabled=false}
  };
  return m;
 }
 async function staffList(){
  try{staff=await authorized('/rest/v1/rpc/rfriend_erp_assignable_staff',{method:'POST',body:{}});return staff}
  catch(e){staff=[];return []}
 }
 const staffOptions=(filter=null)=>[['','未指定'],...staff.filter(x=>!filter||filter.includes(x.role)).map(x=>[x.user_id,x.email+' · '+x.role])];
 const staffName=id=>staff.find(x=>x.user_id===id)?.email|| (id?'员工 '+String(id).slice(0,8):'未指派');
 async function saveViaRpc(name,body,cache){
  await authorized('/rest/v1/rpc/'+name,{method:'POST',body});
  for(const k of cache||[])ERP_CACHE.delete(k);
 }
 function productEditor(p){
  const values=[
   forms.input('sku','SKU', 'text',true,p?.sku||''),
   forms.input('name','产品名称','text',true,p?.product_name||''),
   forms.input('model','型号（例如 Find X10 Pro Max）','text',true,p?.model==='待核'?'':p?.model||''),
   forms.input('color','颜色','text',true,p?.color==='待核'?'':p?.color||''),
   forms.input('storage','内存版本（例如 12GB + 512GB）','text',true,p?.storage_version==='待核'?'':p?.storage_version||''),
   forms.select('category','品类',[['phone','手机'],['tablet','平板'],['wearable','智能穿戴'],['audio','耳机'],['accessory','配件']])
  ];
  const m=modalForm(p?'编辑商品档案':'新增 OPPO 商品',values.join(''),async v=>{
   if(p){
    await saveViaRpc('rfriend_erp_upsert_product_details',{
     p_product_id:p.id,p_name:v.name,p_brand:'OPPO',p_model:v.model,p_color:v.color,p_storage_version:v.storage
    },['products','product_catalog','inventory_v4','purchase_lines_details']);
   }else{
    await saveViaRpc('rfriend_erp_create_product_v4',{
     p_sku:v.sku,p_name:v.name,p_model:v.model,p_color:v.color,p_storage_version:v.storage,p_category:v.category
    },['products','product_catalog','inventory_v4']);
   }
  });
  if(p){m.querySelector('[name=sku]').disabled=true;}
 }
 async function productPage(){
  $('content').innerHTML=bar('OPPO 产品主数据',
   ['admin','operations'].includes(role())?'<button id="v4NewProduct" class="btn primary">＋ 新增 OPPO 商品</button>':'',
   '产品以 SKU 区分具体型号、颜色与内存版本；历史资料不足的字段显示“待核”，不自动猜测。')+
   '<section class="panel"><h3>商品档案 · 型号 / 颜色 / 内存</h3><div id="v4List">读取中…</div></section>';
  try{
   const data=await erpData('product_catalog',true);if(!$('v4List'))return;lastData.products=data;
   $('v4List').innerHTML=table(['SKU','产品名称','品牌','型号','颜色','内存版本','品类','操作'],
    data.map((p,i)=>'<tr><td>'+h(p.sku)+'</td><td>'+h(p.product_name)+'</td><td>'+h(p.brand)+'</td>'+
    '<td>'+h(p.model)+'</td><td>'+h(p.color)+'</td><td>'+h(p.storage_version)+'</td><td>'+h(p.category)+'</td>'+
    '<td>'+(['admin','operations'].includes(role())?'<button class="btn v4EditProduct" data-i="'+i+'">维护字段</button>':'只读')+'</td></tr>'));
   $('v4List').querySelectorAll('.v4EditProduct').forEach(b=>b.onclick=()=>productEditor(data[Number(b.dataset.i)]));
   $('v4NewProduct')?.addEventListener('click',()=>productEditor());
  }catch(e){if($('v4List'))$('v4List').textContent='数据读取失败：'+errorMessage(e)}
 }
 function addPurchaseLine(po,products){
  const options=products.filter(p=>p.model!=='待核'&&p.color!=='待核'&&p.brand==='OPPO')
    .map(p=>[p.id,p.product_name+' | '+p.model+' | '+p.color+' | '+p.storage_version+' | '+p.sku]);
  if(!options.length){alert('先在商品管理补齐型号、颜色和内存版本，才能创建采购明细。');return}
  modalForm('新增采购商品行 · '+po.po_number,[
   forms.select('product','型号 / 颜色 / 内存 / SKU',options),
   forms.input('qty','采购数量','number'),
   forms.input('eta','预计入库日期','date'),
   forms.input('cost','单价 EUR','number',true,'0')
  ].join(''),async v=>{
   if(!Number.isInteger(Number(v.qty))||Number(v.qty)<1)throw Error('采购数量必须是正整数');
   await saveViaRpc('rfriend_erp_purchase_add_line_v2',{
    p_po_id:po.id,p_product_id:v.product,p_quantity:Number(v.qty),
    p_expected_arrival_at:v.eta,p_unit_cost_eur:Number(v.cost)
   },['purchase_lines_details','purchase_items','purchase_orders']);
  });
 }
 async function purchasePage(){
  $('content').innerHTML=bar('采购管理',
    ['admin','operations','finance'].includes(role())?'<button class="btn primary" id="v4NewPO">＋ 创建采购单</button>':'',
    '每条采购明细必须有型号、颜色、内存版本、采购数量和预计入库时间。预计时间不代表已经收货。')+
    '<section class="panel"><h3>采购订单</h3><div id="v4PO">读取中…</div></section>'+
    '<section class="panel"><h3>采购明细与预计入库日期</h3><div id="v4POLines">读取中…</div></section>';
  try{
   const [pos,items,products]=await Promise.all(['purchase_orders','purchase_lines_details','product_catalog'].map(x=>erpData(x,true)));
   if(!$('v4PO'))return;
   $('v4PO').innerHTML=table(['采购单','供应商','状态','创建日期','操作'],
    pos.map((po,i)=>'<tr><td>'+h(po.po_number)+'</td><td>'+h(po.supplier)+'</td><td>'+h(po.status)+'</td><td>'+h(erpDate(po.created_at))+'</td>'+
     '<td>'+(po.status==='draft'&&['admin','operations','finance'].includes(role())?
     '<button class="btn v4AddLine" data-i="'+i+'">＋ 添加型号</button>':'—')+'</td></tr>'));
   $('v4POLines').innerHTML=table(['采购单','SKU','商品名称','型号','颜色','内存版本','数量','已收货','预计入库'],
    items.map(x=>'<tr><td>'+h(x.po_number)+'</td><td>'+h(x.sku)+'</td><td>'+h(x.product_name)+'</td>'+
     '<td>'+h(x.model||'待核')+'</td><td>'+h(x.color||'待核')+'</td><td>'+h(x.storage_version||'待核')+'</td>'+
     '<td>'+h(x.quantity)+'</td><td>'+h(x.received_quantity)+'</td><td>'+h(x.expected_arrival_at||'未设置')+'</td></tr>'));
   $('v4PO').querySelectorAll('.v4AddLine').forEach(btn=>btn.onclick=()=>addPurchaseLine(pos[Number(btn.dataset.i)],products));
   $('v4NewPO')?.addEventListener('click',()=>erpOpenCreate('purchase_orders'));
  }catch(e){if($('v4PO'))$('v4PO').textContent='采购记录读取失败：'+errorMessage(e)}
 }
 async function createTicket(){
  await staffList();
  modalForm('创建售前／售后／投诉工单',[
   forms.input('title','工单标题'),
   forms.select('source','客诉来源',[['whatsapp','WhatsApp'],['email','邮件'],['phone','电话'],['internal','内部反馈']]),
   forms.select('type','类型',[['presales','售前'],['aftersales','售后'],['quality','品质问题'],['complaint','投诉']]),
   forms.input('name','消费者姓名'),
   forms.input('phone','联系电话','tel',false),
   forms.input('email','电子邮箱','email',false),
   forms.select('assignee','负责人',staffOptions(['admin','operations','support']),false),
   forms.input('order','关联订单 UUID（可选）','text',false),
   '<label class="erp-field wide">客诉内容<textarea class="control" name="description" rows="4" maxlength="10000"></textarea></label>'
  ].join(''),async v=>{
   if(!v.phone&&!v.email)throw Error('电话或邮箱必须至少填写一项');
   await saveViaRpc('rfriend_erp_create_ticket_v2',{
    p_title:v.title,p_source:v.source,p_complaint_type:v.type,p_contact_name:v.name,
    p_contact_phone:v.phone||null,p_contact_email:v.email||null,p_description:v.description,
    p_assignee:v.assignee||null,p_order_id:v.order||null
   },['tickets','tickets_sla','ticket_events','ticket_sla_alerts']);
  });
 }
 function ticketAge(t){
  if(t.status==='closed'||t.status==='resolved')return '<span class="erp-tag">已关闭</span>';
  const hrs=Number(t.open_hours||0);
  const badge=hrs>=72?'erp-sla-high':hrs>=48?'erp-sla-medium':hrs>=24?'erp-sla-low':'';
  const tier=hrs>=24?Math.floor(hrs/24)*24+'h 逾期':'<24h';
  return '<span class="erp-sla '+badge+'">'+h(tier)+'</span>';
 }
 function ticketAssign(t){
  modalForm('指派客服负责人 · '+t.ticket_number,
   forms.select('assignee','处理负责人',staffOptions(['admin','operations','support']).filter(x=>x[0]),true,t.assignee_id||''),
   async v=>saveViaRpc('rfriend_erp_assign_ticket',{p_ticket_id:t.id,p_assignee:v.assignee},['tickets_sla','tickets']));
 }
 async function supportPage(){
  $('content').innerHTML=bar('客服与售后工单',
   '<button id="v4NewTicket" class="btn primary">＋ 创建工单</button>',
   '24小时预警、48小时升级、72小时严重逾期，之后按96/120小时持续递增。计时从建单时间起；已关闭工单不累计。')+
   '<div class="cards" id="v4TicketStats"></div><section class="panel">'+
   '<div class="erp-header"><h3>客服工单与 SLA 预警</h3><div class="erp-toolbar"><select id="v4TicketFilter"><option value="all">全部工单</option>'+
   '<option value="24">超时 ≥24小时</option><option value="48">超时 ≥48小时</option><option value="72">超时 ≥72小时</option>'+
   '<option value="open">全部未完结</option></select></div></div><div id="v4TicketList">读取中…</div></section>'+ 
   '<section class="panel"><h3>自动超时提醒记录（24小时、48小时、72小时及后续每日）</h3><div id="v4TicketAlerts">读取中…</div></section>';
  try{
   const [list]=await Promise.all([erpData('tickets_sla',true),staffList()]);
   if(!$('v4TicketList'))return;
   lastData.tickets=list;
   const open=list.filter(x=>!['closed','resolved'].includes(x.status));
   $('v4TicketStats').innerHTML=erpMetric('全部工单',list.length,'历史工单')+
    erpMetric('未完结',open.length,'需要跟进')+
    erpMetric('超过24小时',open.filter(x=>x.open_hours>=24).length,'持续叠加预警')+
    erpMetric('超过72小时',open.filter(x=>x.open_hours>=72).length,'严重逾期');
   const draw=()=>{
    const filter=$('v4TicketFilter')?.value||'all';
    const rows=list.filter(x=>filter==='all'||filter==='open'&&!['closed','resolved'].includes(x.status)||
       /^(24|48|72)$/.test(filter)&&!['closed','resolved'].includes(x.status)&&x.open_hours>=Number(filter));
    $('v4TicketList').innerHTML=table(['建单时间','编号/标题','来源/类型','消费者','联系方式','负责人','状态','逾期提醒','操作'],
     rows.map((t,i)=>'<tr><td>'+h(erpDate(t.created_at))+'</td><td>'+h(t.ticket_number)+'<div>'+h(t.title)+'</div></td>'+
     '<td>'+h(cn(t.source))+' / '+h(cn(t.complaint_type))+'</td>'+
     '<td>'+h(t.contact_name||'待补')+'</td><td>'+h(t.contact_phone||t.contact_email||'待补')+'</td>'+
     '<td>'+h(staffName(t.assignee_id))+'</td><td>'+h(cn(t.status))+'</td><td>'+ticketAge(t)+'</td>'+
     '<td><button class="btn v4TicketAssign" data-id="'+h(t.id)+'">指派</button></td></tr>'));
    $('v4TicketList').querySelectorAll('.v4TicketAssign').forEach(btn=>btn.onclick=()=>ticketAssign(list.find(t=>t.id===btn.dataset.id)));
   };
   $('v4TicketFilter').onchange=draw;draw();$('v4NewTicket').onclick=createTicket;
   try{
    const alerts=await erpData('ticket_sla_alerts',true);
    const openSet=new Set(open.map(x=>x.id));
    if($('v4TicketAlerts'))$('v4TicketAlerts').innerHTML=table(['预警触发时间','工单','逾期节点','负责人','工单状态'],
     alerts.filter(a=>openSet.has(a.ticket_id)).sort((a,b)=>String(b.triggered_at).localeCompare(String(a.triggered_at))).slice(0,100)
     .map(a=>'<tr><td>'+h(erpDate(a.triggered_at))+'</td><td>'+h(a.ticket_number)+'</td>'+
      '<td><span class="erp-sla erp-sla-high">'+h(a.threshold_hours)+' 小时</span></td><td>'+h(staffName(a.assignee_id))+
      '</td><td>'+h(cn(a.status))+'</td></tr>'),'暂无超时预警');
   }catch(err){if($('v4TicketAlerts'))$('v4TicketAlerts').textContent='提醒数据不可读取：'+errorMessage(err)}
   
  }catch(e){if($('v4TicketList'))$('v4TicketList').textContent='工单接口错误：'+errorMessage(e)}
 }
 function caseAssign(row){
  modalForm('订单异常复核指派',[
   forms.input('order','订单号（只读）','text',false,row.external_order_id||row.source_file_id||''),
   '<label class="erp-field wide">异常内容<textarea class="control" name="anomaly" required minlength="8" maxlength="4000" rows="4">'+h(row.anomaly_detail||row.notes||'')+'</textarea></label>',
   forms.select('role','分派至岗位',[['operations','运营'],['support','客服'],['finance','财务'],['warehouse','仓库'],['admin','管理员']]),
   forms.select('assignee','具体负责人（可选）',staffOptions(),false)
  ].join(''),async v=>{
   if(v.assignee&&staff.find(x=>x.user_id===v.assignee)?.role!==v.role)throw Error('员工岗位与选择的负责岗位不一致');
   await saveViaRpc('rfriend_erp_assign_review_case',{
    p_case_id:row.id,p_anomaly:v.anomaly,p_assigned_role:v.role,p_assignee:v.assignee||null
   },['review_queue','reconciliation_cases','work_tasks']);
  });
 }
 async function reviewPage(){
  $('content').innerHTML=bar('订单导入与复核',
   '<button class="btn" id="v4SourceRecord">查看原始导入记录</button>',
   '复核必须明确记录异常内容，指定负责岗位，可进一步指定具体员工；流转后自动生成工作台跟进任务。')+
   '<section class="panel"><h3>异常复核队列 · 每条均可查看来源和异常原因</h3><div id="v4ReviewList">读取中…</div></section>';
  try{
   const [records]=await Promise.all([erpData('review_queue',true),staffList()]);
   if(!$('v4ReviewList'))return;
   $('v4ReviewList').innerHTML=table(['订单号','来源文件/行','异常类型','异常内容','严重性','状态','责任人','流转'],
    records.slice(0,600).map((c,i)=>'<tr><td>'+h(c.external_order_id||'待关联')+'</td><td>'+h(c.source_file_id||'—')+
      ':'+h(c.source_row||'—')+'</td><td>'+h(c.issue_category)+'</td><td class="v4-anomaly">'+h(c.anomaly_detail||'待补异常')+'</td>'+
      '<td>'+h(c.severity)+'</td><td>'+h(c.case_status)+'</td><td>'+h(staffName(c.assignee_id)||c.assigned_role||'未指派')+'</td>'+
      '<td>'+(c.case_status==='open'||c.case_status==='in_review'?'<button class="btn v4CaseRoute" data-i="'+i+'">复核/分派</button>':'—')+'</td></tr>'));
   $('v4ReviewList').querySelectorAll('.v4CaseRoute').forEach(btn=>btn.onclick=()=>caseAssign(records[Number(btn.dataset.i)]));
   $('v4SourceRecord').onclick=()=>{erpTab='order_source_records';erpRenderModule()};
  }catch(e){if($('v4ReviewList'))$('v4ReviewList').textContent='订单复核接口失败：'+errorMessage(e)}
 }
 async function returnsPage(){
  $('content').innerHTML=bar('退换货与 OPPO 二手机',
   '<button id="v4NewReturn" class="btn primary">＋ 新建退货／换货申请</button>',
   '退货质检确认合格后，只有原订单、单件数量、OPPO 品牌和 IMEI 可追溯的记录才自动转入二手机仓；不符合条件保持待核，不会重复入库。')+
   '<div class="cards" id="v4ReturnStats"></div>'+
   '<section class="panel"><h3>退货 / 换货 / 退款处理</h3><div id="v4ReturnsList">读取中…</div></section>'+
   '<section class="panel"><h3>OPPO 二手机库存（退货流转后入账）</h3><div id="v4UsedList">读取中…</div></section>';
  try{
   const [returns,used,refunds]=await Promise.all(['returns_v4','used_devices','refunds'].map(k=>erpData(k,true)));
   if(!$('v4ReturnsList'))return;
   $('v4ReturnStats').innerHTML=erpMetric('退换货申请',returns.length,'按 RMA 单据')+
    erpMetric('已流转二手机',returns.filter(x=>x.used_transfer_status==='transferred').length,'满足全部质检与串码条件')+
    erpMetric('二手机台账',used.length,'按设备 IMEI')+
    erpMetric('退款申请',refunds.length,'真实 ERP 退款台账');
   $('v4ReturnsList').innerHTML=table(['退货单','关联订单','类型','退货状态','质检','二手机流转','退款状态','明细行','操作'],
    returns.map((r,i)=>'<tr><td>'+h(r.rma_number)+'</td><td>'+h(r.external_order_id)+'</td><td>'+h(r.type)+'</td>'+
     '<td>'+h(r.return_status)+'</td><td>'+h(r.inspection_status)+'</td><td>'+h(r.used_transfer_status)+'</td>'+
     '<td>'+h(r.refund_status)+'</td><td>'+r.item_lines+'</td>'+
     '<td>'+(['admin','operations','warehouse'].includes(role())?
      '<button class="btn v4InspectReturn" data-i="'+i+'">质检</button> <button class="btn v4FinalizeReturn" data-i="'+i+'">验证流转</button>':'只读')+'</td></tr>'));
   $('v4UsedList').innerHTML=table(['IMEI','品牌','型号','颜色','内存','等级','状态','来源'],
    used.filter(x=>String(x.brand).toUpperCase()==='OPPO').map(x=>'<tr><td>'+h(x.imei)+'</td><td>'+h(x.brand)+'</td><td>'+h(x.model)+'</td>'+
    '<td>'+h(x.color||'待核')+'</td><td>'+h(x.storage_variant||'待核')+'</td><td>'+h(x.grade)+'</td>'+
    '<td>'+h(x.status)+'</td><td>'+h(x.acquisition_source||'—')+'</td></tr>'));
   $('v4ReturnsList').querySelectorAll('.v4InspectReturn').forEach(btn=>btn.onclick=()=>{
    const row=returns[Number(btn.dataset.i)];
    if(!['received','inspection'].includes(row.return_status)){alert('请先将退货状态流转到 received / inspection，才能质检。');return}
    modalForm('OPPO 退货质检 · '+row.rma_number,[
     forms.select('result','质检结果',[['sellable','确认合格'],['repair','需维修'],['scrap','报废'],['disputed','有争议']]),
     '<label class="erp-field wide">质检说明<textarea class="control" name="notes" maxlength="4000" rows="4"></textarea></label>'
    ].join(''),async v=>{
     await saveViaRpc('rfriend_erp_inspect_return',{
       p_return_id:row.id,p_result:v.result,p_notes:v.notes||null
     },['returns_v4','returns','used_devices']);
    });
   });
   $('v4ReturnsList').querySelectorAll('.v4FinalizeReturn').forEach(btn=>btn.onclick=async()=>{
    const row=returns[Number(btn.dataset.i)];
    if(!confirm('只对已确认合格且 OPPO/IMEI/订单明细完整的退货进行自动流转；缺少数据会进入待核状态。继续？'))return;
    try{
     const x=await authorized('/rest/v1/rpc/rfriend_erp_finalize_oppo_return',{method:'POST',body:{p_return_id:row.id}});
     alert('自动流转校验结果：'+x.status);
     for(const k of ['returns_v4','used_devices'])ERP_CACHE.delete(k);render();
    }catch(err){alert('流转失败：'+errorMessage(err))}
   });
   $('v4NewReturn').onclick=()=>erpOpenCreate('returns');
  }catch(e){if($('v4ReturnsList'))$('v4ReturnsList').textContent='退换货接口错误：'+errorMessage(e)}
 }
 window.erpV4Page=async function(key){
  if(key==='products'){await productPage();return true}
  if(key==='purchase'){await purchasePage();return true}
  if(key==='tickets'){await supportPage();return true}
  if(key==='intake'){await reviewPage();return true}
  if(key==='returns'){await returnsPage();return true}
  return false;
 };
})();
