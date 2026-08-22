// Unir PDF — ACACIA freeware.
// 100% en el navegador (pdf-lib): los documentos nunca se suben. Bilingüe ES/EN. Acento violeta.

const { useState, useEffect, useCallback, useMemo, useRef } = React;

const STRINGS = {
  es: {
    nav_more: "← Más herramientas", lang_label: "Idioma",
    nav_merge: "Unir", nav_compress: "Comprimir", nav_split: "Dividir", nav_p2j: "PDF a JPG", nav_j2p: "JPG a PDF",
    eyebrow: "Herramienta gratis",
    h1: "Unir ", h1b: "PDF",
    hero_p: "Combina, ordena y junta varios archivos PDF en uno solo. Sin instalar, sin marcas de agua y sin subir tus documentos.",
    privacy_chip: "La unión ocurre en tu navegador: tus PDF nunca se suben.",
    drop_h: "Arrastra tus archivos PDF aquí", drop_p: "o haz clic para elegirlos",
    pages: "págs", merge: "Unir PDF", clear: "Limpiar", working: "Uniendo…",
    up: "Subir", down: "Bajar", remove: "Quitar",
    count: "{n} archivo(s) · {p} páginas", err_read: "No se pudo leer (¿protegido?)",
    cta_h3: "¿Tu empresa maneja muchos documentos y procesos?",
    cta_p: "En ACACIA digitalizamos y automatizamos procesos para PyMEs. Hablemos.",
    cta_btn: "Hablar con ACACIA",
    faq_title: "Preguntas frecuentes",
    faq: [
      ["¿Cómo unir varios PDF en uno?", "Arrastra tus PDF, ordénalos con las flechas y pulsa Unir PDF. Se combinan en un solo documento que descargas al instante."],
      ["¿Tiene marca de agua o límite?", "No. El PDF resultante no lleva marca de agua y no hay límite de archivos ni de páginas."],
      ["¿Mis documentos se suben a internet?", "No. La unión se hace por completo en tu navegador; tus archivos nunca salen de tu dispositivo."],
    ],
    foot_free: "© 2026 ACACIA · Herramienta gratis", foot_tools: "Herramientas", foot_privacy: "Privacidad", foot_contact: "Contacto", foot_crafted: "hecho con", foot_by: "por",
  },
  en: {
    nav_more: "← More tools", lang_label: "Language",
    nav_merge: "Merge", nav_compress: "Compress", nav_split: "Split", nav_p2j: "PDF to JPG", nav_j2p: "JPG to PDF",
    eyebrow: "Free tool",
    h1: "Merge ", h1b: "PDF",
    hero_p: "Combine, reorder and join several PDF files into one. No install, no watermark, and your documents are never uploaded.",
    privacy_chip: "Merging happens in your browser: your PDFs are never uploaded.",
    drop_h: "Drag your PDF files here", drop_p: "or click to choose them",
    pages: "pages", merge: "Merge PDF", clear: "Clear", working: "Merging…",
    up: "Up", down: "Down", remove: "Remove",
    count: "{n} file(s) · {p} pages", err_read: "Couldn't read (protected?)",
    cta_h3: "Does your company handle lots of documents and processes?",
    cta_p: "At ACACIA we digitize and automate processes for SMBs. Let's talk.",
    cta_btn: "Talk to ACACIA",
    faq_title: "FAQ",
    faq: [
      ["How do I merge several PDFs into one?", "Drag your PDFs, reorder them with the arrows and press Merge PDF. They combine into a single document you download instantly."],
      ["Is there a watermark or limit?", "No. The resulting PDF has no watermark and there's no limit on files or pages."],
      ["Are my documents uploaded?", "No. Merging happens entirely in your browser; your files never leave your device."],
    ],
    foot_free: "© 2026 ACACIA · Free tool", foot_tools: "Tools", foot_privacy: "Privacy", foot_contact: "Contact", foot_crafted: "crafted with", foot_by: "by",
  },
};
function makeT(lang) { return (k, v) => { let s = (STRINGS[lang] && STRINGS[lang][k]) != null ? STRINGS[lang][k] : (STRINGS.es[k] != null ? STRINGS.es[k] : k); if (v && typeof s === "string") for (var x in v) s = s.split("{" + x + "}").join(v[x]); return s; }; }
const LangContext = React.createContext("es");

