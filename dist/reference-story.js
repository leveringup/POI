const base = new URL('data/poi-story-examples/', location.href);
const $ = id => document.getElementById(id);
const positionPanel = $('position-panel');
const coordinates = $('coordinates');
const comparison = document.createElement('figure');
comparison.className = 'shift-comparison';
const comparisonImage = document.createElement('img');
comparisonImage.src = new URL('data/images_shift/Picture1.png', location.href).href;
comparisonImage.alt = 'ตัวอย่างแผนที่เปรียบเทียบตำแหน่งจุดภาพ Street View เดิมกับตำแหน่ง POI หลังเลื่อน 10 เมตร';
comparisonImage.decoding = 'async';
const comparisonCaption = document.createElement('figcaption');
comparisonCaption.textContent = 'ตัวอย่างตำแหน่งจุดภาพ Street View เดิมและตำแหน่ง POI หลังเลื่อนตามแนวถนน 10 เมตร';
comparison.append(comparisonImage, comparisonCaption);
positionPanel.replaceChildren(comparison, coordinates);
let data, current, stage = 0;
const labels = ['ภาพต้นฉบับ','ตรวจจับบริเวณป้าย','ตัดภาพป้าย','อ่านข้อความด้วย OCR','สกัดข้อมูลด้วย LLM','เลื่อนตำแหน่งเชิงประมาณ'];
function paragraph(parent, text, tag='p') {const el=document.createElement(tag);el.textContent=text;parent.append(el);return el;}
function render() {
 if(!current) return;
 const crop=current.crops.find(c=>c.crop_index===current.featured_crop_index);
 const original=stage<2;
 $('stage-label').textContent=String(stage+1).padStart(2,'0')+' / '+labels[stage];
 $('step-count').textContent=String(stage+1).padStart(2,'0')+' / 06';
 $('place-title').textContent=current.title;
 $('image-date').textContent='วันที่ภาพ '+current.imagery_date;
 const nextImage=new URL(original?current.original_image.src:crop.image,base).href;
 if($('story-image').src!==nextImage) $('story-image').src=nextImage;
 $('story-image').alt=original?'ภาพ Street View ของ'+current.title:'ภาพป้าย '+current.title;
 $('image-frame').hidden=stage===5;
 $('image-frame').classList.toggle('is-crop',!original);
 $('compare-control').hidden=true;
 $('previous-stage').disabled=stage===0;
 $('next-stage').disabled=stage===5;
 document.querySelectorAll('[data-jump-stage]').forEach((button,i)=>{if(i===stage)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
 $('boxes').replaceChildren();
 if(stage===1){const box=document.createElement('div');box.className='box';const [x1,y1,x2,y2]=crop.bbox_xyxy_normalized;Object.assign(box.style,{left:x1*100+'%',top:y1*100+'%',width:(x2-x1)*100+'%',height:(y2-y1)*100+'%'});$('boxes').append(box);}
 $('text-panel').replaceChildren();
 if(stage===2) paragraph($('text-panel'),'ภาพป้ายตัวอย่าง · เผื่อขอบกรอบ 5%');
 if(stage===3){paragraph($('text-panel'),'ข้อความ OCR จากภาพป้ายนี้');paragraph($('text-panel'),crop.ocr_text,'code');paragraph($('text-panel'),'คะแนน OCR: '+crop.ocr_confidence+' · ยังไม่ใช่ค่าความถูกต้อง');}
 if(stage===4){for(const poi of current.llm.pois){paragraph($('text-panel'),poi.poi_name,'b');paragraph($('text-panel'),poi.category,'code');}const d=document.createElement('details');paragraph(d,'ดูข้อความรวมที่ LLM ใช้วิเคราะห์','summary');paragraph(d,current.llm.input_text,'code');$('text-panel').append(d);paragraph($('text-panel'),'ผลจากโมเดล · ยังไม่ยืนยันภาคสนาม');}
 $('position-panel').hidden=stage!==5;
 const p=current.position;
 $('coordinates').textContent=`ก่อน: ${p.before.lat.toFixed(6)}, ${p.before.lon.toFixed(6)}\nหลัง: ${p.after.lat.toFixed(6)}, ${p.after.lon.toFixed(6)}\nHeading: ${p.heading_degrees}° · ระยะประมาณ 10 เมตร`;
 $('coordinates').style.whiteSpace='pre-line';
 document.querySelectorAll('.step').forEach((el,i)=>{el.classList.toggle('active',i===stage);if(i===stage)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
}
fetch(new URL('story-examples.json',base)).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();}).then(d=>{data=d;current=d.examples[0];$('example').replaceChildren();for(const [i,e] of d.examples.entries()){const option=document.createElement('option');option.value=i;option.textContent=e.title;$('example').append(option);}$('load-status').textContent='ตัวอย่างจริง 3 แห่ง · คัดเพื่ออธิบายกระบวนการ';render();}).catch(()=>{$('load-status').textContent='โหลดตัวอย่างไม่สำเร็จ กรุณาเปิดผ่าน HTTP server และตรวจโฟลเดอร์ data/poi-story-examples';});
$('example').addEventListener('change',e=>{current=data.examples[Number(e.target.value)];render();});
let pending=false;
function update(){pending=false;const steps=[...document.querySelectorAll('.step')];const target=innerHeight*(innerWidth<761?.78:.5);let nearest=0,best=Infinity;steps.forEach((el,i)=>{const r=el.getBoundingClientRect();const distance=Math.abs(r.top+r.height/2-target);if(distance<best){best=distance;nearest=i;}});if(nearest!==stage){stage=nearest;render();}if(!matchMedia('(prefers-reduced-motion: reduce)').matches){const hero=document.querySelector('.hero');const rect=hero.getBoundingClientRect();if(rect.bottom>0)document.querySelector('.hero-image').style.transform=`translateY(${Math.min(scrollY*.18,180)}px) scale(1.08)`;}}
addEventListener('scroll',()=>{if(!pending){pending=true;requestAnimationFrame(update);}},{passive:true});addEventListener('resize',update);update();
