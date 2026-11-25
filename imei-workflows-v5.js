'use strict';
/* Serialized inventory and used-goods fulfillment. All actions hit authorized, audited server RPCs. */
(function(){
 const $=id=>document.getElementById(id);
 const h=x=>erpEsc(x??'');
 const canWrite=()=>['admin','operations','warehouse'].includes(profile?.role);
 const xdate=x=>x?String(x).replace('T',' ').slice(0,16):'—';
 const opName={register_existing:'历史库存绑定',purchase_receipt:'采购入库',manual_receipt:'新机入库',
  warehouse_transfer:'仓库调拨',sales_shipment:'全新机销售出库',used_shipment:'二手机销售出库',
  return_used_receipt:'退货合格转二手机仓'};
 let allWarehouse=[],allProducts=[],allChannels=[];
 const opt=(rows)=>rows.map(([k,label])=>'<option value="'+h(k)+'">'+h(label)+'</option>').join('');
 const field=(title,body)=>'<label class="v5-field"><span>'+h(title)+'</span>'+body+'</label>';
 const txt=(name,placeholder='',type='text',required=true)=>'<input class="control" name="'+name+'" type="'+type+'" '+(required?'required':'')+' placeholder="'+h(placeholder)+'">';
 const sel=(name,choices)=>'<select class="control" name="'+name+'" required>'+opt(choices)+'</select>';
 const form=(title,fields,submit)=>{
  const m=erpModal('<form id="v5Form"><div class="v5-fields">'+fields+'</div><div class="erp-actions" style="margin-top:16px"><button type="submit" class="primary">确认业务操作</button></div><p id="v5Msg"></p></form>',title);
  const el=m.querySelector('#v5Form');
  el.onsubmit=async e=>{
   e.preventDefault();const data=Object.fromEntries(new FormData(el));
   const b=el.querySelector('button[type=submit]'),msg=m.querySelector('#v5Msg');b.disabled=true;
   try{
    const ret=await submit(data);msg.style.color='#128257';msg.textContent='操作成功，已记录 IMEI 轨迹。'+(ret.tracking_number?' 运单 '+ret.tracking_number:'');
    for(const k of ['imei_trace','imei_register','used_orders_trace','stock_balances','inventory_v4','inventory_movements','used_devices','shipments','used_orders','used_order_items','purchase_items','purchase_lines_details'])ERP_CACHE.delete(k);
    setTimeout(()=>{m.remove();render()},450);
   }catch(err){msg.style.color='#b03432';msg.textContent=errorMessage(err);b.disabled=false}
  };
 };
 const call=(name,body)=>authorized('/rest/v1/rpc/'+name,{method:'POST',body});
 const tbl=(cols,rows,note='暂无记录')=>'<div class="erp-scroll"><table><thead><tr>'+cols.map(hd=>'<th>'+h(hd)+'</th>').join('')+'</tr></thead><tbody>'+
  (rows.length?rows.join(''):'<tr><td class="erp-empty" colspan="'+cols.length+'">'+h(note)+'</td></tr>')+'</tbody></table></div>';
 async function catalogs(){
  [allWarehouse,allProducts,allChannels]=await Promise.all([
   erpData('warehouses'),erpData('product_catalog'),erpData('channels')
  ]);
 }
 const warehouseOptions=()=>allWarehouse.filter(x=>x.is_active).map(w=>[w.id,w.name||w.code]);
 const skuOptions=()=>allProducts.filter(x=>x.category==='phone'||x.category==='tablet')
  .map(p=>[p.id,p.sku+' · '+p.product_name+' · '+p.color+' · '+p.storage_version]);
 const channelOptions=()=>allChannels.map(c=>[c.id,c.name||c.code]);
 function receiveModal(){
  form('手机/平板按 IMEI 收货',[
   field('IMEI（15 位数字）',txt('imei','15 digit IMEI','text')),
   field('SKU / 型号 / 颜色 / 内存',sel('product',skuOptions())),
   field('目标仓库',sel('warehouse',warehouseOptions())),
   field('操作类型',sel('mode',[['tag_existing','为已有库存绑定 IMEI（不增加库存）'],['new_receipt','新增实物入库（库存 +1）']])),
   field('盘点 / 收货凭证',txt('reference','批次号或扫描记录'))
  ].join(''),async x=>call('rfriend_erp_imei_register_or_receive',{
   p_imei:x.imei,p_product_id:x.product,p_warehouse_id:x.warehouse,p_mode:x.mode,p_reference:x.reference
  }));
 }
 function transferModal(){
  form('按 IMEI 跨仓调拨',[
   field('IMEI（15 位数字）',txt('imei','必须已登记在来源仓')),
   field('目标仓库',sel('warehouse',warehouseOptions())),
   field('调拨单号 / 原因',txt('reference','同一调拨凭证不可重复'))
  ].join(''),async x=>call('rfriend_erp_transfer_imei',{
   p_imei:x.imei,p_to_warehouse:x.warehouse,p_reference:x.reference
  }));
 }
 async function purchaseReceiptModal(){
  const lines=await erpData('purchase_lines_details',true);
  const ready=lines.filter(x=>['ordered','part_received'].includes(x.po_status)&&x.received_quantity<x.quantity);
  if(!ready.length){alert('没有可按 IMEI 收货的采购明细。请先创建并批准采购单。');return}
  form('采购单按 IMEI 逐台入库',[
   field('采购单 / 商品',sel('line',ready.map(x=>[x.id,x.po_number+' · '+x.product_name+' · '+x.color+' · '+x.storage_version+' · 剩余'+(x.quantity-x.received_quantity)]))),
   field('IMEI',txt('imei','15 位设备 IMEI')),
   field('收货凭证',txt('reference','仓库入库单编号'))
  ].join(''),async x=>call('rfriend_erp_receive_purchase_imei',{
   p_purchase_item_id:x.line,p_imei:x.imei,p_reference:x.reference
  }));
 }
 async function newShipmentModal(){
  const orders=await erpData('order_products_v5',true);
  const ready=orders.filter(x=>['confirmed','part_shipped'].includes(x.order_status));
  if(!ready.length){alert('当前没有已确认且尚未完成发货的订单；请先审核订单，才能依据 IMEI 出库。');return}
  form('新机订单按 IMEI 出库',[
   field('销售订单号 / 商品名称',sel('order',ready.map(o=>[o.id,o.external_order_id+' · '+o.product_names.slice(0,110)]))),
   field('实际出库 IMEI',txt('imei','必须已登记在可售仓')),
   field('承运商',txt('carrier','Post AT / GLS / DHL')),
   field('快递单号',txt('tracking','承运商运单号'))
  ].join(''),async x=>call('rfriend_erp_ship_new_imei',{
   p_order_id:x.order,p_imei:x.imei,p_carrier:x.carrier,p_tracking:x.tracking
  }));
 }
 function newUsedOrderModal(available){
  if(!available.length){alert('二手机仓库没有可售且有 IMEI 的 OPPO 设备。请先完成退货质检或二手机入库。');return}
  form('新建二手机销售订单 · IMEI 锁定',[
   field('订单号',txt('order','订单平台的唯一订单号')),
   field('销售渠道',sel('channel',channelOptions())),
   field('OPPO IMEI / 型号',sel('imei',available.map(d=>[d.imei,(allProducts.find(p=>p.id===d.product_id)?.product_name||d.model)+' · '+(d.color||'')+' · '+(d.storage_variant||'')+' · IMEI '+d.imei]))),
   field('客户姓名',txt('customer','可选','text',false))
  ].join(''),async x=>call('rfriend_erp_used_order_create',{
   p_order_number:x.order,p_imei:x.imei,p_channel_id:x.channel,p_customer_name:x.customer||null
  }));
 }
 function usedShipModal(order){
  form('二手机订单按 IMEI 出库',[
   field('订单号', '<input class="control" value="'+h(order.order_number)+'" readonly>'),
   field('设备 IMEI', '<input class="control" value="'+h(order.imei)+'" readonly>'),
   field('承运商',txt('carrier','Post AT / GLS / DHL')),
   field('快递单号',txt('tracking','必须填真实运单号'))
  ].join(''),async x=>call('rfriend_erp_used_order_ship',{
   p_order_id:order.used_order_id,p_imei:order.imei,p_carrier:x.carrier,p_tracking:x.tracking
  }));
 }
 function traceModal(imei,trace){
  const events=trace.filter(x=>x.imei===imei).sort((a,b)=>a.created_at.localeCompare(b.created_at));
  const html='<p>IMEI：<strong>'+h(imei)+'</strong></p><div class="v5-timeline">'+events.map((e,i)=>
   '<div class="v5-event"><span class="v5-step">'+(i+1)+'</span><div><strong>'+h(opName[e.action]||e.action)+'</strong>'+
   '<p>'+h(xdate(e.created_at))+' · '+h(e.from_warehouse||'外部')+' → '+h(e.to_warehouse||'已出库')+'</p>'+
   '<p>订单：'+h(e.order_number||'—')+' · 快递：'+h(e.carrier||'—')+' · 运单：'+h(e.tracking_number||'—')+'</p></div></div>').join('')+'</div>';
  erpModal(html,'IMEI 全生命周期追踪');
 }
 async function imeiPage(){
  el('content').innerHTML='<div class="erp-topline">全仓统一 · IMEI 实物收货 / 调拨 / 出库 / 来源及快递单号追踪</div>'+
   '<div class="message warn">历史库存尚未全部绑定 IMEI。绑定现有库存不会加库存；新增收货会增加库存。手机和平板采用逐台串码流转，原始无串码数据必须先补录后才能按 IMEI 出库。</div>'+
   '<div class="erp-toolbar">'+(canWrite()?'<button id="v5Receive" class="btn primary">＋ IMEI 登记 / 入库</button><button id="v5Transfer" class="btn">⇄ 跨仓调拨</button><button id="v5Purchase" class="btn">↓ 采购逐台入库</button>':'')+
   '<input id="v5Filter" class="control" placeholder="查 IMEI / 订单 / 快递单号"></div>'+
   '<div class="cards" id="v5ImeiMetrics"></div>'+
   '<section class="panel"><h3>逐台 IMEI 库存台账</h3><div id="v5ImeiRegister">读取中…</div></section>'+
   '<section class="panel"><h3>跨仓、入库及出库 IMEI 流水</h3><div id="v5ImeiTrace">读取中…</div></section>';
  try{
   const [serial,trace]=await Promise.all([erpData('imei_register',true),erpData('imei_trace',true)]);
   if(!$('v5ImeiRegister'))return;
   const eligible=serial.filter(x=>x.inventory_status!=='shipped');
   $('v5ImeiMetrics').innerHTML=erpMetric('已建档 IMEI',serial.length,'不等同于全部历史库存')+
    erpMetric('当前在仓设备',eligible.filter(x=>x.warehouse_id).length,'按唯一 IMEI')+
    erpMetric('IMEI 流转记录',trace.length,'追加式审计事件')+
    erpMetric('发货已关联串码',trace.filter(x=>x.action==='used_shipment'||x.action==='sales_shipment').length,'可关联快递单号');
   function draw(){
    const q=($('v5Filter')?.value||'').trim().toLowerCase();
    const filtered=serial.filter(x=>(x.imei+' '+x.sku+' '+(x.product_name||'')+' '+(x.warehouse||'')).toLowerCase().includes(q));
    const t=trace.filter(x=>(x.imei+' '+(x.order_number||'')+' '+(x.tracking_number||'')+' '+(x.from_warehouse||'')+' '+(x.to_warehouse||'')).toLowerCase().includes(q));
    $('v5ImeiRegister').innerHTML=tbl(['IMEI','产品名称','型号','颜色','内存','所在仓','状态','追踪'],
     filtered.slice(0,350).map(x=>'<tr><td>'+h(x.imei)+'</td><td>'+h(x.product_name)+'</td>'+
      '<td>'+h(x.model)+'</td><td>'+h(x.color)+'</td><td>'+h(x.storage_version)+'</td><td>'+h(x.warehouse||'已离仓')+'</td>'+
      '<td>'+h(x.inventory_status)+'</td><td><button class="btn v5TraceIMEI" data-imei="'+h(x.imei)+'">轨迹</button></td></tr>'));
    $('v5ImeiTrace').innerHTML=tbl(['时间','IMEI','动作','来源仓','目标仓','订单号','承运商','快递单号'],
     t.slice(0,350).map(x=>'<tr><td>'+h(xdate(x.created_at))+'</td><td>'+h(x.imei)+'</td>'+
      '<td>'+h(opName[x.action]||x.action)+'</td><td>'+h(x.from_warehouse||'—')+'</td><td>'+h(x.to_warehouse||'—')+'</td>'+
      '<td>'+h(x.order_number||'—')+'</td><td>'+h(x.carrier||'—')+'</td><td>'+h(x.tracking_number||'—')+'</td></tr>'));
    $('v5ImeiRegister').querySelectorAll('.v5TraceIMEI').forEach(b=>b.onclick=()=>traceModal(b.dataset.imei,trace));
   }
   $('v5Filter').oninput=draw;draw();
   $('v5Receive')?.addEventListener('click',receiveModal);
   $('v5Transfer')?.addEventListener('click',transferModal);
   $('v5Purchase')?.addEventListener('click',purchaseReceiptModal);
  }catch(err){if($('v5ImeiRegister'))$('v5ImeiRegister').textContent='IMEI 数据读取失败：'+errorMessage(err)}
 }
 async function usedPage(){
  el('content').innerHTML='<div class="erp-topline">OPPO 二手机业务 · 一机一 IMEI · 订单绑定 · 快递出库</div>'+
   '<div class="message">退货质检合格后，经原订单、OPPO 品牌及 IMEI 校验自动入二手机仓；二手机订单必须先绑定具体 IMEI，再凭真实快递单号确认出库。</div>'+
   '<div class="erp-toolbar">'+(canWrite()?'<button id="v5NewUsedOrder" class="btn primary">＋ 接收二手机订单 / 绑定 IMEI</button>':'')+
   '<input id="v5UsedSearch" class="control" placeholder="查订单号 / IMEI / 运单号"></div>'+
   '<section class="panel"><h3>OPPO 二手机订单 · IMEI 出库</h3><div id="v5UsedOrders">读取中…</div></section>'+
   '<section class="panel"><h3>二手机仓库设备明细</h3><div id="v5UsedStock">读取中…</div></section>';
  try{
   const [orders,used]=await Promise.all([erpData('used_orders_v5',true),erpData('used_devices',true)]);
   if(!$('v5UsedOrders'))return;
   const available=used.filter(x=>String(x.brand).toUpperCase()==='OPPO'&&x.status==='ready'&&x.warehouse_id);
   function draw(){
    const q=($('v5UsedSearch')?.value||'').trim().toLowerCase();
    const matches=orders.filter(o=>(o.order_number+' '+o.imei+' '+(o.tracking_number||'')).toLowerCase().includes(q));
    $('v5UsedOrders').innerHTML=tbl(['订单号','商品名称 / 型号','IMEI','颜色','内存','订单状态','快递公司','快递单号','出库时间','操作'],
     matches.map((x,i)=>'<tr><td>'+h(x.order_number)+'</td><td>'+h(x.imei||'待绑定')+'</td>'+
     '<td>'+h(x.model||'—')+'</td><td>'+h(x.color||'—')+'</td><td>'+h(x.memory_version||'—')+'</td>'+
     '<td>'+h(x.order_status)+'</td><td>'+h(x.carrier||'—')+'</td><td>'+h(x.tracking_number||'—')+'</td>'+
     '<td>'+h(xdate(x.shipped_at))+'</td><td>'+
     (canWrite()&&['reserved','picking'].includes(x.order_status)&&x.imei?
      '<button class="btn v5UsedShip" data-i="'+i+'">扫码 / 确认出库</button>':'—')+'</td></tr>'));
    $('v5UsedStock').innerHTML=tbl(['IMEI','品牌','型号','颜色','内存','成色','状态','仓库'],
     used.filter(x=>String(x.brand).toUpperCase()==='OPPO'&&
      (x.imei+' '+x.model+' '+(x.color||'')).toLowerCase().includes(q)).map(x=>'<tr><td>'+h(x.imei)+'</td><td>OPPO</td>'+
      '<td>'+h(x.model)+'</td><td>'+h(x.color||'—')+'</td><td>'+h(x.storage_variant||'—')+'</td>'+
      '<td>'+h(x.grade)+'</td><td>'+h(x.status)+'</td><td>'+h(allWarehouse.find(w=>w.id===x.warehouse_id)?.name||'已离仓')+'</td></tr>'));
    $('v5UsedOrders').querySelectorAll('.v5UsedShip').forEach(b=>b.onclick=()=>usedShipModal(matches[Number(b.dataset.i)]));
   }
   $('v5UsedSearch').oninput=draw;draw();
   $('v5NewUsedOrder')?.addEventListener('click',()=>newUsedOrderModal(available));
  }catch(err){if($('v5UsedOrders'))$('v5UsedOrders').textContent='二手机订单读取失败：'+errorMessage(err)}
 }
 async function shippingPage(){
  el('content').innerHTML='<div class="erp-topline">所有手机出库都绑定 IMEI、订单号、快递公司与快递单号</div>'+
   '<div class="erp-toolbar">'+(canWrite()?'<button id="v5NewShip" class="btn primary">＋ 新机按 IMEI 发货</button>':'')+
   '<button id="v5GoUsed" class="btn">二手机订单出库</button><button id="v5GoTrace" class="btn">查询 IMEI 全程轨迹</button></div>'+
   '<section class="panel"><h3>已登记的 IMEI 快递发货记录</h3><div id="v5ShipRecords">读取中…</div></section>';
  try{
   const events=(await erpData('imei_trace',true)).filter(x=>['sales_shipment','used_shipment'].includes(x.action));
   if(!$('v5ShipRecords'))return;
   $('v5ShipRecords').innerHTML=tbl(['出库时间','新机/二手机','订单号','IMEI','商品名称 / 型号','颜色','内存版本','来源仓库','承运商','快递单号'],
    events.map(e=>'<tr><td>'+h(xdate(e.created_at))+'</td><td>'+h(opName[e.action])+'</td>'+
    '<td>'+h(e.order_number)+'</td><td>'+h(e.imei)+'</td><td>'+h(e.model||e.product_name)+'</td>'+
    '<td>'+h(e.from_warehouse||'—')+'</td><td>'+h(e.carrier)+'</td><td>'+h(e.tracking_number)+'</td></tr>'));
   $('v5NewShip')?.addEventListener('click',newShipmentModal);
   $('v5GoUsed').onclick=()=>erpNavigate('used');$('v5GoTrace').onclick=()=>erpNavigate('imei');
  }catch(err){if($('v5ShipRecords'))$('v5ShipRecords').textContent='发货追踪读取失败：'+errorMessage(err)}
 }
 window.erpV5Page=async function(page){
  if(!['used','imei','movements','shipping'].includes(page))return false;
  await catalogs();
  if(page==='used')await usedPage();
  else if(page==='shipping')await shippingPage();
  else await imeiPage();
  return true;
 };
})();
