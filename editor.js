/* راصد المشتريات — الإدخال اليدوي ودليل الأصناف. لا يحتاج تصوير الفاتورة. */
'use strict';
var MANUAL_DRAFT_KEY='rasid-manual-inprogress-v1',entry=null,activeLine=null,editLine=-1,entryPinned=false;
var UNITS=['حبة','عبوة','كجم','جرام','لتر','مل','متر','دزينة'];
function downloadFile(filename,content,type){
 var blob=new Blob([content],{type:type||'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url)},1200)
}
function downloadBackup(){downloadFile('rasid-full-backup-'+today()+'.json',JSON.stringify(db,null,2));notify('تم طلب تنزيل النسخة الاحتياطية بكل الفواتير والمسميات')}
function csvExport(){
 var rows=[['التاريخ','الوقت','المتجر','رقم الفاتورة','الصنف المعتمد','اسم السطر الأصلي','الكمية','الوحدة','سعر الوحدة','الإجمالي شامل الضريبة','ضريبة الفاتورة','إجمالي الفاتورة']];
 receipts().forEach(function(r){(r.items||[]).forEach(function(i){rows.push([r.date,r.time||'',r.store,r.invoiceNo,itemName(i),i.name,i.quantity,i.unit||'',i.unitPrice,i.total,r.vat,r.total])})});
 downloadFile('rasid-purchases-'+today()+'.csv','\ufeff'+rows.map(function(row){return row.map(function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'}).join(',')}).join('\r\n'),'text/csv;charset=utf-8')
}
function distinctInvoice(r){return r.invoiceNo?norm(r.store)+'|'+r.date+'|'+String(r.invoiceNo):'id:'+r.id}
function mergeBackup(raw){
 var data=JSON.parse(raw);if(!data||!Array.isArray(data.receipts))throw Error('ملف النسخة الاحتياطية غير صالح');
 var before=copy(db),added=0,known=new Set(receipts().map(distinctInvoice)),remap={};
 if(Array.isArray(data.catalog))data.catalog.forEach(function(p){
  var current=(db.catalog||[]).find(function(x){return norm(x.name)===norm(p.name)});
  if(current)remap[p.id]=current.id;
  else if(p.name&&!(db.catalog||[]).some(function(x){return x.id===p.id})){var cp=copy(p);cp.id='p-'+rid();db.catalog.push(cp);remap[p.id]=cp.id}
 });
 data.receipts.forEach(function(r){
  if(!r||!Array.isArray(r.items)||!/^\d{4}-\d{2}-\d{2}$/.test(r.date||''))return;
  if(known.has(distinctInvoice(r)))return;
  var cp=copy(r);cp.id=rid();cp.items.forEach(function(i){i.id=i.id||rid();if(i.productId&&remap[i.productId])i.productId=remap[i.productId]});
  db.receipts.push(cp);known.add(distinctInvoice(r));added++;
 });
 if(!added){db=before;notify('جميع الفواتير الموجودة في الملف مسجلة بالفعل');return}
 if(!confirm('سيُضاف '+added+' فاتورة دون حذف الموجود، هل توافق؟')){db=before;return}
 ensureCatalog();if(!persist()){db=before;return}page='receipts';draw();notify('أضيفت '+added+' فاتورة دون فقد الفواتير السابقة')
}
function exportOne(id){var r=receipts().find(function(x){return x.id===id});if(r)downloadFile('receipt-'+(r.invoiceNo||r.date)+'.json',JSON.stringify(r,null,2))}
function undoLast(){var old=localStorage.getItem(SNAP_KEY);if(!old)return alert('لا تتوفر نسخة محلية سابقة');if(!confirm('استعادة الحالة السابقة؟ يُفضّل تنزيل نسخة احتياطية أولًا.'))return;try{var previous=JSON.parse(old);if(!Array.isArray(previous.receipts))throw Error('صيغة النسخة غير صحيحة');var current=copy(db);db=previous;ensureCatalog();if(!persist()){db=current;return}draw();notify('استعيدت الحالة السابقة')}catch(e){alert(e.message)}}
function emptyLine(){return {id:rid(),productId:'',name:'',category:'أخرى',barcode:'',quantity:1,unit:'حبة',unitPrice:0,total:0}}
function nowTime(){return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date())}
function emptyPurchase(){return {id:rid(),store:'',branch:'',date:today(),time:nowTime(),invoiceNo:'',subtotal:0,vat:0,total:0,notes:'',source:'إدخال يدوي',review:false,items:[]}}
function persistManualDraft(){if(!entry)return;try{localStorage.setItem(MANUAL_DRAFT_KEY,JSON.stringify({entry:entry,activeLine:activeLine,editLine:editLine,pinned:entryPinned}))}catch(e){}}
function restoreManualDraft(){
 try{var data=JSON.parse(localStorage.getItem(MANUAL_DRAFT_KEY)||'null');return data&&data.entry&&Array.isArray(data.entry.items)?data:null}catch(e){return null}
}
function openManualNew(){
 var saved=restoreManualDraft();
 if(saved&&confirm('وجدت عملية شراء غير مكتملة. هل تريد مواصلة إدخالها؟')){entry=saved.entry;activeLine=saved.activeLine||emptyLine();editLine=Number.isInteger(saved.editLine)?saved.editLine:-1;entryPinned=!!saved.pinned}
 else {entry=emptyPurchase();activeLine=emptyLine();editLine=-1;entryPinned=false;persistManualDraft()}
 openManualDrawer()
}
function openManualEdit(r){
 if(!r)return;entry=copy(r);entry.time=entry.time||'';activeLine=emptyLine();editLine=-1;entryPinned=true;persistManualDraft();openManualDrawer()
}
function openEditor(r){openManualEdit(r)}
function openImport(){openManualNew()}
function closeManual(){drawer.hidden=true;drawer.innerHTML='';document.body.style.overflow='';entry=null;activeLine=null;editLine=-1}
function openManualDrawer(){drawer.hidden=false;document.body.style.overflow='hidden';renderManual();drawer.scrollTop=0}
function manualHead(){var knownStores=shops();return '<div class="twocol">'+
 field('اسم المتجر','store',entry.store,'text','data-purchase="store" list="knownStores" placeholder="اختر متجرًا سابقًا أو اكتب متجرًا جديدًا"')+
 '<datalist id="knownStores">'+knownStores.map(function(s){return '<option value="'+h(s)+'"></option>'}).join('')+'</datalist>'+
 field('الفرع (اختياري)','branch',entry.branch,'text','data-purchase="branch"')+
 field('التاريخ','date',entry.date,'date','data-purchase="date"')+
 field('الوقت','time',entry.time||'','time','data-purchase="time"')+
 field('رقم الفاتورة (اختياري)','invoiceNo',entry.invoiceNo,'text','data-purchase="invoiceNo"')+'</div>'}
function suggestions(text){
 var q=norm(text),p=canonicalList();
 if(q)p=p.filter(function(x){return norm(x.name).includes(q)});
 return p.slice(0,9).map(function(x){return '<button type="button" class="manual-option" data-pickproduct="'+h(x.id)+'"><strong>'+h(x.name)+'</strong><small>'+h(x.unit||'حبة')+' • '+h(x.category||'أخرى')+'</small></button>'}).join('')||(q?'<p class="hint">اسم جديد؛ سيُحفظ في دليل الأصناف عند اعتماد الشراء.</p>':'<p class="hint">اكتب جزءًا من الاسم أو اختر من مسمياتك المحفوظة.</p>')
}
function itemInput(){return '<div class="manual-item-form">'+
 '<div class="field"><label>اسم الصنف — اكتب أو اختر اسمًا محفوظًا</label><input id="activeProductName" autocomplete="off" value="'+h(activeLine.name)+'" placeholder="مثال: تونة 80 جرام" data-line="name"></div>'+
 '<div id="manualSuggestions" class="manual-suggestions">'+suggestions(activeLine.name)+'</div>'+
 '<div class="grid cols2">'+
 options('unit','نوع الكمية أو الوزن',activeLine.unit,UNITS.map(function(x){return [x,x]})).replace('name="unit"','name="unit" data-line="unit"')+
 field('عدد الحبات أو الوزن','quantity',activeLine.quantity,'number','data-line="quantity" min="0.001" step="any"')+
 field('سعر الوحدة / الكيلو','unitPrice',activeLine.unitPrice,'number','data-line="unitPrice" min="0" step="any"')+
 field('الإجمالي لهذا الصنف','total',activeLine.total,'number','data-line="total" min="0" step="any"')+
 '</div><p class="hint">إذا غيّرت الكمية أو السعر يُحسب الإجمالي تلقائيًا، ويمكنك تعديل الإجمالي كما هو مطبوع.</p>'+
 '<div class="between">'+(editLine>=0?btn('إلغاء تعديل الصنف','cancelLine','secondary'):'<span></span>')+
 btn(editLine>=0?'تحديث الصنف':'إضافة الصنف ثم التالي ＋','commitLine','primary')+'</div></div>'}
function manualRows(){return entry.items.length?entry.items.map(function(i,n){return '<div class="manual-line"><div class="between"><div><strong>'+(n+1)+'. '+h(i.productId&&catalogById(i.productId)?catalogById(i.productId).name:i.name)+'</strong><div class="hint">'+fmt(i.quantity,3)+' '+h(i.unit||'حبة')+' × '+fmt(i.unitPrice,3)+' ر.س</div></div><strong class="money">'+fmt(i.total,3)+' ر.س</strong></div><div class="mini-toolbar">'+btn('تعديل','editLine','secondary small','data-index="'+n+'"')+btn('إزالة','removeLine','danger small','data-index="'+n+'"')+'</div></div>'}).join(''):'<div class="empty">لم تضف أصنافًا بعد. ابدأ بالصنف الأول أعلاه.</div>'}
function totalsPanel(){var lines=add(entry.items,function(i){return i.total});return '<div class="manual-totalbar"><div class="between"><span>مجموع الأصناف</span><strong id="sumOfLines">'+fmt(lines,3)+' ر.س</strong></div>'+
 '<div class="grid cols2">'+field('إجمالي الفاتورة شامل الضريبة','total',entry.total,'number','data-purchase="total" step="any" min="0"')+
 field('ضريبة الفاتورة (من الإيصال)','vat',entry.vat,'number','data-purchase="vat" step="any" min="0"')+'</div>'+
 '<div class="between"><span>قبل الضريبة (محسوب من الإجمالي والضريبة)</span><strong id="withoutVat">'+fmt(Math.max(0,val(entry.total)-val(entry.vat)),3)+' ر.س</strong></div>'+
 '<p id="totalDifference" class="hint">فرق مجموع الأصناف والإجمالي: '+fmt(round3(lines-val(entry.total)),3)+' ر.س</p></div>'+
 '<div class="field pull"><label>ملاحظات (اختياري)</label><textarea data-purchase="notes">'+h(entry.notes||'')+'</textarea></div>'}
function renderManual(){
 if(!entry)return;
 drawer.innerHTML='<div class="sheet manual-sheet"><div class="sheet-head"><div class="between"><div><h2>شراء جديد — إدخال يدوي</h2><p>الأصناف تُضاف واحدة بعد الأخرى، وتُحفظ مسمياتها للاستخدام القادم.</p></div>'+btn('إغلاق','manualClose','secondary small')+'</div></div>'+
 '<div class="sheet-body">'+
 box('<h3>1. معلومات الشراء</h3>'+manualHead())+
 '<div class="space"></div>'+box('<h3>2. '+(editLine>=0?'تعديل صنف':'إضافة صنف')+'</h3>'+itemInput())+
 '<div class="space"></div>'+box('<h3>3. الأصناف المسجلة ('+entry.items.length+')</h3><div id="manualLines">'+manualRows()+'</div>')+
 '<div class="space"></div>'+box('<h3>4. إجمالي الفاتورة وضريبتها</h3>'+totalsPanel())+
 '<div class="alert info">لا نضيف الضريبة على الأسعار مرة ثانية؛ أسعار الأصناف تُسجل شاملة للضريبة كما في الفاتورة.</div></div>'+
 '<div class="sheet-foot">'+btn('حفظ الشراء كاملًا','manualSave','primary')+btn('إغلاق مع حفظ المسودة','manualClose','secondary')+'</div></div>'
}
function renderSuggestionList(){var node=document.getElementById('manualSuggestions');if(node)node.innerHTML=suggestions(activeLine.name)}
function updateTotalPreview(){if(!entry)return;var v=document.getElementById('withoutVat'),d=document.getElementById('totalDifference'),lines=add(entry.items,function(i){return i.total});if(v)v.textContent=fmt(Math.max(0,val(entry.total)-val(entry.vat)),3)+' ر.س';if(d)d.textContent='فرق مجموع الأصناف والإجمالي: '+fmt(round3(lines-val(entry.total)),3)+' ر.س'}
function manualChangeField(node){
 var k=node.dataset.purchase,l=node.dataset.line;
 if(k){entry[k]=['total','vat'].includes(k)?round3(val(node.value)):node.value;if(k==='total')entryPinned=true;updateTotalPreview()}
 if(l){activeLine[l]=['total','quantity','unitPrice'].includes(l)?round3(val(node.value)):node.value;
  if(l==='name'){var old=activeLine.productId&&catalogById(activeLine.productId);if(old&&norm(old.name)!==norm(activeLine.name))activeLine.productId='';renderSuggestionList()}
  if(l==='quantity'||l==='unitPrice'){activeLine.total=round3(val(activeLine.quantity)*val(activeLine.unitPrice));var totalInput=drawer.querySelector('input[data-line="total"]');if(totalInput)totalInput.value=activeLine.total}
 }
 persistManualDraft()
}
function productMatch(item){if(item.productId&&catalogById(item.productId))return catalogById(item.productId);return (db.catalog||[]).find(function(x){return norm(x.name)===norm(item.name)})}
function commitLine(){
 var name=String(activeLine.name||'').trim();if(!name){alert('اكتب اسم الصنف أو اختره من القائمة');return false;}
 if(!Number.isFinite(val(activeLine.quantity))||val(activeLine.quantity)<=0){alert('الكمية أو الوزن يجب أن يكون أكبر من صفر');return false;}
 if(val(activeLine.unitPrice)<0||val(activeLine.total)<0){alert('أدخل سعرًا صالحًا');return false;}if(!val(activeLine.unitPrice)&&val(activeLine.total)>0){activeLine.unitPrice=round3(val(activeLine.total)/val(activeLine.quantity))}
 var match=productMatch(activeLine);if(match){activeLine.productId=match.id;activeLine.name=match.name;activeLine.category=match.category||'أخرى'}
 var line=copy(activeLine);
 if(editLine>=0)entry.items[editLine]=line;else entry.items.push(line);
 if(!entryPinned)entry.total=add(entry.items,function(i){return i.total});
 entry.subtotal=round3(val(entry.total)-val(entry.vat));
 activeLine=emptyLine();editLine=-1;persistManualDraft();renderManual();
 var node=drawer.querySelector('#activeProductName');if(node){node.focus();node.scrollIntoView({block:'center'})}
 notify('أضيف الصنف؛ يمكنك إدخال الصنف التالي');return true
}
function doSave(){
 if(activeLine&&activeLine.name&&activeLine.name.trim()){if(commitLine()===false)return}
 if(!entry.store.trim())return alert('أدخل اسم المتجر أولًا');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(entry.date))return alert('التاريخ غير صالح');
 if(entry.time&&!/^\d{2}:\d{2}$/.test(entry.time))return alert('وقت الشراء غير صالح');
 if(!entry.items.length)return alert('أضف صنفًا واحدًا على الأقل');
 if(!entry.items.every(function(i){return i.name.trim()&&val(i.quantity)>0&&val(i.total)>=0}))return alert('أكمل أسماء الأصناف والكميات');
 if(entry.total<=0)return alert('إجمالي الفاتورة يجب أن يكون أكبر من صفر');
 if(entry.vat<0||entry.vat>entry.total)return alert('الضريبة أكبر من الإجمالي أو غير صالحة');
 var gap=round3(add(entry.items,function(i){return i.total})-val(entry.total));
 if(Math.abs(gap)>=.01&&!confirm('مجموع الأصناف يختلف عن إجمالي الفاتورة بـ '+fmt(gap,3)+' ريال. هل تريد الحفظ مع إبقاء الفرق للمراجعة؟'))return;
 var old=copy(db),out=copy(entry),idx=receipts().findIndex(function(r){return r.id===entry.id});
 var duplicate=receipts().some(function(r){return r.id!==out.id&&out.invoiceNo&&r.invoiceNo&&norm(r.store)===norm(out.store)&&r.date===out.date&&String(r.invoiceNo)===String(out.invoiceNo)});
 if(duplicate)return alert('هذه الفاتورة مسجلة بالفعل برقمها وتاريخها ومتجرها');
 out.items.forEach(function(i){
  var p=productMatch(i);
  if(!p){p={id:'p-'+rid(),name:i.name.trim(),unit:i.unit||'حبة',category:i.category||'أخرى'};db.catalog.push(p)}
  i.productId=p.id;i.name=p.name;i.category=p.category||'أخرى';i.manualCanonical=true;
 });
 out.subtotal=round3(val(out.total)-val(out.vat));out.source=out.source||'إدخال يدوي';out.review=Math.abs(gap)>=.01;
 if(idx<0)db.receipts.push(out);else db.receipts[idx]=out;
 if(!persist()){db=old;return}
 try{localStorage.removeItem(MANUAL_DRAFT_KEY)}catch(e){}
 closeManual();page='receipts';draw();notify('تم حفظ '+out.items.length+' صنفًا مع الفاتورة وإضافتها للمقارنات')
}
function renameCatalog(id){
 var p=catalogById(id);if(!p)return;var name=prompt('الاسم الموحد لهذا الصنف:',p.name);if(name==null)return;name=name.trim();if(!name)return alert('الاسم لا يمكن أن يكون فارغًا');
 if((db.catalog||[]).some(function(x){return x.id!==id&&norm(x.name)===norm(name)}))return alert('الاسم موجود بالفعل؛ استخدم دمج مع صنف');
 var before=copy(db);p.name=name;receipts().forEach(function(r){(r.items||[]).forEach(function(i){if(i.productId===id)i.manualCanonical=true})});if(!persist()){db=before;return}draw();notify('تم تعديل الاسم، والربط بالفواتير بقي محفوظًا')
}
function mergeCatalog(sourceId){
 var src=catalogById(sourceId);if(!src)return;var targetName=prompt('اكتب اسم الصنف الآخر الذي تريد الدمج معه. سيبقى الاسم الآخر معتمدًا:',src.name);if(targetName===null)return;
 var target=db.catalog.find(function(p){return p.id!==src.id&&norm(p.name)===norm(targetName)});
 if(!target)return alert('الصنف الهدف غير موجود. اختر اسمًا مسجلًا في دليل الأصناف');
 if(!confirm('دمج «'+src.name+'» في «'+target.name+'»؟ سيُحافظ على الفواتير وأسعارها وتُجمع سجلات المقارنة تحت الاسم المعتمد.'))return;
 var before=copy(db);receipts().forEach(function(r){(r.items||[]).forEach(function(i){if(i.productId===src.id||i.productId===target.id){i.productId=target.id;i.manualCanonical=true}})});db.catalog=db.catalog.filter(function(p){return p.id!==src.id});
 if(!persist()){db=before;return}draw();notify('تم دمج المسميات دون حذف أي فاتورة')
}
root.addEventListener('input',function(e){
 if(e.target.id==='invoiceSearch'){searchText=e.target.value;receiptResults()}
 if(e.target.id==='catalogSearch'){catalogSearch=e.target.value;var node=document.getElementById('catalogResults');if(node)node.innerHTML=catalogRows(canonicalList().filter(function(p){return norm(p.name).includes(norm(catalogSearch))}))}
});
root.addEventListener('change',function(e){
 if(e.target.name==='monthFilter'){monthFilter=e.target.value;draw()}
 if(e.target.name==='productSelect'){selectedProduct=e.target.value;draw()}
 if(e.target.id==='searchProducts'){prodSearch=e.target.value;selectedProduct='';draw()}
 if(e.target.id==='restoreFile'&&e.target.files&&e.target.files[0]){e.target.files[0].text().then(mergeBackup).catch(function(err){alert('تعذر الاستعادة: '+err.message)})}
});
root.addEventListener('click',function(e){
 var b=e.target.closest('[data-action]');if(!b)return;var act=b.dataset.action,id=b.dataset.id;
 if(act==='manualNew'||act==='import')openManualNew();
 else if(act==='edit'){var r=receipts().find(function(x){return x.id===id});if(r)openManualEdit(r)}
 else if(act==='oneExport')exportOne(id);
 else if(act==='backup')downloadBackup();
 else if(act==='csv')csvExport();
 else if(act==='saveBudget'){var old=db.monthlyBudget;db.monthlyBudget=round3(val(document.getElementById('monthlyBudget').value));if(!persist()){db.monthlyBudget=old;return}draw();notify('تم حفظ الميزانية المرحّلة')}
 else if(act==='undo')undoLast();
 else if(act==='catalogAdd'){var name=prompt('اسم الصنف المعتمد الجديد:');if(!name||!name.trim())return;name=name.trim();if((db.catalog||[]).some(function(x){return norm(x.name)===norm(name)}))return alert('هذا الصنف مسجل بالفعل');var before=copy(db);db.catalog.push({id:'p-'+rid(),name:name,unit:'حبة',category:'أخرى'});if(!persist()){db=before;return}draw();notify('أُضيف الصنف إلى القائمة')}
 else if(act==='catalogRename')renameCatalog(id);
 else if(act==='catalogMerge')mergeCatalog(id);
});
drawer.addEventListener('input',function(e){if(!entry)return;var n=e.target;if(n.dataset.purchase||n.dataset.line)manualChangeField(n)});
drawer.addEventListener('change',function(e){if(!entry)return;var n=e.target;if(n.dataset.purchase||n.dataset.line)manualChangeField(n)});
drawer.addEventListener('click',function(e){
 if(e.target===drawer){closeManual();return}
 var b=e.target.closest('[data-action],[data-pickproduct]');if(!b||!entry)return;
 if(b.hasAttribute('data-pickproduct')){
  var p=catalogById(b.dataset.pickproduct);if(!p)return;activeLine.productId=p.id;activeLine.name=p.name;activeLine.unit=p.unit||'حبة';activeLine.category=p.category||'أخرى';
  var n=drawer.querySelector('#activeProductName');if(n)n.value=p.name;
  var u=drawer.querySelector('select[data-line="unit"]');if(u)u.value=activeLine.unit;
  renderSuggestionList();persistManualDraft();return
 }
 var act=b.dataset.action;
 if(act==='manualClose'){persistManualDraft();closeManual();notify('المسودة محفوظة ويمكن إكمالها من شراء جديد')}
 else if(act==='commitLine')commitLine();
 else if(act==='cancelLine'){editLine=-1;activeLine=emptyLine();persistManualDraft();renderManual()}
 else if(act==='editLine'){editLine=Number(b.dataset.index);activeLine=copy(entry.items[editLine]);persistManualDraft();renderManual();var n=drawer.querySelector('#activeProductName');if(n)n.scrollIntoView({block:'center'})}
 else if(act==='removeLine'){var index=Number(b.dataset.index);if(confirm('حذف هذا الصنف من المسودة؟')){entry.items.splice(index,1);if(!entryPinned)entry.total=add(entry.items,function(i){return i.total});persistManualDraft();renderManual()}}
 else if(act==='manualSave')doSave();
});
