'use strict';
/* Role-oriented KPI home layered above the approved v3 cross-analysis dashboard. */
(function(){
 const $=id=>document.getElementById(id),h=x=>erpEsc(x??'');
 const SECTIONS={sales:'销售与日销',inventory:'库存',returns:'退换货与取消',service:'客诉与售后',finance:'退款财务',operations:'订单复核'};
 const defaultForRole={
  admin:Object.keys(SECTIONS),operations:Object.keys(SECTIONS),
  support:['service','returns','sales'],
  warehouse:['inventory','returns','operations'],
  finance:['finance','sales','returns']
 };
 let chosen=null;
 const fallback=()=>defaultForRole[profile?.role]||['sales'];
 const localDate=x=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Vienna',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
 async function pref(){
  if(chosen)return chosen;
  try{
   const r=await authorized('/rest/v1/rfriend_erp_dashboard_preferences?select=visible_sections&user_id=eq.'+encodeURIComponent(profile.user_id));
   chosen=Array.isArray(r)&&r[0]?.visible_sections?.length?r[0].visible_sections:fallback();
  }catch(e){chosen=fallback()}
  return chosen;
 }
 const num=x=>Number(x||0).toLocaleString('de-AT');
 const percent=(a,b)=>b?((a/b)*100).toFixed(2)+'%':'—';
 const warning='数据口径：退货率＝存在退货单的独立订单数 ÷ 历史订单总数；取消率＝当前订单状态为 cancelled 的独立订单数 ÷ 历史订单总数。仅代表 ERP 已登记的订单与退货，不等同渠道平台最终财务结算率。';
 async function savePrefs(){
  const old=await pref();
  const m=erpModal('<p>选择首页希望看到的业务模块。配置保存到你的 ERP 员工账号，管理员可以展示全部领域。</p>'+
   '<form id="v4DashboardPrefs"><div class="v4-preferences">'+Object.entries(SECTIONS).map(([key,label])=>
   '<label><input type="checkbox" value="'+h(key)+'" '+(old.includes(key)?'checked':'')+'> '+h(label)+'</label>').join('')+
   '</div><div class="erp-actions" style="margin-top:18px"><button class="primary" type="submit">保存首页布局</button></div><p id="v4PrefsMsg"></p></form>',
   '首页指标自定义');
  m.querySelector('form').onsubmit=async e=>{
   e.preventDefault();const v=[...e.target.querySelectorAll('input:checked')].map(x=>x.value);
   if(!v.length){m.querySelector('#v4PrefsMsg').textContent='请至少选择一个模块';return}
   try{
    await authorized('/rest/v1/rpc/rfriend_erp_save_dashboard_preferences',{method:'POST',body:{p_sections:v}});
    chosen=v;m.remove();render();
   }catch(err){m.querySelector('#v4PrefsMsg').textContent=errorMessage(err)}
  };
 }
 function dailySalesPanel(){
  const buckets=new Map();
  for(let i=6;i>=0;i--){const date=new Date(Date.now()-i*86400000);buckets.set(localDate(date),0);}
  for(const order of orders)if(order.ordered_at){
   const k=localDate(order.ordered_at);if(buckets.has(k))buckets.set(k,buckets.get(k)+1);
  }
  const top=Math.max(1,...buckets.values());
  return '<div class="v4-daily">'+[...buckets].map(([date,value])=>'<div class="v4-daily-item"><span>'+h(date.slice(5))+'</span>'+
   '<div class="v4-day-track"><i style="height:'+((value/top)*100).toFixed(1)+'%"></i></div><strong>'+num(value)+'</strong></div>').join('')+'</div>'+
   '<p class="erp-mini">最近7个维也纳本地自然日 · 按下单日期统计 · 当日数字不代表已签收销量。</p>';
 }
 async function load(){
  const queries={
   inventory:'inventory_v4',returns:'returns_v4',service:'tickets_sla',finance:'refunds',operations:'review_queue'
  };
  const results=await Promise.all(Object.entries(queries).map(async ([key,table])=>{
   try{return [key,await erpData(table,true),null]}catch(e){return [key,null,errorMessage(e)]}
  }));
  return Object.fromEntries(results.map(([key,rows,error])=>[key,{rows,error}]));
 }
 function cardsFor(key,items){
  return '<section class="panel v4-home-section" data-home="'+key+'"><h3>'+h(SECTIONS[key])+'</h3>'+
   '<div class="v4-home-cards">'+items.map(([title,value,desc])=>'<div class="v4-home-metric"><span>'+h(title)+'</span>'+
   '<strong>'+h(value)+'</strong><small>'+h(desc||'')+'</small></div>').join('')+'</div></section>';
 }
 window.erpV4Dashboard=async function(){
  // Keep every existing cross-filter template and export ability without rewriting them.
  await window.erpDashboard();
  const root=$('content');if(!root)return;
  const header=document.createElement('div');header.id='v4HomeHeader';
  const current=await pref();
  header.innerHTML='<div class="v4-home-head"><div><h2>经营总览 · 角色指标看板</h2>'+
   '<p>总负责可汇总销售、日销、库存、退换货、客诉与财务，各员工可保存自己的首页指标。</p></div>'+
   '<button class="btn primary" id="v4ConfigureHome">⚙ 自定义首页指标</button></div>'+
   '<div id="v4HomeSections"><p class="erp-empty">正在读取各业务模块指标…</p></div>';
  root.prepend(header);
  header.querySelector('#v4ConfigureHome').onclick=savePrefs;
  const v=await load();if(!$('v4HomeSections'))return;
  const rowCount=orders.length, cancellations=orders.filter(o=>o.order_status==='cancelled').length;
  const returned=v.returns.rows?new Set(v.returns.rows.map(x=>x.order_id).filter(Boolean)).size:null;
  const support=v.service.rows||[],open=support.filter(t=>!['closed','resolved'].includes(t.status));
  const inv=v.inventory.rows||[],stockTotal=inv.reduce((sum,o)=>sum+Number(o.on_hand||0),0);
  const stockAvailable=inv.reduce((sum,o)=>sum+(o.quality_status==='sellable'?Math.max(0,Number(o.on_hand||0)-Number(o.reserved||0)):0),0);
  const refund=v.finance.rows||[],refundMoney=refund.filter(r=>r.status==='paid').reduce((a,x)=>a+Number(x.amount_eur||0),0);
  const today=localDate(new Date()),todayCount=orders.filter(o=>o.ordered_at&&localDate(o.ordered_at)===today).length;
  const byRole=v.operations.rows||[];
  const out=[];
  if(current.includes('sales'))out.push(cardsFor('sales',[
   ['历史订单',num(rowCount),'独立订单'],['今日下单',num(todayCount),today+' · Vienna'],
   ['近7天平均日订单', (orders.filter(o=>o.ordered_at&&localDate(o.ordered_at)>=localDate(new Date(Date.now()-6*86400000))).length/7).toFixed(1),'按下单时间']
  ])+'<section class="panel v4-home-section"><h3>最近7天日销订单趋势</h3>'+dailySalesPanel()+'</section>');
  if(current.includes('inventory'))out.push(cardsFor('inventory',[
   ['库存实物总数',v.inventory.error?'无权限':num(stockTotal),'按各仓库存台账'],
   ['可售库存',v.inventory.error?'无权限':num(stockAvailable),'扣除预留'],['仓库/SKU库存行',v.inventory.error?'无权限':num(inv.length),'包含质量状态']
  ]));
  if(current.includes('returns'))out.push(cardsFor('returns',[
   ['退货率',returned===null?'无权限':percent(returned,rowCount),'独立退货订单 / 历史订单'],
   ['取消率',percent(cancellations,rowCount),'cancelled / 历史订单'],
   ['退换货申请',v.returns.error?'无权限':num(v.returns.rows.length),'含换货'],
   ['已流转二手机',v.returns.error?'无权限':num(v.returns.rows.filter(r=>r.used_transfer_status==='transferred').length),'经质检和串码核验']
  ]));
  if(current.includes('service'))out.push(cardsFor('service',[
   ['未结售后工单',v.service.error?'无权限':num(open.length),'所有未关闭/未解决'],
   ['超时≥24h',v.service.error?'无权限':num(open.filter(t=>t.open_hours>=24).length),'需跟进'],
   ['超时≥48h',v.service.error?'无权限':num(open.filter(t=>t.open_hours>=48).length),'升级提醒'],
   ['超时≥72h',v.service.error?'无权限':num(open.filter(t=>t.open_hours>=72).length),'持续每24小时累加']
  ]));
  if(current.includes('finance'))out.push(cardsFor('finance',[
   ['退款申请',v.finance.error?'无权限':num(refund.length),'真实退款台账'],
   ['审核中退款',v.finance.error?'无权限':num(refund.filter(x=>['requested','approved','submitted'].includes(x.status)).length),'不等于已执行'],
   ['已登记付款退款金额',v.finance.error?'无权限':eur(refundMoney),'台账标记paid；需支付平台回执核验']
  ]));
  if(current.includes('operations'))out.push(cardsFor('operations',[
   ['待复核订单异常',v.operations.error?'无权限':num(byRole.filter(r=>r.case_status==='open'||r.case_status==='in_review').length),'异常单据数'],
   ['已分配异常',v.operations.error?'无权限':num(byRole.filter(r=>r.assigned_role).length),'按岗位跟进']
  ]));
  $('v4HomeSections').innerHTML=out.join('')||'<p class="erp-empty">请先设置首页指标。</p>';
  const info=document.createElement('div');info.className='message warn';info.textContent=warning;
  header.appendChild(info);
  if(!current.includes('sales')){
   // The pivot remains available when Sales is selected, but is hidden on support-only home layouts.
   [...root.children].filter(el=>el!==header).forEach(el=>{el.style.display='none'});
  }
 };
})();
