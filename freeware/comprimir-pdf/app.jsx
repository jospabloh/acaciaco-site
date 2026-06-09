// Comprimir PDF — ACACIA freeware.
// 100% en el navegador: rasteriza cada página con PDF.js y reconstruye con pdf-lib.
// Los documentos nunca se suben. Bilingüe ES/EN. Acento violeta.

const { useState, useEffect, useCallback, useMemo, useRef } = React;

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
}

const STRINGS = {
  es: {
    nav_more: "← Más herramientas", theme_label: "Cambiar tema", lang_label: "Idioma", eyebrow: "Herramienta gratis",
    nav_merge: "Unir", nav_compress: "Comprimir",
    h1: "Comprimir ", h1b: "PDF",
    hero_p: "Reduce el tamaño de tus PDF para enviarlos por correo, manteniendo buena calidad. Sin registro, sin marcas de agua y sin subir tus documentos.",
    privacy_chip: "Se comprime en tu navegador: tus PDF nunca se suben.",
    drop_h: "Arrastra tus archivos PDF aquí", drop_p: "o haz clic para elegirlos",
    q_alta: "Alta calidad", q_alta_d: "menor reducción, se ve nítido",
    q_media: "Equilibrada", q_media_d: "buen balance peso/calidad",
    q_baja: "Máxima reducción", q_baja_d: "el archivo más ligero",
    compress: "Comprimir", working: "Comprimiendo…", clear: "Limpiar",
    download: "Descargar", download_all: "Descargar todos (.zip)", remove: "Quitar",
    saved: "menos", grew: "ya estaba optimizado", err: "No se pudo procesar",
    cta_h3: "¿Tu empresa maneja muchos documentos?",
    cta_p: "En ACACIA digitalizamos y automatizamos procesos documentales para PyMEs. Hablemos.",
    cta_btn: "Hablar con ACACIA",
    disclaimer: "La compresión rasteriza las páginas (re-encodea las imágenes), por eso el PDF resultante no conserva el texto seleccionable. Funciona mejor con documentos escaneados o con muchas imágenes.",
    faq_title: "Preguntas frecuentes",
    faq: [
      ["¿Cómo comprimir un PDF para correo?", "Arrastra tu PDF, elige el nivel y descárgalo más ligero. Ideal cuando supera el límite de adjuntos del correo."],
      ["¿Se pierde calidad?", "Se ajusta la resolución de las imágenes. Con 'Alta calidad' la diferencia es mínima. Funciona mejor con PDF escaneados o con imágenes."],
      ["¿Mis documentos se suben?", "No. Todo ocurre en tu navegador; los archivos nunca salen de tu dispositivo."],
    ],
    foot_free: "© 2026 ACACIA · Herramienta gratis", foot_tools: "Herramientas", foot_privacy: "Privacidad", foot_contact: "Contacto", foot_crafted: "hecho con", foot_by: "por",
  },
  en: {
    nav_more: "← More tools", theme_label: "Toggle theme", lang_label: "Language", eyebrow: "Free tool",
    nav_merge: "Merge", nav_compress: "Compress",
    h1: "Compress ", h1b: "PDF",
    hero_p: "Shrink your PDFs to email them, keeping good quality. No sign-up, no watermark, and your documents are never uploaded.",
    privacy_chip: "Compressed in your browser: your PDFs are never uploaded.",
    drop_h: "Drag your PDF files here", drop_p: "or click to choose them",
    q_alta: "High quality", q_alta_d: "smaller reduction, stays sharp",
    q_media: "Balanced", q_media_d: "good size/quality balance",
    q_baja: "Max reduction", q_baja_d: "the lightest file",
    compress: "Compress", working: "Compressing…", clear: "Clear",
    download: "Download", download_all: "Download all (.zip)", remove: "Remove",
    saved: "smaller", grew: "already optimized", err: "Couldn't process",
    cta_h3: "Does your company handle lots of documents?",
    cta_p: "At ACACIA we digitize and automate document processes for SMBs. Let's talk.",
    cta_btn: "Talk to ACACIA",
    disclaimer: "Compression rasterizes the pages (re-encodes images), so the resulting PDF won't keep selectable text. It works best with scanned or image-heavy documents.",
    faq_title: "FAQ",
    faq: [
      ["How to compress a PDF for email?", "Drag your PDF, pick a level and download it lighter. Ideal when it exceeds the email attachment limit."],
      ["Does it lose quality?", "It adjusts image resolution. With 'High quality' the difference is minimal. Works best with scanned or image-heavy PDFs."],
      ["Are my documents uploaded?", "No. Everything happens in your browser; files never leave your device."],
    ],
    foot_free: "© 2026 ACACIA · Free tool", foot_tools: "Tools", foot_privacy: "Privacy", foot_contact: "Contact", foot_crafted: "crafted with", foot_by: "by",
  },
};
function makeT(lang) { return (k, v) => { let s = (STRINGS[lang] && STRINGS[lang][k]) != null ? STRINGS[lang][k] : (STRINGS.es[k] != null ? STRINGS.es[k] : k); if (v && typeof s === "string") for (var x in v) s = s.split("{" + x + "}").join(v[x]); return s; }; }
const LangContext = React.createContext("es");

