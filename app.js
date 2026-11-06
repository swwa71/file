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
    merge: {title:'دمج PDF',desc:'ادمج ملفاتك بملف واحد.',accept:'.pdf,application/pdf',multiple:true,button:'يلا ندمج',hint:'ملفات PDF • تقدر ترتّبها'},
    split: {title:'فصل PDF',desc:'استخرج كل صفحة لحالها أو مجموعات صفحات.',accept:'.pdf,application/pdf',multiple:false,button:'يلا نفصل',hint:'ملف PDF واحد'},
    pages: {title:'تنظيم الصفحات',desc:'استخرج صفحات، احذفها أو دوّرها.',accept:'.pdf,application/pdf',multiple:false,button:'يلا نرتّب',hint:'ملف PDF واحد'},
    compress: {title:'ضغط PDF',desc:'قلّل حجم الملف بالمستوى اللي يناسبك.',accept:'.pdf,application/pdf',multiple:false,button:'يلا نضغط',hint:'ملف PDF واحد'},
    images2pdf: {title:'صور إلى PDF',desc:'اجمع صورك في ملف PDF واحد.',accept:'image/jpeg,image/png,image/webp,image/bmp,image/gif,.heic,.heif',multiple:true,button:'سوّ PDF',hint:'صور JPG أو PNG أو غيرها'},
    imagecompress: {title:'ضغط الصور',desc:'صغّر الصور وتحكّم بجودتها.',accept:'image/*',multiple:true,button:'يلا نضغط',hint:'صورة أو أكثر'},
    pdftext: {title:'PDF إلى نص',desc:'استخرج النص وانسخه أو حمّله TXT أو Word.',accept:'.pdf,application/pdf',multiple:false,button:'طلّع النص',hint:'PDF فيه نص قابل للتحديد'}
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
  // ===== PDF -> نص: ترتيب الكلمات والاتجاه + إصلاح حروف اللام ألف (لا / لأ / لإ) =====
  // PDF.js يعكس حروف الرمز المركّب (لا) فيطلع «السالم» بدل «السلام» و«هلال» بدل «الله».
  // الحل: نقرأ حروف الصفحة كما هي (رمزًا رمزًا) من قائمة العمليات، ونعيد بناء ترتيب كل عنصر نصي على مستوى الرمز.
  const AR_LETTER=/[\u0590-\u05ff\u0621-\u064a\u066e-\u06d3\u06fa-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufefc]/;
  const AR_LETTER_G=new RegExp(AR_LETTER.source,'g');
  const MIRROR={'(':')',')':'(','[':']',']':'[','{':'}','}':'{','<':'>','>':'<','«':'»','»':'«'};
  const CLOSERS=')]}>»';
  function cleanPdfString(s){
    return String(s)
      .replace(/[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069\ufeff]/g,'')
      .replace(/[\u00a0\u2007\u202f]/g,' ')
      .replace(/[\ufb50-\ufdff\ufe70-\ufefc]+/g,m=>m.normalize('NFKC'));
  }
  function pdfClass(str){
    if(AR_LETTER.test(str))return 'R';
    if(/[A-Za-z0-9\u0660-\u0669\u06f0-\u06f9]/.test(str))return 'L';
    return 'N';
  }
  // ترتيب بصري (يسار->يمين) إلى ترتيب منطقي: المحايد يتبع جيرانه، والعربي يُعكس، والإنجليزي/الأرقام تبقى
  function bidiOrder(toks,base,mirror){
    const cls=toks.map(t=>t.c);
    for(let i=0;i<toks.length;i++){
      if(toks[i].c!=='N')continue;
      let l=i-1,r=i+1;while(l>=0&&toks[l].c==='N')l--;while(r<toks.length&&toks[r].c==='N')r++;
      const a=l>=0?toks[l].c:base,b=r<toks.length?toks[r].c:base;
      cls[i]=a===b?a:base;
    }
    const runs=[];
    toks.forEach((t,i)=>{const last=runs[runs.length-1];if(last&&last.c===cls[i])last.t.push(t);else runs.push({c:cls[i],t:[t]});});
    const ordered=base==='R'?runs.slice().reverse():runs;
    const out=[];
    for(const run of ordered){
      const seq=run.c==='R'?run.t.slice().reverse():run.t;
      seq.forEach(t=>out.push({s:(mirror&&run.c==='R'&&t.c==='N'&&MIRROR[t.s])?MIRROR[t.s]:t.s,gap:t.gap}));
    }
    return out;
  }
  function bracketErrors(str){
    const st=[];let err=0;
    for(const ch of str){
      if('([{'.includes(ch))st.push(ch);
      else if(')]}'.includes(ch)){const o=st.pop();if(o!==MIRROR[ch])err++;}
    }
    return err+st.length;
  }
  function composePdfLine(chunks,hint){
    const items=chunks.map(c=>({x:c.x,width:c.width,height:c.height,str:cleanPdfString(c.str)})).filter(c=>c.str!=='');
    if(!items.length)return '';
    items.sort((a,b)=>a.x-b.x);                       // الترتيب البصري: يسار -> يمين
    const all=items.map(c=>c.str).join('');
    const ar=(all.match(AR_LETTER_G)||[]).length,lat=(all.match(/[A-Za-z]/g)||[]).length;
    const base=ar>lat?'R':lat>ar?'L':(hint||'R');
    const toks=[];
    items.forEach((it,i)=>{
      if(i){
        const prev=items[i-1],gap=it.x-(prev.x+prev.width);
        if(gap>Math.max(1,Math.min(prev.height,it.height)*.2))toks.push({s:' ',c:'N',gap:true});
      }
      toks.push({s:it.str,c:pdfClass(it.str)});
    });
    // اتجاه الأقواس المنفصلة يختلف بين برامج إنشاء PDF، فنختار الصيغة التي تكون أقواسها متوازنة
    let logical=bidiOrder(toks,base,false);
    const e0=bracketErrors(logical.map(t=>t.s).join(''));
    if(e0>0){const alt=bidiOrder(toks,base,true);if(bracketErrors(alt.map(t=>t.s).join(''))<e0)logical=alt;}
    let out='';
    logical.forEach((t,i)=>{
      if(t.gap){
        const next=logical[i+1],prev=logical[i-1];
        if(!next||!prev)return;
        if(/\s$/.test(prev.s)||/^\s/.test(next.s))return;
        if(/^[،؛:,.!?؟\)\]٪]/.test(next.s)||/[\(\[]$/.test(prev.s))return;
      }
      out+=t.s;
    });
    return out.replace(/[ \t]{2,}/g,' ').trim().normalize('NFC');
  }
  function reflowPdfItems(items){
    const lines=[];let fallback=[],sample='';
    for(const item of items){
      if(typeof item.str!=='string')continue;
      sample+=item.str;
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
    const pageAr=(sample.match(AR_LETTER_G)||[]).length,pageLat=(sample.match(/[A-Za-z]/g)||[]).length;
    const hint=pageLat>pageAr?'L':'R';
    const rows=lines.sort((a,b)=>b.y-a.y).map(l=>composePdfLine(l.items,hint)).filter(Boolean);
    // قوس مفتوح في آخر السطر يعني أن الرقم أو الإيميل نزل للسطر التالي: نعيد ربطهما
    for(let i=0;i<rows.length-1;i++){if(/[\(\[]$/.test(rows[i])){rows[i]+=rows[i+1];rows.splice(i+1,1);i--;}}
    const result=rows.join('\n');
    if(result)return result;
    return fallback.join('').trim();
  }
  // حروف الصفحة كما تُرسم (رمز لكل عنصر، والرمز المركّب مثل «لا» يبقى رمزًا واحدًا)
  async function pageGlyphPool(page){
    const OPS=window.pdfjsLib.OPS,list=await page.getOperatorList(),pool=[];
    for(let i=0;i<list.fnArray.length;i++){
      const fn=list.fnArray[i];
      if(fn!==OPS.showText&&fn!==OPS.showSpacedText)continue;
      const arr=list.argsArray[i]&&list.argsArray[i][0];
      if(!Array.isArray(arr))continue;
      for(const g of arr){
        if(!g||typeof g!=='object')continue;
        const u=cleanPdfString(g.unicode||'').replace(/\s+/g,'');
        if(u)pool.push({u,n:[...u].length,c:pdfClass(u)});
      }
    }
    return pool;
  }
  const canonChar=c=>CLOSERS.includes(c)?MIRROR[c]:c;
  const isLamAlef=(a,b)=>(a==='ل'&&/[اأإآ]/.test(b))||(b==='ل'&&/[اأإآ]/.test(a));
  // نقبل إعادة البناء فقط لو اختلفت عن نص PDF.js في حروف «لا» المقلوبة (غير ذلك نترك النص كما هو)
  function onlyLamAlefDiff(S,M){
    for(let i=0;i<S.length;){
      if(canonChar(S[i])===canonChar(M[i])){i++;continue;}
      if(i+1<S.length&&S[i]===M[i+1]&&S[i+1]===M[i]&&isLamAlef(S[i],S[i+1])){i+=2;continue;}
      return false;
    }
    return true;
  }
  function repairOne(item,pool,from){
    const S=cleanPdfString(item.str),sNo=[...S.replace(/\s+/g,'')],n=sNo.length;
    if(!n||item.dir==='ttb')return null;
    const bases=item.dir==='rtl'?['R','L']:['L','R'];
    const attempt=q=>{
      let cnt=0,k=q;while(k<pool.length&&cnt<n){cnt+=pool[k].n;k++;}
      if(cnt!==n)return null;
      const toks=pool.slice(q,k).map(g=>({s:g.u,c:g.c}));
      for(const base of bases){
        const m=[...bidiOrder(toks,base,false).map(t=>t.s).join('')];
        if(m.length!==n||!onlyLamAlefDiff(sNo,m))continue;
        let j=0,out='';
        for(const ch of S){if(/\s/.test(ch)){out+=ch;continue;}const c=m[j++];out+=(MIRROR[ch]&&MIRROR[c])?ch:c;}
        return {str:out,next:k};
      }
      return null;
    };
    let r=attempt(from);
    for(let q=from+1;!r&&q<Math.min(pool.length,from+400);q++)r=attempt(q);
    return r;
  }
  function repairPdfItems(items,pool){
    if(!pool.length)return items;
    let ptr=0;
    return items.map(item=>{
      if(typeof item.str!=='string'||!item.str.trim())return item;
      const r=repairOne(item,pool,ptr);
      if(!r)return item;
      ptr=r.next;return {...item,str:r.str};
    });
  }
  async function extractPdfText(file){
    await pdfJs();const doc=await openPdfJs(file);let texts=[];
    try {
      for(let i=1;i<=doc.numPages;i++){
        const p=await doc.getPage(i),result=await p.getTextContent();
        let items=result.items;
        try{items=repairPdfItems(items,await pageGlyphPool(p));}catch(e){/* لو فشل الإصلاح نكمل بالنص العادي */}
        texts.push(reflowPdfItems(items));
        setProgress(i/doc.numPages*90,`قاعد أقرأ صفحة ${i} من ${doc.numPages}`);await tick();
      }
    } finally {await doc.destroy();}
    return texts.filter(Boolean).join('\n\n').trim();
  }
  async function textToDocx(text){
    if(!window.JSZip)throw Error('مكتبة إنشاء DOCX غير متوفرة.');const zip=new JSZip();
    const lines=text.replace(/\r\n?/g,'\n').split('\n');
    const docRtl=(text.match(AR_LETTER_G)||[]).length>=(text.match(/[A-Za-z]/g)||[]).length&&AR_LETTER.test(text);
    const LATIN=/[\(\[]?[A-Za-z0-9]+(?:[._@:\/\-+%#&=?][A-Za-z0-9]+)*[\)\]]?/g;
    const run=(t,rtl)=>t?`<w:r><w:rPr><w:rFonts w:ascii="Tahoma" w:hAnsi="Tahoma" w:cs="Tahoma"/><w:sz w:val="24"/><w:szCs w:val="24"/>${rtl?'<w:rtl/>':''}<w:lang w:val="${rtl?'ar-SA':'en-US'}" w:bidi="ar-SA"/></w:rPr><w:t xml:space="preserve">${escapeHTML(t)}</w:t></w:r>`:'';
    const xmlLines=lines.map(t=>{
      const rtl=AR_LETTER.test(t)||(docRtl&&!/[A-Za-z]/.test(t));
      let runs='';
      if(rtl){
        // الإنجليزي والأرقام (إيميل، رابط، تاريخ) في مقاطع مستقلة حتى لا تنقلب داخل الفقرة العربية
        let last=0,m;LATIN.lastIndex=0;
        while((m=LATIN.exec(t))){runs+=run(t.slice(last,m.index),true)+run(m[0],false);last=m.index+m[0].length;}
        runs+=run(t.slice(last),true);
      }else runs=run(t,false);
      return `<w:p><w:pPr>${rtl?'<w:bidi/>':''}<w:spacing w:after="120" w:line="360" w:lineRule="auto"/></w:pPr>${runs}</w:p>`;
    }).join('');
    const NS='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',HEAD='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    zip.file('[Content_Types].xml',HEAD+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
    zip.file('_rels/.rels',HEAD+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels',HEAD+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    zip.file('word/styles.xml',HEAD+`<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Tahoma" w:hAnsi="Tahoma" w:eastAsia="Tahoma" w:cs="Tahoma"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`);
    zip.file('word/document.xml',HEAD+`<w:document ${NS}><w:body>${xmlLines}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>${docRtl?'<w:bidi/>':''}</w:sectPr></w:body></w:document>`);
    return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
  }
  async function showTextOutputs(text,name){
    // TXT: علامة اتجاه (RLM) في أول كل سطر عربي يبدأ برقم أو إنجليزي، حتى يعرضه المفكرة صح
    const txt=text.split('\n').map(l=>AR_LETTER.test(l)&&!AR_LETTER.test(l.trim()[0]||'')?'\u200f'+l:l).join('\r\n');
    addDownload(`${name}.txt`,new Blob(['\uFEFF',txt],{type:'text/plain;charset=utf-8'}),'حمّل TXT ⬇️');
    addDownload(`${name}.docx`,await textToDocx(text),'حمّل Word ⬇️');
    const copy=el('button','download-btn','📋 انسخ النص');copy.type='button';copy.onclick=()=>copyText(text);els.resultBtns.prepend(copy);
    createPrintButton(name,text.split('\n').map(l=>`<p dir="${AR_LETTER.test(l)?'rtl':'auto'}">${escapeHTML(l)||'&nbsp;'}</p>`).join(''));
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
  document.querySelectorAll('[data-tool]').forEach(button=>button.addEventListener('click',()=>{setActive(button.dataset.tool);const ws=$('workspace'),top=ws.getBoundingClientRect().top;if(top>innerHeight*.6||top<0)ws.scrollIntoView({behavior:'smooth'});}));
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
