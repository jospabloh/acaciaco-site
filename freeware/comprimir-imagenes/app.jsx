// Comprimir y Convertir Imágenes — ACACIA freeware.
// 100% en el navegador (Canvas): las imágenes nunca se suben. Bilingüe ES/EN. Acento teal.

const { useState, useEffect, useCallback, useMemo, useRef } = React;

const STRINGS = {
  es: {
    nav_more: "← Más herramientas", lang_label: "Idioma",
    eyebrow: "Herramienta gratis",
    h1: "Comprimir y convertir ", h1b: "imágenes",
    hero_p: "Reduce el peso y cambia el formato de tus imágenes (JPG, PNG, WebP) sin instalar nada y sin perder calidad.",
    privacy_chip: "Tus imágenes nunca se suben: todo ocurre en tu navegador.",
    drop_h: "Arrastra tus imágenes aquí", drop_p: "o haz clic para elegirlas · JPG, PNG, WebP",
    format: "Formato de salida", fmt_auto: "Mantener original", quality: "Calidad", maxw: "Ancho máx. (px)", maxw_hint: "0 = sin cambiar",
    total_saved: "Ahorro total", download_all: "Descargar todas (.zip)", clear: "Limpiar",
    download: "Descargar", remove: "Quitar", saved: "menos", processing: "Procesando…", error: "Error",
    cta_h3: "¿Tu negocio necesita un sitio rápido y bien optimizado?",
    cta_p: "En ACACIA construimos sitios y sistemas a la medida para PyMEs. Hablemos.",
    cta_btn: "Hablar con ACACIA",
    faq_title: "Preguntas frecuentes",
    faq: [
      ["¿Se pierde calidad al comprimir?", "Tú eliges el nivel de calidad. Con un 80% el peso baja mucho y la diferencia es casi imperceptible; para fidelidad total usa PNG o sube la calidad."],
      ["¿WebP, JPG o PNG?", "WebP da el mejor equilibrio peso/calidad para web; JPG es el más compatible para fotos; PNG conserva transparencia, ideal para logos y capturas."],
      ["¿Mis imágenes se suben a internet?", "No. Todo el procesamiento ocurre en tu navegador; las imágenes nunca salen de tu dispositivo."],
    ],
    foot_free: "© 2026 ACACIA · Herramienta gratis", foot_tools: "Herramientas", foot_privacy: "Privacidad", foot_contact: "Contacto", foot_crafted: "hecho con", foot_by: "por",
  },
  en: {
    nav_more: "← More tools", lang_label: "Language",
    eyebrow: "Free tool",
    h1: "Compress & convert ", h1b: "images",
    hero_p: "Shrink the file size and change the format of your images (JPG, PNG, WebP) with no install and no quality loss.",
    privacy_chip: "Your images are never uploaded: everything happens in your browser.",
    drop_h: "Drag your images here", drop_p: "or click to choose them · JPG, PNG, WebP",
    format: "Output format", fmt_auto: "Keep original", quality: "Quality", maxw: "Max width (px)", maxw_hint: "0 = unchanged",
    total_saved: "Total saved", download_all: "Download all (.zip)", clear: "Clear",
    download: "Download", remove: "Remove", saved: "smaller", processing: "Processing…", error: "Error",
    cta_h3: "Does your business need a fast, well-optimized site?",
    cta_p: "At ACACIA we build custom sites and systems for SMBs. Let's talk.",
    cta_btn: "Talk to ACACIA",
    faq_title: "FAQ",
    faq: [
      ["Does compressing lose quality?", "You choose the quality. At 80% the size drops a lot and the difference is barely noticeable; for full fidelity use PNG or raise the quality."],
      ["WebP, JPG or PNG?", "WebP gives the best size/quality balance for the web; JPG is the most compatible for photos; PNG keeps transparency, ideal for logos and screenshots."],
      ["Are my images uploaded?", "No. All processing happens in your browser; images never leave your device."],
    ],
    foot_free: "© 2026 ACACIA · Free tool", foot_tools: "Tools", foot_privacy: "Privacy", foot_contact: "Contact", foot_crafted: "crafted with", foot_by: "by",
  },
};
function makeT(lang) { return (k, v) => { let s = (STRINGS[lang] && STRINGS[lang][k]) != null ? STRINGS[lang][k] : (STRINGS.es[k] != null ? STRINGS.es[k] : k); if (v && typeof s === "string") for (var x in v) s = s.split("{" + x + "}").join(v[x]); return s; }; }
const LangContext = React.createContext("es");
const useT = () => makeT(React.useContext(LangContext));

