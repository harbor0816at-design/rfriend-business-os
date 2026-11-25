'use strict';
/* Manual, CSV and fuzzy-text order imports all run an explicit review step before atomic posting.
 A fuzzy-text extraction NEVER automatically creates a business order. */
(function(){
 const $=id=>document.getElementById(id),h=v=>erpEsc(v??'');
 let catalog=[],channels=[],drafts=[],kind='manual';
 const friendly=p=>p.product_name+' · '+(p.model||'')+' / '+(p.color||'')+' / '+(p.storage_version||'')+' ('+p.sku+')';
 const opts=(items,selected)=>items.map(([v,label])=>'<option value="'+h(v)+'" '+(String(v)===String(selected)?'selected':'')+'>'+h(label)+'</option>').join('');
 const localDateToIso=local=>{
  if(!local)return '';
  const time=new Date(local);
  if(!Number.isFinite(time.getTime()))return '';
  return time.toISOString(); // Displayed as local time at entry; stored as offset-aware UTC.
 };
 const isoToLocal=v=>{
  if(!v)return '';
  const d=new Date(v);if(!Number.isFinite(d.getTime()))return '';
  const shifted=new Date(d.getTime()-d.getTimezoneOffset()*60000);
  return shifted.toISOString().slice(0,16);
 };
 const sample={order_number:'',product_id:'',quantity:1,ordered_at:'',channel_id:'',total_eur:'',customer_name:'',confidence:'需人工确认'};
 function csvValue(line){return String(line??'').trim().replace(/^\ufeff/,'')}
 async function lookup(){
  [catalog,channels]=await Promise.all([erpData('product_catalog'),erpData('channels')]);
  catalog=catalog.filter(p=>p.is_active);
  channels=channels.filter(c=>c.is_active);
 }
 function guessProduct(str){
  const txt=String(str||'').toLowerCase();
  const candidates=catalog.map(p=>{
   const full=(p.product_name+' '+p.model+' '+p.color+' '+p.storage_version+' '+p.sku).toLowerCase();
   const sku=String(p.sku).toLowerCase(),model=String(p.model||'').toLowerCase();
   const score=(sku.length>=5&&txt.includes(sku)?100:0)+(model.length>=5&&txt.includes(model)?30:0)+
    (String(p.color||'').length>2&&txt.includes(String(p.color).toLowerCase())?9:0)+
    (String(p.storage_version||'').length>3&&txt.includes(String(p.storage_version).toLowerCase().replace(/\s/g,''))?8:0);
   return {id:p.id,score,full};
  }).sort((a,b)=>b.score-a.score);
  // Never pick a candidate with low confidence or tied models/variants.
  return candidates[0]?.score>=100&&candidates[0].score>candidates[1]?.score?candidates[0].id:'';
 }
 function parseFuzzy(text){
  const lines=String(text||'').split(/\n\s*\n|\n(?=(?:订单|order|Bestellung|#|编号)[:：#\s])/i).map(x=>x.trim()).filter(Boolean);
  return lines.slice(0,100).map(line=>{
   const n=line.match(/(?:订单号|订单编号|order(?:\s*no\.?|\s*number|\s*id)?|Bestellnummer|Bestellung|#)\s*[:：#]?\s*([A-Za-z0-9][A-Za-z0-9_-]{2,90})/i);
   const date=line.match(/(20\d\d[-/.]\d{1,2}[-/.]\d{1,2})(?:\s*[T\s]\s*(\d{1,2}:\d{2}))?/);
   const qty=line.match(/(?:数量|qty|quantity|Menge|Stück)\s*[:：]?\s*(\d{1,4})/i);
   const amount=line.match(/(?:合计|总金额|金额|total|betrag)\s*[:：€]?\s*([0-9.,]+)/i);
   const m=guessProduct(line);
   return {...sample,order_number:n?.[1]||'',product_id:m,quantity:qty?Number(qty[1]):1,
    ordered_at:date?date[1].replace(/[/.]/g,'-')+'T'+(date[2]||'12:00'):'',
    total_eur:amount?amount[1].replace(',','.'):'',
    channel_id:channels.length===1?channels[0].id:'',
    confidence:(!n||!date||!m||!qty)?'部分字段未确定，必须核对':'候选值已提取，仍需逐条确认',raw_text:line};
  });
 }
 function renderRows(container){
  container.innerHTML='<div class="erp-scroll"><table class="v6-import-table"><thead><tr>'+
   ['确认','订单号','渠道','具体商品 / 型号 / 颜色 / 内存','数量','订单日期时间（本机时区）','订单总金额 €','解析提示'].map(x=>'<th>'+x+'</th>').join('')+
   '</tr></thead><tbody>'+drafts.map((o,i)=>'<tr data-index="'+i+'">'+
   '<td><input data-field="checked" type="checkbox" '+(o.checked?'checked':'')+'></td>'+
   '<td><input data-field="order_number" class="control" value="'+h(o.order_number)+'" placeholder="平台订单号"></td>'+
   '<td><select data-field="channel_id" class="control"><option value="">选择渠道</option>'+opts(channels.map(c=>[c.id,c.name||c.code]),o.channel_id)+'</select></td>'+
   '<td><select data-field="product_id" class="control"><option value="">必须确认具体 SKU</option>'+opts(catalog.map(p=>[p.id,friendly(p)]),o.product_id)+'</select></td>'+
   '<td><input data-field="quantity" class="control" type="number" min="1" step="1" value="'+h(o.quantity)+'"></td>'+
   '<td><input data-field="ordered_at" class="control" type="datetime-local" value="'+h(o.ordered_at)+'"></td>'+
   '<td><input data-field="total_eur" class="control" type="number" min="0" step=".01" value="'+h(o.total_eur)+'" placeholder="可不填"></td>'+
   '<td><small>'+h(o.confidence)+'</small>'+(o.raw_text?'<details><summary>识别原文</summary><pre class="v6-raw">'+h(o.raw_text)+'</pre></details>':'')+'</td></tr>').join('')+
   '</tbody></table></div><p class="erp-mini">每条订单都必须人工勾选确认，尤其是模糊识别结果；未勾选的记录不会提交。</p>';
  container.querySelectorAll('tr[data-index]').forEach(row=>{
   const obj=drafts[Number(row.dataset.index)];
   row.querySelectorAll('[data-field]').forEach(input=>input.onchange=()=>{
    obj[input.dataset.field]=input.type==='checkbox'?input.checked:input.value;
   });
  });
 }
 function parseCsv(contents){
  const matrix=erpCsvParse(String(contents).replace(/^\ufeff/,'')).filter(x=>x.some(c=>String(c).trim()));
  const header=matrix.shift().map(x=>csvValue(x).toLowerCase());
  const get=(values,...keys)=>{const index=keys.map(k=>header.indexOf(k)).find(i=>i>=0);return index===undefined?'':csvValue(values[index]);};
  if(!header.some(x=>['order_number','订单号'].includes(x)))throw Error('CSV 必须包含 order_number 或 订单号');
  if(matrix.length>1000)throw Error('一次最多预览1000行，请拆分文件');
  return matrix.map(values=>{
   const source=get(values,'sku','商品sku','型号','product','product_name','商品名称');
   const matched=catalog.find(p=>p.sku===source)||catalog.find(p=>p.id===source);
   const channelText=get(values,'channel','渠道','channel_code');
   const channel=channels.find(c=>[c.code,c.name,c.id].some(x=>String(x).toLowerCase()===channelText.toLowerCase()));
   const iso=get(values,'ordered_at','订单时间','order_time','下单时间');
   const dt=iso?(iso.includes('T')?iso:iso.replace(' ','T')):'';
   return {...sample,order_number:get(values,'order_number','订单号'),product_id:matched?.id||'',
     quantity:Number(get(values,'quantity','数量')||1),ordered_at:dt.slice(0,16),
     channel_id:channel?.id||'',total_eur:get(values,'total_eur','金额','总金额'),
     confidence:matched?'商品SKU已匹配，仍需核对':'商品 SKU 未匹配，需手工选择'};
  });
 }
 function preview(title,mode){
  kind=mode;
  const m=erpModal('<p class="message">所有订单必须复核：平台订单号、具体型号（SKU）、数量和订单日期时间。防止渠道订单号重复，批量提交会由服务器原子校验。模糊文本不会未经确认直接入库。</p>'+
   '<div class="erp-toolbar"><button class="btn" id="v6AddRow">＋ 添加一条</button><button class="btn" id="v6SelectAll">全部标为已核对</button></div>'+
   '<div id="v6Rows"></div><div class="erp-actions" style="margin-top:16px"><button class="primary" id="v6Confirm" type="button">提交已人工核对订单</button></div>'+
   '<div id="v6Result"></div>',title);
  const target=m.querySelector('#v6Rows');renderRows(target);
  m.querySelector('#v6AddRow').onclick=()=>{drafts.push({...sample,checked:false});renderRows(target)};
  m.querySelector('#v6SelectAll').onclick=()=>{if(!confirm('已逐条核对订单号、SKU、数量和时间？未核实不得勾选。'))return;drafts.forEach(x=>x.checked=true);renderRows(target)};
  m.querySelector('#v6Confirm').onclick=async()=>{
   const btn=m.querySelector('#v6Confirm'),out=m.querySelector('#v6Result');
   const selected=drafts.filter(x=>x.checked);
   if(!selected.length){out.textContent='请逐条勾选已确认的订单';return}
   const duplicate=new Set(),bad=[];
   const rows=selected.map((x,i)=>{
    const stamp=localDateToIso(x.ordered_at);
    if(!x.order_number||!x.product_id||!x.channel_id||!stamp||!Number.isInteger(Number(x.quantity))||Number(x.quantity)<1)bad.push(i+1);
    const key=x.channel_id+'|'+x.order_number;if(duplicate.has(key))bad.push(i+1);duplicate.add(key);
    return {order_number:x.order_number.trim(),channel_id:x.channel_id,product_id:x.product_id,
      quantity:Number(x.quantity),ordered_at:stamp,total_eur:x.total_eur||null,customer_name:x.customer_name||null};
   });
   if(bad.length){out.textContent='以下已勾选行存在缺失字段或重复订单号：'+[...new Set(bad)].join(', ');return}
   btn.disabled=true;let done=0;
   try{
    // One RPC call per ≤100 rows is transactionally atomic, all rows validated on server.
    for(let i=0;i<rows.length;i+=100){
     const result=await authorized('/rest/v1/rpc/rfriend_erp_confirm_sales_orders',{method:'POST',
       body:{p_rows:rows.slice(i,i+100),p_method:kind}});
     done+=Number(result.created||0);
    }
    out.style.color='#128257';out.textContent='已成功保存 '+done+' 单。刷新可查看商品名称与订单明细。';
    ['order_products_v5','orders','order_dimensions','order_source_records','report_sales_by_month'].forEach(k=>ERP_CACHE.delete(k));
    await loadData();setTimeout(()=>{m.remove();erpNavigate('orders')},350);
   }catch(err){out.style.color='#b03432';out.textContent='成功 '+done+' 单，其余失败：'+errorMessage(err);btn.disabled=false}
  };
 }
 async function start(mode){
  await lookup();
  if(!catalog.length||!channels.length){alert('请先维护有效商品 SKU 与销售渠道');return}
  if(mode==='manual'){drafts=[{...sample,checked:false}];preview('单条手工创建销售订单','manual');return}
  const upload=erpModal('<p>CSV 必须包含 <code>order_number,channel,sku,quantity,ordered_at</code>，可选 <code>total_eur</code>。解析后还需逐条确认。</p>'+
   '<input id="v6Csv" type="file" accept=".csv,text/csv">'+
   '<div class="erp-toolbar"><button class="btn" id="v6CsvTemplate">下载 CSV 模板</button></div><p id="v6UploadNote"></p>',mode==='csv'?'批量 CSV 导入订单':'文字模糊识别');
  if(mode==='csv'){
   upload.querySelector('#v6CsvTemplate').onclick=()=>{
    const csv='order_number,channel,sku,quantity,ordered_at,total_eur\r\nTEST-001,oppo_at,OPPO_SKU,1,2026-11-25T10:00,999';
    const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
    a.href=url;a.download='rfriend-orders-template.csv';a.click();URL.revokeObjectURL(url);
   };
   upload.querySelector('#v6Csv').onchange=async e=>{
    try{drafts=parseCsv(await e.target.files[0].text()).map(x=>({...x,checked:false}));upload.remove();preview('批量订单逐条确认','csv')}
    catch(err){upload.querySelector('#v6UploadNote').textContent=errorMessage(err)}
   };
  }else{
   upload.querySelector('#v6Csv').remove();upload.querySelector('#v6CsvTemplate').remove();
   const area=document.createElement('div');area.innerHTML='<textarea id="v6FuzzyText" class="control" rows="10" style="width:100%" placeholder="例如：订单号 AT12345，Find X10 Pro Max Grey 12+512，数量 2，2026-11-25 10:30。每个订单一段。"></textarea>'+
    '<button id="v6Extract" class="btn primary">提取候选字段，进入人工确认</button>';
   upload.appendChild(area);
   upload.querySelector('#v6Extract').onclick=()=>{
    const input=upload.querySelector('#v6FuzzyText').value;
    if(input.trim().length<15){alert('请提供完整订单文字');return}
    drafts=parseFuzzy(input).map(x=>({...x,checked:false}));
    upload.remove();preview('文字识别结果：逐单人工确认','fuzzy_confirmed');
   };
  }
 }
 const original=window.erpV5OrderPage;
 window.erpV5OrderPage=async page=>{
  const result=await original(page);
  if(page==='orders'&&$('content')){
   const wrapper=document.createElement('section');wrapper.className='panel v6-order-actions';
   wrapper.innerHTML='<div class="erp-header"><h3>新增销售订单</h3></div>'+
    '<div class="erp-toolbar"><button class="btn primary" data-type="manual">＋ 单条手工录入</button>'+
    '<button class="btn" data-type="csv">⇪ CSV 批量上传</button>'+
    '<button class="btn" data-type="fuzzy">≋ 文字模糊上传 → 人工确认</button></div>';
   const anchor=$('content').querySelector('.erp-toolbar');
   if(anchor)anchor.before(wrapper);else $('content').prepend(wrapper);
   wrapper.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>start(b.dataset.type));
  }
  return result;
 };
})();
