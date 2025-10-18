const APP_VERSION = (document.querySelector('[name="app-version"]') || {}).content || "2025.10.17-65";

// === Version badge
(function () {
  try {
    const m = document.querySelector('meta[name="app-version"]');
    if (m) {
      const v = m.getAttribute('content') || '';
      const span = document.getElementById('v');
      if (span) span.textContent = v;
    }
  } catch(e) { console && console.warn && console.warn('version badge', e); }
})();

// === Helpers
function $(id){ return document.getElementById(id); }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function todayFR(){
  const d = new Date(), p=n=>n.toString().padStart(2,'0');
  return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()}`;
}
function normalizeSegment(seg){
  seg = (seg||'').toLowerCase();
  if (seg === 'moderne') return 'modern';
  if (seg === 'historique' || seg === 'rurale') return seg;
  return 'historique';
}
function validate(){
  const missing = [];
  if(!$('segment').value) missing.push('Segment');
  if(!$('nom').value.trim()) missing.push('Nom');
  if(!$('adresse').value.trim()) missing.push('Adresse');
  if(!$('cp').value.trim()) missing.push('CP');
  if(!$('ville').value.trim()) missing.push('Ville');
  if(missing.length){ alert('Champs obligatoires : ' + missing.join(', ')); return false; }
  return true;
}
function collect(){
  const rawSeg   = $('segment').value;            // moderne | historique | rurale (valeur UI)
  const segClass = normalizeSegment(rawSeg);      // 'modern' | 'historique' | 'rurale' (classe CSS)
  try { localStorage.setItem('mag-segment', segClass); } catch{}
  return { APP_VERSION: APP_VERSION, SEGMENT: rawSeg,
    SEGMENT_CLASS: segClass,                      // <<< utilisÃ© par lâ€™enveloppe
    CIVILITE: $('civilite').value || '',
    NOM: $('nom').value.trim(),
    PRENOM: $('prenom').value.trim(),
    ADRESSE_HTML: escapeHtml($('adresse').value).replace(/\r?\n/g,'<br>'),
    CP: $('cp').value.trim(),
    VILLE: $('ville').value.trim(),
    DATE: $('date').value.trim() || todayFR()
  };
}
function applyTokens(html, t){
  return html
    .replaceAll('{SEGMENT_CLASS}', t.SEGMENT_CLASS)
    .replaceAll('{APP_VERSION}', t.APP_VERSION) // <<< nouvelle variable
    .replaceAll('{CIVILITE}', t.CIVILITE)
    .replaceAll('{NOM}',      t.NOM)
    .replaceAll('{PRENOM}',   t.PRENOM)
    .replaceAll('{ADRESSE}',  t.ADRESSE_HTML)
    .replaceAll('{CP}',       t.CP)
    .replaceAll('{VILLE}',    t.VILLE)
    .replaceAll('{DATE}',     t.DATE);
}
async function openAndPrint(url, tokens){
  // 1) Charger le modèle et injecter les tokens
  const res = await fetch(url, {cache:'no-store'});
  if(!res.ok){ alert('Impossible de charger le modèle : ' + url); return; }
  let html = await res.text();
  html = applyTokens(html, tokens);

  // 2) Injecter un script "print on load" (léger, cross-platform)
  const PRINT_SNIPPET = `<script>(function(){function go(){try{window.focus();setTimeout(function(){window.print()},120);}catch(e){}}if(document.readyState!=="complete"){window.addEventListener("load",go);}else{go();}})();<\/script>`;
  if (!/window\.print\(/.test(html)) {
    html = html.replace('</body>', PRINT_SNIPPET + '</body>');
  }

  // 3) Créer un Blob HTML et ouvrir une URL blob: (évite about:blank/document.write)
  const blob = new Blob([html], {type: 'text/html'});
  const blobURL = URL.createObjectURL(blob);

  // 4) Tenter une nouvelle fenêtre; si bloquée sur mobile, basculer l’onglet courant
  let win = null;
  try { win = window.open(blobURL, '_blank'); } catch(e){}
  if (!win) {
    // Mobile: naviguer dans l’onglet courant (URL réelle blob:) -> partage/print OK
    location.href = blobURL;
    // Révoquer l’URL un peu plus tard (après impression)
    setTimeout(()=>{ try{ URL.revokeObjectURL(blobURL); }catch(e){} }, 15000);
    return;
  }

  // 5) Desktop: fenêtre ouverte -> impression auto au onload via script injecté
  try {
    win.addEventListener('unload', ()=>{ try{ URL.revokeObjectURL(blobURL); }catch(e){} }, {once:true});
  } catch(e){}
}

  let html = await res.text();
  html = applyTokens(html, tokens);

  const win = window.open('', '_blank');
  if(!win){ alert("Le navigateur a bloquÃ© l'ouverture de la fenÃªtre d'impression."); return; }
  win.document.open('text/html','replace');
  win.document.write(html);
  win.document.close();
  win.onload = () => setTimeout(()=>{ try{win.focus(); win.print();}catch{} }, 150);
}

// === Bouton LETTRE
$('btnLettre').addEventListener('click', async ()=>{
  if(!validate()) return;
  const t = collect();
  const map = {
    moderne:    'letter_moderne.html',
    historique: 'letter_historique.html',
    rurale:     'letter_rurale.html'
  };
  await openAndPrint(map[t.SEGMENT], t);
});

// === Bouton ENVELOPPE (la classe est injectÃ©e via {SEGMENT_CLASS})
$('btnEnveloppe').addEventListener('click', async ()=>{
  if(!validate()) return;
  const t = collect();
  await openAndPrint('envelope_a4.html', t);
});

$('btnEnvDL').addEventListener('click', async ()=>{
  if(!validate()) return;
  const t = collect();
  await openAndPrint('print/envelope_dl_android.html', t);
});

// === SW auto-update
window.addEventListener("load", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) {
        reg.update().catch(()=>{});
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!window.__reloadedOnce) {
            window.__reloadedOnce = true;
            window.location.reload();
          }
        });
      }
    });
  }
});

// === PrÃ©remplissage de la date (si vide)
(function(){
  try{
    var el = document.getElementById('date') || document.querySelector('input[name="date"]');
    if(el && !el.value){
      var d = new Date(), pad=(n)=> (n<10?'0':'')+n;
      el.value = pad(d.getDate()) + '/' + pad(d.getMonth()+1) + '/' + d.getFullYear();
    }
  }catch(e){}
})();

