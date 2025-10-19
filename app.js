// app.js — HTML print (Lettre/A4) + PDF pour DL Android

const APP_VERSION =
  (document.querySelector('[name="app-version"]') || {}).content ||
  "2025.10.19-01";

/* === Helpers ============================================================= */
function $(id) { return document.getElementById(id); }
function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}
function todayFR() {
  const d = new Date(), p = n => n.toString().padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function normalizeSegment(seg) {
  seg = (seg || "").toLowerCase();
  if (seg === "moderne") return "modern";
  if (seg === "historique" || seg === "rurale") return seg;
  return "historique";
}
function validate() {
  const missing = [];
  if (!$("segment").value) missing.push("Segment");
  if (!$("nom").value.trim()) missing.push("Nom");
  if (!$("adresse").value.trim()) missing.push("Adresse");
  if (!$("cp").value.trim()) missing.push("CP");
  if (!$("ville").value.trim()) missing.push("Ville");
  if (missing.length) { alert("Champs obligatoires : " + missing.join(", ")); return false; }
  return true;
}
function collect() {
  const rawSeg = $("segment").value;
  const segClass = normalizeSegment(rawSeg);
  try { localStorage.setItem("mag-segment", segClass); } catch {}
  return {
    APP_VERSION,
    SEGMENT: rawSeg,
    SEGMENT_CLASS: segClass,
    CIVILITE: $("civilite").value || "",
    NOM: $("nom").value.trim(),
    PRENOM: $("prenom").value.trim(),
    ADRESSE_HTML: escapeHtml($("adresse").value).replace(/\r?\n/g, "<br>"),
    CP: $("cp").value.trim(),
    VILLE: $("ville").value.trim(),
    DATE: $("date").value.trim() || todayFR()
  };
}
function applyTokens(html, t) {
  return html
    .replaceAll("{SEGMENT_CLASS}", t.SEGMENT_CLASS)
    .replaceAll("{APP_VERSION}", t.APP_VERSION)
    .replaceAll("{CIVILITE}", t.CIVILITE)
    .replaceAll("{NOM}", t.NOM)
    .replaceAll("{PRENOM}", t.PRENOM)
    .replaceAll("{ADRESSE}", t.ADRESSE_HTML)
    .replaceAll("{CP}", t.CP)
    .replaceAll("{VILLE}", t.VILLE)
    .replaceAll("{DATE}", t.DATE);
}

/* Resolves href against base (for CSS links in template) */
function resolveUrl(base, href) {
  try { return new URL(href, base).href; } catch { return href; }
}

/* === Impression HTML (Lettre + A4 paysage) ============================== */
async function openAndPrintHTML(url, tokens) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) { alert("Impossible de charger le modèle : " + url); return; }
  let html = applyTokens(await res.text(), tokens);

  const PRINT_SNIPPET =
    `<script>(function(){function go(){try{window.focus();setTimeout(function(){window.print()},120);}catch(e){}}` +
    `if(document.readyState!=="complete"){window.addEventListener("load",go);}else{go();}})();<\/script>`;
  if (!/window\.print\(/.test(html)) {
    html = html.replace("</body>", PRINT_SNIPPET + "</body>");
  }

  const blob = new Blob([html], { type: "text/html" });
  const blobURL = URL.createObjectURL(blob);

  let win = null;
  try { win = window.open(blobURL, "_blank"); } catch {}
  if (!win) {
    location.href = blobURL; // mobile fallback
    setTimeout(() => { try { URL.revokeObjectURL(blobURL); } catch {} }, 15000);
    return;
  }
  try {
    win.addEventListener("unload", () => { try { URL.revokeObjectURL(blobURL); } catch {} }, { once: true });
  } catch {}
}

/* === PDF pour l’enveloppe DL Android ==================================== */
async function openAsPDF(templateUrl, tokens) {
  if (!window.html2pdf) {
    alert("Le module PDF (html2pdf) n'a pas été chargé.");
    return;
  }

  // 1) Charger le modèle
  const res = await fetch(templateUrl, { cache: "no-store" });
  if (!res.ok) { alert("Impossible de charger le modèle : " + templateUrl); return; }
  const raw = applyTokens(await res.text(), tokens);

  // 2) Parser le HTML pour récupérer <body> + <link rel="stylesheet">
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "text/html");

  const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"][href]'))
                      .map(l => resolveUrl(templateUrl, l.getAttribute('href')));

  // 3) Télécharger les CSS et les inline dans un <style>
  let cssText = "";
  try {
    const parts = await Promise.all(links.map(href => fetch(href, { cache: "no-store" }).then(r => r.ok ? r.text() : "")));
    cssText = parts.join("\n\n");
  } catch {}

  // 4) Conteneur invisible avec le <style> et le contenu du <body> du modèle
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-10000px;top:0;width:220mm;height:110mm;background:#fff;";
  const style = document.createElement("style");
  style.textContent = cssText;
  holder.appendChild(style);

  // Important: on prend seulement le contenu du body (pas <html> / <head>)
  const inner = document.createElement("div");
  inner.innerHTML = doc.body ? doc.body.innerHTML : raw;
  holder.appendChild(inner);

  document.body.appendChild(holder);

  // 5) Générer le PDF (DL 220×110 mm = paysage)
  const opt = {
    margin:      0,
    filename:    "enveloppe-dl.pdf",
    image:       { type: "jpeg", quality: 1 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
    jsPDF:       { unit: "mm", format: [110, 220], orientation: "landscape" }
  };

  try {
    const worker = html2pdf().set(opt).from(holder).toPdf();
    const pdf = await worker.get("pdf");
    const blob = pdf.output("blob");
    const blobURL = URL.createObjectURL(blob);

    let w = null;
    try { w = window.open(blobURL, "_blank"); } catch {}
    if (!w) location.href = blobURL;

    setTimeout(() => { try { URL.revokeObjectURL(blobURL); } catch {} }, 30000);
  } catch (e) {
    console.warn("PDF error", e);
    alert("Impossible de générer le PDF.");
  } finally {
    document.body.removeChild(holder);
  }
}

/* === Listeners ========================================================== */
document.addEventListener("DOMContentLoaded", () => {
  // Lettre
  $("btnLettre")?.addEventListener("click", async () => {
    if (!validate()) return;
    const t = collect();
    const map = {
      moderne: "letter_moderne.html",
      historique: "letter_historique.html",
      rurale: "letter_rurale.html"
    };
    await openAndPrintHTML(map[t.SEGMENT], t);
  });

  // Enveloppe A4 paysage
  $("btnEnveloppe")?.addEventListener("click", async () => {
    if (!validate()) return;
    const t = collect();
    await openAndPrintHTML("envelope_a4.html", t);
  });

  // Enveloppe DL réel (Android) → PDF
  $("btnEnvDL")?.addEventListener("click", async () => {
    if (!validate()) return;
    const t = collect();
    await openAsPDF("print/envelope_dl_android.html?v=" + Date.now(), t);
  });

  // Préremplissage de la date si vide
  try {
    const el = document.getElementById("date") || document.querySelector('input[name="date"]');
    if (el && !el.value) el.value = todayFR();
  } catch {}
});
