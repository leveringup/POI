// Read before the first paint; storage may be unavailable in private browsing.
try{document.documentElement.dataset.theme=localStorage.getItem('poi-theme')==='minimal'?'minimal':'night';}catch(_){document.documentElement.dataset.theme='night';}
