
'use strict';
var STORE_KEY='rasid-clean-v2',SNAP_KEY='rasid-clean-v2-previous';
var CATS=['خضار وفواكه','لحوم ودواجن','ألبان وأجبان','مخبوزات','معلبات','منظفات','مشروبات','بهارات','حلويات','أخرى'];
var TABS=[['home','الرئيسية'],['receipts','الفواتير'],['compare','المقارنات'],['catalog','الأصناف'],['months','المصروف الشهري'],['settings','الإعدادات']];
var page='home',searchText='',monthFilter='',prodSearch='',selectedProduct='',draft=null,activeDrawer='',openItems=new Set(),writeLocked=false;
var root=document.getElementById('main'),drawer=document.getElementById('drawer'),toastNode=document.getElementById('toast');
function rid(){return 'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,9)}
function round3(v){return Math.round((Number(v)||0)*1000)/1000}
function val(s){return Number(String(s==null?'':s).trim().replace(/[٠-٩]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'.indexOf(d)}).replace(/[۰-۹]/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)}).replace(/٬/g,'').replace(/٫/g,'.'))||0}
function fmt(v,d){return Number(v||0).toLocaleString('ar-SA-u-nu-latn',{minimumFractionDigits:d==null?2:d,maximumFractionDigits:d==null?2:d})}
function sar(x){return fmt(x)+' ر.س'}
function h(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function today(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function monthNow(){return today().slice(0,7)}
function mtitle(m){return /^\d{4}-\d{2}$/.test(m||'')?new Intl.DateTimeFormat('ar-SA-u-nu-latn',{month:'long',year:'numeric',calendar:'gregory'}).format(new Date(m+'-01T12:00:00')):m||'—'}
function nextMonth(m){var d=new Date(Number(m.slice(0,4)),Number(m.slice(5,7)),1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function monthRange(a,b){var out=[];for(var k=0;a<=b&&k<240;k++,a=nextMonth(a))out.push(a);return out}
function copy(x){return JSON.parse(JSON.stringify(x))}
function add(list,field){return round3(list.reduce(function(a,b){return a+Number(field(b)||0)},0))}
function box(x,c){return '<section class="card '+(c||'')+'">'+x+'</section>'}
function title(x,sub,right){return '<div class="page-head"><div><h2>'+h(x)+'</h2><p>'+h(sub||'')+'</p></div><div class="actions">'+(right||'')+'</div></div>'}
function btn(label,action,style,extra){return '<button type="button" class="'+(style||'secondary')+'" data-action="'+action+'" '+(extra||'')+'>'+label+'</button>'}
function field(label,name,value,type,extra){return '<div class="field"><label>'+h(label)+'</label><input type="'+(type||'text')+'" name="'+h(name)+'" value="'+h(value==null?'':value)+'" '+(extra||'')+'></div>'}
function options(name,label,selected,items){return '<div class="field"><label>'+h(label)+'</label><select name="'+h(name)+'">'+items.map(function(i){return '<option value="'+h(i[0])+'" '+(String(i[0])===String(selected)?'selected':'')+'>'+h(i[1])+'</option>'}).join('')+'</select></div>'}
function notify(msg){toastNode.textContent=msg;toastNode.classList.add('show');clearTimeout(notify.t);notify.t=setTimeout(function(){toastNode.classList.remove('show')},3400)}
function initial(){var seeds=copy(window.RASID_SEED||[]),legacyCount=0,budget=0;
 try{var text=localStorage.getItem('rasid-purchases-v1'),old=text?JSON.parse(text):null;
 if(old&&Array.isArray(old.receipts)){budget=round3(val(old.budget));old.receipts.forEach(function(r){if(!r||!Array.isArray(r.items)||!/^\d{4}-\d{2}-\d{2}$/.test(r.date||''))return;
 var entry=copy(r);entry.id=entry.id||rid();entry.review=!!(entry.review||entry.requiresReview);entry.items=entry.items.map(function(i){return Object.assign({id:rid(),barcode:'',size:'',category:'أخرى'},i)});entry.source=entry.source||'مُنقولة من راصد السابق';
 var k=seeds.findIndex(function(x){return x.date===entry.date&&x.invoiceNo&&entry.invoiceNo&&String(x.invoiceNo)===String(entry.invoiceNo)});
 if(k>=0)seeds[k]=entry;else seeds.push(entry);legacyCount++})}}
 catch(e){console.warn('تعذر استيراد البيانات القديمة؛ أُبقيت فواتير البداية',e)}
 return {version:2,createdAt:today(),monthlyBudget:budget,receipts:seeds,legacyImported:legacyCount}}
function loadDB(){var raw=null,parsed=null;try{raw=localStorage.getItem(STORE_KEY);if(raw)parsed=JSON.parse(raw)}catch(e){writeLocked=true;alert('تعذر قراءة التخزين المحلي. لن نكتب فوقه.');return initial()}if(parsed&&Array.isArray(parsed.receipts))return parsed;if(raw){writeLocked=true;alert('هناك بيانات محلية غير صالحة. أوقفنا الحفظ حفاظًا عليها.');return initial()}var fresh=initial();try{localStorage.setItem(STORE_KEY,JSON.stringify(fresh))}catch(e){writeLocked=true;alert('تعذر حفظ البيانات محليًا. استخدم متصفحًا يسمح بالتخزين.')}return fresh}
var db=loadDB();
function ensureCatalog(){if(!Array.isArray(db.catalog))db.catalog=[];var existing=new Map(db.catalog.map(function(p){return [norm(p.name),p]}));receipts().forEach(function(r){(r.items||[]).forEach(function(i){var name=String(i.name||'').trim();if(!name||norm(name).includes('غير واضح'))return;if(i.productId&&db.catalog.some(function(p){return p.id===i.productId}))return;var found=existing.get(norm(name));if(!found){found={id:'p-'+rid(),name:name,category:i.category||'أخرى',unit:i.unit||(val(i.quantity)%1?'كجم':'حبة')};db.catalog.push(found);existing.set(norm(name),found)}i.productId=found.id;i.unit=i.unit||found.unit})})}
ensureCatalog();
function catalogById(id){return (db.catalog||[]).find(function(p){return p.id===id})}
function canonicalList(){return (db.catalog||[]).slice().sort(function(a,b){return a.name.localeCompare(b.name,'ar')})}
function itemName(i){var p=i.productId&&catalogById(i.productId);return p?p.name:i.name}

function persist(){if(writeLocked){alert('الحفظ متوقف لحماية السجل.');return false}try{var old=localStorage.getItem(STORE_KEY);if(old)localStorage.setItem(SNAP_KEY,old);localStorage.setItem(STORE_KEY,JSON.stringify(db));return true}catch(e){alert('تعذر الحفظ. نزّل نسخة احتياطية وتحقق من مساحة المتصفح.');return false}}
function receipts(){return db.receipts||[]}
function rkey(r){return r.invoiceNo&&r.date?'invoice:'+r.date+'|'+r.invoiceNo:'id:'+r.id}
function byDate(){return receipts().slice().sort(function(a,b){return b.date.localeCompare(a.date)})}
function diff(r){return round3(add(r.items||[],function(i){return i.total})-val(r.total))}
function shops(){return [...new Set(receipts().map(function(r){return r.store||'غير معروف'}))].sort(function(a,b){return a.localeCompare(b,'ar')})}
function norm(t){return String(t||'').normalize('NFKC').replace(/[٠-٩]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'.indexOf(d)}).replace(/[۰-۹]/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)}).toLowerCase().replace(/[أإآ]/g,'ا').replace(/[ًٌٍَُِّْـ]/g,'').replace(/[،.\-_/]/g,' ').replace(/\s+/g,' ').trim()}
function productSignature(name){var words=norm(name).split(' ').filter(Boolean).map(function(w){w=w.length>4&&w.slice(0,2)==='ال'?w.slice(2):w;return w.replace(/ة$/,'ه').replace(/ى$/,'ي')});if(words.includes('لتر')&&!words.some(function(w){return /^\d+$/.test(w)}))words.push('1');return words.sort().join('|')}
function measure(i){var q=val(i.quantity)||1,u=i.unit||'حبة';if(u==='جرام')return {quantity:q/1000,unit:'كجم'};if(u==='مل')return {quantity:q/1000,unit:'لتر'};return {quantity:q,unit:u}}
function pkey(i,r){if(i.productId&&catalogById(i.productId))return 'canonical:'+i.productId+'|unit:'+measure(i).unit;var b=String(i.barcode||'').replace(/\D/g,'');if(b.length>=8)return 'barcode:'+b;var name=norm(i.name),size=norm(i.size);return !name||name.includes('غير واضح')?'unknown:'+r.id+':'+i.id:'name:'+productSignature(name)+'|'+productSignature(size)}
function products(){var map=new Map();receipts().forEach(function(r){(r.items||[]).forEach(function(i){if(!i.name)return;var key=pkey(i,r),p=map.get(key),m=measure(i),q=m.quantity||1;if(!p){p={key:key,name:itemName(i)+(i.productId?' • لكل '+m.unit:''),barcode:i.barcode||'',hits:[],spend:0,receipts:new Set(),shops:new Set(),unit:m.unit};map.set(key,p)}p.hits.push({date:r.date,store:r.store,price:round3(val(i.total)/q),total:val(i.total),qty:q,invoice:r.invoiceNo});p.spend+=val(i.total);p.shops.add(r.store);p.receipts.add(r.id)})});return [...map.values()].sort(function(a,b){return b.hits.length-a.hits.length||a.name.localeCompare(b.name,'ar')})}
/* مقارنة أنواع الصنف الواحد عند تساوي نوعه وحجم عبوته، مع الاحتفاظ باسم العلامة المطبوع. */
function compareFamilies(){
 var groups=new Map();
 receipts().forEach(function(r){(r.items||[]).forEach(function(i){
  if(i.manualCanonical&&i.productId&&catalogById(i.productId))return;var name=String(i.name||''),clean=norm(name);
  if(!clean||clean.includes('غير واضح'))return;
  var ascii=name.replace(/[٠-٩]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'.indexOf(d)}).replace(/[۰-۹]/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)});
  /* لا نخلط التونة العادية مع السلطات أو عبوات بأحجام مختلفة. */
  var weight=ascii.match(/(\d+(?:\.\d+)?)\s*(?:جرام|غرام|جم|غ)(?=$|[\s\)×x*،,])/);
  if(!/تون[هة]/.test(clean)||!weight||/سلط[هة]|سلاد|كسكس|سلطة/.test(clean))return;
  var grams=Number(weight[1]),key='family:tuna:'+grams;
  if(!groups.has(key))groups.set(key,{key:key,name:'تونة '+grams+' جرام — مقارنة العلامات',hits:[],spend:0,shops:new Set(),receipts:new Set(),isFamily:true,brands:new Set()});
  var p=groups.get(key),qty=val(i.quantity)||1,total=val(i.total);
  if(qty<=0)return;
  p.hits.push({date:r.date,store:r.store,price:round3(total/qty),total:total,qty:qty,invoice:r.invoiceNo,name:name});
  p.receipts.add(r.id);p.shops.add(r.store);p.brands.add(name);p.spend+=total;
 })});
 return [...groups.values()].filter(function(p){return p.shops.size>=2}).sort(function(a,b){return b.shops.size-a.shops.size||b.hits.length-a.hits.length});
}
function comparisonProducts(){var families=compareFamilies(),covered=new Set();families.forEach(function(g){g.hits.forEach(function(x){covered.add(norm(x.name||''))})});return families.concat(products().filter(function(p){return !covered.has(norm(p.name))}))}
function storeRanking(p){
 var groups=new Map();
 p.hits.forEach(function(x){var store=x.store||'غير معروف';if(!groups.has(store))groups.set(store,[]);groups.get(store).push(x)});
 var rows=[...groups.entries()].map(function(entry){
  var sorted=entry[1].slice().sort(function(a,b){return a.date.localeCompare(b.date)});
  var lowest=sorted.reduce(function(best,x){return x.price<best.price?x:best},sorted[0]);
  var latest=sorted[sorted.length-1];
  return {store:entry[0],minimum:lowest.price,lowestName:lowest.name||p.name,latest:latest.price,lastName:latest.name||p.name,date:latest.date,lowDate:lowest.date};
 }).sort(function(a,b){return a.minimum-b.minimum||a.store.localeCompare(b.store,'ar')});
 var distinct=[];rows.forEach(function(x){var index=distinct.findIndex(function(p){return Math.abs(p-x.minimum)<0.0005});if(index<0){distinct.push(x.minimum);index=distinct.length-1}x.rank=index+1});
 return rows;
}
function monthsData(){var map=new Map();receipts().forEach(function(r){var m=String(r.date||'').slice(0,7);if(!/^\d{4}-\d{2}$/.test(m))return;if(!map.has(m))map.set(m,{month:m,spent:0,vat:0,count:0});var x=map.get(m);x.spent=round3(x.spent+val(r.total));x.vat=round3(x.vat+val(r.vat));x.count++});return map}
function budgetLedger(){var months=[...monthsData().keys()].sort(),start=months[0]||monthNow(),end=months.length&&months[months.length-1]>monthNow()?months[months.length-1]:monthNow(),map=monthsData(),carry=0,base=val(db.monthlyBudget);return monthRange(start,end).map(function(m){var x=map.get(m)||{spent:0,vat:0,count:0},opening=carry,available=round3(base+opening),closing=round3(available-x.spent);carry=closing;return {month:m,base:base,opening:opening,available:available,spent:x.spent,vat:x.vat,count:x.count,closing:closing}})}
function averages(){var l=budgetLedger(),active=l.filter(function(r){return r.count}),total=add(l,function(r){return r.spent});return {total:total,months:l.length,active:active.length,average:l.length?round3(total/l.length):0,activeAverage:active.length?round3(total/active.length):0}}
function bars(rows){if(!rows.length)return '<div class="empty">لا توجد بيانات للعرض</div>';var high=Math.max(1,...rows.map(function(r){return Math.abs(r.value)}));return rows.slice(0,14).map(function(r){return '<div class="barrow"><span title="'+h(r.name)+'" class="barlabel">'+h(r.name)+'</span><div class="bartrack"><div class="barfill" style="width:'+Math.max(0,100*Math.abs(r.value)/high).toFixed(1)+'%"></div></div><b class="value">'+fmt(r.value)+'</b></div>'}).join('')}
function storeTotals(source){var data=source||receipts();return [...new Set(data.map(function(r){return r.store}))].map(function(s){return {name:s||'غير معروف',value:add(data.filter(function(r){return r.store===s}),function(r){return r.total})}}).sort(function(a,b){return b.value-a.value})}
function invoiceCard(r){var difference=diff(r);return box('<div class="between"><div><div class="name">'+h(r.store)+'</div><div class="sub">'+h(r.date)+(r.time?' '+h(r.time):'')+' • رقم '+h(r.invoiceNo||'—')+' • '+h(r.branch||'')+'</div></div><strong class="money">'+fmt(r.total,3)+' ر.س</strong></div><div class="statline pull"><span class="tag">'+(r.items||[]).length+' سطر</span><span class="tag">الضريبة '+fmt(r.vat,3)+'</span>'+(r.review?'<span class="pill review">مراجعة</span>':'')+(Math.abs(difference)>=.01?'<span class="pill review">الفرق '+fmt(difference,3)+'</span>':'')+'</div><div class="actions">'+btn('عرض وتعديل','edit','primary small','data-id="'+h(r.id)+'"')+btn('نسخ الفاتورة','oneExport','secondary small','data-id="'+h(r.id)+'"')+'</div>','receipt')}
function drawHome(){var l=budgetLedger(),thisRow=l.find(function(x){return x.month===monthNow()})||l[l.length-1],allSum=add(receipts(),function(r){return r.total}),recent=byDate().slice(0,3),reviews=receipts().filter(function(r){return r.review||Math.abs(diff(r))>=.01});return title('الرئيسية','عرض شامل دون فلتر شهر',btn('＋ شراء جديد','manualNew','primary'))+'<div class="grid cols4">'+
 box('<div class="label">مجموع الفواتير</div><div class="big">'+sar(allSum)+'</div><div class="hint">'+receipts().length+' فاتورة','metric feature')+
 box('<div class="label">مصروف الشهر الحالي</div><div class="big">'+sar(thisRow.spent)+'</div><div class="hint">'+mtitle(thisRow.month)+'</div>','metric')+
 box('<div class="label">المتبقي المرحّل</div><div class="big '+(thisRow.closing<0?'up':'good')+'">'+(db.monthlyBudget?sar(thisRow.closing):'غير محدد')+'</div><div class="hint">يشمل باقي الأشهر السابقة</div>','metric')+
 box('<div class="label">متوسط الإنفاق الشهري</div><div class="big">'+sar(averages().average)+'</div><div class="hint">متوسط جميع الأشهر التقويمية</div>','metric')+'</div>'+
 (reviews.length?'<div class="alert">هناك '+reviews.length+' فاتورة أولية أو ذات فرق بين البنود والإجمالي؛ راجعها من قسم الفواتير.</div>':'')+
 '<div class="space"></div><div class="grid cols2">'+box('<h3>الإنفاق حسب المتجر • جميع الأشهر</h3>'+bars(storeTotals()))+box('<h3>الفواتير الحديثة</h3>'+(recent.length?recent.map(function(r){return '<div class="listrow between"><div><b>'+h(r.store)+'</b><div class="hint">'+h(r.date)+'</div></div><div>'+sar(r.total)+' '+btn('فتح','edit','secondary small','data-id="'+h(r.id)+'"')+'</div></div>'}).join(''):'<div class="empty">لا توجد فواتير</div>'))+'</div>'+
 '<div class="alert info">الميزانية الأساسية ثابتة كل شهر، وينتقل رصيد الشهر السابق تلقائيًا للشهر الجديد. يُرحّل العجز أيضًا لعدم إخفاء زيادة الإنفاق.</div>'}
function drawReceipts(){return title('الفواتير','جميع الفواتير من كل الأشهر في قائمة واحدة',btn('＋ شراء جديد','manualNew','primary'))+box('<div class="field"><label>البحث في المتجر ورقم الفاتورة والأصناف</label><input id="invoiceSearch" placeholder="بحث في جميع الأشهر" value="'+h(searchText)+'"></div><p class="hint">'+receipts().length+' فاتورة محفوظة</p>')+'<div class="space"></div><div class="receipts" id="receiptResults"></div>'}
function receiptResults(){var e=document.getElementById('receiptResults'),q=norm(searchText);if(!e)return;var list=byDate().filter(function(r){return !q||norm([r.store,r.branch,r.invoiceNo].concat((r.items||[]).map(function(i){return i.name})).join(' ')).includes(q)});e.innerHTML=list.length?list.map(invoiceCard).join(''):'<div class="card empty">لا توجد نتائج</div>'}
function drawMonths(){var l=budgetLedger(),stat=averages(),selected=monthFilter?l.find(function(x){return x.month===monthFilter}):null,shown=selected?[selected]:l.slice().reverse(),total=add(shown,function(x){return x.spent}),vat=add(shown,function(x){return x.vat}),count=shown.reduce(function(s,x){return s+x.count},0),opts=[['','جميع الأشهر']].concat(l.slice().reverse().map(function(x){return [x.month,mtitle(x.month)]}));return title('المصروف الشهري','صفحة مستقلة للتواريخ والإجماليات والمتوسط')+
 box('<div class="controls">'+options('monthFilter','الفترة',monthFilter,opts)+'</div><div class="grid cols4">'+
 box('<div class="label">إجمالي الصرف</div><div class="big">'+sar(total)+'</div>','metric')+
 box('<div class="label">الفواتير</div><div class="big">'+count+'</div>','metric')+
 box('<div class="label">الضريبة المكتوبة</div><div class="big">'+sar(vat)+'</div>','metric')+
 box('<div class="label">'+(selected?'الرصيد بنهاية الشهر':'متوسط الإنفاق')+'</div><div class="big">'+sar(selected?selected.closing:stat.average)+'</div>','metric')+'</div>')+
 '<div class="space"></div>'+box('<h3>المشتريات شهريًا</h3>'+bars(l.map(function(x){return {name:mtitle(x.month),value:x.spent}}))+'<p class="hint">المتوسط لجميع الأشهر: '+sar(stat.average)+' • متوسط أشهر الشراء فقط: '+sar(stat.activeAverage)+' • عدد الأشهر: '+stat.months+'</p>')+
 '<div class="space"></div>'+box('<h3>كشف الرصيد المرحّل</h3><div class="tablewrap"><table><thead><tr><th>الشهر</th><th>ميزانية الشهر</th><th>مرحّل من السابق</th><th>الإنفاق</th><th>المتبقي</th><th>عدد الفواتير</th></tr></thead><tbody>'+shown.map(function(x){return '<tr><td>'+h(mtitle(x.month))+'</td><td>'+sar(x.base)+'</td><td>'+sar(x.opening)+'</td><td>'+sar(x.spent)+'</td><td class="'+(x.closing<0?'up':'good')+'">'+sar(x.closing)+'</td><td>'+x.count+'</td></tr>'}).join('')+'</tbody></table></div><p class="hint">المتبقي = الميزانية الشهرية الثابتة + رصيد الشهر الماضي − إنفاق الشهر. اختيار شهر هنا يغيّر العرض فقط.</p>')+
 '<div class="space"></div>'+box('<h3>المتاجر في الفترة المختارة</h3>'+bars(storeTotals(receipts().filter(function(r){return !monthFilter||r.date.slice(0,7)===monthFilter}))))}
function graph(hits){if(!hits.length)return '<div class="empty">لا توجد أسعار</div>';var a=hits.slice().sort(function(x,y){return x.date.localeCompare(y.date)}),vals=a.map(function(x){return x.price}),lo=Math.min.apply(null,vals),hi=Math.max.apply(null,vals);if(lo===hi){lo=Math.max(0,lo-.5);hi+=.5}var w=680,H=220,L=62,R=26,T=20,B=48,xx=function(i){return L+(a.length===1?(w-L-R)/2:(w-L-R)*i/(a.length-1))},yy=function(x){return T+(hi-x)/(hi-lo)*(H-T-B)};return '<svg class="lineplot" viewBox="0 0 '+w+' '+H+'" role="img" aria-label="تطور السعر">'+[0,.25,.5,.75,1].map(function(v){var y=T+v*(H-T-B);return '<line x1="'+L+'" y1="'+y+'" x2="'+(w-R)+'" y2="'+y+'" stroke="#dce6e7"/><text x="'+(L-7)+'" y="'+(y+4)+'" text-anchor="end" font-size="12" fill="#6e8387">'+fmt(hi-v*(hi-lo))+'</text>'}).join('')+'<polyline points="'+a.map(function(x,i){return xx(i)+','+yy(x.price)}).join(' ')+'" fill="none" stroke="#087e79" stroke-width="3"/>'+a.map(function(x,i){return '<circle cx="'+xx(i)+'" cy="'+yy(x.price)+'" r="5" fill="#087e79"><title>'+h(x.date+' • '+x.store+' • '+sar(x.price))+'</title></circle><text x="'+xx(i)+'" y="'+(H-9)+'" text-anchor="middle" font-size="11" fill="#6e8387">'+h(x.date.slice(5))+'</text>'}).join('')+'</svg>'}
function drawCompare(){
 var list=comparisonProducts(),query=norm(prodSearch),matches=list.filter(function(x){return !query||norm(x.name).includes(query)||(x.isFamily&&[...x.brands].some(function(name){return norm(name).includes(query)}))}),
 p=matches.find(function(x){return x.key===selectedProduct})||matches.find(function(x){return x.isFamily&&x.shops.size>1})||matches.find(function(x){return new Set(x.hits.map(function(z){return z.date.slice(0,7)})).size>1&&x.shops.size>1})||matches[0];
 if(p)selectedProduct=p.key;else selectedProduct='';
 var months=[...monthsData().keys()].sort(),panel='<div class="empty">لم تُسجل منتجات بعد</div>';
 if(p){
  var uniq=new Map();
  p.hits.forEach(function(x){var key=x.date+'|'+x.store+'|'+x.price+'|'+(x.name||'');if(!uniq.has(key))uniq.set(key,x)});
  var hits=[...uniq.values()].sort(function(a,b){return a.date.localeCompare(b.date)}),
  storeInfo=storeRanking(p),tied=storeInfo.length>1&&storeInfo[0].rank===storeInfo[1].rank,
  cheapest=storeInfo.filter(function(x){return x.rank===1}).map(function(x){return x.store}).join('، ');
  var rankCards=storeInfo.map(function(x){
    var leading=x.rank===1,position=leading?(tied?'الأقل بالتساوي':'الأقل سعرًا'):'المرتبة '+x.rank;
    return '<div class="item-card '+(leading?'winner':'')+'"><div class="between"><div><span class="pill '+(leading?'':'secondary-rank')+'">'+position+'</span><h3 class="compare-store">'+h(x.store)+'</h3><div class="hint">'+h(x.lowestName)+'</div></div><strong class="bigprice">'+fmt(x.minimum,3)+' ر.س</strong></div><div class="hint pull">أقل سعر مرصود للوحدة • '+h(x.lowDate)+' | الأحدث: '+fmt(x.latest,3)+' ر.س ('+h(x.date)+')</div></div>';
  }).join('');
  panel=box('<h3>'+h(p.name)+'</h3><p class="hint">موجود في '+p.receipts.size+' فاتورة و '+p.shops.size+' متجر</p>'+
   (p.isFamily?'<div class="alert info">المقارنة تشمل علامات تجارية مختلفة للمنتج نفسه وبالحجم نفسه. نعرض اسم كل علامة أمام متجرها؛ لا نفترض تطابق الجودة أو المكونات.</div>':'')+
   '<div class="grid cols3">'+
   box('<div class="label">أقل سعر لكل '+h(p.unit||'وحدة')+'</div><div class="big">'+fmt(storeInfo[0].minimum,3)+' ر.س</div>','metric')+
   box('<div class="label">المتجر الأرخص'+(tied?' بالتساوي':'')+'</div><div class="big store-name">'+h(cheapest)+'</div>','metric')+
   box('<div class="label">إجمالي الصرف على الصنف</div><div class="big">'+sar(p.spend)+'</div>','metric')+
   '</div><div class="space"></div><h3>ترتيب المتاجر حسب الأقل سعرًا</h3><div class="ranked-stores">'+rankCards+'</div>'+
   '<p class="hint">ترتيب حسب أقل سعر تاريخي للوحدة. إذا تساوى متجران في السعر تظهر المرتبة الأولى لكليهما؛ ولا يُستبعد أي متجر.</p>'+
   '<div class="space"></div><h3>تطور سعر الوحدة بين الأشهر</h3>'+graph(hits)+
   '<p class="chart-note">تُدمج نقاط السعر المتطابقة للمنتج في اليوم والمتجر ذاته، ولا تُحذف عمليات الشراء من الإجماليات.</p>'+
   '<h3>تفاصيل المتاجر</h3><div class="tablewrap"><table><thead><tr><th>الترتيب</th><th>المتجر</th><th>اسم الصنف</th><th>أقل سعر</th><th>آخر سعر</th><th>آخر تاريخ</th></tr></thead><tbody>'+
   storeInfo.map(function(x){return '<tr><td>'+x.rank+'</td><td>'+h(x.store)+'</td><td>'+h(x.lowestName)+'</td><td>'+fmt(x.minimum,3)+' ر.س</td><td>'+fmt(x.latest,3)+' ر.س</td><td>'+h(x.date)+'</td></tr>'}).join('')+
   '</tbody></table></div><p class="hint">عند غياب الباركود تكون المطابقة بالاسم والحجم. ويمكن اختيار منتج بعلامة معينة لإجراء مقارنة مطابقة تمامًا.</p>');
 }
 return title('المقارنات','أقل سعر أولًا، مع إظهار كل المتاجر المتساوية — جميع الأشهر دون فلتر')+
 box('<h3>الأشهر والمتاجر المسجلة</h3><div class="badge-row">'+months.map(function(m){return '<span class="tag">'+h(mtitle(m))+'</span>'}).join('')+'<span class="tag">'+shops().length+' متجر</span></div>')+
 '<div class="space"></div>'+box('<div class="grid cols2">'+field('ابحث عن منتج','searchProducts',prodSearch,'search','id="searchProducts"')+
 options('productSelect','الصنف أو مجموعة المقارنة',selectedProduct,matches.map(function(x){return [x.key,x.name+' • '+x.shops.size+' متجر']}))+'</div>')+
 '<div class="space"></div>'+panel+'<div class="space"></div>'+box('<h3>صرف المتاجر الإجمالي</h3>'+bars(storeTotals())+
 '<p class="hint">ارتفاع إجمالي المشتريات من متجر لا يعني أنه الأغلى؛ يعتمد ترتيب الأسعار أعلاه على المنتج المحدد وحجم عبوتـه.</p>');
}
var catalogSearch='';
function drawCatalog(){var list=canonicalList().filter(function(p){return norm(p.name).includes(norm(catalogSearch))});return title('دليل الأصناف','تستخدم الأسماء التي تعتمدها أنت في جميع المتاجر والمشتريات',btn('＋ صنف جديد','catalogAdd','primary'))+
 box('<div class="field"><label>ابحث في مسمياتك المعتمدة</label><input id="catalogSearch" placeholder="تونة، أرز، حليب..." value="'+h(catalogSearch)+'"></div><p class="hint">عدد الأصناف المحفوظة: '+(db.catalog||[]).length+'. يمكنك إعادة تسمية الصنف أو دمج اسمين في هوية واحدة، دون حذف فواتيرهما.</p>')+
 '<div class="space"></div><div id="catalogResults">'+catalogRows(list)+'</div>'}
function catalogRows(list){return list.length?list.map(function(p){var count=receipts().reduce(function(n,r){return n+(r.items||[]).filter(function(i){return i.productId===p.id}).length},0);return box('<div class="between"><div><strong>'+h(p.name)+'</strong><div class="hint">'+h(p.unit||'حبة')+' • '+h(p.category||'أخرى')+' • '+count+' عملية شراء</div></div><div class="mini-toolbar">'+btn('تعديل الاسم','catalogRename','secondary small','data-id="'+h(p.id)+'"')+btn('دمج مع صنف','catalogMerge','secondary small','data-id="'+h(p.id)+'"')+'</div></div>','receipt')}).join('<div class="space"></div>'):'<div class="empty">لا توجد أصناف مطابقة</div>'}
function drawSettings(){return title('الإعدادات والنسخ','التخزين محلي في المتصفح ولا ينتقل تلقائيًا بين الأجهزة')+
 box('<h3>الميزانية الشهرية الأساسية</h3><p class="hint">المبلغ نفسه يتكرر كل شهر، ويضاف إليه رصيد الشهر الماضي، ويُخصم إنفاق الشهر. العجز السالب يُرحّل كذلك.</p><div class="controls">'+field('الميزانية الشهرية (ريال)','monthlyBudget',db.monthlyBudget||'','number','id="monthlyBudget" min="0" step="0.01"')+btn('حفظ','saveBudget','primary')+'</div>')+'<div class="space"></div>'+
 box('<h3>نسخ احتياطي كامل</h3><p>نزّل ملفًا يحوي كل الفواتير، المتاجر، الأصناف والميزانية. استيراد نسخة احتياطية يدمج فقط الفواتير غير الموجودة ولا يمسح السجل الحالي.</p><div class="mini-toolbar">'+btn('⬇ نسخة JSON','backup','primary')+btn('تصدير CSV','csv','secondary')+'</div><div class="space"></div><div class="field"><label>استعادة نسخة من راصد القديم أو الجديد</label><input id="restoreFile" type="file" accept=".json,application/json"></div><div class="alert info">مهم: النسخ محفوظة على جهازك، ولا تُرفع إلى GitHub. احتفظ بها في ملفات الجوال أو Google Drive.</div>')+
 '<div class="space"></div>'+box('<h3>حالة البيانات</h3><div class="badge-row"><span class="tag">'+receipts().length+' فاتورة</span><span class="tag">'+shops().length+' متجر</span><span class="tag">'+products().length+' منتج</span></div><div class="space"></div>'+btn('استرجاع الحالة المحلية السابقة','undo','secondary')+'<p class="hint">تُحفظ نسخة محلية واحدة من السجل قبل أي تعديل. لا تغني عن النسخة الخارجية.</p>')+
 '<div class="space"></div>'+box('<h3>إدخال المشتريات</h3><p>لا حاجة لتصوير الفواتير أو تحويلها إلى ملفات. أدخل المتجر والتاريخ والوقت ثم أضف الأصناف واحدًا واحدًا.</p>'+btn('＋ شراء جديد','manualNew','primary'))}
function draw(){var view={home:drawHome,receipts:drawReceipts,compare:drawCompare,catalog:drawCatalog,months:drawMonths,settings:drawSettings};document.getElementById('nav').innerHTML=TABS.map(function(t){return '<button type="button" data-tab="'+t[0]+'" class="'+(page===t[0]?'active':'')+'">'+t[1]+'</button>'}).join('');root.innerHTML=view[page]();if(page==='receipts')receiptResults()}
document.getElementById('nav').addEventListener('click',function(e){var b=e.target.closest('[data-tab]');if(b){page=b.dataset.tab;draw();window.scrollTo(0,0)}});
document.getElementById('addNow').onclick=function(){openManualNew()};
document.getElementById('backupNow').onclick=function(){downloadBackup()};
draw();
