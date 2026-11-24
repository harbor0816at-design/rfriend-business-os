'use strict';
/* Production UI adapter: matches the approved Rfriend Business OS v5 visual hierarchy.
   All records are fetched from Supabase RLS-protected ERP views, NOT localStorage demo data. */
const ERP_NAV=[
 ['dashboard','▦','经营总览','Overview'],
 ['tasks','☑','我的工作台','My workspace'],
 ['intake','⇪','订单导入','Order intake'],
 ['orders','↗','销售订单','Sales orders'],
 ['inventory','▣','库存中心','Inventory'],
 ['purchase','↓','采购管理','Purchasing'],
 ['shipping','➜','发货履约','Shipping'],
 ['returns','↩','退换货质检','Returns & QC'],
 ['used','◈','二手机业务','Used devices'],
 ['tickets','☏','售后工单','Customer service'],
 ['finance','€','财务发票','Finance & invoices'],
 ['reports','▥','经营报告','Reports'],
 ['audit','☷','操作日志','Audit trail'],
 ['settings','⚙','设置与备份','Settings'],
 ['team','♧','员工与角色','Employees & roles'],
 ['imei','⌗','串码识别','IMEI recognition']
];
const ERP_GROUPS=[
 ['workspace','工作台','Workspace',['dashboard','tasks']],
 ['sales','销售与履约','Sales & Fulfillment',['intake','orders','shipping']],
 ['stock','采购与库存','Procurement & Inventory',['purchase','inventory','imei','used']],
 ['care','客户服务','Customer Service',['tickets','returns']],
 ['money','财务管理','Finance',['finance']],
 ['system','分析与系统','Insights & Administration',['reports','audit','team','settings']]
];
const ERP_MODULES={
 tasks:{title:'我的工作台',en:'My workspace',tables:[['work_tasks','工作任务'],['reconciliation_cases','订单核查异常']]},
 intake:{title:'订单导入',en:'Order intake',tables:[['import_batches','导入批次'],['order_source_records','历史源文件行'],['reconciliation_cases','数据质量异常'],['sku_dictionary','SKU 对照字典']]},
 orders:{title:'销售订单',en:'Sales orders',tables:[['orders','订单主表'],['order_items','订单商品明细'],['order_status_history','订单状态历史']]},
 inventory:{title:'库存中心',en:'Inventory',tables:[['stock_balances','仓库库存'],['products','商品目录'],['inventory_movements','库存流水']]},
 purchase:{title:'采购管理',en:'Purchasing',tables:[['purchase_orders','采购单'],['purchase_items','采购明细']]},
 shipping:{title:'发货履约',en:'Shipping',tables:[['shipments','正式出货记录'],['source_logistics_evidence','历史物流凭证']]},
 returns:{title:'退换货质检',en:'Returns & QC',tables:[['returns','退换货申请'],['return_items','质检明细']]},
 used:{title:'二手机业务',en:'Used devices',tables:[['used_devices','二手机台账'],['used_inspections','质检报告'],['used_orders','二手机订单'],['used_device_events','状态流水']]},
 tickets:{title:'售后工单',en:'Customer service',tables:[['tickets','售后工单'],['ticket_events','跟进事件']]},
 finance:{title:'财务发票',en:'Finance & invoices',tables:[['refunds','退款台账'],['invoices','发票台账']]},
 audit:{title:'操作日志',en:'Audit trail',tables:[['audit_events','真实审计流水'],['order_status_history','订单状态变更']]},
 team:{title:'员工与角色',en:'Employees & roles',tables:[['staff_roles','员工角色'],['role_definitions','角色权限定义']]},
 imei:{title:'串码识别',en:'IMEI recognition',tables:[['device_imeis','设备串码'],['imei_recognition_reviews','待核查识别结果'],['sku_dictionary','SKU 码表']]},
 settings:{title:'设置与备份',en:'Settings',tables:[['channels','渠道配置'],['warehouses','仓库配置'],['product_keyword_rules','自动识别规则']]},
 reports:{title:'经营报告',en:'Business reports',tables:[['report_sales_by_month','月度渠道销售'],['report_order_stage_kpis','订单阶段分布'],['report_order_dates_quality','订单时间完整性'],['report_order_lifecycle','订单生命周期'],['report_source_product_mix','产品结构'],['report_review_queue','待核对队列'],['report_workflow_summary','工作流摘要']]}
};
const ERP_VIEWS={channels:'rfriend_erp_channels',warehouses:'rfriend_erp_warehouses',shipments:'rfriend_erp_shipments',orders:'rfriend_erp_orders',work_tasks:'rfriend_erp_tasks',staff_roles:'rfriend_erp_profile'};
const ERP_ROLE_ALLOW={
 admin:['*'],
 operations:['dashboard','tasks','intake','orders','inventory','purchase','shipping','returns','used','tickets','finance','reports','audit','settings','team','imei'],
 support:['dashboard','tasks','orders','tickets','returns','imei','reports'],
 finance:['dashboard','tasks','orders','purchase','finance','reports'],
 warehouse:['dashboard','tasks','shipping','inventory','purchase','returns','used','imei','reports']
};
const ERP_FIELDS={
 products:[['sku','SKU','text',1],['name','商品名称','text',1],['category','品类'],['ean','EAN'],['variant','规格'],['cost_eur','采购成本 EUR','number'],['price_eur','销售价格 EUR','number'],['low_stock_threshold','低库存阈值','number']],
 tickets:[['title','工单标题','text',1],['category','类型'],['description','问题描述'],['priority','优先级','select:low|medium|high|urgent']],
 purchase_orders:[['po_number','采购单号','text',1],['supplier','供应商','text',1],['warehouse_id','仓库 ID'],['status','状态','select:draft|requested']],
 orders:[['external_order_id','外部订单号','text',1],['channel_id','渠道 ID','text',1],['customer_name','客户姓名'],['order_status','状态','select:pending|confirmed'],['total_eur','金额 EUR','number']],
 returns:[['order_id','订单 UUID','text',1],['type','退换货类型','select:return|exchange'],['reason','原因','text',1]],
 work_tasks:[['title','任务标题','text',1],['task_type','任务类型'],['assigned_role','分配岗位','select:support|operations|warehouse|finance'],['due_at','截止时间','datetime-local']],
 used_devices:[['imei','IMEI','text',1],['brand','品牌','text',1],['model','型号','text',1],['grade','成色级别'],['purchase_cost_eur','采购成本 EUR','number'],['listing_price_eur','挂牌价 EUR','number']],
 invoices:[['invoice_number','发票号','text',1],['order_id','关联订单 UUID'],['invoice_type','发票类型'],['amount_eur','含税金额','number'],['vat_eur','VAT','number']],
 };
