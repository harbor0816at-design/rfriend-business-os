'use strict';
/* Cross-dimensional historical ORDER analysis. Every data row represents one unique ERP order,
 not product units or recognized revenue. */
(function(){
 const DIMS={time:'时间',channel_code:'渠道',series:'系列',model:'型号',category:'品类',order_status:'订单状态'};
 const TEMPLATES=[
  ['渠道 × 系列',{row:'channel_code',col:'series',grain:'month'}],
  ['月份 × 型号',{row:'time',col:'model',grain:'month'}],
  ['月份 × 渠道',{row:'time',col:'channel_code',grain:'month'}],
  ['品类 × 渠道',{row:'category',col:'channel_code',grain:'year'}],
  ['日期 × 系列',{row:'time',col:'series',grain:'day'}]
 ];
 let state={row:'time',col:'channel_code',grain:'month',start:'',end:'',channel:'',series:'',model:'',category:'',status:''};
 let dimensionRows=[],lastFiltered=[];
 const $=id=>document.getElementById(id);
 const html=v=>erpEsc(v??'');
 const asDate=v=>v?String(v).slice(0,10):'';
 function dimValue(o,dimension){
  if(dimension==='time'){
   const d=asDate(o.order_local_date);
   return !d?'日期待核':state.grain==='year'?d.slice(0,4):state.grain==='day'?d:d.slice(0,7);
  }
  return String(o[dimension]||'待核');
 }
 const choice=(id,label,opts,value)=>'<label class="pivot-field">'+html(label)+
  '<select class="control" id="'+id+'">'+opts.map(([v,n])=>'<option value="'+html(v)+'"'+(String(value)===String(v)?' selected':'')+'>'+html(n)+'</option>').join('')+'</select></label>';
 const optRows=vals=>[['','全部'],...vals.filter(x=>x!=null&&String(x).trim()).sort((a,b)=>String(a).localeCompare(String(b),'zh')).map(x=>[String(x),String(x)])];
 const unique=key=>[...new Set(dimensionRows.map(x=>x[key]).filter(x=>x!==null&&x!==undefined))];
 function drill(cell,grouped){
  const filtered=grouped.filter(x=>(cell.r===null||dimValue(x,state.row)===cell.r)&&(cell.c===null||dimValue(x,state.col)===cell.c));
  const m=erpModal('<div class="message">订单明细（去重后的独立 ERP 订单） · '+filtered.length+' 单。套装商品不按单品数量拆分。</div>'+
   '<div class="erp-toolbar"><button class="btn" id="pivotDrillExport">↓ 导出当前明细 CSV</button></div>'+
   '<div class="erp-scroll"><table><thead><tr><th>订单号</th><th>渠道</th><th>系列</th><th>型号</th><th>品类</th><th>下单日期</th><th>状态</th></tr></thead><tbody>'+
   filtered.slice(0,150).map(x=>'<tr>'+['external_order_id','channel_code','series','model','category','order_local_date','order_status']
    .map(k=>'<td>'+html(x[k]||'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'+
   '<p class="erp-mini">页面仅展示前 150 单；导出包含全部 '+filtered.length+' 单。</p>','交叉明细 / Drill-down');
  m.querySelector('#pivotDrillExport').onclick=()=>erpDownload('cross-analysis-detail',filtered);
 }
 function renderResults(){
  const root=$('pivotResults');if(!root)return;
  const groups=dimensionRows.filter(o=>{
   const date=asDate(o.order_local_date);
   return (!state.start||date&&date>=state.start)&&(!state.end||date&&date<=state.end)&&
    (!state.channel||o.channel_code===state.channel)&&(!state.series||o.series===state.series)&&
    (!state.model||o.model===state.model)&&(!state.category||o.category===state.category)&&
    (!state.status||o.order_status===state.status);
  });
  lastFiltered=groups;
  const rowKeys=[...new Set(groups.map(o=>dimValue(o,state.row)))].sort((a,b)=>a.localeCompare(b,'zh'));
  const colKeys=state.col==='none'?['订单数']:[...new Set(groups.map(o=>dimValue(o,state.col)))].sort((a,b)=>a.localeCompare(b,'zh'));
  // Maps count each order once; the base view has one row per ERP order.
  const cube=new Map(),rTotals=new Map(),cTotals=new Map();
  for(const o of groups){
   const r=dimValue(o,state.row),c=state.col==='none'?'订单数':dimValue(o,state.col);
   const key=JSON.stringify([r,c]);cube.set(key,(cube.get(key)||0)+1);
   rTotals.set(r,(rTotals.get(r)||0)+1);cTotals.set(c,(cTotals.get(c)||0)+1);
  }
  const total=groups.length;
  $('pivotKpis').innerHTML=erpMetric('筛选后订单',total.toLocaleString('de-AT'),'一单计一次')+
   erpMetric('参与交叉维度',state.col==='none'?'1':'2','行 × 列')+
   erpMetric('未识别型号',groups.filter(x=>x.model==='型号待核').length.toLocaleString('de-AT'),'不可当作已识别型号')+
   erpMetric('缺失下单日期',groups.filter(x=>!x.order_local_date).length.toLocaleString('de-AT'),'单独列示，不补造时间');
  let body='';
  for(const r of rowKeys){
   body+='<tr><th>'+html(r)+'</th>';
   for(const c of colKeys){const n=cube.get(JSON.stringify([r,c]))||0;
    body+='<td><button class="pivot-cell" data-r="'+html(r)+'" data-c="'+html(c)+'" '+(n?'':'disabled')+'>'+n.toLocaleString('de-AT')+'</button></td>';}
   body+='<td class="pivot-total"><button class="pivot-cell" data-r="'+html(r)+'" data-c="__ALL__">'+(rTotals.get(r)||0).toLocaleString('de-AT')+'</button></td></tr>';
  }
  root.innerHTML='<div class="erp-scroll"><table class="pivot-table"><thead><tr><th>'+html(DIMS[state.row])+' / '+html(state.col==='none'?'总计':DIMS[state.col])+'</th>'+
   colKeys.map(c=>'<th>'+html(c)+'</th>').join('')+'<th>合计</th></tr></thead><tbody>'+
   (body||'<tr><td colspan="'+(colKeys.length+2)+'" class="erp-empty">该筛选组合下没有订单</td></tr>')+
   '<tr class="pivot-total"><th>合计</th>'+colKeys.map(c=>'<td>'+(cTotals.get(c)||0).toLocaleString('de-AT')+'</td>').join('')+'<td>'+total.toLocaleString('de-AT')+'</td></tr></tbody></table></div>'+
   '<p class="erp-mini">点击数字可下钻至对应订单，包含订单号与状态；统计为独立订单数，不是销售件数或支付金额。</p>';
  root.querySelectorAll('[data-r]').forEach(btn=>btn.onclick=()=>drill({r:btn.dataset.r,c:btn.dataset.c==='__ALL__'?null:btn.dataset.c},groups));
  const top=[...rTotals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12),max=top[0]?.[1]||1;
  $('pivotBars').innerHTML=top.map(([name,count])=>'<div class="pivot-bar-row"><span>'+html(name)+'</span><div class="pivot-track"><i style="width:'+(100*count/max).toFixed(1)+'%"></i></div><strong>'+count+'</strong></div>').join('')||
   '<div class="erp-empty">暂无数据</div>';
  $('pivotCountNote').textContent=dimensionRows.length+' 条已归档 ERP 订单 · 交叉筛选 '+total+' 条 · 数据按 Vienna 本地日历统计';
 }
 function change(){
  for(const key of ['row','col','grain','start','end','channel','series','model','category','status']){
   const el=$('pivot_'+key);if(el)state[key]=el.value;
  }
  if(state.row===state.col){state.col='none';$('pivot_col').value='none'}
  renderResults();
 }
 function applyTemplate(i){state={...state,...TEMPLATES[i][1]};
  for(const key of ['row','col','grain'])$('pivot_'+key).value=state[key];
  renderResults();
  $('pivotTemplateButtons').querySelectorAll('[data-template]').forEach(btn=>btn.classList.toggle('primary',Number(btn.dataset.template)===i));
 }
 window.erpDashboard=async function(){
  $('content').innerHTML='<div class="erp-topline">订单量分析 · 分渠道 / 型号 / 系列 / 品类 / 年月日交叉</div>'+
   '<div class="message">当前订单分析的基础口径是 ERP 独立订单：一单即使含多件商品仍计算 1 单。型号来源于历史归类及原始商品描述；无法确定的记录显示“型号待核”，不会拆分推测。</div>'+
   '<div class="cards" id="pivotKpis"></div>'+
   '<section class="panel"><div class="erp-header"><div><h3>固定分析模板</h3><div class="erp-sub">可切换模板，也可自由组合维度和筛选条件</div></div></div>'+
    '<div class="erp-toolbar" id="pivotTemplateButtons">'+TEMPLATES.map(([name],i)=>'<button class="btn" data-template="'+i+'">'+html(name)+'</button>').join('')+'</div>'+
    '<div class="pivot-controls" id="pivotControlArea"></div>'+
    '<div class="erp-toolbar" style="margin-top:12px"><button class="btn primary" id="pivotRun">应用分析</button><button class="btn" id="pivotReset">清空筛选</button><button class="btn" id="pivotExport">↓ 导出筛选后的订单</button></div></section>'+
   '<div class="erp-grid"><section class="panel"><h3>自定义交叉分析</h3><div id="pivotResults">正在加载订单维度…</div></section>'+
   '<section class="panel"><h3>当前行维度 TOP 12</h3><div id="pivotBars"></div></section></div>'+
   '<p class="erp-mini" id="pivotCountNote"></p>';
  try{dimensionRows=await erpData('order_dimensions');
   if(!$('pivotControlArea'))return;
   const selections=[
    choice('pivot_row','行维度',Object.entries(DIMS).map(([k,v])=>[k,v]),state.row),
    choice('pivot_col','列维度',[['none','仅汇总'],...Object.entries(DIMS).map(([k,v])=>[k,v])],state.col),
    choice('pivot_grain','时间粒度',[['year','年'],['month','月'],['day','日']],state.grain),
    choice('pivot_channel','渠道',optRows(unique('channel_code')),state.channel),
    choice('pivot_series','系列',optRows(unique('series')),state.series),
    choice('pivot_model','型号',optRows(unique('model')),state.model),
    choice('pivot_category','品类',optRows(unique('category')),state.category),
    choice('pivot_status','订单状态',optRows(unique('order_status')),state.status),
    '<label class="pivot-field">开始日期<input class="control" id="pivot_start" type="date" value="'+html(state.start)+'"></label>',
    '<label class="pivot-field">结束日期<input class="control" id="pivot_end" type="date" value="'+html(state.end)+'"></label>'
   ];
   $('pivotControlArea').innerHTML=selections.join('');
   $('pivotRun').onclick=change;
   $('pivotReset').onclick=()=>{state={row:'time',col:'channel_code',grain:'month',start:'',end:'',channel:'',series:'',model:'',category:'',status:''};render();};
   $('pivotExport').onclick=()=>{change();erpDownload('order-pivot-filtered',lastFiltered);};
   $('pivotTemplateButtons').querySelectorAll('[data-template]').forEach(btn=>btn.onclick=()=>applyTemplate(Number(btn.dataset.template)));
   $('pivotControlArea').querySelectorAll('select').forEach(x=>x.addEventListener('change',change));
   renderResults();
  }catch(e){if($('pivotResults'))$('pivotResults').innerHTML='<div class="erp-blocked">'+html(errorMessage(e))+'</div>';}
 };
})();
