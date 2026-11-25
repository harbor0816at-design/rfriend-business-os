'use strict';
/* Production UI adapter: matches the approved Rfriend Business OS v5 visual hierarchy.
   All records are fetched from Supabase RLS-protected ERP views, NOT localStorage demo data. */
const ERP_NAV=[
 ['dashboard','▦','经营总览','Overview'],
 ['tasks','☑','我的工作台','My workspace'],
 ['intake','⇪','订单复核与导入','Order review & import'],
 ['orders','↗','销售订单','Sales orders'],
 ['products','▤','商品管理','Products'],
 ['inventory','▣','库存管理','Inventory'],
 ['movements','☰','库存流水','Stock movements'],
 ['purchase','↓','采购管理','Purchasing'],
 ['shipping','➜','发货履约','Shipping'],
 ['returns','↩','退换货管理','Returns & Exchanges'],
 ['used','◈','二手机业务','Used Devices'],
 ['tickets','☏','售后工单','Customer service'],
 ['finance','€','财务发票','Finance & invoices'],
 ['reports','▥','经营报告','Reports'],
 ['audit','☷','操作日志','Audit trail'],
 ['settings','⚙','设置与备份','Settings'],
 ['team','♧','员工与角色','Employees & roles'],
 ['imei','⌗','IMEI 全链路追踪','IMEI Trace']
];
// Navigation structure strictly follows the user-approved Business OS v3 HTML.
const ERP_GROUPS=[
 ['workspace','工作台','Workspace',['dashboard','tasks']],
 ['sales','销售与履约','Sales & Fulfillment',['intake','orders','shipping']],
 ['stock','采购与库存','Procurement & Inventory',['purchase','products','inventory','movements','imei']],
 ['service','售后与二手机','Service & Used Devices',['tickets','returns','used']],
 ['finance','财务管理','Finance',['finance']],
 ['insights','分析与系统','Insights & Administration',['reports','audit','team','settings']]
];
const ERP_NAV_PREFS_KEY='rf_os_prod_nav_v3';
const ERP_GROUP_KEY='rf_os_prod_nav_groups_v3';
function erpReadPrefs(){
 try{
  const x=JSON.parse(localStorage.getItem(ERP_NAV_PREFS_KEY));
  if(x&&Array.isArray(x.pinned)&&x.visits&&typeof x.visits==='object')
   return {pinned:x.pinned.filter(k=>ERP_NAV.some(n=>n[0]===k)),visits:x.visits};
 }catch(e){}
 return {pinned:['dashboard','tasks','orders','tickets'],visits:{}};
}
let erpNavPrefs=erpReadPrefs();
let erpGroupPrefs=(()=>{
 try{const x=JSON.parse(localStorage.getItem(ERP_GROUP_KEY));return x&&typeof x==='object'?x:{}}catch(e){return {}}
})();
function erpSaveNavPrefs(){
 localStorage.setItem(ERP_NAV_PREFS_KEY,JSON.stringify(erpNavPrefs));
}
function erpPinNav(key){
 erpNavPrefs.pinned=erpNavPrefs.pinned.includes(key)?
 erpNavPrefs.pinned.filter(x=>x!==key):[...erpNavPrefs.pinned,key];
 erpSaveNavPrefs();erpRenderNav();
}
function erpToggleGroup(group){
 erpGroupPrefs[group]=erpGroupPrefs[group]===false?true:false;
 localStorage.setItem(ERP_GROUP_KEY,JSON.stringify(erpGroupPrefs));
 erpRenderNav();
}
function erpQuickNavigate(){
 const allowed=ERP_NAV.filter(x=>erpAllowed(x[0]));
 const m=erpModal('<input class="control" id="erpQuickSearch" placeholder="搜索模块 / Search module" style="width:100%;padding:10px">'+
 '<div class="quickgrid" id="erpQuickResults" style="margin-top:14px">'+allowed.map(([id,icon,cn,en])=>
 '<button type="button" class="btn quicklink" data-search="'+erpEsc(cn+' '+en)+'" data-jump="'+id+'">'+
 erpEsc(icon)+' '+erpEsc(lang==='en'?en:cn)+'</button>').join('')+'</div>'+
 '<p class="erp-mini">★ 可在侧边栏置顶。其余模块按照访问频次排列。</p>',
 '快速导航 / Quick jump');
 const bind=()=>{
  m.querySelectorAll('[data-jump]').forEach(btn=>btn.onclick=()=>{m.remove();erpNavigate(btn.dataset.jump)});
 };
 bind();
 m.querySelector('#erpQuickSearch').oninput=e=>{
  const q=e.target.value.trim().toLocaleLowerCase();
  m.querySelectorAll('[data-jump]').forEach(btn=>btn.style.display=btn.dataset.search.toLocaleLowerCase().includes(q)?'':'none');
 };
 m.querySelector('#erpQuickSearch').focus();
}
const ERP_MODULES={
 products:{title:'商品管理',en:'Products',tables:[['products','商品目录'],['sku_dictionary','SKU 字典'],['product_keyword_rules','SKU 识别规则']]},
 movements:{title:'库存流水',en:'Stock movements',tables:[['inventory_movements','正式库存流水']]},
 tasks:{title:'我的工作台',en:'My workspace',tables:[['work_tasks','工作任务']]},
 intake:{title:'订单复核与导入',en:'Order review & import',tables:[['import_batches','导入批次'],['order_source_records','历史源文件行'],['reconciliation_cases','数据质量异常']]},
 orders:{title:'销售订单',en:'Sales orders',tables:[['orders','订单主表'],['order_items','订单商品明细'],['order_status_history','订单状态历史']]},
 inventory:{title:'库存管理',en:'Inventory',tables:[['stock_balances','仓库库存']]},
 purchase:{title:'采购管理',en:'Purchasing',tables:[['purchase_orders','采购单'],['purchase_items','采购明细']]},
 shipping:{title:'发货履约',en:'Shipping',tables:[['shipments','正式出货记录'],['source_logistics_evidence','历史物流凭证']]},
 returns:{title:'退换货管理',en:'Returns & Exchanges',tables:[['returns','退换货申请'],['return_items','质检明细'],['refunds','退款记录']]},
 used:{title:'二手机业务',en:'Used devices',tables:[['used_devices','二手机台账'],['used_inspections','质检报告'],['used_orders','二手机订单'],['used_device_events','状态流水']]},
 tickets:{title:'售后工单',en:'Customer service',tables:[['tickets','售后工单'],['ticket_events','跟进事件']]},
 finance:{title:'财务发票',en:'Finance & invoices',tables:[['refunds','退款台账'],['invoices','发票台账']]},
 audit:{title:'操作日志',en:'Audit trail',tables:[['audit_events','真实审计流水']]},
 team:{title:'员工与角色',en:'Employees & roles',tables:[['staff_roles','员工角色'],['role_definitions','角色权限定义']]},
 imei:{title:'IMEI 全链路追踪',en:'IMEI Trace',tables:[['device_imeis','设备串码'],['imei_recognition_reviews','待核查识别结果']]},
 settings:{title:'设置与备份',en:'Settings',tables:[['channels','渠道配置'],['warehouses','仓库配置'],['product_keyword_rules','自动识别规则']]},
 reports:{title:'经营报告',en:'Business reports',tables:[['report_sales_by_month','月度渠道销售'],['report_order_stage_kpis','订单阶段分布'],['report_order_dates_quality','订单时间完整性'],['report_order_lifecycle','订单生命周期'],['report_source_product_mix','产品结构'],['report_review_queue','待核对队列'],['report_workflow_summary','工作流摘要']]}
};
const ERP_VIEWS={channels:'rfriend_erp_channels',warehouses:'rfriend_erp_warehouses',shipments:'rfriend_erp_shipments',orders:'rfriend_erp_orders',work_tasks:'rfriend_erp_tasks',staff_roles:'rfriend_erp_profile'};
const ERP_ROLE_ALLOW={
 admin:['*'],
 operations:['dashboard','tasks','intake','orders','products','inventory','movements','purchase','shipping','returns','used','tickets','finance','reports','audit','settings','team','imei'],
 support:['dashboard','tasks','orders','tickets','returns','imei','reports'],
 finance:['dashboard','tasks','orders','purchase','finance','reports'],
 warehouse:['dashboard','tasks','shipping','products','inventory','movements','purchase','returns','used','imei','reports']
};
const ERP_FIELDS={
 products:[['sku','SKU','text',1],['name','商品名称','text',1],['category','品类'],['ean','EAN'],['variant','规格'],['cost_eur','采购成本 EUR','number'],['price_eur','销售价格 EUR','number'],['low_stock_threshold','低库存阈值','number']],
 tickets:[['title','工单标题','text',1],['category','类型'],['description','问题描述'],['priority','优先级','select:low|medium|high|urgent']],
 purchase_orders:[['po_number','采购单号','text',1],['supplier','供应商','text',1],['warehouse_id','仓库 ID'],['status','状态','select:draft|requested']],
 orders:[['external_order_id','外部订单号','text',1],['channel_id','渠道 ID','text',1],['customer_name','客户姓名'],['order_status','状态','select:pending|confirmed'],['total_eur','金额 EUR','number']],
 returns:[['order_id','订单 UUID','text',1],['type','退换货类型','select:return|exchange'],['reason','原因','text',1]],
 work_tasks:[['title','任务标题','text',1],['task_type','任务类型','select:other|support|operations|finance|warehouse|review'],['assigned_role','分配岗位','select:support|operations|warehouse|finance'],['due_at','截止时间','datetime-local']],
 used_devices:[['imei','IMEI','text',1],['brand','品牌','text',1],['model','型号','text',1],['grade','成色级别','select:ungraded|A|B|C|D'],['purchase_cost_eur','采购成本 EUR','number'],['listing_price_eur','挂牌价 EUR','number']],
 invoices:[['invoice_number','发票号','text',1],['order_id','关联订单 UUID'],['invoice_type','发票类型','select:sales|purchase|credit_note'],['amount_eur','含税金额','number'],['vat_eur','VAT','number']],
 };