const uid = () => Math.random().toString(36).slice(2, 9);
function triggerDownload(blob, filename) { var url = URL.createObjectURL(blob); var a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
function detectLang() { try { var s = localStorage.getItem("acacia-lang"); if (s === "es" || s === "en") return s; } catch (e) {} return (navigator.language || "es").toLowerCase().indexOf("en") === 0 ? "en" : "es"; }

function App() {
  const [lang, setLang] = useState(detectLang);
  const t = makeT(lang);

  const [items, setItems] = useState([]); // {id,file,name,pages,error}
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { document.documentElement.setAttribute("lang", lang); try { localStorage.setItem("acacia-lang", lang); } catch (e) {} }, [lang]);

  const addFiles = useCallback(async (list) => {
    const pdfs = [...list].filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    for (const f of pdfs) {
      const entry = { id: uid(), file: f, name: f.name, pages: null, error: false };
      setItems((prev) => [...prev, entry]);
      try {
        const buf = await f.arrayBuffer();
        const doc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
        const n = doc.getPageCount();
        setItems((prev) => prev.map((x) => x.id === entry.id ? { ...x, pages: n } : x));
      } catch (e) {
        setItems((prev) => prev.map((x) => x.id === entry.id ? { ...x, error: true } : x));
      }
    }
  }, []);

  const move = (i, d) => setItems((prev) => { const a = [...prev]; const j = i + d; if (j < 0 || j >= a.length) return prev; const tmp = a[i]; a[i] = a[j]; a[j] = tmp; return a; });
  const removeItem = (id) => setItems((prev) => prev.filter((x) => x.id !== id));
  const clearAll = () => setItems([]);
  const onDrop = (e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files) addFiles(e.dataTransfer.files); };

  const valid = items.filter((x) => !x.error);
  const totals = useMemo(() => ({ n: valid.length, p: valid.reduce((s, x) => s + (x.pages || 0), 0) }), [items]);

  const merge = async () => {
    if (valid.length < 2 || busy) return;
    setBusy(true);
    try {
      const out = await PDFLib.PDFDocument.create();
      for (const it of items) {
        if (it.error) continue;
        const buf = await it.file.arrayBuffer();
        const src = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      }
      const bytes = await out.save();
      triggerDownload(new Blob([bytes], { type: "application/pdf" }), "pdf-unido.pdf");
    } catch (e) { /* noop */ }
    setBusy(false);
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
            <nav className="pdfnav" aria-label="PDF">
              <a href="/freeware/unir-pdf" aria-current="true">{t("nav_merge")}</a>
              <a href="/freeware/comprimir-pdf">{t("nav_compress")}</a>
              <a href="/freeware/dividir-pdf">{t("nav_split")}</a>
              <a href="/freeware/pdf-a-jpg">{t("nav_p2j")}</a>
              <a href="/freeware/jpg-a-pdf">{t("nav_j2p")}</a>
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
              <div className="items">
                {items.map((it, i) => (
                  <div className="item" key={it.id}>
                    <div className="pdf-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                    <div className="item-body">
                      <div className="item-name">{it.name}</div>
                      <div className={"item-meta mono" + (it.error ? " err" : "")}>{it.error ? t("err_read") : (it.pages == null ? "…" : it.pages + " " + t("pages"))}</div>
                    </div>
                    <div className="item-actions">
                      <button className="iconbtn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("up")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>
                      <button className="iconbtn" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={t("down")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
                      <button className="iconbtn" onClick={() => removeItem(it.id)} aria-label={t("remove")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bar">
                <span className="total mono">{t("count", { n: totals.n, p: totals.p })}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary" onClick={merge} disabled={totals.n < 2 || busy}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    {busy ? t("working") : t("merge")}
                  </button>
                  <button className="btn" onClick={clearAll}>{t("clear")}</button>
                </div>
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
