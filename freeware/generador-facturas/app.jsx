// Generador de Facturas / Recibos / Cotizaciones (PDF) — ACACIA freeware.
// 100% en el navegador (pdf-lib): datos y logo nunca se suben. Documento NO fiscal. ES/EN. Acento teal.

const { useState, useEffect, useMemo, useCallback, useRef } = React;

const STRINGS = {
  es: {
    nav_more:"← Más herramientas", lang_label:"Idioma", eyebrow:"Herramienta gratis",
    h1:"Generador de ", h1b:"facturas y recibos",
    hero_p:"Crea recibos, cotizaciones y notas de venta en PDF con tu logo, conceptos e IVA. Sin registro y sin subir tus datos.",
    privacy_chip:"El PDF se genera en tu navegador. Nada se sube.",
    doctype:"Tipo de documento", t_recibo:"Recibo", t_cotiz:"Cotización", t_nota:"Nota de venta", t_factura:"Factura (no fiscal)",
    emisor:"Tus datos (emisor)", cliente:"Cliente",
    name:"Nombre o empresa", taxid:"RFC / ID (opcional)", address:"Dirección (opcional)", phone:"Teléfono (opcional)", email:"Correo (opcional)",
    logo:"Logo (opcional)", logo_add:"Subir logo", logo_remove:"Quitar",
    folio:"Folio", date:"Fecha", currency:"Moneda",
    items:"Conceptos", it_desc:"Descripción", it_qty:"Cant.", it_price:"P. unitario", it_amount:"Importe", add_item:"Agregar concepto",
    ivaLabel:"IVA", notes:"Notas / términos (opcional)", notes_ph:"Condiciones de pago, vigencia de la cotización, etc.",
    subtotal:"Subtotal", total:"Total",
    generate:"Generar PDF", remember:"Recordar mis datos de emisor",
    disclaimer:"<strong>Documento no fiscal.</strong> Genera un recibo, cotización o nota de venta para enviar a tus clientes; <strong>no es un CFDI timbrado</strong> ante el SAT. Para facturación fiscal necesitas un sistema con timbrado autorizado (lo implementamos en ACACIA).",
    cta_h3:"¿Necesitas facturación fiscal (CFDI) de verdad?", cta_p:"En ACACIA implementamos facturación, finanzas e inventario para PyMEs. Hablemos.", cta_btn:"Hablar con ACACIA",
    faq_title:"Preguntas frecuentes",
    faq:[["¿Es válida ante el SAT?","No. Es un documento imprimible (recibo/cotización/nota). Para un CFDI fiscal necesitas un sistema de facturación con timbrado."],["¿Necesito registrarme?","No. Llenas el formulario y descargas el PDF al instante, sin cuenta."],["¿Mis datos se suben?","No. Todo se genera en tu navegador; ni tus datos ni tu logo salen del dispositivo."]],
    foot_free:"© 2026 ACACIA · Herramienta gratis", foot_tools:"Herramientas", foot_privacy:"Privacidad", foot_contact:"Contacto", foot_crafted:"hecho con", foot_by:"por",
    pdf_for:"PARA", pdf_footer:"Documento no fiscal · generado en acaciaco.com.mx",
  },
  en: {
    nav_more:"← More tools", lang_label:"Language", eyebrow:"Free tool",
    h1:"Invoice & receipt ", h1b:"generator",
    hero_p:"Create receipts, quotes and sales notes as PDF with your logo, line items and tax. No sign-up, nothing uploaded.",
    privacy_chip:"The PDF is generated in your browser. Nothing is uploaded.",
    doctype:"Document type", t_recibo:"Receipt", t_cotiz:"Quote", t_nota:"Sales note", t_factura:"Invoice (non-fiscal)",
    emisor:"Your details (sender)", cliente:"Client",
    name:"Name or company", taxid:"Tax ID (optional)", address:"Address (optional)", phone:"Phone (optional)", email:"Email (optional)",
    logo:"Logo (optional)", logo_add:"Upload logo", logo_remove:"Remove",
    folio:"Number", date:"Date", currency:"Currency",
    items:"Line items", it_desc:"Description", it_qty:"Qty", it_price:"Unit price", it_amount:"Amount", add_item:"Add item",
    ivaLabel:"Tax", notes:"Notes / terms (optional)", notes_ph:"Payment terms, quote validity, etc.",
    subtotal:"Subtotal", total:"Total",
    generate:"Generate PDF", remember:"Remember my sender details",
    disclaimer:"<strong>Non-fiscal document.</strong> It creates a receipt, quote or sales note to send to clients; it is <strong>not a stamped tax invoice (CFDI)</strong>. For fiscal invoicing you need an authorized system (we build those at ACACIA).",
    cta_h3:"Need real fiscal invoicing (CFDI)?", cta_p:"At ACACIA we implement invoicing, finance and inventory for SMBs. Let's talk.", cta_btn:"Talk to ACACIA",
    faq_title:"FAQ",
    faq:[["Is it valid for tax (SAT)?","No. It's a printable document (receipt/quote/note). For a fiscal CFDI you need a stamping-enabled invoicing system."],["Do I need to register?","No. Fill the form and download the PDF instantly, no account."],["Is my data uploaded?","No. Everything is generated in your browser; neither your data nor your logo leaves the device."]],
    foot_free:"© 2026 ACACIA · Free tool", foot_tools:"Tools", foot_privacy:"Privacy", foot_contact:"Contact", foot_crafted:"crafted with", foot_by:"by",
    pdf_for:"BILL TO", pdf_footer:"Non-fiscal document · generated at acaciaco.com.mx",
  },
};
function makeT(lang){return (k,v)=>{let s=(STRINGS[lang]&&STRINGS[lang][k])!=null?STRINGS[lang][k]:(STRINGS.es[k]!=null?STRINGS.es[k]:k);if(v&&typeof s==="string")for(var x in v)s=s.split("{"+x+"}").join(v[x]);return s;};}
const LangContext=React.createContext("es");
const uid=()=>Math.random().toString(36).slice(2,9);
const num=(v)=>{const n=parseFloat(v);return isFinite(n)?n:0;};
function detectLang(){try{var s=localStorage.getItem("acacia-lang");if(s==="es"||s==="en")return s;}catch(e){}return "es";}
function fmtMoney(n,sym){ n=Math.round((n+Number.EPSILON)*100)/100; const parts=n.toFixed(2).split("."); parts[0]=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,","); return (sym||"$")+parts.join("."); }
function dataUrlToBytes(durl){ const b64=durl.split(",")[1]; const bin=atob(b64); const arr=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i); return arr; }

