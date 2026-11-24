'use strict';
// This client uses only the public Supabase publishable key. All ERP data is protected by database RLS.
const API='https://xcmmxstftxcmieakdbxf.supabase.co';
const KEY='sb_publishable_1DBDbjKJc7zDfr8zds-O_g_Rrc6jn0X';
const storageKey='rfriend-erp-session-v1';
let token=null,refreshToken=null,profile=null,page='overview',orders=[],monthly=[],tasks=[],warehouses=[],shipments=[],orderPage=0,lang='zh',term='',pendingShipmentKey=null;
const el=id=>document.getElementById(id);
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const t=(zh,en)=>lang==='zh'?zh:en;
const fmtDate=v=>v?new Date(v).toLocaleString(lang==='zh'?'zh-CN':'en-GB',{timeZone:'Europe/Vienna'}):'—';
const eur=v=>new Intl.NumberFormat(lang==='zh'?'zh-CN':'en-GB',{style:'currency',currency:'EUR'}).format(Number(v)||0);
const errorMessage=e=>String(e?.message||e||'Unknown error');
function notice(message,isError=false){el('notice').innerHTML='<div class="message'+(isError?' warn':'')+'">'+escapeHTML(message)+'</div>';}
async function request(path,{method='GET',body,auth=true}={}){
 const headers={apikey:KEY};
 if(auth&&token)headers.Authorization='Bearer '+token;
 if(body!==undefined)headers['Content-Type']='application/json';
 const response=await fetch(API+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 let data;try{data=await response.json()}catch{data=null}
 if(!response.ok)throw new Error(data?.message||data?.error_description||data?.msg||data?.error||data?.code||'HTTP '+response.status);
 return data;
}
let refreshInFlight=null;
let sessionGeneration=0;
async function refreshSession(){
 if(refreshInFlight)return refreshInFlight;
 if(!refreshToken)throw new Error('No refresh token');
 const generation=sessionGeneration;
 const previous=refreshToken;
 const work=(async()=>{
  const data=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:previous},auth:false});
  if(generation!==sessionGeneration)throw new Error('Session changed');
  token=data.access_token;refreshToken=data.refresh_token;
  sessionStorage.setItem(storageKey,JSON.stringify({token,refreshToken}));
 })();
 refreshInFlight=work;
 try{return await work}finally{if(refreshInFlight===work)refreshInFlight=null;}
}
async function authorized(path,opts={}){
 const attempted=token;
 const generation=sessionGeneration;
 try{return await request(path,opts)}
 catch(e){
  if(generation!==sessionGeneration)throw new Error('Session changed');
  if(refreshToken&&/jwt|expired|token/i.test(errorMessage(e))){
   if(token===attempted)await refreshSession();
   if(generation!==sessionGeneration)throw new Error('Session changed');
   return request(path,opts);
  }
  throw e;
 }
}
async function loadProfile(){
 const rows=await authorized('/rest/v1/rfriend_erp_profile?select=user_id,role,active&limit=2');
 if(!Array.isArray(rows)||rows.length!==1||!rows[0].active)throw new Error(t('此账号没有 ERP 权限。','This account is not authorized for ERP.'));
 profile=rows[0];
 el('profile').textContent=profile.role+' · Frankfurt';
 el('login').classList.add('hidden');
 el('app').classList.remove('hidden');
}
async function signIn(email,password){
 sessionGeneration++;refreshInFlight=null;
 const result=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password},auth:false});
 token=result.access_token;refreshToken=result.refresh_token;
 await loadProfile();
 sessionStorage.setItem(storageKey,JSON.stringify({token,refreshToken}));
}
function signOut(){
 sessionGeneration++;refreshInFlight=null;
 sessionStorage.removeItem(storageKey);token=null;refreshToken=null;profile=null;
 orders=[];monthly=[];tasks=[];warehouses=[];shipments=[];
 el('app').classList.add('hidden');el('login').classList.remove('hidden');el('password').value='';
}
function grid(headers,rows){
 return '<div class="tablewrap"><table><thead><tr>'+headers.map(h=>'<th>'+escapeHTML(h)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.join(''):'<tr><td colspan="'+headers.length+'">'+t('暂无记录','No records')+'</td></tr>')+'</tbody></table></div>';
}
function panel(name,content){return '<section class="panel"><h3>'+escapeHTML(name)+'</h3>'+content+'</section>';}
function cards(values){return '<div class="cards">'+values.map(([k,v,sub])=>'<div class="card"><small>'+escapeHTML(k)+'</small><strong>'+escapeHTML(v)+'</strong><small>'+escapeHTML(sub||'')+'</small></div>').join('')+'</div>';}
function overview(){
 const value=orders.reduce((s,o)=>s+Number(o.total_eur||0),0), dated=orders.filter(x=>x.ordered_at).length;
 const pending=tasks.filter(x=>!['done','closed','cancelled','completed'].includes(x.status)).length;
 return '<div class="message warn">'+t('订单金额是历史导入订单面额，不等于实际营收、已付款或已签收金额。','Imported order face value is not recognized revenue, paid value or fulfilled sales.')+'</div>'+
 cards([[t('销售订单','Sales orders'),orders.length],[t('导入订单面额','Imported order value'),eur(value)],[t('具有下单时间','Dated orders'),dated],[t('待处理任务','Open tasks'),pending]])+
 panel(t('最近销售记录（按月与渠道）','Recent monthly channel orders'),grid([t('月份','Month'),t('渠道','Channel'),t('状态','Status'),t('订单数','Orders'),t('订单面额','Value')],monthly.slice().sort((a,b)=>String(b.period).localeCompare(String(a.period))).slice(0,50).map(x=>'<tr><td>'+escapeHTML(x.period)+'</td><td>'+escapeHTML(x.channel_code)+'</td><td>'+escapeHTML(x.order_status)+'</td><td>'+escapeHTML(x.order_count)+'</td><td>'+eur(x.order_amount_eur)+'</td></tr>')));
}
function filteredOrders(){
 const q=term.trim().toLowerCase();return orders.filter(x=>!q||[x.external_order_id,x.customer_name,x.channel_code].some(v=>String(v||'').toLowerCase().includes(q)));
}
function orderView(){
 const results=filteredOrders();const rows=results.slice(orderPage*50,(orderPage+1)*50);
 return panel(t('销售订单 · 真实数据','Sales orders · live data'),
 '<div class="toolbar"><input id="orderSearch" class="search" placeholder="'+t('搜索订单号 / 渠道 / 客户','Search order / channel / customer')+'" value="'+escapeHTML(term)+'">'+
 '<button id="orderFilter" class="btn">'+t('查询','Search')+'</button><span class="muted">'+results.length+' '+t('笔','orders')+'</span></div>'+
 grid([t('订单号','Order ID'),t('渠道','Channel'),t('下单时间','Order date'),t('ERP 创建时间','ERP created'),t('客户','Customer'),t('金额','Value'),t('状态','Status')],
 rows.map(o=>'<tr><td>'+escapeHTML(o.external_order_id)+'</td><td>'+escapeHTML(o.channel_code)+'</td><td>'+fmtDate(o.ordered_at)+'</td><td>'+fmtDate(o.created_at)+'</td><td>'+escapeHTML(o.customer_name)+'</td><td>'+eur(o.total_eur)+'</td><td><span class="pill">'+escapeHTML(o.order_status)+'</span></td></tr>'))+
 '<div class="paging"><button id="prev" class="btn" '+(orderPage===0?'disabled':'')+'>‹</button><span>'+(orderPage+1)+' / '+Math.max(1,Math.ceil(results.length/50))+'</span><button id="next" class="btn" '+((orderPage+1)*50>=results.length?'disabled':'')+'>›</button></div>');
}
function taskView(){
 const list=tasks.filter(x=>!['done','closed','cancelled','completed'].includes(x.status));
 return panel(t('我的待办','My tasks'),grid([t('任务','Task'),t('业务类型','Type'),t('负责岗位','Responsible role'),t('状态','Status'),t('创建时间','Created')],list.slice(0,600).map(x=>'<tr><td>'+escapeHTML(x.title)+'</td><td>'+escapeHTML(x.task_type)+'</td><td>'+escapeHTML(x.assigned_role)+'</td><td>'+escapeHTML(x.status)+'</td><td>'+fmtDate(x.created_at)+'</td></tr>')));
}
function shipmentView(){
 const canWrite=['admin','operations','warehouse'].includes(profile?.role);
 const options=warehouses.map(w=>'<option value="'+escapeHTML(w.id)+'">'+escapeHTML(w.name)+'</option>').join('');
 const form=canWrite?'<form id="shipmentForm"><div class="fields">'+
 '<div class="field"><label>'+t('平台订单号','Order number')+'</label><input id="shipmentOrder" required placeholder="AT..."></div>'+
 '<div class="field"><label>'+t('出货仓库','Warehouse')+'</label><select id="shipmentWarehouse">'+options+'</select></div>'+
 '<div class="field"><label>'+t('承运商','Carrier')+'</label><input id="shipmentCarrier" placeholder="DHL / Post AT / UPS" required></div>'+
 '<div class="field"><label>'+t('物流单号','Tracking number')+'</label><input id="shipmentTracking" required></div>'+
 '<div class="field"><label>'+t('仓库系统单号（可选）','Warehouse reference (optional)')+'</label><input id="shipmentWarehouseNumber"></div>'+
 '</div><button id="shipmentSubmit" class="btn primary" type="submit">'+t('创建待确认发货单','Create pending shipment')+'</button></form>':
 '<p class="muted">'+t('当前角色没有手工录单权限。','Your role cannot create shipment requests.')+'</p>';
 return panel(t('手工发货录单','Manual shipment entry'),'<div class="message warn">'+t('仅创建待仓库确认的发货申请，不自动确认签收、不扣减库存。','Creates a pending warehouse request. Does not deduct stock or mark delivered.')+'</div>'+form)+
 panel(t('近期发货记录','Recent shipments'),grid([t('内部单号','Internal ID'),t('运单','Tracking'),t('承运商','Carrier'),t('状态','Status'),t('录入时间','Created')],shipments.slice(0,200).map(s=>'<tr><td>'+escapeHTML(s.shipment_number)+'</td><td>'+escapeHTML(s.tracking_number)+'</td><td>'+escapeHTML(s.carrier)+'</td><td>'+escapeHTML(s.status)+'</td><td>'+fmtDate(s.created_at)+'</td></tr>')));
}
function reportView(){
 const map=new Map();
 for(const r of monthly){const key=r.period+'|'+r.channel_code;const value=map.get(key)||{period:r.period,channel:r.channel_code,count:0,amount:0};value.count+=Number(r.order_count);value.amount+=Number(r.order_amount_eur);map.set(key,value);}
 return '<div class="message warn">'+t('这是订单口径的报表。实际净销售、退款、签收率需待物流和财务核验后计算。','Order-based report, not net revenue. Fulfillment and refunds require verification.')+'</div>'+
 panel(t('月度 × 渠道订单情况','Monthly order performance'),grid([t('月份','Month'),t('渠道','Channel'),t('订单数','Orders'),t('订单金额','Value')],[...map.values()].sort((a,b)=>String(b.period).localeCompare(String(a.period))).map(x=>'<tr><td>'+escapeHTML(x.period)+'</td><td>'+escapeHTML(x.channel)+'</td><td>'+x.count+'</td><td>'+eur(x.amount)+'</td></tr>'))+'<button class="btn" id="exportCSV">'+t('导出 CSV','Export CSV')+'</button>');
}
function render(){
 const titles={overview:['经营总览','Overview'],orders:['销售订单','Sales orders'],tasks:['我的待办','Tasks'],shipments:['手工发货','Manual shipments'],reports:['销售报告','Sales reports']};
 el('heading').textContent=t(...titles[page]);
 document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
 el('content').innerHTML=({overview,orders:orderView,tasks:taskView,shipments:shipmentView,reports:reportView})[page]();
 bindPage();
}
function bindPage(){
 el('orderFilter')?.addEventListener('click',()=>{term=el('orderSearch').value;orderPage=0;render()});
 el('orderSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){term=e.target.value;orderPage=0;render();}});
 el('prev')?.addEventListener('click',()=>{if(orderPage){orderPage--;render();}});
 el('next')?.addEventListener('click',()=>{if((orderPage+1)*50<filteredOrders().length){orderPage++;render();}});
 el('shipmentForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const button=el('shipmentSubmit');button.disabled=true;
  const ref=el('shipmentOrder').value.trim();
  const same=orders.filter(o=>o.external_order_id===ref);
  if(same.length!==1){notice(t('订单号找不到或有多个同号订单，请先核对渠道。','Order not found or ambiguous: verify channel.'),true);button.disabled=false;return;}
  const body={p_order_id:same[0].id,p_warehouse_id:el('shipmentWarehouse').value,p_carrier:el('shipmentCarrier').value.trim(),p_tracking:el('shipmentTracking').value.trim(),p_warehouse_order:el('shipmentWarehouseNumber').value.trim(),p_request_key:pendingShipmentKey||crypto.randomUUID()};
  pendingShipmentKey=body.p_request_key;
  try{
   const r=await authorized('/rest/v1/rpc/rfriend_erp_create_manual_shipment',{method:'POST',body});
   pendingShipmentKey=null;notice(t('发货申请已创建：','Shipment request created: ')+(r.shipment_number||r.shipment_id));
   shipments=await authorized('/rest/v1/rfriend_erp_shipments?select=*&order=created_at.desc&limit=1000');render();
  }catch(err){notice(errorMessage(err),true)}finally{button.disabled=false}
 });
 el('exportCSV')?.addEventListener('click',()=>{
  const lines=[['month','channel','status','order_count','order_amount_eur'],...monthly.map(x=>[x.period,x.channel_code,x.order_status,x.order_count,x.order_amount_eur])];
  const csv=lines.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='rfriend_erp_sales.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),300);
 });
}
async function fetchAllPages(table,{sort='',chunk=1000,maxRows=20000}={}){
 const rows=[];
 for(let offset=0;offset<maxRows;offset+=chunk){
  const query='/rest/v1/'+table+'?select=*'+(sort?'&order='+sort:'')+'&limit='+chunk+'&offset='+offset;
  const page=await authorized(query);
  if(!Array.isArray(page))throw new Error('Invalid paginated response for '+table);
  rows.push(...page);
  if(page.length<chunk)return rows;
 }
 throw new Error('Pagination safety limit reached for '+table+'. Refine query or extend server paging.');
}
async function loadData(){
 el('notice').innerHTML='';
 el('content').innerHTML='<section class="panel">'+t('正在分页读取完整历史订单…','Loading complete paginated orders…')+'</section>';
 try{
  // PostgREST/Supabase defaults to max 1,000 rows per response regardless of limit=3000.
  // Use deterministic ordering to ensure no records disappear at page boundaries.
  [orders,monthly,tasks,warehouses,shipments]=await Promise.all([
   fetchAllPages('rfriend_erp_orders',{sort:'ordered_at.desc.nullslast,id.asc',maxRows:20000}),
   fetchAllPages('rfriend_erp_monthly',{sort:'period.desc,channel_code.asc,order_status.asc'}),
   fetchAllPages('rfriend_erp_tasks',{sort:'created_at.desc,id.asc'}),
   fetchAllPages('rfriend_erp_warehouses',{sort:'code.asc'}),
   fetchAllPages('rfriend_erp_shipments',{sort:'created_at.desc,id.asc'})
  ]);
  if(orders.length<1000)notice(t('订单读取完成，但当前数量少于 1000，请检查账户权限和数据源。','Order total appears below expected baseline; verify database and role.'),true);
  render();
 }catch(err){
  notice(errorMessage(err),true);
  el('content').innerHTML='<section class="panel">'+t('订单加载失败。请检查权限与分页接口。','Order load failed; verify authorization and pagination.')+'</section>';
 }
}
// PASSWORD RECOVERY: Auth verifies recovery token; no service role or privileged endpoint is used.
let recoveryAccessToken=null;
function authScreen(which){
 for(const id of ['loginForm','forgotForm','resetForm'])el(id).classList.toggle('hidden',id!==which);
 el('login').classList.remove('hidden');
 el('app').classList.add('hidden');
}
function authStatus(id,message,isError=false){
 const node=el(id);node.textContent=message;node.className='status-message '+(isError?'error':'success');
}
function clearRecovery(){
 recoveryAccessToken=null;
 el('newPassword').value='';el('confirmPassword').value='';
 el('changePasswordBtn').disabled=true;
}
async function startRecovery(email){
 // The redirect must be in Supabase Auth > URL Configuration > Redirect URLs.
 const destination=new URL(window.location.pathname,window.location.origin);
 destination.searchParams.set('action','reset-password');
 return request('/auth/v1/recover?redirect_to='+encodeURIComponent(destination.toString()),{
  method:'POST',body:{email},auth:false
 });
}
async function acceptRecoveryLink(){
 const hash=new URLSearchParams(window.location.hash.replace(/^#/,'')); 
 const query=new URLSearchParams(window.location.search);
 if(!hash.has('access_token')&&!hash.has('error')&&query.get('action')!=='reset-password')return false;
 const recoveryType=hash.get('type');
 const access=hash.get('access_token');
 // Clear tokens from the URL immediately; never save the recovery session to browser storage.
 window.history.replaceState({},document.title,window.location.pathname);
 authScreen('resetForm');
 if(hash.has('error')){
  authStatus('resetStatus',hash.get('error_description')||'恢复链接无效或已过期，请重新发送。',true);
  return true;
 }
 if(recoveryType!=='recovery'||!access){
  authStatus('resetStatus','没有收到有效的恢复凭据。请重新发送密码重置邮件。',true);
  return true;
 }
 try{
  const response=await fetch(API+'/auth/v1/user',{headers:{apikey:KEY,Authorization:'Bearer '+access}});
  if(!response.ok)throw new Error('恢复凭据已失效，请重新申请密码重置邮件。');
  recoveryAccessToken=access;
  el('changePasswordBtn').disabled=false;
  authStatus('resetStatus','邮箱已验证，请设置新密码。');
 }catch(err){authStatus('resetStatus',errorMessage(err),true)}
 return true;
}
async function saveRecoveryPassword(password){
 if(!recoveryAccessToken)throw new Error('恢复链接无效或已过期。');
 const response=await fetch(API+'/auth/v1/user',{
  method:'PUT',headers:{apikey:KEY,Authorization:'Bearer '+recoveryAccessToken,'Content-Type':'application/json'},
  body:JSON.stringify({password})
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data?.msg||data?.message||data?.error_description||data?.error||'HTTP '+response.status);
 clearRecovery();
 // A fresh password login is required. Never turn a recovery token into an ERP session.
 sessionStorage.removeItem(storageKey);
 token=null;refreshToken=null;profile=null;
 return data;
}
el('forgotBtn').addEventListener('click',()=>{
 el('recoveryEmail').value=el('email').value||'';
 el('forgotStatus').textContent='';
 authScreen('forgotForm');
});
el('backToLogin').addEventListener('click',()=>authScreen('loginForm'));
el('resetBackToLogin').addEventListener('click',()=>{clearRecovery();authScreen('loginForm')});
el('forgotForm').addEventListener('submit',async e=>{
 e.preventDefault();const button=el('sendRecoveryBtn');button.disabled=true;
 authStatus('forgotStatus','正在发送重置邮件…');
 try{
  await startRecovery(el('recoveryEmail').value.trim());
  authStatus('forgotStatus','若该邮箱存在且允许接收恢复邮件，你将收到密码重置链接。请检查收件箱及垃圾邮件。');
 }catch(err){
  // Do not disclose whether an email account exists.
  const message=errorMessage(err);
  authStatus('forgotStatus',/rate|limit|smtp|email|redirect|429/i.test(message)?
    '暂时无法发送恢复邮件，可能是发送频率限制或 Supabase 邮件设置。请稍后重试或联系管理员。':
    '发送失败，请检查网络或联系管理员。',true);
 }finally{button.disabled=false;}
});
el('resetForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const pass=el('newPassword').value,verify=el('confirmPassword').value;
 if(pass.length<12){authStatus('resetStatus','密码至少需要 12 个字符。',true);return}
 if(pass!==verify){authStatus('resetStatus','两次输入的密码不一致。',true);return}
 const button=el('changePasswordBtn');button.disabled=true;
 try{
  await saveRecoveryPassword(pass);
  authScreen('loginForm');el('password').value='';
  el('loginError').textContent='密码修改成功，请使用新密码登录。';
 }catch(err){
  authStatus('resetStatus',errorMessage(err),true);
  button.disabled=!recoveryAccessToken;
 }
});

el('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();el('loginError').textContent='';el('loginBtn').disabled=true;
 try{await signIn(el('email').value.trim(),el('password').value);await loadData()}
 catch(err){el('loginError').textContent=errorMessage(err);signOut()}
 finally{el('loginBtn').disabled=false;}
});
el('logoutBtn').addEventListener('click',signOut);
el('refreshBtn').addEventListener('click',loadData);
el('lang').addEventListener('change',e=>{lang=e.target.value;render();});
document.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>{page=button.dataset.page;render();}));
(async()=>{try{if(await acceptRecoveryLink())return;const session=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(session?.refreshToken){refreshToken=session.refreshToken;await refreshSession();await loadProfile();await loadData();}}catch(err){signOut();}})();
