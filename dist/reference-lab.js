const labPages=['streetview','density','compare','summary','evidence'];
const labMeta={
 streetview:{title:'แผนที่สถานที่สำคัญ',code:'01 / SPATIAL EXPLORER',subtitle:'สำรวจตำแหน่งและหลักฐาน POI จากภาพ Street View',scope:'CHIANG MAI',badge:'1,374 กลุ่มจุด'},
 density:{title:'ความหนาแน่นเชิงพื้นที่',code:'02 / DENSITY ANALYSIS',subtitle:'สำรวจการกระจุกตัวของจุดที่ตรวจพบ ด้วย Kernel Density',scope:'KERNEL DENSITY',badge:'10 m / 100 m'},
 compare:{title:'เปรียบเทียบข้อมูลย่านนิมมาน',code:'03 / SOURCE COMPARISON',subtitle:'สามแหล่งข้อมูล ภายใน buffer 10 เมตรจากแนวถนนนิมมานเหมินท์',scope:'NIMMAN / BUFFER',badge:'3 แหล่งข้อมูล'},
 summary:{title:'ภาพรวมผลการศึกษา',code:'04 / RESEARCH ANALYTICS',subtitle:'จำนวนและหมวดหมู่ POI ในพื้นที่เปรียบเทียบนิมมาน',scope:'COMPARISON SCOPE',badge:'BUFFER 10 m'},
 evidence:{title:'คลังภาพป้าย',code:'05 / EVIDENCE ARCHIVE',subtitle:'ย้อนดูภาพต้นทางของข้อมูลสถานที่ และตรวจสอบผลการตีความ',scope:'STREET VIEW',badge:'IMAGE EVIDENCE'}
};
let labRouteVersion=0;
const filterButton=document.getElementById('filterToggle');
function activeLabMap(){return location.hash==='#density'?densityMap:location.hash==='#compare'?compareLeafletMap:svMap;}
function fitMapToData(){const map=activeLabMap();if(!map)return;const key=location.hash==='#compare'?'buffer':'municipality';getData(key).then(data=>map.fitBounds(L.geoJSON(data).getBounds(),{paddingTopLeft:innerWidth>760&&!document.body.classList.contains('filters-collapsed')?[325,35]:[30,30],paddingBottomRight:[35,35]}));}
function setFiltersVisible(visible){document.body.classList.toggle('filters-collapsed',!visible);filterButton.setAttribute('aria-expanded',String(visible));filterButton.textContent=visible?'ซ่อนแผงควบคุม':'แสดงแผงควบคุม';const page=document.querySelector('.map-page.active');if(page){const panel=page.querySelector('.map-sidebar');panel.inert=!visible;panel.setAttribute('aria-hidden',String(!visible));}}
filterButton.addEventListener('click',()=>setFiltersVisible(document.body.classList.contains('filters-collapsed')));
async function labNavigate(){
 const version=++labRouteVersion;let page=location.hash.slice(1);if(!labPages.includes(page)){location.replace('#streetview');return;}
 const meta=labMeta[page];document.body.dataset.page=page;document.getElementById('workspaceTitle').textContent=meta.title;document.getElementById('workspaceSubtitle').textContent=meta.subtitle;document.getElementById('workspaceCode').textContent=meta.code;document.getElementById('workspaceScope').textContent=meta.scope;document.getElementById('workspaceBadge').textContent=meta.badge;document.title=meta.title+' — POI Intelligence Lab';
 filterButton.hidden=!['streetview','density','compare'].includes(page);document.getElementById('explorerError').hidden=true;
 window.scrollTo({top:0,behavior:'instant'});
 document.querySelectorAll('#mainNav button').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);if(b.dataset.page===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 setFiltersVisible(innerWidth>760);
 try{await showPage(page);if(version!==labRouteVersion)return;setFiltersVisible(innerWidth>760);requestAnimationFrame(()=>{for(const map of [svMap,densityMap,compareLeafletMap])if(map)map.closePopup();const map=activeLabMap();if(map)map.invalidateSize();});if(page==='summary')await buildLabStats();if(page==='evidence')updateEvidenceStats();}
 catch(error){const e=document.getElementById('explorerError');e.textContent='โหลดข้อมูลไม่สำเร็จ: '+error.message+' กรุณารีเฟรชเพื่อลองอีกครั้ง';e.hidden=false;}
}
async function buildLabStats(){
 const holder=document.getElementById('sourceStats');if(holder.children.length)return;
 const sources=[['svNimman','Street View','#aa8cf8'],['osmNimman','OpenStreetMap','#69e8de'],['ggNimman','Google Places','#edb578']];
 const records=await Promise.all(sources.map(async([key,label,color])=>({label,color,count:(await getData(key)).features.length})));
 const total=records.reduce((a,r)=>a+r.count,0);
 for(const r of records){const card=document.createElement('article');card.className='source-stat';card.style.setProperty('--source-color',r.color);for(const [tag,text] of [['span',r.label],['b',r.count.toLocaleString('th-TH')],['small','จุดในขอบเขตเปรียบเทียบ']]){const e=document.createElement(tag);e.textContent=text;card.append(e);}holder.append(card);
 const segment=document.createElement('span');segment.style.width=r.count/total*100+'%';segment.style.background=r.color;segment.title=r.label+': '+r.count+' รายการ';document.getElementById('sourceShare').append(segment);
 const legend=document.createElement('span');legend.textContent=r.label;const value=document.createElement('b');value.textContent=(r.count/total*100).toFixed(1)+'%';legend.append(value);document.getElementById('shareLegend').append(legend);
 const line=document.createElement('div');const name=document.createElement('span');const dot=document.createElement('i');dot.style.background=r.color;name.append(dot,document.createTextNode(r.label));const count=document.createElement('b');count.textContent=r.count+' จุด';line.append(name,count);document.getElementById('sourceCountList').append(line);
 }
 document.getElementById('comparisonTotal').textContent=total+' รายการ';
}
function updateEvidenceStats(){if(!evidenceState)return;document.getElementById('evidenceTotal').textContent=evidenceState.features.length.toLocaleString('th-TH');}
document.querySelectorAll('#mainNav button').forEach(b=>b.addEventListener('click',()=>{if(location.hash==='#'+b.dataset.page)labNavigate();else location.hash=b.dataset.page;}));
document.querySelectorAll('[data-reset-map]').forEach(b=>b.addEventListener('click',fitMapToData));
document.querySelectorAll('[data-reset-filters]').forEach(button=>button.addEventListener('click',()=>{const page=button.closest('.page');page.querySelectorAll('input[type=search]').forEach(e=>{e.value='';e.dispatchEvent(new Event('input'));});page.querySelectorAll('select').forEach(e=>{e.selectedIndex=0;e.dispatchEvent(new Event('change'));});page.querySelectorAll('input[type=checkbox]').forEach(e=>{if(!e.checked){e.checked=true;e.dispatchEvent(new Event('change'));}});}));
document.querySelectorAll('[data-gallery-mode]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-gallery-mode]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});document.getElementById('evidenceList').classList.toggle('compact',button.dataset.galleryMode==='compact');}));
addEventListener('hashchange',labNavigate);labNavigate();
