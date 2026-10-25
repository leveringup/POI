(()=>{
 const root=document.documentElement;
 const controls=document.createElement('div');controls.className='theme-picker';
 controls.innerHTML='<label><span class="theme-symbol" aria-hidden="true">◐</span><span class="visually-hidden">ธีมเว็บไซต์</span><select aria-label="ธีมเว็บไซต์"><option value="night">โหมดมืด</option><option value="minimal">โหมดสว่าง</option></select></label>';
 const target=document.querySelector('.header-meta')||document.querySelector('header nav');
 if(target)target.prepend(controls);
 const select=controls.querySelector('select');
 function applyTheme(value,remember=false){
  const theme=value==='minimal'?'minimal':'night';root.dataset.theme=theme;
  if(document.body.classList.contains('color-story'))document.body.classList.toggle('dark-mode',theme==='night');
  select.value=theme;
  if(remember)try{localStorage.setItem('poi-theme',theme);}catch(_){}
  const palette=theme==='minimal'?{text:'#40594a',grid:'#dde4df',center:'#243e34',sub:'#526b59'}:{text:'#7892b2',grid:'#23334a',center:'#d0def3',sub:'#5a7d9e'};
  if(window.Chart){Chart.defaults.color=palette.text;Chart.defaults.borderColor=palette.grid;Object.values(Chart.instances).forEach(chart=>{if(chart.options.scales)Object.values(chart.options.scales).forEach(axis=>{if(axis.ticks)axis.ticks.color=palette.text;if(axis.grid)axis.grid.color=palette.grid;});if(chart.options.plugins?.legend?.labels)chart.options.plugins.legend.labels.color=palette.text;if(chart.canvas.id==='sourceChart')chart.data.datasets.forEach(ds=>ds.borderColor=theme==='minimal'?'#ffffff':'#101927');chart.update('none');});}
  document.dispatchEvent(new CustomEvent('poi-theme-change',{detail:{theme}}));
 }
 select.addEventListener('change',()=>applyTheme(select.value,true));
 addEventListener('storage',event=>{if(event.key==='poi-theme')applyTheme(event.newValue);});
 applyTheme(root.dataset.theme);
})();