const uid = () => Math.random().toString(36).slice(2, 9);
function formatBytes(b) { if (b < 1024) return b + " B"; if (b < 1048576) return (b / 1024).toFixed(1) + " KB"; return (b / 1048576).toFixed(2) + " MB"; }
function triggerDownload(blob, filename) { var url = URL.createObjectURL(blob); var a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
function outName(name, type) { var base = name.replace(/\.[^.]+$/, ""); return base + "." + (EXT[type] || "img"); }

async function compressOne(file, fmt, quality, maxDim) {
  const bitmap = await createImageBitmap(file);
  let w = bitmap.width, h = bitmap.height;
  if (maxDim > 0 && Math.max(w, h) > maxDim) { const s = maxDim / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  let type = fmt === "auto" ? (EXT[file.type] ? file.type : "image/jpeg") : "image/" + fmt;
  if (type === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(bitmap, 0, 0, w, h);
  if (bitmap.close) bitmap.close();
  const blob = await new Promise((res) => canvas.toBlob(res, type, type === "image/png" ? undefined : quality));
  return { blob, url: URL.createObjectURL(blob), size: blob.size, w, h, type };
}

function detectLang() { try { var s = localStorage.getItem("acacia-lang"); if (s === "es" || s === "en") return s; } catch (e) {} return "es"; }

function App() {
  const [lang, setLang] = useState(detectLang);
  const t = makeT(lang);

  const [items, setItems] = useState([]);   // {id,file,name,originalSize,origUrl}
  const [results, setResults] = useState({}); // id -> {blob,url,size,w,h,type}|{error}
  const [fmt, setFmt] = useState("auto");
  const [quality, setQuality] = useState(80);
  const [maxDim, setMaxDim] = useState(0);
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { document.documentElement.setAttribute("lang", lang === "en" ? "en" : "es-MX"); try { localStorage.setItem("acacia-lang", lang); } catch (e) {} }, [lang]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out = {};
      for (const it of items) {
        try { out[it.id] = await compressOne(it.file, fmt, quality / 100, maxDim); }
        catch (e) { out[it.id] = { error: true }; }
        if (cancelled) { if (out[it.id] && out[it.id].url) URL.revokeObjectURL(out[it.id].url); return; }
      }
      if (cancelled) { Object.values(out).forEach((r) => r && r.url && URL.revokeObjectURL(r.url)); return; }
      setResults((prev) => { Object.values(prev).forEach((r) => r && r.url && URL.revokeObjectURL(r.url)); return out; });
    })();
    return () => { cancelled = true; };
  }, [items, fmt, quality, maxDim]);

  const addFiles = useCallback((list) => {
    const arr = [...list].filter((f) => f.type && f.type.indexOf("image/") === 0)
      .map((f) => ({ id: uid(), file: f, name: f.name, originalSize: f.size, origUrl: URL.createObjectURL(f) }));
    if (arr.length) setItems((prev) => [...prev, ...arr]);
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => { const it = prev.find((x) => x.id === id); if (it) URL.revokeObjectURL(it.origUrl); return prev.filter((x) => x.id !== id); });
  }, []);
  const clearAll = useCallback(() => { items.forEach((it) => URL.revokeObjectURL(it.origUrl)); setItems([]); }, [items]);

  const onDrop = (e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files) addFiles(e.dataTransfer.files); };

  const totals = useMemo(() => {
    let o = 0, c = 0, n = 0;
    items.forEach((it) => { const r = results[it.id]; if (r && !r.error) { o += it.originalSize; c += r.size; n++; } });
    return { o, c, n, pct: o > 0 ? Math.round((1 - c / o) * 100) : 0 };
  }, [items, results]);

  const downloadOne = (it) => { const r = results[it.id]; if (r && !r.error) triggerDownload(r.blob, outName(it.name, r.type)); };
  const downloadZip = async () => {
    if (!window.JSZip) return;
    const zip = new window.JSZip();
    items.forEach((it) => { const r = results[it.id]; if (r && !r.error) zip.file(outName(it.name, r.type), r.blob); });
    const blob = await zip.generateAsync({ type: "blob" });
    triggerDownload(blob, "imagenes-comprimidas.zip");
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
            </div>
          </div>

          <header className="hero">
            <span className="eyebrow"><span className="dot" aria-hidden="true"></span> {t("eyebrow")}</span>
            <h1>{t("h1")}<span style={{ color: "var(--accent-2)" }}>{t("h1b")}</span></h1>
            <p>{t("hero_p")}</p>
            <span className="privacy-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>{t("privacy_chip")}</span>
          </header>

          <div className={"drop" + (over ? " over" : "")} onClick={() => inputRef.current && inputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <h2>{t("drop_h")}</h2><p>{t("drop_p")}</p>
            <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => addFiles(e.target.files)} />
          </div>

          {items.length > 0 && (
            <React.Fragment>
              <div className="controls">
                <div className="field">
                  <label>{t("format")}</label>
                  <select value={fmt} onChange={(e) => setFmt(e.target.value)}>
                    <option value="auto">{t("fmt_auto")}</option>
                    <option value="webp">WebP</option><option value="jpeg">JPG</option><option value="png">PNG</option>
                  </select>
                </div>
                <div className="field">
                  <label>{t("quality")} <span className="range-val">{quality}%</span></label>
                  <input type="range" min="10" max="100" value={quality} onChange={(e) => setQuality(parseInt(e.target.value))} disabled={fmt === "png"} />
                </div>
                <div className="field">
                  <label>{t("maxw")} <span className="hint">· {t("maxw_hint")}</span></label>
                  <input type="number" min="0" step="100" value={maxDim} onChange={(e) => setMaxDim(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
              </div>

              <div className="bar">
                <span className="total">{t("total_saved")}: <strong className="saved">{totals.pct}%</strong> · {formatBytes(totals.o)} → {formatBytes(totals.c)}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary" onClick={downloadZip} disabled={totals.n === 0}>{t("download_all")}</button>
                  <button className="btn" onClick={clearAll}>{t("clear")}</button>
                </div>
              </div>

              <div className="items">
                {items.map((it) => {
                  const r = results[it.id];
                  return (
                    <div className="item" key={it.id}>
                      <img className="thumb" src={it.origUrl} alt="" />
                      <div className="item-body">
                        <div className="item-name">{it.name}</div>
                        <div className="item-meta mono">
                          {!r ? t("processing") : r.error ? t("error") : (
                            <React.Fragment>{formatBytes(it.originalSize)} → {formatBytes(r.size)} · <span className="saved">{Math.max(0, Math.round((1 - r.size / it.originalSize) * 100))}% {t("saved")}</span> · {r.w}×{r.h}</React.Fragment>
                          )}
                        </div>
                      </div>
                      <div className="item-actions">
                        <button className="btn btn-primary" onClick={() => downloadOne(it)} disabled={!r || r.error}>{t("download")}</button>
                        <button className="btn iconbtn" onClick={() => removeItem(it.id)} aria-label={t("remove")}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
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