async function buildPdf(d, t) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 612, H = 792, m = 48;
  const accent = rgb(0.18, 0.46, 0.41), ink = rgb(0.13, 0.15, 0.16), gray = rgb(0.46, 0.48, 0.51), line = rgb(0.85, 0.86, 0.87);
  const sym = d.currencySym || "$";
  const text = (s, x, y, size, f, c) => page.drawText(String(s == null ? "" : s), { x, y, size, font: f || font, color: c || ink });
  const rtext = (s, xr, y, size, f, c) => { s = String(s == null ? "" : s); const w = (f || font).widthOfTextAtSize(s, size); page.drawText(s, { x: xr - w, y, size, font: f || font, color: c || ink }); };
  const fit = (s, size, f, maxW) => { s = String(s || ""); if ((f || font).widthOfTextAtSize(s, size) <= maxW) return s; while (s.length > 1 && (f || font).widthOfTextAtSize(s + "…", size) > maxW) s = s.slice(0, -1); return s + "…"; };

  let y = H - m;
  // Logo
  let leftTop = y;
  if (d.logo) {
    try {
      const bytes = dataUrlToBytes(d.logo);
      const img = d.logo.indexOf("image/png") > -1 ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const max = 56, sc = Math.min(max / img.width, max / img.height), w = img.width * sc, h = img.height * sc;
      page.drawImage(img, { x: m, y: y - h, width: w, height: h });
      leftTop = y - h - 12;
    } catch (e) { leftTop = y; }
  }
  // Emisor (left)
  let ly = leftTop;
  text(d.emisorName || "—", m, ly - 12, 14, bold); ly -= 28;
  [d.emisorTax, d.emisorAddr, d.emisorPhone, d.emisorEmail].filter(Boolean).forEach((l) => { text(fit(l, 9.5, font, 230), m, ly, 9.5, font, gray); ly -= 13; });
  // Título + folio/fecha (right)
  rtext((d.docTypeLabel || "").toUpperCase(), W - m, H - m - 16, 22, bold, accent);
  let ry = H - m - 38;
  rtext(t("folio") + ": " + (d.folio || "—"), W - m, ry, 10, font, gray); ry -= 14;
  rtext(t("date") + ": " + (d.date || "—"), W - m, ry, 10, font, gray);

  // Cliente
  let cy = Math.min(ly, ry) - 18;
  text(t("pdf_for"), m, cy, 9, bold, accent); cy -= 15;
  text(fit(d.clienteName || "—", 12, bold, 320), m, cy, 12, bold); cy -= 16;
  [d.clienteTax, d.clienteAddr].filter(Boolean).forEach((l) => { text(fit(l, 9.5, font, 320), m, cy, 9.5, font, gray); cy -= 13; });

  // Tabla de conceptos
  let ty = cy - 22;
  const xDesc = m, xQty = 366, xPrice = 470, xAmt = W - m;
  text(t("it_desc"), xDesc, ty, 9, bold, gray);
  rtext(t("it_qty"), xQty + 8, ty, 9, bold, gray);
  rtext(t("it_price"), xPrice + 6, ty, 9, bold, gray);
  rtext(t("it_amount"), xAmt, ty, 9, bold, gray);
  ty -= 8; page.drawLine({ start: { x: m, y: ty }, end: { x: W - m, y: ty }, thickness: 1, color: line }); ty -= 16;
  (d.items || []).forEach((it) => {
    if (ty < 120) return; // simple: no paginación (MVP)
    const imp = num(it.qty) * num(it.price);
    text(fit(it.desc || "—", 10.5, font, xQty - xDesc - 16), xDesc, ty, 10.5, font);
    rtext(num(it.qty) % 1 === 0 ? String(num(it.qty)) : num(it.qty).toFixed(2), xQty + 8, ty, 10.5);
    rtext(fmtMoney(num(it.price), sym), xPrice + 6, ty, 10.5);
    rtext(fmtMoney(imp, sym), xAmt, ty, 10.5);
    ty -= 10; page.drawLine({ start: { x: m, y: ty }, end: { x: W - m, y: ty }, thickness: 0.5, color: line }); ty -= 16;
  });

  // Totales
  let toy = ty - 6; const lblX = 420;
  rtext(t("subtotal"), W - m - 90, toy, 11, font, gray); rtext(fmtMoney(d.subtotal, sym), W - m, toy, 11); toy -= 18;
  if (d.ivaRate > 0) { rtext(t("ivaLabel") + " " + d.ivaRate + "%", W - m - 90, toy, 11, font, gray); rtext(fmtMoney(d.iva, sym), W - m, toy, 11); toy -= 18; }
  page.drawLine({ start: { x: lblX, y: toy + 4 }, end: { x: W - m, y: toy + 4 }, thickness: 1, color: line }); toy -= 14;
  rtext(t("total"), W - m - 110, toy, 14, bold); rtext(fmtMoney(d.total, sym) + " " + (d.currencyCode || ""), W - m, toy, 14, bold, accent);

  // Notas
  if (d.notes) {
    let ny = toy - 36; text(t("notes"), m, ny, 9, bold, gray); ny -= 14;
    String(d.notes).split("\n").forEach((l) => { if (ny < 70) return; text(fit(l, 9.5, font, W - 2 * m), m, ny, 9.5, font, gray); ny -= 13; });
  }
  // Footer
  rtext(t("pdf_footer"), W - m, 40, 8.5, font, gray);
  text("", m, 40, 8.5);

  const bytes = await doc.save();
  return new Blob([bytes], { type: "application/pdf" });
}

