'use strict';

// Milafat Web — all selected file contents are processed client-side.
(() => {
  const $ = (id) => document.getElementById(id);
  const els = {
    picker: $('file-picker'), drop: $('dropzone'), hint: $('file-hint'),
    list: $('files-list'), count: $('file-count'), area: $('files-area'),
    options: $('options'), title: $('current-tool-title'), description: $('current-tool-description'),
    run: $('run-btn'), status: $('status'), progressWrap: $('progress-wrap'),
    progress: $('progress'), progressLabel: $('progress-label'), percent: $('progress-percent'),
    result: $('result'), resultInfo: $('result-info'), resultBtns: $('result-buttons'),
    preview: $('preview')
  };
  const tools = {
    merge: {title:'دمج PDF',desc:'ارفع ملفين PDF أو أكثر ورتّبهم مثل ما تبي، وخلّهم ملف واحد.',accept:'.pdf,application/pdf',multiple:true,button:'يلا ندمج',hint:'ملفات PDF • تقدر تغيّر ترتيبها'},
    split: {title:'فصل PDF',desc:'طلّع كل صفحة لحالها أو اختر مجموعات صفحات، وحمّلها كلها مرة وحدة.',accept:'.pdf,application/pdf',multiple:false,button:'يلا نفصل',hint:'ملف PDF واحد'},
    pages: {title:'تنظيم الصفحات',desc:'تبي تستخرج صفحات أو تحذفها أو تدوّرها؟ حدّد اللي تبيه.',accept:'.pdf,application/pdf',multiple:false,button:'يلا نرتّب',hint:'ملف PDF واحد'},
    compress: {title:'ضغط PDF',desc:'خفّف حجم ملفك واختر مستوى الضغط اللي يناسبك.',accept:'.pdf,application/pdf',multiple:false,button:'يلا نضغط',hint:'ملف PDF واحد'},
    images2pdf: {title:'صور إلى PDF',desc:'اجمع صورك بملف PDF واحد، ورتّبها قبل تبدأ.',accept:'image/jpeg,image/png,image/webp,image/bmp,image/gif,.heic,.heif',multiple:true,button:'سوّ PDF',hint:'صور من الصيغ اللي يدعمها متصفحك'},
    imagecompress: {title:'ضغط الصور',desc:'صغّر الصور وتحكّم في جودتها وحمّلها مرة وحدة.',accept:'image/*',multiple:true,button:'يلا نضغط',hint:'صورة أو أكثر'},
    pdftext: {title:'PDF إلى نص',desc:'طلّع النص من ملف PDF وانسخه أو حمّله TXT أو Word.',accept:'.pdf,application/pdf',multiple:false,button:'طلّع النص',hint:'ملف PDF فيه نص قابل للتحديد'}
  };
  let active = 'merge';
  let files = [];
  let working = false;
  let resultUrls = [];
  let currentResult = null;
  const scriptLoads = new Map();

  const formatSize = n => n < 1024 ? `${n} بايت` : n < 1048576 ? `${(n / 1024).toFixed(1)} ك.ب` : `${(n / 1048576).toFixed(2)} م.ب`;
  function clearResult() {
    for (const url of resultUrls) URL.revokeObjectURL(url);
    resultUrls = []; currentResult = null;
    els.result.classList.add('hidden'); els.resultBtns.replaceChildren();
    els.preview.replaceChildren(); els.preview.classList.add('hidden');
  }
  function setStatus(msg, type='') { els.status.textContent=msg; els.status.className=`status ${type}`; }
  function setProgress(value, label='ثواني ونخلص...') {
    els.progressWrap.classList.remove('hidden');
    els.progress.value=Math.max(0,Math.min(100,value));
    els.progressLabel.textContent=label; els.percent.textContent=`${Math.round(value)}%`;
  }
  function stopProgress() {els.progressWrap.classList.add('hidden');}
  function el(tag,cls,text) {const x=document.createElement(tag); if(cls)x.className=cls; if(text!==undefined)x.textContent=text; return x;}
  function optionLabel(text,element) {const c=el('div','field'); c.append(el('label','',text),element); return c;}
  function input(type,id,placeholder,value) { const e=document.createElement('input'); e.type=type; e.id=id; if(placeholder)e.placeholder=placeholder; if(value!==undefined)e.value=value; return e; }
  function select(id,choices) {const s=document.createElement('select');s.id=id;for(const [value,title] of choices){const o=document.createElement('option');o.value=value;o.textContent=title;s.append(o);}return s;}
  function paragraph(txt,cls='help') {return el('p',cls,txt);}
  function setActive(key) {
    if (working) return;
    active=key; files=[]; els.picker.value=''; clearResult();stopProgress();setStatus('');
    const cfg=tools[key];els.title.textContent=cfg.title;els.description.textContent=cfg.desc;
    els.hint.textContent=cfg.hint;els.picker.accept=cfg.accept;els.picker.multiple=cfg.multiple;
    els.run.firstChild.textContent=cfg.button+' '; document.querySelectorAll('.tool-card').forEach(b=>b.classList.toggle('active',b.dataset.tool===key));
    renderOptions(); renderFiles();
  }
  function renderOptions() {
    els.options.replaceChildren(); const grid=el('div','option-grid');
    if(active==='split'){
      grid.append(optionLabel('كيف تبي تفصل؟',select('split-mode',[['each','كل صفحة بملف'],['groups','كل مجموعة صفحات بملف']])));
      grid.append(optionLabel('نطاقات الصفحات (إذا اخترت مجموعات)',input('text','split-ranges','مثال: 1-3, 4-6','1-3,4-6')));
      els.options.append(grid,paragraph('افصل بين المجموعات بفاصلة، وكل مجموعة بتطلع في ملف لحالها.'));
    }
    if(active==='pages'){
      grid.append(optionLabel('وش تبي تسوي؟',select('pages-mode',[['extract','أطلع الصفحات المختارة'],['delete','أحذف الصفحات المختارة'],['rotate','أدوّر الصفحات المختارة']])));
      grid.append(optionLabel('أرقام الصفحات اللي تبيها',input('text','pages-range','مثال: 1,3,5-8','1-3')));
      grid.append(optionLabel('كم تبي تدوّر؟',select('rotate-angle',[['90','90 درجة'],['180','180 درجة'],['270','270 درجة']])));
      els.options.append(grid,paragraph('مثال: 1,3,5-8 — تقدر تكرّر الصفحات وترتّبها إذا اخترت الاستخراج.'));
    }
    if(active==='compress'){
      grid.append(optionLabel('قوة الضغط',select('compress-level',[['lossless','بدون تغيير جودة الصفحات'],['medium','متوسط'],['strong','قوي']])));
      els.options.append(grid,paragraph('إذا صار الناتج أكبر من ملفك، بنقول لك وما نحفظه كأنه مضغوط.'),paragraph('⚠️ الضغط المتوسط والقوي يحوّل الصفحات لصور؛ ممكن تفقد البحث في النص والروابط.','warning'));
    }
    if(active==='images2pdf'){
      grid.append(optionLabel('مقاس صفحات الملف',select('image-page-size',[['a4','A4 — احتواء الصورة'],['fit','على مقاس الصورة تقريبًا']])));
      grid.append(optionLabel('جودة الصور',select('image-page-quality',[['0.9','عالية'],['0.7','متوسطة'],['0.5','حجم أصغر']])));
      els.options.append(grid,paragraph('لو الصورة ضخمة بنصغّرها شوي عشان ما يعلق المتصفح.'));
    }
    if(active==='imagecompress'){
      grid.append(optionLabel('أقصى عرض للصورة (بكسل)',input('number','img-max-width','مثال: 1600',1600)));
      grid.append(optionLabel('جودة الصورة',select('img-quality',[['0.85','عالية'],['0.65','متوسطة'],['0.4','قوية']])));
      els.options.append(grid,paragraph('الصور الشفافة راح تكون بخلفية بيضاء. بنجمّع النتائج في ZIP.'));
    }
  }
  function isValidFile(file) {
    const n=file.name.toLowerCase();
    if (['merge','split','pages','compress','pdftext'].includes(active))return n.endsWith('.pdf');
    if(['imagecompress','images2pdf'].includes(active))return /^image\//.test(file.type)||/\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(n);
    return false;
  }
  function addFiles(incoming) {
    if(working)return;
    const arr=Array.from(incoming||[]); const allowed=arr.filter(isValidFile);
    if(!allowed.length){setStatus('هذا النوع ما يشتغل مع الأداة اللي اخترتها.','error');return;}
    if(allowed.length<arr.length)setStatus('فيه ملفات ما تنفع مع هالأداة، وتجاهلناها.','error');else setStatus('');
    if(!tools[active].multiple)files=[allowed[0]];else files.push(...allowed);
    clearResult();renderFiles();
  }
  function renderFiles(){
    els.area.classList.toggle('hidden',!files.length);els.count.textContent=String(files.length);els.list.replaceChildren();
    files.forEach((f,i)=>{
      const li=el('li','file-row'), badge=el('span','file-badge',f.name.split('.').pop().toUpperCase().slice(0,6));
      const info=el('span','file-info');info.append(el('span','file-name',f.name),el('span','file-size',formatSize(f.size)));li.append(badge,info);
      const shift=(symbol,dir,title)=>{const b=el('button','icon-btn',symbol);b.type='button';b.title=title;b.disabled=(dir<0&&i===0)||(dir>0&&i===files.length-1);b.onclick=()=>{const [f]=files.splice(i,1);files.splice(i+dir,0,f);clearResult();renderFiles();};li.append(b);};
      if(tools[active].multiple){shift('↑',-1,'طلّعه فوق');shift('↓',1,'نزّله تحت');}
      const remove=el('button','icon-btn','×');remove.type='button';remove.title='شِل الملف';remove.onclick=()=>{files.splice(i,1);clearResult();renderFiles();};li.append(remove);els.list.append(li);
    });
  }
  function safeFilename(name){return name.replace(/[/\\:*?"<>|\x00-\x1f]/g,'_').slice(0,120);}
  function basename(name){return safeFilename(name.replace(/\.[^.]+$/,''));}
  function readBinary(file){return file.arrayBuffer().then(b=>new Uint8Array(b));}
  function loadScript(key,urls,check){
    if(check())return Promise.resolve();
    if(scriptLoads.has(key))return scriptLoads.get(key);
    const attempt=(i)=>new Promise((resolve,reject)=>{
      if(i===urls.length){reject(new Error(`تعذّر تحميل مكتبة ${key}. تحقق من اتصالك بالإنترنت، ثم أعد المحاولة.`));return;}
      const s=document.createElement('script');s.src=urls[i];s.async=true;s.crossOrigin='anonymous';
      s.onload=()=>check()?resolve():attempt(i+1).then(resolve,reject);
      s.onerror=()=>{s.remove();attempt(i+1).then(resolve,reject);};document.head.append(s);
    });
    const promise=attempt(0).catch(e=>{scriptLoads.delete(key);throw e;});scriptLoads.set(key,promise);return promise;
  }
  function pdfLib(){return loadScript('PDF',[ 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js','https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js'],()=>!!window.PDFLib);}
  async function pdfJs(){
    await loadScript('PDF.js',['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'],()=>!!window.pdfjsLib);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  function pdfDoc(data){return window.PDFLib.PDFDocument.load(data,{updateMetadata:false});}
  const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
  function parsePages(text,count,allowDuplicates=true){
    if(!text.trim())throw Error('حدد أرقام الصفحات.');
    let out=[];
    for(const raw of text.replace(/\s+/g,'').split(/[,،]+/)){
      if(!raw)continue;const m=raw.match(/^(\d+)(?:-(\d+))?$/);if(!m)throw Error('صيغة أرقام الصفحات غير صحيحة. مثال: 1,3,5-8');
      const a=Number(m[1]),b=m[2]?Number(m[2]):a;if(a<1||b>count||a>b)throw Error(`نطاق خارج عدد الصفحات (1 إلى ${count}).`);
      for(let n=a;n<=b;n++)if(allowDuplicates||!out.includes(n-1))out.push(n-1);
    }
    if(!out.length)throw Error('لم يتم اختيار أي صفحة.');return out;
  }
  function blobFor(data,type='application/pdf'){return new Blob([data],{type});}
  function addDownload(name,blob,label='حمّل ملفك ⬇️'){
    const url=URL.createObjectURL(blob);resultUrls.push(url);
    const a=el('a','download-btn',label);a.href=url;a.download=safeFilename(name);els.resultBtns.append(a);
  }
  function showResult(info){els.resultInfo.textContent=info;els.result.classList.remove('hidden');els.result.scrollIntoView({behavior:'smooth',block:'nearest'});}
  function previewText(text){
    els.preview.replaceChildren();els.preview.classList.remove('hidden');
    const heading=el('h3','', 'هذا النص اللي طلع 👇');
    const area=el('textarea','extracted-text');area.readOnly=true;area.dir='auto';area.value=text;
    area.setAttribute('aria-label','النص المستخرج من PDF');area.spellcheck=false;
    els.preview.append(heading,area,paragraph('تقدر تحدد النص وتنسخه من المربع، أو تضغط «انسخ النص» فوق.'));
  }
  async function copyText(text){
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const area=els.preview.querySelector('.extracted-text');
        if(!area)throw Error('ما قدرت أوصل للنص.');
        area.focus();area.select();area.setSelectionRange(0,area.value.length);
        if(!document.execCommand('copy'))throw Error('المتصفح ما سمح بالنسخ التلقائي.');
      }
      setStatus('انسخناه لك 📋','success');
    } catch(err){
      setStatus('ما ضبط النسخ التلقائي. حدّد النص من المربع وانسخه يدويًا.','error');
    }
  }
  function createPrintButton(title,html){const b=el('button','download-btn','اطبع أو احفظ PDF');b.type='button';b.onclick=()=>printHTML(title,html);els.resultBtns.append(b);}
  function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function printHTML(title,inner){
    const w=window.open('','_blank');if(!w){setStatus('اسمح بفتح نافذة جديدة عشان تقدر تحفظ PDF.','error');return;}
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${escapeHTML(title)}</title><style>body{font:16px/1.9 Arial,Tahoma,sans-serif;padding:24px;color:#000}h1{font-size:20px;white-space:normal}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #999;padding:5px;text-align:right;overflow-wrap:anywhere}p{white-space:pre-wrap;overflow-wrap:anywhere}@page{size:A4;margin:15mm}</style></head><body><h1>${escapeHTML(title)}</h1>${inner}</body></html>`);
    w.document.close();w.focus();setTimeout(()=>w.print(),300);
  }
  async function mergePDF(){
    if(files.length<2)throw Error('أضف ملفين PDF على الأقل.'); await pdfLib();const out=await window.PDFLib.PDFDocument.create();
    for(let i=0;i<files.length;i++){
      const src=await pdfDoc(await readBinary(files[i])); const count=src.getPageCount();
      if(!count)throw Error(`الملف ${files[i].name} بلا صفحات.`);
      const pages=await out.copyPages(src,Array.from({length:count},(_,i)=>i));pages.forEach(p=>out.addPage(p));
      setProgress((i+1)/files.length*85,`دمج الملف ${i+1} من ${files.length}`);await tick();
    }
    const data=await out.save({useObjectStreams:true});addDownload('ملفات-مدمجة.pdf',blobFor(data));showResult(`${out.getPageCount()} صفحة • ${formatSize(data.length)}`);
  }
  async function splitPDF(){
    if(files.length!==1)throw Error('اختر ملف PDF واحدًا.');await pdfLib();const doc=await pdfDoc(await readBinary(files[0]));const count=doc.getPageCount();
    const groups=$('split-mode').value==='groups' ? $('split-ranges').value.split(/[,،]/).filter(s=>s.trim()).map(s=>parsePages(s,count)) : Array.from({length:count},(_,i)=>[i]);
    if(groups.length>400)throw Error('الحد 400 ملف ناتج؛ استخدم النطاقات لتجميع الصفحات.');
    const zip=new JSZip();let i=0;
    for(const group of groups){const dest=await window.PDFLib.PDFDocument.create();(await dest.copyPages(doc,group)).forEach(p=>dest.addPage(p));zip.file(`صفحات-${String(++i).padStart(3,'0')}.pdf`,await dest.save());setProgress(i/groups.length*85,`إنشاء ${i} من ${groups.length}`);if(i%3===0)await tick();}
    const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:5}},({percent})=>setProgress(85+percent*.15,'تجهيز الملف المضغوط'));
    addDownload(`${basename(files[0].name)}-صفحات.zip`,blob,'تنزيل ZIP');showResult(`${groups.length} ملف PDF • ${formatSize(blob.size)}`);
  }
  async function organizePDF(){
    if(files.length!==1)throw Error('اختر ملف PDF واحدًا.');await pdfLib();const source=await pdfDoc(await readBinary(files[0]));const count=source.getPageCount();
    const mode=$('pages-mode').value;const selected=parsePages($('pages-range').value,count,mode==='extract');
    const dest=await window.PDFLib.PDFDocument.create();
    let keep=[];if(mode==='extract')keep=selected;else if(mode==='delete')keep=Array.from({length:count},(_,i)=>i).filter(i=>!selected.includes(i));else keep=Array.from({length:count},(_,i)=>i);
    if(!keep.length)throw Error('لا يمكن إنشاء PDF بلا صفحات.');
    (await dest.copyPages(source,keep)).forEach((p,i)=>{if(mode==='rotate'&&selected.includes(keep[i])){const angle=Number($('rotate-angle').value),old=p.getRotation().angle;p.setRotation(window.PDFLib.degrees((old+angle)%360));}dest.addPage(p);});
    const data=await dest.save({useObjectStreams:true});addDownload(`${basename(files[0].name)}-${mode}.pdf`,blobFor(data));showResult(`${dest.getPageCount()} صفحة • ${formatSize(data.length)}`);
  }
  async function openPdfJs(file){const data=await readBinary(file);return window.pdfjsLib.getDocument({data,enableXfa:false}).promise;}
  async function renderPage(page,scale){const viewport=page.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(viewport.width));canvas.height=Math.max(1,Math.ceil(viewport.height));const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);await page.render({canvasContext:ctx,viewport}).promise;return {canvas,viewport};}
  function canvasBlob(canvas,type='image/jpeg',quality=.8){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('تعذّر تحويل الصورة.')),type,quality));}
  async function compressPDF(){
    if(files.length!==1)throw Error('اختر PDF واحدًا.');const source=files[0];await pdfLib();const level=$('compress-level').value;let data;
    if(level==='lossless'){
      const doc=await pdfDoc(await readBinary(source));setProgress(50,'إعادة تنظيم PDF');data=await doc.save({useObjectStreams:true});
    }else{
      await pdfJs();const pdf=await openPdfJs(source);const output=await window.PDFLib.PDFDocument.create();
      const scale=level==='strong'?.95:1.4,quality=level==='strong'?.43:.68;
      for(let i=1;i<=pdf.numPages;i++){
        const page=await pdf.getPage(i),viewport=page.getViewport({scale:1});
        const rendered=await renderPage(page,scale);const jpg=await canvasBlob(rendered.canvas,'image/jpeg',quality);
        const emb=await output.embedJpg(await jpg.arrayBuffer());const p=output.addPage([viewport.width,viewport.height]);
        p.drawImage(emb,{x:0,y:0,width:viewport.width,height:viewport.height});rendered.canvas.width=0;rendered.canvas.height=0;
        setProgress(i/pdf.numPages*87,`ضغط صفحة ${i} من ${pdf.numPages}`);await tick();
      }
      data=await output.save({useObjectStreams:true});
    }
    if(data.length>=source.size){
      setStatus(`تعذّر تقليل الحجم بهذا المستوى: الأصل ${formatSize(source.size)} والناتج ${formatSize(data.length)}. جرّب مستوى آخر.`, 'error');return;
    }
    addDownload(`${basename(source.name)}-مضغوط.pdf`,blobFor(data));showResult(`قبل: ${formatSize(source.size)} • بعد: ${formatSize(data.length)} • توفير ${Math.round((1-data.length/source.size)*100)}%`);
  }
  function imageLoad(file){return new Promise((resolve,reject)=>{
    const u=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(u);resolve(img);};img.onerror=()=>{URL.revokeObjectURL(u);reject(Error(`تعذّر قراءة الصورة ${file.name}؛ الصيغة قد لا يدعمها متصفحك.`));};img.src=u;
  });}
  async function imageToCanvas(file,max=2400){const img=await imageLoad(file);const scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);return canvas;}
  async function imagesToPDF(){
    if(!files.length)throw Error('أضف صورة على الأقل.');await pdfLib();const pdf=await window.PDFLib.PDFDocument.create();
    const fit=$('image-page-size').value==='fit',quality=Number($('image-page-quality').value);
    for(let i=0;i<files.length;i++){
      const canvas=await imageToCanvas(files[i]);const jpg=await canvasBlob(canvas,'image/jpeg',quality);
      const embedded=await pdf.embedJpg(await jpg.arrayBuffer());
      const [w,h]=fit?[canvas.width*.75,canvas.height*.75]:[595.28,841.89];
      const page=pdf.addPage([w,h]),pad=fit?0:24,ratio=Math.min((w-2*pad)/embedded.width,(h-2*pad)/embedded.height);
      const dw=embedded.width*ratio,dh=embedded.height*ratio;page.drawImage(embedded,{x:(w-dw)/2,y:(h-dh)/2,width:dw,height:dh});
      canvas.width=0;canvas.height=0;setProgress((i+1)/files.length*90,`إضافة الصورة ${i+1} من ${files.length}`);await tick();
    }
    const data=await pdf.save({useObjectStreams:true});addDownload('صور-إلى-PDF.pdf',blobFor(data));showResult(`${pdf.getPageCount()} صفحة • ${formatSize(data.length)}`);
  }
  async function compressImages(){
    if(!files.length)throw Error('اختر صورة واحدة على الأقل.');const width=Number($('img-max-width').value);if(!Number.isFinite(width)||width<100||width>12000)throw Error('العرض الأقصى يجب أن يكون بين 100 و12000 بكسل.');
    const quality=Number($('img-quality').value),zip=new JSZip();let total=0,saved=0;
    for(let i=0;i<files.length;i++){
      const canvas=await imageToCanvas(files[i],width),blob=await canvasBlob(canvas,'image/jpeg',quality);canvas.width=0;canvas.height=0;
      zip.file(`${basename(files[i].name)}-مضغوط-${i+1}.jpg`,blob);total+=files[i].size;saved+=blob.size;
      setProgress((i+1)/files.length*80,`ضغط الصورة ${i+1} من ${files.length}`);await tick();
    }
    const result=await zip.generateAsync({type:'blob',compression:'STORE'},m=>setProgress(80+m.percent*.2,'تجهيز صورك'));
    addDownload('صور-مضغوطة.zip',result,'تنزيل الصور ZIP');showResult(`${files.length} صورة • ${formatSize(total)} إلى ${formatSize(saved)} قبل تغليف ZIP${saved>total?' (الصورة أصغر أصلًا)':''}`);
  }
  // PDF.js may return one word OR one glyph in each text item.
  // Never append a space unconditionally between items; infer word gaps from the PDF coordinates.
  function composePdfLine(chunks){
    if(!chunks.length)return '';
    const script=chunks.map(c=>c.str).join('');
    const arCount=(script.match(/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/g)||[]).length;
    const latinCount=(script.match(/[A-Za-z]/g)||[]).length;
    const rtl=arCount>latinCount;
    const ordered=chunks.slice().sort((a,b)=>rtl ? b.x-a.x : a.x-b.x);
    let result='',prev=null;
    for(const item of ordered){
      const str=item.str.replace(/[\u00a0\u2007\u202f]/g,' ');
      if(!str)continue;
      if(prev){
        const gap=rtl ? prev.x-(item.x+item.width) : item.x-(prev.x+prev.width);
        const threshold=Math.max(1,Math.min(prev.height,item.height)*.20);
        const hasSpace=/\s$/.test(result)||/^\s/.test(str);
        // Embedded spaces in PDF.js items are preserved. Only add an inferred gap for whole words.
        if(!hasSpace&&gap>threshold&&!/^[،؛:,.!?؟\)\]٪]/.test(str)&&!/[\(\[]$/.test(result))result+=' ';
      }
      result+=str;
      prev=item;
    }
    // Keep punctuation / intentional spaces, but trim PDF positioning artifacts.
    return result.replace(/[ \t]{2,}/g,' ').trim().normalize('NFC');
  }
  function reflowPdfItems(items){
    const lines=[];let fallback=[];
    for(const item of items){
      if(typeof item.str!=='string')continue;
      const x=Number(item.transform?.[4]),y=Number(item.transform?.[5]);
      const height=Math.max(1,Math.abs(Number(item.height||item.transform?.[0]||10)));
      if(!Number.isFinite(x)||!Number.isFinite(y)){
        fallback.push(item.str);if(item.hasEOL)fallback.push('\n');continue;
      }
      const c={str:item.str,x,y,height,width:Math.max(0,Number(item.width)||0)};
      const line=lines.find(l=>Math.abs(l.y-y)<=Math.max(2,Math.min(l.height,height)*.42));
      if(line){line.items.push(c);line.y=(line.y*(line.items.length-1)+y)/line.items.length;line.height=Math.max(line.height,height);}
      else lines.push({y,height,items:[c]});
    }
    // Typical PDF page coordinates: higher y means an earlier line on the page.
    const result=lines.sort((a,b)=>b.y-a.y).map(l=>composePdfLine(l.items)).filter(Boolean).join('\n');
    if(result)return result;
    return fallback.join('').trim();
  }
  async function extractPdfText(file){
    await pdfJs();const doc=await openPdfJs(file);let texts=[];
    try {
      for(let i=1;i<=doc.numPages;i++){
        const p=await doc.getPage(i),result=await p.getTextContent();
        texts.push(reflowPdfItems(result.items));
        setProgress(i/doc.numPages*90,`قاعد أقرأ صفحة ${i} من ${doc.numPages}`);await tick();
      }
    } finally {await doc.destroy();}
    return texts.filter(Boolean).join('\n\n').trim();
  }
  async function textToDocx(text){
    if(!window.JSZip)throw Error('مكتبة إنشاء DOCX غير متوفرة.');const zip=new JSZip();const lines=text.replace(/\r\n/g,'\n').split('\n');
    const xmlLines=lines.map(t=>{
      const rtl=/[\u0600-\u06ff]/.test(t);
      return `<w:p><w:pPr>${rtl?'<w:bidi/>':''}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Tahoma" w:hAnsi="Tahoma" w:cs="Tahoma"/>${rtl?'<w:rtl/>':''}</w:rPr><w:t xml:space="preserve">${escapeHTML(t)}</w:t></w:r></w:p>`;
    }).join('');
    zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${xmlLines}<w:sectPr/></w:body></w:document>`);
    return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
  }
  async function showTextOutputs(text,name){
    addDownload(`${name}.txt`,new Blob(['\uFEFF',text],{type:'text/plain;charset=utf-8'}),'حمّل TXT ⬇️');
    addDownload(`${name}.docx`,await textToDocx(text),'حمّل Word ⬇️');
    const copy=el('button','download-btn','📋 انسخ النص');copy.type='button';copy.onclick=()=>copyText(text);els.resultBtns.prepend(copy);
    createPrintButton(name,`<p>${escapeHTML(text)}</p>`);
    showResult(`${text.length.toLocaleString('ar')} حرف • النص جاهز`);previewText(text);
  }
  async function pdfText(){
    if(files.length!==1)throw Error('ارفع ملف PDF واحد.');
    const text=await extractPdfText(files[0]);
    if(!text.trim())throw Error('ما لقينا نص قابل للنسخ في هالملف. ممكن تكون صفحاته صورًا أو النص مشفّرًا.');
    await showTextOutputs(text,basename(files[0].name));
  }
  const handlers={merge:mergePDF,split:splitPDF,pages:organizePDF,compress:compressPDF,images2pdf:imagesToPDF,imagecompress:compressImages,pdftext:pdfText};
  async function run(){
    if(working)return;working=true;els.run.disabled=true;clearResult();stopProgress();setStatus('ثواني، نجهز ملفاتك...');
    try{
      if(!files.length)throw Error('ارفع ملفك أولًا 📂');
      await handlers[active](); if(!els.result.classList.contains('hidden'))setStatus('تمّت! 🎉','success');
    }catch(error){console.error(error);let message=String(error?.message||error||'صار خطأ غير متوقع. جرّب مرة ثانية.');
      if(/encrypt|password|PasswordException/i.test(message))message='الملف عليه كلمة مرور، وما نقدر نشتغل عليه.';
      else if(/Invalid PDF|No PDF header|not a PDF/i.test(message))message='ملف PDF فيه مشكلة أو صيغته ما تشتغل هنا.';
      setStatus(message,'error');
    }finally{working=false;els.run.disabled=false;stopProgress();}
  }
  document.querySelectorAll('[data-tool]').forEach(button=>button.addEventListener('click',()=>{setActive(button.dataset.tool);$('workspace').scrollIntoView({behavior:'smooth'});}));
  els.drop.addEventListener('click',()=>els.picker.click());els.drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();els.picker.click();}});
  els.picker.addEventListener('change',e=>{addFiles(e.target.files);e.target.value='';});
  ['dragenter','dragover'].forEach(type=>els.drop.addEventListener(type,e=>{e.preventDefault();els.drop.classList.add('dragover');}));
  ['dragleave','dragend','drop'].forEach(type=>els.drop.addEventListener(type,e=>{e.preventDefault();els.drop.classList.remove('dragover');}));
  els.drop.addEventListener('drop',e=>addFiles(e.dataTransfer.files));
  $('add-files-btn').onclick=()=>els.picker.click();$('reset-btn').onclick=()=>{if(!working){files=[];els.picker.value='';renderFiles();clearResult();stopProgress();setStatus('');}};
  els.run.onclick=run;
  $('theme-btn').onclick=()=>{document.body.classList.toggle('light');$('theme-btn').textContent=document.body.classList.contains('light')?'☀':'☾';};
  setActive('merge');
})();
