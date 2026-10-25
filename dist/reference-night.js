// Decorative data field: visual motion only, not a live model or live POI feed.
const nightReduced=matchMedia('(prefers-reduced-motion: reduce)');
let nightPaused=nightReduced.matches;
const nightToggle=document.createElement('button');
nightToggle.type='button';nightToggle.className='night-motion-control';
function updateMotionLabel(){nightToggle.textContent=nightPaused?'▷ เปิดลูกเล่นเคลื่อนไหว':'Ⅱ พักลูกเล่นเคลื่อนไหว';nightToggle.setAttribute('aria-pressed',String(!nightPaused));document.body.classList.toggle('motion-paused',nightPaused);}
nightToggle.addEventListener('click',()=>{nightPaused=!nightPaused;updateMotionLabel();if(typeof startNightField==='function')startNightField();});
document.body.append(nightToggle);updateMotionLabel();
nightReduced.addEventListener('change',event=>{nightPaused=event.matches;updateMotionLabel();if(typeof startNightField==='function')startNightField();});
if(window.Chart){Chart.defaults.color='#8b9ab7';Chart.defaults.borderColor='#28334b';Chart.defaults.font.family="'Noto Sans Thai',Tahoma,sans-serif";}
const heroNight=document.querySelector('.hero');
let startNightField;
if(heroNight){
 const canvas=document.createElement('canvas');canvas.className='night-field';canvas.setAttribute('aria-hidden','true');heroNight.prepend(canvas);
 const ctx=canvas.getContext('2d');let width=1,height=1,frameId=0,last=0,heroVisible=true;
 let particles=[];const pointer={x:-1000,y:-1000};
 function resizeNight(){const r=heroNight.getBoundingClientRect();width=r.width;height=r.height;const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);particles=Array.from({length:innerWidth<761?25:55},(_,i)=>({x:Math.random()*width,y:Math.random()*height,vx:(Math.random()-.5)*.2,vy:(Math.random()-.5)*.2,r:i%8===0?2:1}));paintNight(0);}
 function paintNight(time){ctx.clearRect(0,0,width,height);for(let i=0;i<particles.length;i++){const a=particles[i];if(!nightPaused){a.x=(a.x+a.vx+width)%width;a.y=(a.y+a.vy+height)%height;}const near=Math.hypot(a.x-pointer.x,a.y-pointer.y)<180;const light=document.documentElement.dataset.theme==='minimal';ctx.fillStyle=light?(near?'#28634f':i%3?'#52796599':'#78739a88'):(near?'#88f4ec':i%3?'#9381c873':'#8ac5d573');ctx.beginPath();ctx.arc(a.x,a.y,near?2.3:a.r,0,Math.PI*2);ctx.fill();for(let j=i+1;j<particles.length;j++){const b=particles[j],distance=Math.hypot(a.x-b.x,a.y-b.y);if(distance<120){ctx.strokeStyle=`rgba(${light?'66,103,81':'142,119,193'},${(1-distance/120)*(light?.28:.18)})`;ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}}}
 function loopNight(time){frameId=0;if(nightPaused||!heroVisible||document.hidden)return;if(time-last>32){paintNight(time);last=time;}frameId=requestAnimationFrame(loopNight);}
 startNightField=()=>{if(!nightPaused&&heroVisible&&!document.hidden&&!frameId)frameId=requestAnimationFrame(loopNight);};
 new IntersectionObserver(entries=>{heroVisible=entries[0].isIntersecting;if(heroVisible)startNightField();},{threshold:0}).observe(heroNight);
 addEventListener('resize',resizeNight);document.addEventListener('visibilitychange',startNightField);document.addEventListener('poi-theme-change',startNightField);resizeNight();startNightField();
 const lab=document.querySelector('.hero-lab');
 if(matchMedia('(hover:hover) and (pointer:fine)').matches){heroNight.addEventListener('pointermove',e=>{const r=heroNight.getBoundingClientRect();pointer.x=e.clientX-r.left;pointer.y=e.clientY-r.top;if(nightPaused)return;const l=lab.getBoundingClientRect();const x=Math.max(-1,Math.min(1,(e.clientX-l.left-l.width/2)/(l.width/2)));const y=Math.max(-1,Math.min(1,(e.clientY-l.top-l.height/2)/(l.height/2)));lab.style.setProperty('--tilt-x',x*7+'deg');lab.style.setProperty('--tilt-y',-y*6+'deg');},{passive:true});heroNight.addEventListener('pointerleave',()=>{pointer.x=-1000;lab.style.setProperty('--tilt-x','0deg');lab.style.setProperty('--tilt-y','0deg');});}
 const stageTarget=document.getElementById('stage-label');new MutationObserver(()=>{if(nightPaused)return;const visual=document.querySelector('.visual');visual.classList.remove('stage-changing');void visual.offsetWidth;visual.classList.add('stage-changing');}).observe(stageTarget,{childList:true});
}
if(matchMedia('(hover:hover) and (pointer:fine)').matches){document.querySelectorAll('.question-grid article,.explore-grid a,.evidence-card,.source-stat').forEach(card=>{card.classList.add('spotlight-card');card.addEventListener('pointermove',e=>{if(nightPaused)return;const r=card.getBoundingClientRect();card.style.setProperty('--spot-x',e.clientX-r.left+'px');card.style.setProperty('--spot-y',e.clientY-r.top+'px');},{passive:true});});}