function App() {
  const [lang, setLang] = useState(detectLang);
  const t = makeT(lang);

  const [docType, setDocType] = useState("recibo");
  const [em, setEm] = useState({ name: "", tax: "", addr: "", phone: "", email: "" });
  const [logo, setLogo] = useState(null);
  const [cl, setCl] = useState({ name: "", tax: "", addr: "" });
  const today = new Date().toISOString().slice(0, 10);
  const [folio, setFolio] = useState("001");
  const [date, setDate] = useState(today);
  const [currencyCode, setCurrencyCode] = useState("MXN");
  const [currencySym, setCurrencySym] = useState("$");
  const [items, setItems] = useState([{ id: uid(), desc: "", qty: "1", price: "" }]);
  const [ivaRate, setIvaRate] = useState(16);
  const [notes, setNotes] = useState("");
  const [remember, setRemember] = useState(true);
  const logoRef = useRef(null);

  useEffect(() => { document.documentElement.setAttribute("lang", lang === "en" ? "en" : "es-MX"); try { localStorage.setItem("acacia-lang", lang); } catch (e) {} }, [lang]);
  // cargar emisor recordado
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem("acacia-fact-emisor") || "null"); if (s) { if (s.em) setEm(s.em); if (s.logo) setLogo(s.logo); if (s.currencyCode) setCurrencyCode(s.currencyCode); if (s.currencySym) setCurrencySym(s.currencySym); } } catch (e) {}
  }, []);

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + num(it.qty) * num(it.price), 0);
    const iva = subtotal * (num(ivaRate) / 100);
    return { subtotal, iva, total: subtotal + iva };
  }, [items, ivaRate]);

  const onLogo = useCallback((e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => setLogo(r.result); r.readAsDataURL(f); }, []);
  const setItem = (id, k, v) => setItems((p) => p.map((it) => it.id === id ? { ...it, [k]: v } : it));
  const addItem = () => setItems((p) => [...p, { id: uid(), desc: "", qty: "1", price: "" }]);
  const delItem = (id) => setItems((p) => p.length > 1 ? p.filter((x) => x.id !== id) : p);

  const docLabel = () => ({ recibo: t("t_recibo"), cotiz: t("t_cotiz"), nota: t("t_nota"), factura: t("t_factura") }[docType]);

  const generate = async () => {
    if (remember) { try { localStorage.setItem("acacia-fact-emisor", JSON.stringify({ em, logo, currencyCode, currencySym })); } catch (e) {} }
    else { try { localStorage.removeItem("acacia-fact-emisor"); } catch (e) {} }
    if (window.acaciaTrack) window.acaciaTrack("invoice_generate", { type: docType });
    const blob = await buildPdf({
      docTypeLabel: docLabel(), folio, date, currencyCode, currencySym,
      emisorName: em.name, emisorTax: em.tax, emisorAddr: em.addr, emisorPhone: em.phone, emisorEmail: em.email, logo,
      clienteName: cl.name, clienteTax: cl.tax, clienteAddr: cl.addr,
      items, ivaRate: num(ivaRate), subtotal: totals.subtotal, iva: totals.iva, total: totals.total, notes,
    }, t);
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = (docType + "-" + (folio || "")).replace(/\s+/g, "") + ".pdf";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const TYPES = [["recibo", "t_recibo"], ["cotiz", "t_cotiz"], ["nota", "t_nota"], ["factura", "t_factura"]];

  return (
    <LangContext.Provider value={lang}>
      <div className="app">
        <div className="wrap">
          <div className="topbar">
            <a className="brand" href="/" aria-label="ACACIA inicio"><img src="/assets/acacia-logo.jpg" alt="ACACIA" width="28" height="28" /> ACACIA</a>
            <div className="topbar-actions">
              <a className="ghost-link" href="/freeware">{t("nav_more")}</a>
              <div className="lang-seg" role="group" aria-label={t("lang_label")}><button type="button" aria-pressed={lang === "es"} onClick={() => setLang("es")}>ES</button><button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button></div>
            </div>
          </div>

          <header className="hero">
            <span className="eyebrow"><span className="dot" aria-hidden="true"></span> {t("eyebrow")}</span>
            <h1>{t("h1")}<span style={{ color: "var(--accent-2)" }}>{t("h1b")}</span></h1>
            <p>{t("hero_p")}</p>
            <span className="privacy-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>{t("privacy_chip")}</span>
          </header>

          <div className="card">
            <div className="field"><label>{t("doctype")}</label>
              <div className="seg" role="group" aria-label={t("doctype")}>
                {TYPES.map(([id, k]) => <button key={id} type="button" aria-pressed={docType === id} onClick={() => setDocType(id)}>{t(k)}</button>)}
              </div>
            </div>
            <div className="row2">
              <div className="field"><label>{t("folio")}</label><input type="text" value={folio} onChange={(e) => setFolio(e.target.value)} /></div>
              <div className="field"><label>{t("date")}</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            </div>
          </div>

          <div className="grid2">
            <div className="card">
              <h2>{t("emisor")}</h2>
              <div className="field"><label>{t("logo")}</label>
                <div className="logo-row">
                  <div className="logo-prev">{logo ? <img src={logo} alt="logo" /> : <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5L9 20"/></svg>}</div>
                  <label className="btn-mini" style={{ cursor: "pointer" }}>{t("logo_add")}<input ref={logoRef} type="file" accept="image/png,image/jpeg" onChange={onLogo} style={{ display: "none" }} /></label>
                  {logo && <button type="button" className="btn-mini" onClick={() => setLogo(null)}>{t("logo_remove")}</button>}
                </div>
              </div>
              <div className="field"><label>{t("name")}</label><input type="text" value={em.name} onChange={(e) => setEm({ ...em, name: e.target.value })} /></div>
              <div className="field"><label>{t("taxid")}</label><input type="text" value={em.tax} onChange={(e) => setEm({ ...em, tax: e.target.value })} /></div>
              <div className="field"><label>{t("address")}</label><input type="text" value={em.addr} onChange={(e) => setEm({ ...em, addr: e.target.value })} /></div>
              <div className="row2">
                <div className="field"><label>{t("phone")}</label><input type="text" value={em.phone} onChange={(e) => setEm({ ...em, phone: e.target.value })} /></div>
                <div className="field"><label>{t("email")}</label><input type="text" value={em.email} onChange={(e) => setEm({ ...em, email: e.target.value })} /></div>
              </div>
              <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 9, marginTop: 4, cursor: "pointer" }}>
                <input type="checkbox" style={{ width: "auto" }} checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span style={{ fontWeight: 400, color: "var(--ink-2)", fontSize: 13 }}>{t("remember")}</span>
              </label>
            </div>

            <div className="card">
              <h2>{t("cliente")}</h2>
              <div className="field"><label>{t("name")}</label><input type="text" value={cl.name} onChange={(e) => setCl({ ...cl, name: e.target.value })} /></div>
              <div className="field"><label>{t("taxid")}</label><input type="text" value={cl.tax} onChange={(e) => setCl({ ...cl, tax: e.target.value })} /></div>
              <div className="field"><label>{t("address")}</label><textarea value={cl.addr} onChange={(e) => setCl({ ...cl, addr: e.target.value })} /></div>
              <div className="row2">
                <div className="field"><label>{t("currency")}</label><input type="text" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} /></div>
                <div className="field"><label>{t("ivaLabel")} (%)</label><input type="number" min="0" max="100" step="0.5" value={ivaRate} onChange={(e) => setIvaRate(e.target.value)} /></div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>{t("items")}</h2>
            <table className="items">
              <thead><tr><th className="ti-desc">{t("it_desc")}</th><th className="ti-num">{t("it_qty")}</th><th className="ti-num">{t("it_price")}</th><th className="ti-num">{t("it_amount")}</th><th></th></tr></thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="ti-desc"><input type="text" value={it.desc} onChange={(e) => setItem(it.id, "desc", e.target.value)} placeholder={t("it_desc")} /></td>
                    <td><input className="ti-num" type="number" min="0" step="1" value={it.qty} onChange={(e) => setItem(it.id, "qty", e.target.value)} /></td>
                    <td><input className="ti-num" type="number" min="0" step="0.01" value={it.price} onChange={(e) => setItem(it.id, "price", e.target.value)} placeholder="0.00" /></td>
                    <td className="col-imp mono">{fmtMoney(num(it.qty) * num(it.price), currencySym)}</td>
                    <td style={{ paddingTop: 12 }}><button className="rowdel" onClick={() => delItem(it.id)} aria-label="x"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn-mini addrow" onClick={addItem}>+ {t("add_item")}</button>
            <div className="totals">
              <div className="trow"><span>{t("subtotal")}</span><span className="v mono">{fmtMoney(totals.subtotal, currencySym)}</span></div>
              {num(ivaRate) > 0 && <div className="trow"><span>{t("ivaLabel")} {num(ivaRate)}%</span><span className="v mono">{fmtMoney(totals.iva, currencySym)}</span></div>}
              <div className="trow grand"><span>{t("total")}</span><span className="v mono">{fmtMoney(totals.total, currencySym)} {currencyCode}</span></div>
            </div>
          </div>

          <div className="card">
            <div className="field"><label>{t("notes")}</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notes_ph")} /></div>
            <button className="btn btn-primary" onClick={generate}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
              {t("generate")}
            </button>
          </div>

          <div className="disclaimer" dangerouslySetInnerHTML={{ __html: t("disclaimer") }} />
          <div className="cta"><h3>{t("cta_h3")}</h3><p>{t("cta_p")}</p><a className="btn btn-primary" href="/contacto">{t("cta_btn")}</a></div>
          <div style={{ marginTop: 8 }}><h2 className="section-title">{t("faq_title")}</h2>{t("faq").map(([q, a], i) => <details key={i}><summary>{q}</summary><p>{a}</p></details>)}</div>
          <footer className="foot"><span>{t("foot_free")}</span><span className="foot-credit">{t("foot_crafted")} <span className="foot-heart" aria-label="love">♥</span> {t("foot_by")} <a className="foot-link" href="https://acaciaco.com.mx" target="_blank" rel="noopener noreferrer">ACACIA Consultoría</a></span><span><a href="/freeware">{t("foot_tools")}</a> · <a href="/legal/privacidad">{t("foot_privacy")}</a> · <a href="/contacto">{t("foot_contact")}</a></span></footer>
        </div>
      </div>
    </LangContext.Provider>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