const ERP_CREATE={
 inventory:'products',purchase:'purchase_orders',orders:'orders',returns:'returns',tickets:'tickets',
 tasks:'work_tasks',used:'used_devices',finance:'invoices'
};
const ERP_COLUMNS={
 staff_roles:['email','role','active','created_at'],
 orders:['external_order_id','channel_code','ordered_at','customer_name','order_status','total_eur'],
 products:['sku','ean','product_description','category','cost_eur','price_eur'],
 stock_balances:['sku','ean','product_description','warehouse_name','quality_status','on_hand','reserved'],
 inventory_movements:['sku','ean','product_description','created_at','warehouse_name','quantity_delta','reason'],
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
const ERP_LABELS={product_description:'产品名称描述',warehouse_name:'仓库',warehouse_code:'仓库编码',email:'邮箱',id:'ID',external_order_id:'外部订单号',channel_code:'渠道',ordered_at:'下单时间',created_at:'创建时间',updated_at:'更新时间',customer_name:'客户姓名',order_status:'订单状态',total_eur:'金额 EUR',sku:'SKU',name:'名称',title:'标题',category:'分类',ean:'EAN',price_eur:'售价 EUR',cost_eur:'成本 EUR',low_stock_threshold:'低库存阈值',warehouse_id:'仓库 ID',product_id:'商品 ID',on_hand:'库存数量',reserved:'预留数量',quality_status:'质量状态',quantity_delta:'变动数量',reason:'原因',po_number:'采购单号',supplier:'供应商',status:'状态',shipment_number:'发货单号',carrier:'承运商',tracking_number:'物流单号',shipped_at:'发货时间',rma_number:'RMA 单号',return_status:'退换状态',inspection_status:'质检状态',ticket_number:'工单编号',priority:'优先级',payment_reference:'付款凭证',invoice_number:'发票号码',invoice_type:'发票类型',amount_eur:'金额 EUR',vat_eur:'VAT',brand:'品牌',model:'型号',grade:'成色',imei:'IMEI',task_type:'任务类型',assigned_role:'负责部门',due_at:'截止时间',source_sheet:'源表',source_status:'来源状态',product_family:'商品系列',validation_state:'数据验证',recorded_orders:'订单数量',sales_month:'月份',order_face_value_eur:'订单面额',delivered_orders:'签收订单',action:'操作',actor_id:'操作员',entity_type:'业务实体',entity_id:'关联 ID',user_id:'员工 ID',role:'角色',active:'启用',allowed_modules:'允许模块'};
const ERP_CACHE=new Map();
let erpCurrentUserIdentity=null;
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
function erpBuildTopActions(){
 const bar=document.querySelector('.top .actions');if(!bar||bar.querySelector('#erpQuickAction'))return;
 const buttons=document.createElement('div');buttons.className='erp-actions';buttons.id='erpGlobalActions';
 buttons.innerHTML='<button id="erpBackup" class="btn">↓ 备份数据</button>'+
 '<button id="erpRestore" class="btn">↑ 恢复备份</button>'+
 '<button id="erpBulkGlobal" class="btn">⇪ 批量添加</button>'+
 '<button id="erpQuickAction" class="btn primary">＋ 快速操作</button>';
 bar.insertBefore(buttons,bar.firstChild);
 buttons.querySelector('#erpBackup').onclick=erpBackup;
 buttons.querySelector('#erpRestore').onclick=erpRestorePreview;
 buttons.querySelector('#erpBulkGlobal').onclick=()=>erpChooseAction('bulk');
 buttons.querySelector('#erpQuickAction').onclick=()=>erpChooseAction('new');
 buttons.insertAdjacentHTML('afterbegin','<button id="erpGlobalQuickNav" class="btn">⌕ 快速导航</button>');
 buttons.querySelector('#erpGlobalQuickNav').onclick=erpQuickNavigate;
}
async function erpBackup(){
 if(profile?.role!=='admin'){alert('仅管理员允许导出全业务数据。');return;}
 const m=erpModal('<p>将导出当前授权范围内已录入的 ERP 数据记录（JSON）。这不是 Supabase 数据库级备份，不包含存储文件、数据库对象或用户密码。</p>'+
 '<p id="erpBackupStatus">正在汇总业务表…</p>','导出业务数据');
 const entities=[...new Set(Object.values(ERP_MODULES).flatMap(x=>x.tables.map(([k])=>k)))];
 const dump={app:'Rfriend Business OS',generated_at:new Date().toISOString(),type:'business_data_export',tables:{},errors:[]};
 for(const entity of entities){
  const status=m.querySelector('#erpBackupStatus');if(!status)break;status.textContent='正在读取 '+entity+'…';
  try{dump.tables[entity]=await erpData(entity)}catch(e){dump.errors.push(entity+': '+errorMessage(e))}
 }
 const blob=new Blob([JSON.stringify(dump,null,2)],{type:'application/json'});
 const link=URL.createObjectURL(blob),a=document.createElement('a');a.href=link;a.download='rfriend-erp-export-'+new Date().toISOString().slice(0,10)+'.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(link),2000);
 if(m.querySelector('#erpBackupStatus'))m.querySelector('#erpBackupStatus').textContent='导出完成：'+Object.keys(dump.tables).length+' 张表。失败 '+dump.errors.length+' 张。请妥善保管客户数据。';
}
function erpRestorePreview(){
 const m=erpModal('<div class="erp-blocked">安全说明：生产数据库不允许直接用本地 JSON 覆盖。备份恢复需核对版本、外键、重复记录并经过审批。</div>'+
 '<p style="margin-top:15px">你可以先选择之前导出的 JSON 文件，在此查看表名及记录数量，不会写入数据库。</p>'+
 '<input id="erpRestoreFile" type="file" accept=".json,application/json"><div id="erpRestoreResult" style="margin-top:15px"></div>','恢复备份 · 只读预检');
 m.querySelector('#erpRestoreFile').onchange=async e=>{
  try{
   const src=JSON.parse(await e.target.files[0].text());
   if(!src||!src.tables||src.type!=='business_data_export')throw new Error('非 ERP 业务备份文件');
   m.querySelector('#erpRestoreResult').innerHTML=erpPanel('备份内容（尚未恢复）',
   '<div class="tablewrap"><table><thead><tr><th>业务表</th><th>记录数</th></tr></thead><tbody>'+
   Object.entries(src.tables).map(([k,v])=>'<tr><td>'+erpEsc(k)+'</td><td>'+ (Array.isArray(v)?v.length:'异常')+'</td></tr>').join('')+
   '</tbody></table></div><p class="erp-blocked">为防止覆盖真实业务，整库恢复必须由服务器管理员审核执行。</p>');
  }catch(err){m.querySelector('#erpRestoreResult').textContent='文件不符合 ERP 备份结构：'+errorMessage(err)}
 };
}
function erpChooseAction(mode){
 const list=Object.keys(ERP_FIELDS).filter(x=>profile?.role==='admin'||(
  ['tickets','returns','work_tasks'].includes(x)&&profile?.role==='support')||(
  ['products','purchase_orders','orders','used_devices','tickets'].includes(x)&&profile?.role==='operations')||(
  ['purchase_orders','invoices','work_tasks'].includes(x)&&profile?.role==='finance')||(
  ['used_devices','work_tasks'].includes(x)&&profile?.role==='warehouse'));
 const m=erpModal('<div class="erp-toolbar">'+list.map(key=>'<button data-erp-action="'+erpEsc(key)+'" class="btn">'+erpEsc(key)+'</button>').join('')+'</div>','快速'+(mode==='bulk'?'批量导入':'新建业务'));
 m.querySelectorAll('[data-erp-action]').forEach(button=>button.onclick=()=>{
  const entity=button.dataset.erpAction;m.remove();
  if(mode==='bulk'){erpTab=entity;erpBulkModal()}else if(typeof window.erpV4Create==='function'){
    Promise.resolve(window.erpV4Create(entity)).then(handled=>{if(!handled)erpOpenCreate(entity)}).catch(err=>alert(errorMessage(err)));
   }else erpOpenCreate(entity);
 });
}
function erpBuildNav(){
 const root=document.querySelector('.sidebar');
 root.innerHTML='<div class="brand">Rfriend <span>OS</span><small>OPPO Austria · Business ERP v3</small></div>'+
 '<div class="nav-search"><input id="erpNavSearch" aria-label="Search navigation" placeholder="快速导航 / Search…">'+
 '<button id="erpNavQuick" title="Quick navigation">⌕</button></div>'+
 '<div id="erpNavGroups"></div>'+
 '<div class="erp-mini erp-prod-foot">真实生产数据 · Supabase Frankfurt<br>员工权限由服务端验证</div>';
 root.querySelector('#erpNavSearch').addEventListener('input',erpRenderNav);
 root.querySelector('#erpNavQuick').addEventListener('click',erpQuickNavigate);
 erpRenderNav();
}
function erpRenderNav(){
 const q=(document.querySelector('#erpNavSearch')?.value||'').trim().toLocaleLowerCase();
 const root=document.querySelector('#erpNavGroups');if(!root)return;
 const allowed=ERP_NAV.filter(x=>erpAllowed(x[0]));
 const isMatch=x=>(x[2]+' '+x[3]).toLocaleLowerCase().includes(q);
 const pinned=allowed.filter(x=>erpNavPrefs.pinned.includes(x[0])).filter(x=>!q||isMatch(x));
 const navItem=([key,icon,zh,en])=>'<div class="navitem">'+
 '<button class="nav '+(erpSelectedPage===key?'active':'')+'" data-erp-nav="'+key+'">'+
 '<span class="nav-symbol">'+erpEsc(icon)+'</span>'+(lang==='zh'?erpEsc(zh):erpEsc(en))+'</button>'+
 '<button class="pin '+(erpNavPrefs.pinned.includes(key)?'is-pinned':'')+'" data-erp-pin="'+key+'" title="'+
 (lang==='zh'?'置顶 / 取消置顶':'Pin / unpin')+'">'+(erpNavPrefs.pinned.includes(key)?'★':'☆')+'</button></div>';
 let html='';
 if(pinned.length)html+='<div class="nav-group-title nav-favorites">★ '+(lang==='zh'?'常用功能':'Favorites')+'</div>'+
 pinned.map(navItem).join('');
 for(const [id,zh,en,items] of ERP_GROUPS){
  const groupItems=allowed.filter(x=>items.includes(x[0])&&!erpNavPrefs.pinned.includes(x[0]));
  const matching=groupItems.filter(x=>!q||isMatch(x));
  if(!matching.length)continue;
  matching.sort((a,b)=>(erpNavPrefs.visits[b[0]]||0)-(erpNavPrefs.visits[a[0]]||0)||
   ERP_NAV.findIndex(x=>x[0]===a[0])-ERP_NAV.findIndex(x=>x[0]===b[0]));
  const open=!!q||erpGroupPrefs[id]!==false||matching.some(x=>x[0]===erpSelectedPage);
  html+='<button class="nav-group-title nav-group-toggle" data-erp-group="'+id+'" aria-expanded="'+open+'">'+
   '<span>'+(lang==='zh'?erpEsc(zh):erpEsc(en))+'</span><span>'+(open?'⌄':'›')+'</span></button>';
  if(open)html+=matching.map(navItem).join('');
 }
 root.innerHTML=html||'<div class="nav-nothing">'+(lang==='zh'?'没有匹配的功能':'No matching feature')+'</div>';
 root.querySelectorAll('[data-erp-group]').forEach(btn=>btn.onclick=()=>erpToggleGroup(btn.dataset.erpGroup));
 root.querySelectorAll('[data-erp-nav]').forEach(btn=>btn.onclick=()=>erpNavigate(btn.dataset.erpNav));
 root.querySelectorAll('[data-erp-pin]').forEach(btn=>btn.onclick=()=>erpPinNav(btn.dataset.erpPin));
}
function erpNavigate(pageId){
 if(!erpAllowed(pageId))return;
 erpSelectedPage=pageId;erpTab='';erpSearch='';erpOffset=0;
 erpNavPrefs.visits[pageId]=(erpNavPrefs.visits[pageId]||0)+1;
 erpSaveNavPrefs();erpRenderNav();render();
 window.scrollTo({top:0,behavior:'smooth'});
}
function erpPanel(title,content,subtitle=''){
 return '<section class="panel"><div class="erp-header"><div><h3>'+erpEsc(title)+'</h3>'+(subtitle?'<div class="erp-sub">'+erpEsc(subtitle)+'</div>':'')+'</div></div>'+content+'</section>';
}
function erpMetric(label,num,detail=''){return '<div class="card"><small>'+erpEsc(label)+'</small><strong>'+erpEsc(num)+'</strong><small>'+erpEsc(detail)+'</small></div>'}
function erpTable(data,key){
 const cols=ERP_COLUMNS[key]||Object.keys(data[0]||{}).filter(k=>k!=='raw_data').slice(0,7);
 const first=erpOffset*50;
 const rows=data.slice(first,first+50).map((row,i)=>'<tr>'+cols.map(k=>'<td title="'+erpEsc(erpValue(row[k],k))+'">'+erpEsc(erpValue(row[k],k)).slice(0,140)+'</td>').join('')+
 '<td><button class="btn erp-view" data-index="'+(first+i)+'" style="padding:6px 8px">详情 / 操作</button></td></tr>');
 return '<div class="erp-scroll tablewrap"><table><thead><tr>'+[...cols.map(k=>ERP_LABELS[k]||k),'操作'].map(k=>'<th>'+erpEsc(k)+'</th>').join('')+'</tr></thead><tbody>'+
 (rows.length?rows.join(''):'<tr><td colspan="'+(cols.length+1)+'" class="erp-empty">暂无记录（数据库未录入或当前角色无权限）</td></tr>')+'</tbody></table></div>'+
 '<div class="erp-pagination"><button id="erpPrev" class="btn" '+(erpOffset===0?'disabled':'')+'>上一页</button><span>第 '+(erpOffset+1)+' / '+Math.max(1,Math.ceil(data.length/50))+' 页 · 共 '+data.length+' 条</span><button id="erpNext" class="btn" '+(first+50>=data.length?'disabled':'')+'>下一页</button></div>';
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
 if(name==='staff_roles'&&profile?.role==='admin'){
  const items=await authorized('/rest/v1/rpc/rfriend_erp_staff_directory',{method:'POST',body:{}});
  ERP_CACHE.set(name,items);return items;
 }
 if(name==='orders'&&orders.length){
  ERP_CACHE.set(name,orders);return orders;
 }
 const view=ERP_VIEWS[name]||'rfriend_erp_'+name;
 const orderBy={
  stock_balances:'warehouse_id.asc,product_id.asc,quality_status.asc',
  inventory_v4:'warehouse_code.asc,sku.asc,quality_status.asc',
  purchase_tracking:'po_number.asc,id.asc',
  purchase_delivery_alerts:'alert_created_at.desc,id.asc',
  imei_trace:'created_at.desc,id.asc',
  imei_register:'imei.asc',
  used_orders_trace:'ordered_at.desc,used_order_id.asc',
  used_orders_v5:'ordered_at.desc,used_order_id.asc',
  inventory_weekly_snapshots:'week_start.desc,warehouse_id.asc,product_id.asc,quality_status.asc',
  inventory_external_counts:'week_start.desc,warehouse_id.asc,product_id.asc,quality_status.asc,source.asc',
  inventory_adjustment_requests:'requested_at.desc,id.asc',inventory_dos:'product_id.asc,lookback_days.asc',
  channels:'code.asc',warehouses:'code.asc',role_definitions:'code.asc',
  source_logistics_evidence:'source_record_id.asc',
  source_product_matches:'source_record_id.asc',
  product_keyword_rules:'priority.asc,id.asc'
 }[name]||(['report_channel_order_intake','report_operations_pipeline','report_order_dates_quality','report_order_lifecycle','report_order_linkage','report_order_stage_kpis','report_review_queue','report_sales_by_month','report_source_product_mix','report_workflow_summary'].includes(name)?'': 'id.asc');
 const combined=[];
 const maxRows=20000;
 for(let offset=0;offset<maxRows;offset+=ERP_MAX){
  const query='/rest/v1/'+view+'?select=*'+(orderBy?'&order='+orderBy:'')+'&limit='+ERP_MAX+'&offset='+offset;
  const data=await authorized(query);
  if(!Array.isArray(data))throw new Error('Unexpected database response for '+name);
  combined.push(...data);
  if(data.length<ERP_MAX){ERP_CACHE.set(name,combined);return combined}
 }
 throw new Error('The table exceeds the 20,000-row page safety limit: '+name+'. No partial records shown.');
}
function erpCSV(rows){if(!rows.length)return '';const keys=Object.keys(rows[0]);return [keys,...rows.map(o=>keys.map(k=>o[k]))].map(row=>row.map(v=>'"'+String((typeof v==='object'?JSON.stringify(v):v)??'').replaceAll('"','""')+'"').join(',')).join('\r\n')}
function erpDownload(name,rows){
 const csv=erpCSV(rows);const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='rfriend-'+name+'-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),300);
}
const ERP_WORKFLOW={
 tickets:{new:['assigned','in_progress'],assigned:['in_progress','waiting_customer','waiting_operations','waiting_finance'],
  in_progress:['waiting_customer','waiting_operations','waiting_finance','resolved'],
  waiting_customer:['in_progress','resolved'],waiting_operations:['in_progress','resolved'],
  waiting_finance:['in_progress','resolved'],resolved:['closed']},
 work_tasks:{open:['in_progress','blocked','done','cancelled'],in_progress:['blocked','done','cancelled'],
  blocked:['in_progress','cancelled'],done:['open']},
 purchase_orders:{draft:['submitted','cancelled'],submitted:['approved','cancelled'],approved:['ordered']},
 returns:{requested:['approved','rejected'],approved:['awaiting_customer','in_transit'],awaiting_customer:['in_transit'],
  in_transit:['received'],received:['inspection'],inspection:['resolved'],resolved:['closed']},
 orders:{pending:['confirmed','cancel_requested'],confirmed:['cancel_requested'],cancel_requested:['cancelled']}
};
function erpBindDetail(rows,table){
 document.querySelectorAll('.erp-view').forEach(b=>b.onclick=()=>{
  const row=rows[Number(b.dataset.index)];if(!row)return;
  const state=(table==='returns'?row.return_status:table==='orders'?row.order_status:row.status);
  const options=ERP_WORKFLOW[table]?.[state]||[];
  const workflow=options.length&&row.id?
    '<div class="erp-blocked" style="margin:15px 0">状态变更由 Supabase 服务端验证角色、前后状态并写入审计日志。不会自动执行库存扣减或支付退款。</div>'+
    '<form id="erpStateForm"><div class="erp-fields"><div class="erp-field"><label>推进至状态</label><select name="status">'+
     options.map(x=>'<option value="'+erpEsc(x)+'">'+erpEsc(x)+'</option>').join('')+
    '</select></div><div class="erp-field"><label>处理备注</label><input name="note" placeholder="说明处理结果与依据"></div></div>'+
    '<div class="erp-actions" style="margin-top:14px"><button class="primary" type="submit">确认状态流转</button></div>'+
    '<p id="erpStatusMsg"></p></form>':
    '<div class="erp-mini" style="margin-top:14px">当前记录仅可查看详情；此状态暂没有可执行的操作，或相应业务操作未开放。</div>';
  const modal=erpModal('<dl class="erp-kv">'+Object.entries(row).map(([k,v])=>
   '<dt>'+erpEsc(ERP_LABELS[k]||k)+'</dt><dd>'+erpEsc(erpValue(v,k))+'</dd>').join('')+'</dl>'+workflow,
   ERP_MODULES[erpSelectedPage]?.title||table);
  erpAttachPurchaseActions(modal,table,row);
  erpAttachServiceActions(modal,table,row);
  erpAttachInspectionActions(modal,table,row);
  modal.querySelector('#erpStateForm')?.addEventListener('submit',async e=>{
   e.preventDefault();const body=Object.fromEntries(new FormData(e.target));
   const btn=e.target.querySelector('[type=submit]'),status=modal.querySelector('#erpStatusMsg');btn.disabled=true;
   try{
    await authorized('/rest/v1/rpc/rfriend_erp_advance_status',{method:'POST',
     body:{p_entity:table,p_id:row.id,p_status:body.status,p_note:body.note}});
    status.textContent='状态已成功更新至 '+body.status;status.style.color='#128257';
    ERP_CACHE.delete(table);erpDrawRows();
   }catch(err){status.textContent='更新失败：'+errorMessage(err);status.style.color='#b03432'}
   finally{btn.disabled=false}
  });
 });
}
function erpAttachPurchaseActions(modal,table,row){
 if(table==='purchase_orders'&&row.status==='draft'&&['admin','operations','finance'].includes(profile?.role)){
  const wrap=document.createElement('div');wrap.className='erp-toolbar';
  wrap.innerHTML='<button id="erpAddPOLine" class="primary">＋ 添加采购商品行</button>';
  modal.querySelector('.erp-modal-body').appendChild(wrap);
  wrap.querySelector('#erpAddPOLine').onclick=async()=>{
   const products=await erpData('products');
   if(!products.length){alert('请先在商品管理中创建真实 SKU');return}
   const body='<form id="erpPOLineForm"><div class="erp-fields"><div class="erp-field"><label>商品 SKU</label><select name="product" required>'+
    products.map(p=>'<option value="'+erpEsc(p.id)+'">'+erpEsc(p.sku)+' · '+erpEsc(p.name)+'</option>').join('')+
    '</select></div><div class="erp-field"><label>采购数量</label><input name="quantity" type="number" min="1" required></div>'+
    '<div class="erp-field"><label>单价 EUR</label><input name="cost" type="number" min="0" step="0.01" required></div></div>'+
    '<div class="erp-actions" style="margin-top:15px"><button type="submit" class="primary">添加采购行</button></div><p id="erpLineFeedback"></p></form>';
   const old=modal.querySelector('#erpPOInline');old?.remove();
   const area=document.createElement('div');area.id='erpPOInline';area.innerHTML=body;
   modal.querySelector('.erp-modal-body').appendChild(area);
   area.querySelector('#erpPOLineForm').onsubmit=async e=>{
    e.preventDefault();const fd=Object.fromEntries(new FormData(e.target)),btn=e.target.querySelector('button');
    btn.disabled=true;const feedback=area.querySelector('#erpLineFeedback');
    try{
     await authorized('/rest/v1/rpc/rfriend_erp_purchase_add_line',{method:'POST',
      body:{p_po_id:row.id,p_product_id:fd.product,p_quantity:Number(fd.quantity),p_unit_cost_eur:Number(fd.cost)}});
     feedback.textContent='采购明细已保存';feedback.style.color='#128257';ERP_CACHE.delete('purchase_items');
    }catch(err){feedback.textContent=errorMessage(err);feedback.style.color='#b03432'}
    finally{btn.disabled=false}
   };
  };
 }
 if(table==='purchase_items'&&['admin','operations','warehouse'].includes(profile?.role)){
  const remain=Number(row.quantity)-Number(row.received_quantity);
  if(remain<1)return;
  const area=document.createElement('div');area.innerHTML='<div class="erp-blocked">请先确保采购单已批准并处于 ordered 或 part_received 状态。该动作会正式增加仓库库存并记录库存流水。</div>'+
   '<form id="erpReceiveForm"><div class="erp-fields"><div class="erp-field"><label>本次收货数量（剩余 '+remain+'）</label><input type="number" name="quantity" min="1" max="'+remain+'" required></div></div>'+
   '<div class="erp-actions" style="margin-top:15px"><button type="submit" class="primary">确认收货并入库</button></div><p id="erpReceiveFeedback"></p></form>';
  modal.querySelector('.erp-modal-body').appendChild(area);
  area.querySelector('#erpReceiveForm').onsubmit=async e=>{
   e.preventDefault();const btn=e.target.querySelector('button'),quantity=Number(e.target.elements.quantity.value);
   btn.disabled=true;const status=area.querySelector('#erpReceiveFeedback');
   try{
    const result=await authorized('/rest/v1/rpc/rfriend_erp_receive_purchase_line',{method:'POST',
     body:{p_item_id:row.id,p_quantity:quantity,p_idempotency_key:crypto.randomUUID()}});
    status.textContent='仓库正式入库成功：'+quantity+' 件，流水 '+result.movement_id;status.style.color='#128257';
    for(const key of ['purchase_items','purchase_orders','stock_balances','inventory_movements'])ERP_CACHE.delete(key);
   }catch(err){status.textContent=errorMessage(err);status.style.color='#b03432';btn.disabled=false}
  };
 }
}
function erpRefundCreate(){
 const m=erpModal('<form id="erpRefundForm"><p>申请仅进入 ERP 退款审批流程，提交后不会调用支付平台或向客户打款。</p>'+
 '<div class="erp-fields"><div class="erp-field"><label>订单 UUID</label><input name="order" required></div>'+
 '<div class="erp-field"><label>退货单 UUID（可选）</label><input name="return_id"></div>'+
 '<div class="erp-field"><label>退款金额 EUR</label><input name="amount" min="0.01" step="0.01" type="number" required></div></div>'+
 '<div class="erp-actions" style="margin-top:16px"><button type="submit" class="primary">提交退款申请</button></div><p id="erpRefundFeedback"></p></form>','发起退款申请');
 m.querySelector('#erpRefundForm').onsubmit=async e=>{
  e.preventDefault();const form=Object.fromEntries(new FormData(e.target));
  const status=m.querySelector('#erpRefundFeedback'),btn=e.target.querySelector('button');btn.disabled=true;
  try{
   await authorized('/rest/v1/rpc/rfriend_erp_refund_request',{method:'POST',
    body:{p_order_id:form.order,p_return_id:form.return_id||null,p_amount_eur:Number(form.amount)}});
   status.textContent='退款申请已登记，等待财务复核。';status.style.color='#128257';ERP_CACHE.delete('refunds');ERP_CACHE.delete('returns');
  }catch(err){status.textContent=errorMessage(err);status.style.color='#b03432'}finally{btn.disabled=false}
 };
}
function erpAttachServiceActions(modal,table,row){
 if(table==='tickets'&&row.id&&['admin','operations','support'].includes(profile?.role)){
  const area=document.createElement('div');
  area.innerHTML='<section style="margin-top:20px"><h3>新增售后跟进记录</h3>'+
   '<form id="erpTicketNote"><textarea name="note" required placeholder="客户反馈、技术排查进展、下一步跟进安排…" style="width:100%;min-height:90px;padding:10px;border:1px solid #d9e2dc;border-radius:8px"></textarea>'+
   '<div class="erp-actions" style="margin-top:12px"><button type="submit" class="primary">保存跟进记录</button></div><p id="erpTicketNoteStatus"></p></form></section>';
  modal.querySelector('.erp-modal-body').appendChild(area);
  area.querySelector('#erpTicketNote').onsubmit=async e=>{
   e.preventDefault();const note=new FormData(e.target).get('note'),status=area.querySelector('#erpTicketNoteStatus');
   const btn=e.target.querySelector('button');btn.disabled=true;
   try{
    await authorized('/rest/v1/rpc/rfriend_erp_ticket_comment',{method:'POST',body:{p_ticket_id:row.id,p_body:note}});
    status.textContent='跟进已记录到真实工单事件流水。';status.style.color='#128257';
    e.target.reset();ERP_CACHE.delete('ticket_events');
   }catch(err){status.textContent=errorMessage(err);status.style.color='#b03432'}
   finally{btn.disabled=false}
  };
 }
 if(table==='refunds'&&row.id&&['admin','finance'].includes(profile?.role)){
  const statusOptions={requested:['approved','cancelled'],approved:['submitted','cancelled'],
   submitted:['paid','failed'],failed:['approved']}[row.status]||[];
  if(!statusOptions.length)return;
  const area=document.createElement('div');
  area.innerHTML='<section style="margin-top:20px"><h3>财务退款审核 / 回执登记</h3>'+
   '<div class="erp-blocked">本操作只记录财务审批状态；只有实际支付平台确认资金退还后，才能选择 paid 并填写退款交易号。申请人与批准人不能相同。</div>'+
   '<form id="erpRefundAdvance"><div class="erp-fields">'+
   '<div class="erp-field"><label>下一状态</label><select name="status">'+statusOptions.map(k=>'<option>'+k+'</option>').join('')+'</select></div>'+
   '<div class="erp-field"><label>支付平台退款流水号（paid 时必填）</label><input name="reference"></div></div>'+
   '<div class="erp-actions" style="margin-top:12px"><button type="submit" class="primary">确认财务状态</button></div><p id="erpRefundAdvanceStatus"></p></form></section>';
  modal.querySelector('.erp-modal-body').appendChild(area);
  area.querySelector('#erpRefundAdvance').onsubmit=async e=>{
   e.preventDefault();const vals=Object.fromEntries(new FormData(e.target)),status=area.querySelector('#erpRefundAdvanceStatus'),btn=e.target.querySelector('button');btn.disabled=true;
   try{
    await authorized('/rest/v1/rpc/rfriend_erp_refund_advance',{method:'POST',
     body:{p_refund_id:row.id,p_status:vals.status,p_payment_reference:vals.reference||null}});
    status.textContent='退款台账状态已更新：'+vals.status;status.style.color='#128257';ERP_CACHE.delete('refunds');ERP_CACHE.delete('returns');
   }catch(err){status.textContent=errorMessage(err);status.style.color='#b03432'}finally{btn.disabled=false}
  };
 }
}
async function erpImeiEditor(){
 const [products,depots]=await Promise.all([erpData('products'),erpData('warehouses')]);
 if(!products.length){alert('请先在商品管理中创建 SKU。');return}
 const body='<p class="erp-blocked">新增串码登记为 quarantine（待核查）状态，不会自动增加库存或变更可售数量。</p>'+
 '<form id="erpImeiForm"><div class="erp-fields"><div class="erp-field"><label>IMEI（15位数字）</label><input name="imei" pattern="[0-9]{15}" required maxlength="15" autocomplete="off"></div>'+
 '<div class="erp-field"><label>商品 SKU</label><select name="product">'+products.map(p=>'<option value="'+erpEsc(p.id)+'">'+erpEsc(p.sku)+'</option>').join('')+'</select></div>'+
 '<div class="erp-field"><label>所属仓库</label><select name="warehouse"><option value="">暂未指定</option>'+depots.map(w=>'<option value="'+erpEsc(w.id)+'">'+erpEsc(w.name)+'</option>').join('')+'</select></div></div>'+
 '<div class="erp-actions" style="margin-top:15px"><button type="submit" class="primary">确认串码登记</button></div><p id="erpImeiStatus"></p></form>';
 const m=erpModal(body,'IMEI 串码登记');
 m.querySelector('#erpImeiForm').onsubmit=async e=>{
  e.preventDefault();const val=Object.fromEntries(new FormData(e.target)),btn=e.target.querySelector('button'),status=m.querySelector('#erpImeiStatus');
  btn.disabled=true;try{
   await authorized('/rest/v1/rpc/rfriend_erp_register_imei',{method:'POST',
    body:{p_imei:val.imei,p_product_id:val.product,p_warehouse_id:val.warehouse||null}});
   status.textContent='已成功登记 IMEI，状态：quarantine';status.style.color='#128257';ERP_CACHE.delete('device_imeis');
  }catch(err){status.textContent=errorMessage(err);status.style.color='#b03432'}finally{btn.disabled=false}
 };
}
function erpAttachInspectionActions(modal,table,row){
 if(!['admin','operations','warehouse'].includes(profile?.role))return;
 if(table==='used_devices'&&['awaiting_inspection','inspecting','returned_quarantine','repair'].includes(row.status)){
  const area=document.createElement('div');
  area.innerHTML='<section style="margin-top:20px"><h3>二手机入库质检报告</h3>'+
   '<form id="erpUsedInspection"><div class="erp-fields"><div class="erp-field"><label>质检成色</label>'+
   '<select name="grade">'+['A','B','C','D'].map(v=>'<option>'+v+'</option>').join('')+'</select></div>'+
   '<div class="erp-field"><label>电池健康度 %</label><input name="battery" type="number" min="0" max="100" required></div>'+
   '<div class="erp-field"><label>屏幕情况</label><input name="screen"></div><div class="erp-field"><label>外壳情况</label><input name="housing"></div>'+
   '<div class="erp-field"><label>质检结论</label><select name="outcome"><option value="ready">合格可售</option><option value="repair">维修</option><option value="scrapped">报废</option></select></div>'+
   '<div class="erp-field"><label>备注</label><input name="notes"></div></div>'+
   '<div class="erp-actions" style="margin-top:15px"><button type="submit" class="primary">保存质检报告</button></div><p id="erpUsedInspectionStatus"></p></form></section>';
  modal.querySelector('.erp-modal-body').appendChild(area);
  area.querySelector('#erpUsedInspection').onsubmit=async e=>{
   e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),status=area.querySelector('#erpUsedInspectionStatus'),btn=e.target.querySelector('button');btn.disabled=true;
   try{
    await authorized('/rest/v1/rpc/rfriend_erp_inspect_used_device',{method:'POST',body:{
     p_device_id:row.id,p_grade:v.grade,p_battery_health:Number(v.battery),p_screen:v.screen,p_housing:v.housing,p_outcome:v.outcome,p_notes:v.notes
    }});
    status.textContent='质检报告已保存';status.style.color='#128257';ERP_CACHE.delete('used_devices');ERP_CACHE.delete('used_inspections');
   }catch(err){status.textContent=errorMessage(err);status.style.color='#b03432'}finally{btn.disabled=false}
  };
 }
 if(table==='returns'&&['received','inspection'].includes(row.return_status)){
  const area=document.createElement('div');
  area.innerHTML='<section style="margin-top:20px"><h3>退货质检结果</h3>'+
   '<div class="erp-blocked">质检只记录状态，不自动入库或申请退款。</div>'+
   '<form id="erpReturnInspect"><div class="erp-fields"><div class="erp-field"><label>质检结论</label>'+
   '<select name="result"><option value="sellable">合格可售</option><option value="repair">需维修</option><option value="scrap">需报废</option><option value="disputed">存在争议</option></select></div>'+
   '<div class="erp-field"><label>质检说明</label><input name="notes"></div></div>'+
   '<div class="erp-actions" style="margin-top:15px"><button type="submit" class="primary">保存质检结果</button></div><p id="erpReturnInspectStatus"></p></form></section>';
  modal.querySelector('.erp-modal-body').appendChild(area);
  area.querySelector('#erpReturnInspect').onsubmit=async e=>{
   e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),status=area.querySelector('#erpReturnInspectStatus'),btn=e.target.querySelector('button');btn.disabled=true;
   try{
    await authorized('/rest/v1/rpc/rfriend_erp_inspect_return',{method:'POST',
     body:{p_return_id:row.id,p_result:v.result,p_notes:v.notes}});
    status.textContent='质检结果保存成功';status.style.color='#128257';ERP_CACHE.delete('returns');
   }catch(err){status.textContent=errorMessage(err);status.style.color='#b03432'}finally{btn.disabled=false}
  };
 }
}
function erpTitle(id){return ERP_NAV.find(x=>x[0]===id)?.[lang==='en'?3:2]||'经营总览'}
async function erpOpenCreate(entity){
 const defs=ERP_FIELDS[entity];if(!defs){erpModal('<p>该模块的创建动作尚未开放服务端接口。</p>');return}
 const [availableWarehouses,availableChannels]=await Promise.all([
  erpData('warehouses').catch(()=>[]),erpData('channels').catch(()=>[])]);
 const items=defs.map(([key,label,type='text',required])=>{
  const select=type.startsWith('select:');
  return '<div class="erp-field '+(key==='description'?'wide':'')+'"><label>'+erpEsc(label)+'</label>'+
  ((key==='warehouse_id'||key==='channel_id')?
   '<select name="'+key+'" '+(required?'required':'')+'><option value="">选择'+erpEsc(label)+'</option>'+
   (key==='warehouse_id'?availableWarehouses:availableChannels).map(x=>'<option value="'+erpEsc(x.id)+'">'+erpEsc(x.name||x.code)+'</option>').join('')+'</select>':
   select?'<select name="'+key+'">'+type.slice(7).split('|').map(v=>'<option value="'+erpEsc(v)+'">'+erpEsc(v)+'</option>').join('')+'</select>':
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
   ERP_CACHE.delete(entity);
   if(entity==='orders'){
    orders=[];await loadData();
   }else await erpRenderPage();
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
 (ERP_FIELDS[erpTab]?'<button class="primary" id="erpAdd">＋ 新建</button>':'')+
 (erpTab==='refunds'?'<button class="primary" id="erpRequestRefund">＋ 申请退款</button>':'')+
 (slug==='shipping'&&erpTab==='shipments'?'<button class="primary" id="erpManualShipment">＋ 手工发货</button>':'')+
 (slug==='imei'&&erpTab==='device_imeis'?'<button class="primary" id="erpRegisterImei">＋ 登记 IMEI</button>':'')+
 (slug==='team'&&erpTab==='staff_roles'&&profile?.role==='admin'?'<button class="primary" id="erpStaffEdit">＋ 授予员工权限</button>':'')+
 '</div><div id="erpRecords"><p class="erp-empty">正在从 Supabase 读取…</p></div>','数据源：erp.'+erpTab+' · 角色：'+(profile?.role||'-'));
 document.querySelectorAll('[data-erp-tab]').forEach(b=>b.onclick=()=>{erpTab=b.dataset.erpTab;erpSearch='';erpOffset=0;render()});
 document.querySelector('#erpSearchRun').onclick=()=>{erpSearch=document.querySelector('#erpSearch').value.trim();erpOffset=0;erpDrawRows()};
 document.querySelector('#erpSearch').onkeydown=e=>{if(e.key==='Enter'){erpSearch=e.target.value.trim();erpOffset=0;erpDrawRows()}};
 document.querySelector('#erpReload').onclick=()=>{ERP_CACHE.delete(erpTab);erpDrawRows()};
 document.querySelector('#erpAdd')?.addEventListener('click',()=>erpOpenCreate(erpTab));
 document.querySelector('#erpRequestRefund')?.addEventListener('click',()=>erpRefundCreate());
 document.querySelector('#erpRegisterImei')?.addEventListener('click',()=>erpImeiEditor());
 document.querySelector('#erpManualShipment')?.addEventListener('click',()=>{
  const m=erpModal(shipmentView(),'手工发货 · 需仓库确认');bindPage();
 });
 document.querySelector('#erpStaffEdit')?.addEventListener('click',()=>erpStaffEditor());
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
  document.querySelector('#erpPrev')?.addEventListener('click',()=>{if(erpOffset>0){erpOffset--;erpDrawRows()}});
  document.querySelector('#erpNext')?.addEventListener('click',()=>{if((erpOffset+1)*50<filtered.length){erpOffset++;erpDrawRows()}});
 }catch(e){
  target.innerHTML='<div class="erp-blocked">接口读取失败：'+erpEsc(errorMessage(e))+'。请检查该角色的模块权限和 Supabase API 设置。</div>';
 }
}
function erpCsvParse(input){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(c==='"'&&quoted&&input[i+1]==='"'){cell+='"';i++}
  else if(c==='"'){quoted=!quoted}
  else if(c===','&&!quoted){row.push(cell);cell=''}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.length))rows.push(row);row=[];cell=''}
  else cell+=c;
 }
 row.push(cell);if(row.some(x=>x.length))rows.push(row);
 if(quoted)throw new Error('CSV 双引号没有关闭');
 return rows;
}
function erpStaffEditor(){
 const m=erpModal('<form id="erpStaffForm"><div class="erp-fields">'+
 '<div class="erp-field"><label>员工邮箱（必须已在 Supabase Auth 验证）</label><input name="email" type="email" required></div>'+
 '<div class="erp-field"><label>岗位角色</label><select name="role">'+['support','operations','warehouse','finance','admin'].map(k=>'<option value="'+k+'">'+k+'</option>').join('')+'</select></div>'+
 '<div class="erp-field"><label>账号状态</label><select name="active"><option value="true">启用</option><option value="false">停用</option></select></div>'+
 '</div><div class="erp-actions" style="margin-top:15px"><button type="submit" class="primary">保存角色和状态</button></div><p id="erpStaffStatus"></p></form>','员工与角色 · ERP');
 m.querySelector('#erpStaffForm').onsubmit=async e=>{
  e.preventDefault();const values=Object.fromEntries(new FormData(e.target));
  const status=m.querySelector('#erpStaffStatus');const btn=e.target.querySelector('[type=submit]');btn.disabled=true;
  try{const result=await authorized('/rest/v1/rpc/rfriend_erp_assign_staff',{method:'POST',
   body:{p_email:values.email,p_role:values.role,p_active:values.active==='true'}});
   ERP_CACHE.delete('staff_roles');status.style.color='#128257';status.textContent='员工权限已生效：'+values.email+' / '+values.role;
  }catch(err){status.style.color='#b03432';status.textContent=errorMessage(err)}
  finally{btn.disabled=false}
 };
}
function erpBulkModal(){
 const m=erpModal('<p>上传 CSV 文件。系统会预览记录，只有明确支持的实体类型才允许写入生产数据库，单批最多 100 条。</p>'+
 '<input type="file" id="erpBulkFile" accept=".csv,text/csv"><div id="erpBulkPreview" style="margin-top:16px"></div>','批量导入 · '+erpTab);
 m.querySelector('#erpBulkFile').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
   const parsed=erpCsvParse((await file.text()).replace(/^\\ufeff/,''));
   const heads=(parsed[0]||[]).map(x=>x.trim()),records=parsed.slice(1).map(row=>Object.fromEntries(heads.map((h,i)=>[h,row[i]||''])));
   if(!heads.length||!records.length)throw new Error('文件没有有效数据行');
   const canImport=!!ERP_FIELDS[erpTab];
   const preview=parsed.slice(1,11);
   m.querySelector('#erpBulkPreview').innerHTML='<p>文件：'+erpEsc(file.name)+' · '+records.length+' 条记录</p>'+
   '<div class="tablewrap"><table><thead><tr>'+heads.map(h=>'<th>'+erpEsc(h)+'</th>').join('')+'</tr></thead><tbody>'+
   preview.map(row=>'<tr>'+row.map(c=>'<td>'+erpEsc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'+
   (canImport?'<div class="erp-blocked" style="margin-top:14px">CSV 字段名应使用 ERP 数据库字段名，每批 100 行，逐批提交，单批失败全部回滚；已成功批次不会回滚。</div><div class="erp-actions" style="margin-top:15px"><button id="erpBulkSubmit" class="primary">确认导入真实数据库</button></div><p id="erpBulkStatus"></p>':
    '<div class="erp-blocked" style="margin-top:14px">当前业务类型尚未提供安全批量写入接口，仅开放预览和导出。</div>');
   if(canImport)m.querySelector('#erpBulkSubmit').onclick=async()=>{
    if(!confirm('确认将 '+records.length+' 条 '+erpTab+' 数据提交到生产数据库？'))return;
    const button=m.querySelector('#erpBulkSubmit'),status=m.querySelector('#erpBulkStatus');button.disabled=true;
    let completed=0;
    try{
     for(let i=0;i<records.length;i+=100){
      const data=records.slice(i,i+100);
      await authorized('/rest/v1/rpc/rfriend_erp_bulk_create_records',{method:'POST',body:{p_entity:erpTab,p_rows:data}});
      completed+=data.length;status.textContent='已完成 '+completed+' / '+records.length+' 条';
     }
     ERP_CACHE.delete(erpTab);status.style.color='#127347';status.textContent='导入成功，共 '+completed+' 条。';
    }catch(err){status.style.color='#b03432';status.textContent='已入库 '+completed+' 条，后续失败：'+errorMessage(err)}
    finally{button.disabled=false}
   };
  }catch(err){m.querySelector('#erpBulkPreview').textContent='CSV 解析失败：'+errorMessage(err)}
 };
}
async function erpDashboard(){
 el('content').innerHTML='<div class="erp-topline">销售、库存和风险 · 生产数据库</div><div id="erpSummary" class="cards"></div>'+
 '<div class="message" style="margin-bottom:16px">订单总数按渠道与平台订单号唯一归档，客户端跨页读取所有记录；原始导入行数不同于订单数量。历史订单金额是面额，不等同财务确认的净销售额。</div>'+
 '<div class="erp-grid"><div id="erpSalesPanel"></div><div id="erpRiskPanel"></div></div>';
 const sum=el('erpSummary'),sales=el('erpSalesPanel'),risk=el('erpRiskPanel');
 try{
  const [stock,skus,disputes]=await Promise.all([
   erpData('stock_balances').catch(()=>[]),erpData('products').catch(()=>[]),erpData('reconciliation_cases').catch(()=>[])
  ]);
  const onhand=stock.reduce((n,r)=>n+Number(r.on_hand||0),0);
  const totalValue=orders.reduce((n,r)=>n+Number(r.total_eur||0),0);
  const open=disputes.filter(x=>!['resolved','closed','done'].includes(x.case_status)).length;
  if(sum)sum.innerHTML=erpMetric('历史订单总量',orders.length,'全部分页加载 · 实际订单口径')+
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
const ERP_DESCRIPTIONS={
 dashboard:'全业务监控与风险',tasks:'角色待办与审批',intake:'批量、单条、文字、校验',
 orders:'订单—履约—发票全链路',products:'SKU 与产品信息',inventory:'多仓库存与安全阈值',
 movements:'收发货与库存变动',purchase:'申请、审批、收货',shipping:'仓库指令与物流确认',
 returns:'退货收货、质检、退款',used:'一机一档、销售与发货',tickets:'WhatsApp / 邮件 / 电话',
 finance:'退款、发票与待办',reports:'销售、库存、采购、售后与导出',audit:'业务状态变更记录',
 settings:'渠道、仓库、数据',team:'员工账号与角色权限',imei:'上传、识别、人工校正'
};
let erpInventoryWarehouse='all',erpInventoryQuery='',erpInventoryAlert='all';
async function erpInventoryPage(){
 const root=el('content');
 const stamp=++erpLoading;
 root.innerHTML='<div class="erp-panel">正在读取真实库存与销售订单…</div>';
 try{
  const [rawProducts,stock,dos,depots,catalog]=await Promise.all(['products','stock_balances','inventory_dos','warehouses','product_catalog'].map(k=>erpData(k,true)));
  const detailIndex=new Map(catalog.map(p=>[p.id,p]));
  const products=rawProducts.map(p=>({...p,...(detailIndex.get(p.id)||{}),product_description:p.product_description||detailIndex.get(p.id)?.product_name||p.name}));
  if(stamp!==erpLoading||erpSelectedPage!=='inventory')return;
  const labels={out_of_stock:'缺货',low_stock:'低于安全库存',critical:'严重不足',warning:'库存不足',watch:'库存关注',normal:'正常',no_sales:'无动销',sales_data_incomplete:'数据不足'};
  const h=erpEsc, num=v=>Number(v)||0;
  const opts=[['all','全部仓库'],...depots.map(w=>[w.code,w.name])];
  function draw(){
   const scope=stock.filter(x=>erpInventoryWarehouse==='all'||x.warehouse_code===erpInventoryWarehouse);
   const sums=scope.reduce((a,x)=>{a.total+=num(x.on_hand);if(x.quality_status==='sellable')a.available+=num(x.on_hand)-num(x.reserved);else a.other+=num(x.on_hand);return a},{total:0,available:0,other:0});
   const coverage=[15,21,30].map(n=>{let d=dos.find(x=>x.lookback_days===n);return n+'天 '+(d?.itemized_orders??0)+'/'+(d?.eligible_orders??0)}).join(' · ');
   const list=products.filter(p=>p.is_active!==false).map(p=>{
    const rows=scope.filter(x=>x.product_id===p.id),total=rows.reduce((a,x)=>a+num(x.on_hand),0),available=rows.filter(x=>x.quality_status==='sellable').reduce((a,x)=>a+num(x.on_hand)-num(x.reserved),0);
    const periods=[15,21,30].map(n=>dos.find(x=>x.product_id===p.id&&x.lookback_days===n));
    const d=periods[2];const status=available===0?'out_of_stock':(p.low_stock_threshold>0&&available<=p.low_stock_threshold?'low_stock':d?.alert_status||'sales_data_incomplete');
    return {p,total,available,periods,status};
   }).filter(x=>(x.p.sku+' '+(x.p.ean||'')+' '+x.p.product_description).toLowerCase().includes(erpInventoryQuery.toLowerCase())&&(erpInventoryAlert==='all'||x.status===erpInventoryAlert));
   const value=(d,x)=>d&&num(d.sales_units)>0?(erpInventoryWarehouse==='all'?d.dos:(x.available*num(d.lookback_days)/num(d.sales_units)).toFixed(1)):'—';
   root.innerHTML=cards([['实物库存',sums.total],['全新可用',sums.available],['不可售 / 开箱',sums.other],['缺货 SKU',list.filter(x=>x.status==='out_of_stock').length]])+
    '<div class="message warn">DOS = 可用库存 ÷ 全渠道已匹配订单日均量。分仓 DOS 使用同一全渠道销量，仅代表该仓对全渠道需求的支撑能力；匹配不完整时 DOS 可能偏高。订单匹配覆盖：'+h(coverage)+'</div>'+
    erpPanel('分仓库存 / DOS 预警','<div class="erp-toolbar"><select id="invWarehouse">'+opts.map(([v,n])=>'<option value="'+h(v)+'" '+(v===erpInventoryWarehouse?'selected':'')+'>'+h(n)+'</option>').join('')+'</select><input id="invSearch" placeholder="SKU / EAN / 产品名称描述" value="'+h(erpInventoryQuery)+'"><select id="invAlert"><option value="all">全部预警</option>'+Object.entries(labels).map(([v,n])=>'<option value="'+v+'" '+(erpInventoryAlert===v?'selected':'')+'>'+n+'</option>').join('')+'</select><button id="invRun">查询</button><button id="invReload">刷新</button><button id="invExport">导出 CSV</button></div>'+
    '<div class="tablewrap"><table><thead><tr>'+['SKU','EAN','产品名称','型号','颜色','内存版本','实物库存','可用库存','DOS 15','DOS 21','DOS 30','预警','30天建议补货(估计)'].map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+list.map(x=>'<tr>'+[x.p.sku,x.p.ean||'待维护',x.p.product_description,x.p.model||'待核',x.p.color||'待核',x.p.storage_version||'待核',x.total,x.available,...x.periods.map(d=>value(d,x)),labels[x.status],x.periods[2]?.sales_units>0&&erpInventoryWarehouse==='all'?x.periods[2].suggested_replenishment_30d:'—'].map(v=>'<td>'+h(v??'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>','已展示 '+list.length+' 个商品');
   el('invWarehouse').onchange=e=>{erpInventoryWarehouse=e.target.value;draw()};
   el('invAlert').onchange=e=>{erpInventoryAlert=e.target.value;draw()};
   el('invRun').onclick=()=>{erpInventoryQuery=el('invSearch').value;draw()};
   el('invSearch').onkeydown=e=>{if(e.key==='Enter'){erpInventoryQuery=e.target.value;draw()}};
   el('invReload').onclick=erpInventoryPage;
   el('invExport').onclick=()=>erpDownload('inventory',list.map(x=>({sku:x.p.sku,ean:x.p.ean,product_description:x.p.product_description,model:x.p.model,color:x.p.color,storage_version:x.p.storage_version,warehouse:erpInventoryWarehouse,on_hand:x.total,available:x.available,dos15:value(x.periods[0],x),dos21:value(x.periods[1],x),dos30:value(x.periods[2],x),alert:labels[x.status]})));
  }
  draw();
 }catch(e){if(stamp===erpLoading&&erpSelectedPage==='inventory')root.innerHTML='<div class="erp-blocked">'+erpEsc(errorMessage(e))+'</div>';}
}
async function erpRenderPage(){
 if(!profile)return;
 const identity=String(profile.user_id)+'|'+String(profile.role);
 if(erpCurrentUserIdentity!==identity){ERP_CACHE.clear();erpCurrentUserIdentity=identity}
 erpRenderNav();el('heading').textContent=erpTitle(erpSelectedPage);
 if(el('subtitle'))el('subtitle').textContent=lang==='en'?(ERP_MODULES[erpSelectedPage]?.en||'Operations'):ERP_DESCRIPTIONS[erpSelectedPage]||'真实 ERP 数据';
 if(erpSelectedPage==='dashboard'){
  if(typeof window.erpV4Dashboard==='function')await window.erpV4Dashboard();
  else if(typeof window.erpDashboard==='function')await window.erpDashboard();
  else await erpDashboard();
  return;
 }
 if(erpSelectedPage==='inventory'){
  if(window.erpStockTab!=='dos'&&typeof window.erpInventory==='function')await window.erpInventory();
  else await erpInventoryPage();
  if(el('content')){
   const bar=document.createElement('div');bar.className='erp-toolbar';
   bar.innerHTML='<button class="btn '+(window.erpStockTab!=='dos'?'primary':'')+'" data-stock-tab="reconcile">周库存核验 / 调整</button>'+
    '<button class="btn '+(window.erpStockTab==='dos'?'primary':'')+'" data-stock-tab="dos">库存周转 / DOS 预警</button>';
   el('content').prepend(bar);
   bar.querySelectorAll('[data-stock-tab]').forEach(btn=>btn.onclick=()=>{window.erpStockTab=btn.dataset.stockTab;render()});
  }
  return;
 }
 if(erpSelectedPage==='purchase'&&typeof window.erpProcurementTracking==='function'){await window.erpProcurementTracking();return;}
 if(typeof window.erpV5OrderPage==='function'&&await window.erpV5OrderPage(erpSelectedPage))return;
 if(typeof window.erpV5Page==='function'&&await window.erpV5Page(erpSelectedPage))return;
 if(typeof window.erpV4Page==='function'&&await window.erpV4Page(erpSelectedPage))return;
 if(!ERP_MODULES[erpSelectedPage])return;
 await erpRenderModule();
 if(erpSelectedPage==='settings')erpSettingsExtras();
}
window.render=function(){return erpRenderPage()};
const oldLoadData=window.loadData;
document.querySelector('#lang')?.addEventListener('change',()=>{erpRenderNav();render()});
erpBuildNav();
erpBuildTopActions();
document.querySelector('.foot').textContent='Rfriend Business OS · Approved UI v3 · Supabase production · 2026-11-24';
document.querySelector('#logoutBtn')?.addEventListener('click',()=>{
 ERP_CACHE.clear();erpCurrentUserIdentity=null;erpTab='';erpSearch='';erpOffset=0;
});
if(profile)render();
