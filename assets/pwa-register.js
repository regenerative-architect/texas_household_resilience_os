(function(){
'use strict';
async function register(){
  const status=()=>document.getElementById('pwaStatus');
  if(!('serviceWorker'in navigator)){if(status())status().textContent='Service workers are not supported in this browser.';return}
  if(location.protocol==='file:'){if(status())status().textContent='Opened with file:// — core local tools work, but PWA service-worker caching requires HTTPS or localhost.';return}
  try{
    const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
    if(status())status().textContent=`Service worker registered. Scope: ${reg.scope}${navigator.serviceWorker.controller?' · app is currently controlled':' · reload once after first install to enter controlled mode'}.`;
    reg.addEventListener('updatefound',()=>{const w=reg.installing;if(w)w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller){const s=status();if(s)s.textContent='A newer offline shell is installed. Reload when convenient to activate it.'}})});
  }catch(e){if(status())status().textContent=`PWA registration failed: ${e.message}`}
}
window.addEventListener('load',register);
})();