const uid = () => Math.random().toString(36).slice(2, 9);
function formatBytes(b) { if (b < 1024) return b + " B"; if (b < 1048576) return (b / 1024).toFixed(1) + " KB"; return (b / 1048576).toFixed(2) + " MB"; }
function triggerDownload(blob, filename) { var url = URL.createObjectURL(blob); var a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
const QUALITY = { alta: { dpi: 150, q: 0.82 }, media: { dpi: 120, q: 0.65 }, baja: { dpi: 96, q: 0.5 } };
function detectLang() { try { var s = localStorage.getItem("acacia-lang"); if (s === "es" || s === "en") return s; } catch (e) {} return (navigator.language || "es").toLowerCase().indexOf("en") === 0 ? "en" : "es"; }

async function compressPdf(file, preset) {
  const { dpi, q } = QUALITY[preset];
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const out = await PDFLib.PDFDocument.create();
  const scale = dpi / 72;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp1 = page.getViewport({ scale: 1 });       // puntos (tamaño real de página)
    const vp = page.getViewport({ scale });           // render a mayor resolución
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(vp.width));
    canvas.height = Math.max(1, Math.floor(vp.height));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", q));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const img = await out.embedJpg(bytes);
    const p = out.addPage([vp1.width, vp1.height]);
    p.drawImage(img, { x: 0, y: 0, width: vp1.width, height: vp1.height });
    canvas.width = canvas.height = 0; // libera memoria
  }
  const outBytes = await out.save();
  return new Blob([outBytes], { type: "application/pdf" });
}