const ERP_CREATE={
 inventory:'products',purchase:'purchase_orders',orders:'orders',returns:'returns',tickets:'tickets',
 tasks:'work_tasks',used:'used_devices',finance:'invoices'
};
const ERP_COLUMNS={
 orders:['external_order_id','channel_code','ordered_at','customer_name','order_status','total_eur'],
 products:['sku','name','category','ean','cost_eur','price_eur'],
 stock_balances:['warehouse_id','product_id','quality_status','on_hand','reserved'],
 inventory_movements:['created_at','warehouse_id','product_id','quantity_delta','reason'],
 purchase_orders:['po_number','supplier','status','warehouse_id','created_at'],
 shipments:['shipment_number','carrier','tracking_number','status','shipped_at'],
 returns:['rma_number','order_id','type','return_status','inspection_status','reason'],
 tickets:['ticket_number','title','category','priority','status','created_at'],
 refunds:['order_id','amount_eur','status','payment_reference','created_at'],
 invoices:['invoice_number','invoice_type','amount_eur','vat_eur','status'],
 used_devices:['imei','brand','model','grade','status','listing_price_eur'],
 used_orders:['order_number','external_order_id','status','total_eur'],
 work_tasks:['title','task_type','assigned_role','status','due_at'],
 import_batches:['filename','source_type','status','total_rows','error_rows','created_at'],
 order_source_records:['source_sheet','external_order_id','source_status','product_family','amount_eur','validation_state'],
 device_imeis:['imei','product_id','inventory_status','warehouse_id'],
 staff_roles:['user_id','role','active','created_at'],
 audit_events:['entity_type','action','entity_id','actor_id','created_at'],
 role_definitions:['code','name','allowed_modules'],
 report_sales_by_month:['sales_month','channel_code','recorded_orders','order_face_value_eur','delivered_orders'],
 report_order_stage_kpis:['channel_code','total_orders','pending','shipped','delivered','order_face_value_eur']
};
const ERP_LABELS={id:'ID',external_order_id:'外部订单号',channel_code:'渠道',ordered_at:'下单时间',created_at:'创建时间',updated_at:'更新时间',customer_name:'客户姓名',order_status:'订单状态',total_eur:'金额 EUR',sku:'SKU',name:'名称',title:'标题',category:'分类',ean:'EAN',price_eur:'售价 EUR',cost_eur:'成本 EUR',low_stock_threshold:'低库存阈值',warehouse_id:'仓库 ID',product_id:'商品 ID',on_hand:'库存数量',reserved:'预留数量',quality_status:'质量状态',quantity_delta:'变动数量',reason:'原因',po_number:'采购单号',supplier:'供应商',status:'状态',shipment_number:'发货单号',carrier:'承运商',tracking_number:'物流单号',shipped_at:'发货时间',rma_number:'RMA 单号',return_status:'退换状态',inspection_status:'质检状态',ticket_number:'工单编号',priority:'优先级',payment_reference:'付款凭证',invoice_number:'发票号码',invoice_type:'发票类型',amount_eur:'金额 EUR',vat_eur:'VAT',brand:'品牌',model:'型号',grade:'成色',imei:'IMEI',task_type:'任务类型',assigned_role:'负责部门',due_at:'截止时间',source_sheet:'源表',source_status:'来源状态',product_family:'商品系列',validation_state:'数据验证',recorded_orders:'订单数量',sales_month:'月份',order_face_value_eur:'订单面额',delivered_orders:'签收订单',action:'操作',actor_id:'操作员',entity_type:'业务实体',entity_id:'关联 ID',user_id:'员工 ID',role:'角色',active:'启用',allowed_modules:'允许模块'};
const ERP_CACHE=new Map();
let erpSelectedPage='dashboard',erpTab='',erpSearch='',erpOffset=0,erpRow=null,erpLoading=0;
const ERP_MAX=1000;
function erpEsc(v){return escapeHTML(v)}
function erpText(s){return lang==='en'?({dashboard:'Overview',inventory:'Inventory',orders:'Sales orders',purchase:'Purchasing',tickets:'Service tickets'}[s]||s):s}
function erpDate(x){return x?fmtDate(x):'—'}
function erpAmount(v){return v==null?'—':eur(v)}
function erpValue(v,k=''){
 if(v==null||v==='')return '—';
 if(typeof v==='boolean')return v?'是':'否';
 if(Array.isArray(v))return v.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(', ');
 if(typeof v==='object')return JSON.stringify(v);
 if(/(_at|_date)$/.test(k)&&!Number.isNaN(Date.parse(v)))return erpDate(v);
 if(/(_eur|amount_eur|total_eur)$/.test(k))return erpAmount(v);
 return String(v)
}
function erpAllowed(slug){
 const roles=ERP_ROLE_ALLOW[profile?.role]||ERP_ROLE_ALLOW.support;
 return roles.includes('*')||roles.includes(slug);
}
function erpBuildNav(){
 const root=document.querySelector('.sidebar');
 root.innerHTML='<div class="brand">Rfriend <span>OS</span><small>OPPO Austria · 进销存业务系统</small></div>'+
 '<div class="erp-toolbar"><input id="erpNavSearch" placeholder="快速导航 / Search…" style="width:100%;background:#21483a;color:#fff;border-color:#41614f"></div>'+
 '<div id="erpNavGroups"></div>'+
 '<div class="erp-mini" style="margin:24px 12px;color:#a8c1b3">生产数据库 · Supabase Frankfurt<br>权限按员工角色控制</div>';
 document.querySelector('#erpNavSearch').addEventListener('input',erpRenderNav);
 erpRenderNav();
}
function erpRenderNav(){
 const q=(document.querySelector('#erpNavSearch')?.value||'').toLowerCase();
 const root=document.querySelector('#erpNavGroups');if(!root)return;
 root.innerHTML=ERP_GROUPS.map(([id,zh,en,items])=>{
  const links=ERP_NAV.filter(x=>items.includes(x[0])&&erpAllowed(x[0])&&(x[2]+x[3]).toLowerCase().includes(q));
  return links.length?'<div class="side-label">'+(lang==='zh'?zh:en)+'</div>'+
   links.map(([key,icon,cn,english])=>'<button class="nav '+(erpSelectedPage===key?'active':'')+'" data-erp-nav="'+key+'"><em>'+icon+'</em>'+(lang==='zh'?cn:english)+'</button>').join(''):'';
 }).join('');
 root.querySelectorAll('[data-erp-nav]').forEach(button=>button.addEventListener('click',()=>erpNavigate(button.dataset.erpNav)));
}
function erpNavigate(pageId){
 if(!erpAllowed(pageId))return;
 erpSelectedPage=pageId;erpTab='';erpSearch='';erpOffset=0;
 erpRenderNav();render();
}
function erpPanel(title,content,subtitle=''){
 return '<section class="panel"><div class="erp-header"><div><h3>'+erpEsc(title)+'</h3>'+(subtitle?'<div class="erp-sub">'+erpEsc(subtitle)+'</div>':'')+'</div></div>'+content+'</section>';
}
function erpMetric(label,num,detail=''){return '<div class="card"><small>'+erpEsc(label)+'</small><strong>'+erpEsc(num)+'</strong><small>'+erpEsc(detail)+'</small></div>'}
function erpTable(data,key){
 const cols=ERP_COLUMNS[key]||Object.keys(data[0]||{}).filter(k=>k!=='raw_data').slice(0,7);
 const rows=data.slice(0,250).map((row,i)=>'<tr data-row-index="'+i+'">'+cols.map(k=>'<td title="'+erpEsc(erpValue(row[k],k))+'">'+erpEsc(erpValue(row[k],k)).slice(0,140)+'</td>').join('')+
 '<td><button class="btn erp-view" data-index="'+i+'" style="padding:6px 8px">详情 / 操作</button></td></tr>');
 return '<div class="erp-scroll tablewrap"><table><thead><tr>'+[...cols.map(k=>ERP_LABELS[k]||k),'操作'].map(k=>'<th>'+erpEsc(k)+'</th>').join('')+'</tr></thead><tbody>'+
 (rows.length?rows.join(''):'<tr><td colspan="'+(cols.length+1)+'" class="erp-empty">暂无记录（生产数据库未录入或当前角色无权限）</td></tr>')+
 '</tbody></table></div><div class="erp-mini" style="margin-top:11px">当前展示 '+data.length+' 条记录中的前 '+Math.min(data.length,250)+' 条。所有记录均来自数据库读取。</div>';
}
function erpModal(html,title='详情 / 操作'){
 document.querySelector('#erpModal')?.remove();
 const wrapper=document.createElement('div');wrapper.id='erpModal';wrapper.className='erp-detail';
 wrapper.innerHTML='<div class="erp-modal"><div class="erp-modal-head"><h2>'+erpEsc(title)+'</h2><button class="btn" id="erpModalClose">× 关闭</button></div><div class="erp-modal-body">'+html+'</div><div class="erp-modal-actions"><button id="erpCloseBottom">关闭</button></div></div>';
 document.body.appendChild(wrapper);
 wrapper.querySelector('#erpModalClose').onclick=()=>wrapper.remove();
 wrapper.querySelector('#erpCloseBottom').onclick=()=>wrapper.remove();
 wrapper.addEventListener('mousedown',e=>{if(e.target===wrapper)wrapper.remove()});
 return wrapper;
}
async function erpData(name,refresh=false){
 if(!refresh&&ERP_CACHE.has(name))return ERP_CACHE.get(name);
 const view=ERP_VIEWS[name]||'rfriend_erp_'+name;
 const data=await authorized('/rest/v1/'+view+'?select=*&limit='+ERP_MAX);
 if(!Array.isArray(data))throw new Error('Unexpected database response for '+name);
 ERP_CACHE.set(name,data);
 return data;
}
function erpCSV(rows){if(!rows.length)return '';const keys=Object.keys(rows[0]);return [keys,...rows.map(o=>keys.map(k=>o[k]))].map(row=>row.map(v=>'"'+String((typeof v==='object'?JSON.stringify(v):v)??'').replaceAll('"','""')+'"').join(',')).join('\r\n')}
function erpDownload(name,rows){
 const csv=erpCSV(rows);const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='rfriend-'+name+'-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),300);
}
function erpBindDetail(rows,table){
 document.querySelectorAll('.erp-view').forEach(b=>b.onclick=()=>{
  const row=rows[Number(b.dataset.index)];if(!row)return;
  erpModal('<dl class="erp-kv">'+Object.entries(row).map(([k,v])=>'<dt>'+erpEsc(ERP_LABELS[k]||k)+'</dt><dd>'+erpEsc(erpValue(v,k))+'</dd>').join('')+'</dl>'+
  '<div class="erp-blocked" style="margin-top:14px">当前显示数据库原始记录。修改状态、库存扣减、退款执行等操作必须经服务端权限和事务校验，暂不通过浏览器直接改写。</div>',ERP_MODULES[erpSelectedPage]?.title||table);
 });
}
function erpTitle(id){return ERP_NAV.find(x=>x[0]===id)?.[lang==='en'?3:2]||'经营总览'}
function erpOpenCreate(entity){
 const defs=ERP_FIELDS[entity];if(!defs){erpModal('<p>该模块的创建动作尚未开放服务端接口。</p>');return}
 const items=defs.map(([key,label,type='text',required])=>{
  const select=type.startsWith('select:');
  return '<div class="erp-field '+(key==='description'?'wide':'')+'"><label>'+erpEsc(label)+'</label>'+
  (select?'<select name="'+key+'">'+type.slice(7).split('|').map(v=>'<option value="'+erpEsc(v)+'">'+erpEsc(v)+'</option>').join('')+'</select>':
  key==='description'?'<textarea name="'+key+'" '+(required?'required':'')+'></textarea>':
  '<input name="'+key+'" type="'+type+'" '+(required?'required':'')+'></div>');
 });
 const modal=erpModal('<form id="erpCreateForm"><div class="erp-fields">'+items.join('')+'</div>'+
 '<div class="erp-blocked" style="margin-top:15px">所有新建操作经过 Supabase 服务端角色校验；尚未开放的实体不会写入生产数据。</div>'+
 '<div class="erp-actions" style="justify-content:flex-end;margin-top:18px"><button type="submit" class="primary">提交创建申请</button></div><p id="erpCreateStatus"></p></form>','新建业务 · '+entity);
 modal.querySelector('#erpCreateForm').onsubmit=async e=>{
  e.preventDefault();
  const form=e.target;const payload={};for(const [k,v] of new FormData(form).entries()){if(v!=='')payload[k]=/_eur$|low_stock_threshold/.test(k)?Number(v):v}
  const status=modal.querySelector('#erpCreateStatus');const button=form.querySelector('[type=submit]');button.disabled=true;
  try{const result=await authorized('/rest/v1/rpc/rfriend_erp_create_record',{method:'POST',body:{p_entity:entity,p_payload:payload}});
   status.textContent='创建成功：'+(result?.id||result?.record_id||JSON.stringify(result));status.style.color='#127347';
   ERP_CACHE.delete(entity);erpRenderPage();
  }catch(err){status.textContent='无法创建：'+errorMessage(err);status.style.color='#b03432';}finally{button.disabled=false}
 };
}
async function erpRenderModule(){
 const slug=erpSelectedPage;const module=ERP_MODULES[slug];
 const choices=module.tables;
 if(!choices.some(([k])=>k===erpTab))erpTab=choices[0][0];
 const tabs=choices.map(([key,label])=>'<button class="btn '+(erpTab===key?'primary':'')+'" data-erp-tab="'+key+'">'+erpEsc(label)+'</button>').join('');
 el('content').innerHTML='<div class="erp-topline">'+(lang==='zh'?'真实生产数据 · 列表 / 详情 / 操作':'Live data · List / detail / actions')+'</div>'+
 '<div id="erpModuleNotice"></div>'+
 '<div class="erp-toolbar">'+tabs+'</div>'+
 erpPanel(module.title,
 '<div class="erp-toolbar"><input id="erpSearch" placeholder="搜索当前表的关键字…" value="'+erpEsc(erpSearch)+'">'+
 '<button id="erpSearchRun">搜索</button><button id="erpReload">刷新数据</button>'+
 '<button id="erpExport">↓ 导出 CSV</button><button id="erpBulk">⇪ 批量导入</button>'+
 (ERP_CREATE[slug]===erpTab?'<button class="primary" id="erpAdd">＋ 新建</button>':'')+
 '</div><div id="erpRecords"><p class="erp-empty">正在从 Supabase 读取…</p></div>','数据源：erp.'+erpTab+' · 角色：'+(profile?.role||'-'));
 document.querySelectorAll('[data-erp-tab]').forEach(b=>b.onclick=()=>{erpTab=b.dataset.erpTab;erpSearch='';render()});
 document.querySelector('#erpSearchRun').onclick=()=>{erpSearch=document.querySelector('#erpSearch').value.trim();erpDrawRows()};
 document.querySelector('#erpSearch').onkeydown=e=>{if(e.key==='Enter'){erpSearch=e.target.value.trim();erpDrawRows()}};
 document.querySelector('#erpReload').onclick=()=>{ERP_CACHE.delete(erpTab);erpDrawRows()};
 document.querySelector('#erpAdd')?.addEventListener('click',()=>erpOpenCreate(erpTab));
 document.querySelector('#erpExport').onclick=async()=>{try{erpDownload(erpTab,await erpData(erpTab))}catch(e){notice(errorMessage(e),true)}};
 document.querySelector('#erpBulk').onclick=()=>erpBulkModal();
 await erpDrawRows();
}
async function erpDrawRows(){
 const table=erpTab;
 const target=document.querySelector('#erpRecords');if(!target)return;
 target.innerHTML='<p class="erp-empty">正在查询…</p>';
 const run=++erpLoading;
 try{
  const data=await erpData(table);
  if(run!==erpLoading||!document.querySelector('#erpRecords')||table!==erpTab)return;
  const term=(erpSearch||'').toLowerCase();
  const filtered=term?data.filter(r=>Object.values(r).some(v=>String(typeof v==='object'?JSON.stringify(v):v).toLowerCase().includes(term))):data;
  target.innerHTML=erpTable(filtered,table);
  erpBindDetail(filtered,table);
 }catch(e){
  target.innerHTML='<div class="erp-blocked">接口读取失败：'+erpEsc(errorMessage(e))+'。请检查该角色的模块权限和 Supabase API 设置。</div>';
 }
}
function erpBulkModal(){
 const m=erpModal('<p>选择 CSV 文件，在本地预览前 10 条记录。导入生产库必须执行后端字段校验、重复检测和审批，不能沿用 Demo 的浏览器本地写入。</p>'+
 '<input type="file" id="erpBulkFile" accept=".csv,text/csv"><div id="erpBulkPreview" class="erp-mini" style="margin-top:16px"></div>','批量导入 · '+erpTab);
 m.querySelector('#erpBulkFile').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  const text=await file.text();const lines=text.replace(/\r/g,'').split('\n').filter(Boolean);
  const first=lines[0]?.split(',')||[];const preview=lines.slice(1,11).map(line=>line.split(','));
  m.querySelector('#erpBulkPreview').innerHTML='<p>文件：'+erpEsc(file.name)+' · '+Math.max(0,lines.length-1)+' 行（只读预览，尚未提交）</p>'+
  '<div class="tablewrap"><table><thead><tr>'+first.map(h=>'<th>'+erpEsc(h)+'</th>').join('')+'</tr></thead><tbody>'+
  preview.map(row=>'<tr>'+row.map(c=>'<td>'+erpEsc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'+
  '<p class="erp-blocked">安全提示：批量上传入库接口正在接入事务校验。当前只提供文件检查，尚未提交生产数据库。</p>';
 };
}
async function erpDashboard(){
 el('content').innerHTML='<div class="erp-topline">销售、库存和风险 · 生产数据库</div><div id="erpSummary" class="cards"></div>'+
 '<div class="message" style="margin-bottom:16px">欢迎使用 Rfriend Business OS。销售订单和工作台读取真实 Supabase 数据；库存仅统计已正式入账的记录。历史订单金额是面额，不等同财务确认的净销售额。</div>'+
 '<div class="erp-grid"><div id="erpSalesPanel"></div><div id="erpRiskPanel"></div></div>';
 const sum=el('erpSummary'),sales=el('erpSalesPanel'),risk=el('erpRiskPanel');
 try{
  const [stock,skus,disputes]=await Promise.all([
   erpData('stock_balances').catch(()=>[]),erpData('products').catch(()=>[]),erpData('reconciliation_cases').catch(()=>[])
  ]);
  const onhand=stock.reduce((n,r)=>n+Number(r.on_hand||0),0);
  const totalValue=orders.reduce((n,r)=>n+Number(r.total_eur||0),0);
  const open=disputes.filter(x=>!['resolved','closed','done'].includes(x.case_status)).length;
  if(sum)sum.innerHTML=erpMetric('销售订单',orders.length,'已导入订单记录')+
   erpMetric('库存总件数',onhand,'仅正式库存台账')+
   erpMetric('订单金额面额',eur(totalValue),'并非净销售额')+
   erpMetric('待核查异常',open,'历史导入对账问题');
  const by=new Map();
  for(const o of orders){const c=o.channel_code||'其他';by.set(c,(by.get(c)||0)+1);}
  if(sales)sales.innerHTML=erpPanel('渠道销售表现',
   '<div class="erp-scroll tablewrap"><table><thead><tr><th>销售渠道</th><th>订单数</th></tr></thead><tbody>'+
   [...by.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<tr><td>'+erpEsc(k)+'</td><td>'+v+'</td></tr>').join('')+'</tbody></table></div>');
  const low=stock.filter(x=>Number(x.on_hand)-Number(x.reserved)<=0);
  if(risk)risk.innerHTML=erpPanel('库存预警',
   low.length?'<div class="erp-blocked">'+low.length+' 条库存记录可售数量不足，需结合 SKU 阈值核实。</div>':
   '<div class="erp-empty">暂无库存预警<br>正式库存台账无缺货记录</div>');
 }catch(e){notice(errorMessage(e),true)}
}
async function erpReports(){
 el('content').innerHTML='<div class="erp-topline">经营报告 · 多维分析 · 数据核查</div>'+
 '<div class="cards">'+erpMetric('订单总量',orders.length)+erpMetric('订单面额',eur(orders.reduce((x,o)=>x+Number(o.total_eur||0),0)))+
 erpMetric('待处理任务',tasks.filter(x=>!['done','closed'].includes(x.status)).length)+erpMetric('发货登记',shipments.length)+'</div>';
 await erpRenderModule();
}
function erpSettingsExtras(){
 const root=document.querySelector('#erpRecords');
 if(root)root.insertAdjacentHTML('beforebegin','<div class="message warn" style="margin-bottom:14px">本系统已接入真实数据库。生产备份和恢复应使用 Supabase 项目备份或受控导出；不允许使用 Demo 的浏览器本地覆盖功能。</div>');
}
async function erpRenderPage(){
 if(!profile)return;
 erpRenderNav();el('heading').textContent=erpTitle(erpSelectedPage);
 if(erpSelectedPage==='dashboard'){await erpDashboard();return}
 if(!ERP_MODULES[erpSelectedPage])return;
 await erpRenderModule();
 if(erpSelectedPage==='settings')erpSettingsExtras();
}
window.render=function(){return erpRenderPage()};
const oldLoadData=window.loadData;
document.querySelector('#lang')?.addEventListener('change',()=>{erpRenderNav();render()});
erpBuildNav();
if(profile)render();
