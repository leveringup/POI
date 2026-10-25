const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const progressBar=document.querySelector('.reading-progress i');
const storyTrack=document.querySelector('.story-track i');
const visual=document.querySelector('.visual');
let motionQueued=false;
function updateExperience(){motionQueued=false;const max=document.documentElement.scrollHeight-innerHeight;progressBar.style.width=(max>0?scrollY/max*100:0)+'%';const section=document.querySelector('.steps');const r=section.getBoundingClientRect();storyTrack.style.setProperty('--story-progress',Math.min(100,Math.max(0,(innerHeight*.5-r.top)/r.height*100))+'%');}
addEventListener('scroll',()=>{if(!motionQueued){motionQueued=true;requestAnimationFrame(updateExperience);}},{passive:true});addEventListener('resize',updateExperience);updateExperience();
if(!reducedMotion.matches){const revealObserver=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('in-view');revealObserver.unobserve(entry.target);}});},{threshold:.1});document.querySelectorAll('.intro h2,.intro-grid,.question-grid article,.street h2,.street-grid,.process-heading h2,.closing h2,.explore-grid a').forEach((el,i)=>{el.classList.add('reveal-ready');el.style.transitionDelay=(i%3)*60+'ms';revealObserver.observe(el);});}
function goStage(index){const step=document.querySelector(`.step[data-stage="${index}"]`);if(!step)return;step.scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth',block:'center'});}
document.querySelectorAll('[data-jump-stage]').forEach(button=>button.addEventListener('click',()=>goStage(Number(button.dataset.jumpStage))));
document.getElementById('previous-stage').addEventListener('click',()=>goStage(Math.max(0,stage-1)));
document.getElementById('next-stage').addEventListener('click',()=>goStage(Math.min(5,stage+1)));
const tabs=document.querySelector('.example-tabs');
function updateTabs(){if(!data||tabs.children.length)return;for(const [index,example] of data.examples.entries()){const button=document.createElement('button');button.type='button';button.setAttribute('aria-pressed',index===0?'true':'false');const image=document.createElement('img');const crop=example.crops.find(c=>c.crop_index===example.featured_crop_index);image.src=new URL(crop.image,base);image.alt='';const text=document.createElement('span');text.textContent=example.title;button.append(image,text);button.addEventListener('click',()=>{document.getElementById('example').value=index;document.getElementById('example').dispatchEvent(new Event('change'));[...tabs.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));});tabs.append(button);}}
const optionsObserver=new MutationObserver(()=>{updateTabs();if(tabs.children.length)optionsObserver.disconnect();});optionsObserver.observe(document.getElementById('example'),{childList:true});updateTabs();
document.getElementById('example').addEventListener('change',event=>{[...tabs.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===Number(event.target.value))));});