function App() {
  const [lang, setLang] = useState(detectLang);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("acacia-theme") || "light"; } catch (e) { return "light"; } });
  const t = makeT(lang);

  const [items, setItems] = useState([]); // {id,file,name,originalSize, result:{blob,size}|null, status:'idle'|'done'|'error'}
  const [preset, setPreset] = useState("alta");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); try { localStorage.setItem("acacia-theme", theme); } catch (e) {} }, [theme]);
  useEffect(() => { document.documentElement.setAttribute("lang", lang); try { localStorage.setItem("acacia-lang", lang); } catch (e) {} }, [lang]);

  const addFiles = useCallback((list) => {
    const pdfs = [...list].filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name))
      .map((f) => ({ id: uid(), file: f, name: f.name, originalSize: f.size, result: null, status: "idle" }));
    if (pdfs.length) setItems((prev) => [...prev, ...pdfs]);
  }, []);
  const removeItem = (id) => setItems((prev) => prev.filter((x) => x.id !== id));
  const clearAll = () => setItems([]);
  const onDrop = (e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files) addFiles(e.dataTransfer.files); };

  const run = async () => {
    if (busy || !items.length) return;
    setBusy(true);
    for (const it of items) {
      try {
        const blob = await compressPdf(it.file, preset);
        setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, result: { blob, size: blob.size }, status: "done" } : x));
      } catch (e) {
        setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, status: "error" } : x));
      }
    }
    setBusy(false);
  };

  const totals = useMemo(() => {
    let o = 0, c = 0, n = 0;
    items.forEach((it) => { if (it.result) { o += it.originalSize; c += it.result.size; n++; } });
    return { o, c, n, pct: o > 0 ? Math.round((1 - c / o) * 100) : 0 };
  }, [items]);

  const dlName = (name) => name.replace(/\.pdf$/i, "") + "-comprimido.pdf";
  const downloadOne = (it) => { if (it.result) triggerDownload(it.result.blob, dlName(it.name)); };
  const downloadZip = async () => {
    if (!window.JSZip) return;
    const zip = new window.JSZip();
    items.forEach((it) => { if (it.result) zip.file(dlName(it.name), it.result.blob); });
    triggerDownload(await zip.generateAsync({ type: "blob" }), "pdf-comprimidos.zip");
  };

  return (
    <LangContext.Provider value={lang}>
      <div className="app">
        <div className="wrap">
          <div className="topbar">
            <a className="brand" href="/" aria-label="ACACIA inicio"><img src="/assets/acacia-logo.jpg" alt="ACACIA" width="28" height="28" /> ACACIA</a>
            <div className="topbar-actions">
              <a className="ghost-link" href="/freeware">{t("nav_more")}</a>
              <div className="lang-seg" role="group" aria-label={t("lang_label")}>
                <button type="button" aria-pressed={lang === "es"} onClick={() => setLang("es")}>ES</button>
                <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
              </div>
              <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={t("theme_label")}>
                <svg className="moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                <svg className="sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              </button>
            </div>
          </div>

          <header className="hero">
            <span className="eyebrow"><span className="dot" aria-hidden="true"></span> {t("eyebrow")}</span>
            <h1>{t("h1")}<span style={{ color: "var(--accent-2)" }}>{t("h1b")}</span></h1>
            <p>{t("hero_p")}</p>
            <nav className="pdfnav" aria-label="PDF">
              <a href="/freeware/unir-pdf">{t("nav_merge")}</a>
              <a href="/freeware/comprimir-pdf" aria-current="true">{t("nav_compress")}</a>
            </nav>
            <div><span className="privacy-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>{t("privacy_chip")}</span></div>
          </header>

          <div className={"drop" + (over ? " over" : "")} onClick={() => inputRef.current && inputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <h2>{t("drop_h")}</h2><p>{t("drop_p")}</p>
            <input ref={inputRef} type="file" accept="application/pdf" multiple style={{ display: "none" }} onChange={(e) => addFiles(e.target.files)} />
          </div>

          {items.length > 0 && (
            <React.Fragment>
              <div className="quality" role="group" aria-label="Calidad">
                {["alta", "media", "baja"].map((k) => (
                  <button key={k} type="button" className="ql" aria-pressed={preset === k} onClick={() => setPreset(k)}>
                    <b>{t("q_" + k)}</b><span>{t("q_" + k + "_d")}</span>
                  </button>
                ))}
              </div>

              <div className="items">
                {items.map((it) => (
                  <div className="item" key={it.id}>
                    <div className="pdf-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                    <div className="item-body">
                      <div className="item-name">{it.name}</div>
                      <div className={"item-meta mono" + (it.status === "error" ? " err" : "")}>
                        {it.status === "error" ? t("err")
                          : it.result ? (() => { const pct = Math.round((1 - it.result.size / it.originalSize) * 100); return <React.Fragment>{formatBytes(it.originalSize)} → {formatBytes(it.result.size)} · {pct > 0 ? <span className="saved">{pct}% {t("saved")}</span> : t("grew")}</React.Fragment>; })()
                            : formatBytes(it.originalSize)}
                      </div>
                    </div>
                    <div className="item-actions">
                      {it.result && <button className="btn btn-primary" onClick={() => downloadOne(it)}>{t("download")}</button>}
                      <button className="btn iconbtn" onClick={() => removeItem(it.id)} aria-label={t("remove")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bar">
                <span className="total mono">{totals.n > 0 ? <React.Fragment>{t("saved")}: <strong className="saved">{totals.pct}%</strong> · {formatBytes(totals.o)} → {formatBytes(totals.c)}</React.Fragment> : ""}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  {totals.n > 1 && <button className="btn" onClick={downloadZip}>{t("download_all")}</button>}
                  <button className="btn btn-primary" onClick={run} disabled={busy}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4"/><path d="M15 3h4a2 2 0 0 1 2 2v4"/><path d="M9 21H5a2 2 0 0 1-2-2v-4"/><path d="M15 21h4a2 2 0 0 0 2-2v-4"/></svg>
                    {busy ? t("working") : t("compress")}
                  </button>
                  <button className="btn" onClick={clearAll} disabled={busy}>{t("clear")}</button>
                </div>
              </div>
              <p className="disclaimer">{t("disclaimer")}</p>
            </React.Fragment>
          )}

          <div className="cta"><h3>{t("cta_h3")}</h3><p>{t("cta_p")}</p><a className="btn btn-primary" style={{ display: "inline-flex" }} href="/contacto">{t("cta_btn")}</a></div>

          <div style={{ marginTop: 8 }}>
            <h2 className="section-title">{t("faq_title")}</h2>
            {t("faq").map(([q, a], i) => <details key={i}><summary>{q}</summary><p>{a}</p></details>)}
          </div>

          <footer className="foot">
            <span>{t("foot_free")}</span>
            <span className="foot-credit">{t("foot_crafted")} <span className="foot-heart" aria-label="love">♥</span> {t("foot_by")} <a className="foot-link" href="https://acaciaco.com.mx" target="_blank" rel="noopener noreferrer">ACACIA Consultoría</a></span>
            <span><a href="/freeware">{t("foot_tools")}</a> · <a href="/legal/privacidad">{t("foot_privacy")}</a> · <a href="/contacto">{t("foot_contact")}</a></span>
          </footer>
        </div>
      </div>
    </LangContext.Provider>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
