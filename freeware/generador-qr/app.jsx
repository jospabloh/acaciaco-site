// Generador de Códigos QR y de Barras — ACACIA freeware.
// 100% en el navegador: ningún dato (ni el logo) sale del dispositivo.
// QR (URL, texto, Wi-Fi, contacto, email, SMS, teléfono) + códigos de barras.
// Logo al centro y exportación a PNG, SVG y PDF. Bilingüe ES/EN.

const { useState, useEffect, useMemo, useCallback } = React;

/* ---------- i18n ---------- */
const STRINGS = {
  es: {
    nav_more: "← Más herramientas", lang_label: "Idioma",
    eyebrow: "Herramienta gratis",
    h1: "Generador de ",
    hero_p: "Crea códigos QR y de barras para enlaces, Wi-Fi, contacto y más. Añade tu logo y descarga en PNG, SVG o PDF, sin marcas de agua y sin cuenta.",
    privacy_chip: "Se generan en tu navegador. Ni la contraseña del Wi-Fi ni tu logo se suben a internet.",
    mode_qr: "Código QR", mode_bc: "Código de barras",
    tab_url: "Enlace", tab_text: "Texto", tab_wifi: "Wi-Fi", tab_vcard: "Contacto", tab_email: "Email", tab_sms: "SMS", tab_tel: "Teléfono",
    url_label: "URL", url_hint: "incluye https://", url_ph: "https://tusitio.com",
    text_label: "Texto", text_ph: "Cualquier texto…",
    wifi_ssid: "Nombre de la red (SSID)", wifi_pass: "Contraseña", wifi_enc: "Seguridad", wifi_hidden: "Red oculta", wifi_none: "Sin contraseña",
    vc_name: "Nombre completo", vc_phone: "Teléfono", vc_email: "Correo", vc_org: "Empresa", vc_url: "Sitio web",
    em_to: "Destinatario", em_subject: "Asunto", em_body: "Mensaje",
    sms_num: "Número", sms_msg: "Mensaje",
    tel_num: "Número de teléfono",
    bc_format: "Formato", bc_value: "Valor a codificar", bc_value_hint: "según el formato",
    options: "Personalizar", ecc: "Corrección de errores", ecc_hint: "alto = admite logo", margin: "Margen",
    color_fg: "Color", color_bg: "Fondo",
    logo: "Logo al centro", logo_add: "Subir logo", logo_remove: "Quitar", logo_hint: "PNG/SVG · usa corrección alta (H)",
    empty: "Captura datos para ver tu código aquí.",
    too_long: "El contenido es demasiado largo. Acórtalo.",
    bc_invalid: "Valor inválido para este formato de código de barras.",
    note: "Consejo: buen contraste y prueba el escaneo antes de imprimir, sobre todo con logo o colores.",
    cta_h3: "¿Quieres QR dinámicos con estadísticas de escaneo?",
    cta_p: "En ACACIA creamos soluciones a medida: menús digitales, inventario, fidelización y más.",
    cta_btn: "Hablar con ACACIA",
    faq_title: "Preguntas frecuentes",
    faq: [
      ["¿Los códigos QR caducan?", "No. Son códigos estáticos: la información va dentro del propio código, así que funcionan para siempre y no dependen de ningún servidor."],
      ["¿Puedo poner mi logo en el centro?", "Sí. Sube tu logo y se coloca al centro. Usa corrección de errores alta (H) para que el código siga siendo legible."],
      ["¿En qué formatos puedo descargar?", "PNG para pantallas, SVG vectorial para imprenta y diseño, y PDF listo para imprimir. Sin marcas de agua."],
      ["¿Mis datos se suben a internet?", "No. Todo se genera en tu navegador; ningún dato, ni la contraseña del Wi-Fi ni tu logo, sale de tu dispositivo."],
    ],
    foot_free: "© 2026 ACACIA · Herramienta gratis",
    foot_tools: "Herramientas", foot_privacy: "Privacidad", foot_contact: "Contacto",
    foot_crafted: "hecho con", foot_by: "por",
  },
  en: {
    nav_more: "← More tools", lang_label: "Language",
    eyebrow: "Free tool",
    h1: "Free ",
    hero_p: "Create QR and barcodes for links, Wi-Fi, contacts and more. Add your logo and download as PNG, SVG or PDF — no watermark, no account.",
    privacy_chip: "Generated in your browser. Neither the Wi-Fi password nor your logo is uploaded.",
    mode_qr: "QR code", mode_bc: "Barcode",
    tab_url: "Link", tab_text: "Text", tab_wifi: "Wi-Fi", tab_vcard: "Contact", tab_email: "Email", tab_sms: "SMS", tab_tel: "Phone",
    url_label: "URL", url_hint: "include https://", url_ph: "https://yoursite.com",
    text_label: "Text", text_ph: "Any text…",
    wifi_ssid: "Network name (SSID)", wifi_pass: "Password", wifi_enc: "Security", wifi_hidden: "Hidden network", wifi_none: "No password",
    vc_name: "Full name", vc_phone: "Phone", vc_email: "Email", vc_org: "Company", vc_url: "Website",
    em_to: "Recipient", em_subject: "Subject", em_body: "Message",
    sms_num: "Number", sms_msg: "Message",
    tel_num: "Phone number",
    bc_format: "Format", bc_value: "Value to encode", bc_value_hint: "depends on format",
    options: "Customize", ecc: "Error correction", ecc_hint: "high = allows logo", margin: "Margin",
    color_fg: "Color", color_bg: "Background",
    logo: "Center logo", logo_add: "Upload logo", logo_remove: "Remove", logo_hint: "PNG/SVG · use high (H) correction",
    empty: "Enter data to see your code here.",
    too_long: "The content is too long. Please shorten it.",
    bc_invalid: "Invalid value for this barcode format.",
    note: "Tip: keep good contrast and test scanning before printing, especially with a logo or colors.",
    cta_h3: "Want dynamic QR codes with scan analytics?",
    cta_p: "At ACACIA we build custom solutions: digital menus, inventory, loyalty and more.",
    cta_btn: "Talk to ACACIA",
    faq_title: "FAQ",
    faq: [
      ["Do QR codes expire?", "No. These are static codes: the data lives inside the code, so they work forever and don't rely on any server."],
      ["Can I put my logo in the center?", "Yes. Upload your logo and it's placed in the center. Use high error correction (H) so the code stays scannable."],
      ["Which formats can I download?", "PNG for screens, vector SVG for print and design, and PDF ready to print. No watermark."],
      ["Is my data uploaded?", "No. Everything is generated in your browser; no data, not even the Wi-Fi password or your logo, leaves your device."],
    ],
    foot_free: "© 2026 ACACIA · Free tool",
    foot_tools: "Tools", foot_privacy: "Privacy", foot_contact: "Contact",
    foot_crafted: "crafted with", foot_by: "by",
  },
};
function makeT(lang) {
  return (key, vars) => {
    let s = (STRINGS[lang] && STRINGS[lang][key]) != null ? STRINGS[lang][key] : (STRINGS.es[key] != null ? STRINGS.es[key] : key);
    if (vars && typeof s === "string") for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
    return s;
  };
}
const LangContext = React.createContext("es");
const useT = () => makeT(React.useContext(LangContext));

/* ---------- helpers ---------- */
const escWifi = (s) => (s || "").replace(/([\\;,:"])/g, "\\$1");
const enc = (s) => encodeURIComponent(s || "");

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function roundRectPath(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* ---------- QR ---------- */
function buildMatrix(data, ecc) {
  if (!data) return null;
  try {
    const qr = qrcode(0, ecc);
    qr.addData(data); qr.make();
    const count = qr.getModuleCount();
    const modules = [];
    for (let r = 0; r < count; r++) { const row = []; for (let c = 0; c < count; c++) row.push(qr.isDark(r, c)); modules.push(row); }
    return { count, modules };
  } catch (e) { return { error: true }; }
}
function qrSvg(m, fg, bg, margin, logo) {
  const size = m.count + margin * 2;
  let rects = "";
  for (let r = 0; r < m.count; r++) for (let c = 0; c < m.count; c++)
    if (m.modules[r][c]) rects += `<rect x="${c + margin}" y="${r + margin}" width="1" height="1"/>`;
  let overlay = "";
  if (logo) {
    const lw = size * 0.24, pos = (size - lw) / 2, pad = lw * 0.14, bw = lw + pad * 2, bpos = pos - pad;
    overlay = `<rect x="${bpos}" y="${bpos}" width="${bw}" height="${bw}" rx="${bw * 0.12}" fill="${bg}"/><image href="${logo}" x="${pos}" y="${pos}" width="${lw}" height="${lw}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${bg}"/><g fill="${fg}">${rects}</g>${overlay}</svg>`;
}
function qrCanvas(m, fg, bg, margin, logo, px) {
  return new Promise((resolve) => {
    const total = m.count + margin * 2, scale = Math.max(2, Math.round(px / total)), cs = total * scale;
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = cs;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cs, cs);
    ctx.fillStyle = fg;
    for (let r = 0; r < m.count; r++) for (let c = 0; c < m.count; c++)
      if (m.modules[r][c]) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
    if (logo) {
      const img = new Image();
      img.onload = () => {
        const lw = cs * 0.24, pos = (cs - lw) / 2, pad = lw * 0.14, bw = lw + pad * 2, bpos = pos - pad;
        ctx.fillStyle = bg; roundRectPath(ctx, bpos, bpos, bw, bw, bw * 0.12); ctx.fill();
        const ar = img.width / img.height; let dw = lw, dh = lw;
        if (ar > 1) dh = lw / ar; else dw = lw * ar;
        ctx.drawImage(img, pos + (lw - dw) / 2, pos + (lw - dh) / 2, dw, dh);
        resolve(canvas);
      };
      img.onerror = () => resolve(canvas);
      img.src = logo;
    } else resolve(canvas);
  });
}

/* ---------- Barcode (JsBarcode) ---------- */
function barcodeSvg(value, format, fg, bg) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  let ok = true;
  JsBarcode(svg, value, { format, lineColor: fg, background: bg, displayValue: true, margin: 10, width: 2, height: 80, fontSize: 16, valid: (v) => { ok = v; } });
  if (!ok) throw new Error("invalid barcode value");
  return new XMLSerializer().serializeToString(svg);
}
function barcodeCanvas(value, format, fg, bg) {
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, value, { format, lineColor: fg, background: bg, displayValue: true, margin: 10, width: 3, height: 120, fontSize: 22 });
  return canvas;
}

/* ---------- exports ---------- */
function exportSVG(svgStr, name) { triggerDownload(new Blob([svgStr], { type: "image/svg+xml" }), name + ".svg"); }
async function exportPNG(getCanvas, name) { const c = await getCanvas(); c.toBlob((b) => triggerDownload(b, name + ".png")); }
async function exportPDF(getCanvas, name) {
  const c = await getCanvas();
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pw = pdf.internal.pageSize.getWidth();
  const max = Math.min(380, pw - 120), ar = c.width / c.height;
  let w = max, h = max / ar; if (h > max) { h = max; w = max * ar; }
  pdf.addImage(c.toDataURL("image/png"), "PNG", (pw - w) / 2, 90, w, h);
  pdf.save(name + ".pdf");
}

/* ---------- UI atoms ---------- */
function Field({ label, hint, children }) {
  return (
    <div className="field">
      <label>{label}{hint ? <span className="hint"> · {hint}</span> : null}</label>
      {children}
    </div>
  );
}

const QR_TABS = [
  { id: "url", key: "tab_url" }, { id: "text", key: "tab_text" }, { id: "wifi", key: "tab_wifi" },
  { id: "vcard", key: "tab_vcard" }, { id: "email", key: "tab_email" }, { id: "sms", key: "tab_sms" }, { id: "tel", key: "tab_tel" },
];
const BC_FORMATS = ["CODE128", "EAN13", "UPC", "CODE39", "ITF14"];
const FG_PRESETS = ["#11181f", "#1f4fd8", "#0f7a4f", "#6b21a8"];

function detectLang() {
  try { const s = localStorage.getItem("acacia-lang"); if (s === "es" || s === "en") return s; } catch (e) {}
  return "es";
}

function App() {
  const [lang, setLang] = useState(detectLang);
  const t = makeT(lang);

  const [mode, setMode] = useState("qr");      // qr | barcode
  const [tab, setTab] = useState("url");        // QR type

  const [url, setUrl] = useState(""); const [text, setText] = useState("");
  const [ssid, setSsid] = useState(""); const [wpass, setWpass] = useState(""); const [wenc, setWenc] = useState("WPA"); const [hidden, setHidden] = useState(false);
  const [vName, setVName] = useState(""); const [vPhone, setVPhone] = useState(""); const [vEmail, setVEmail] = useState(""); const [vOrg, setVOrg] = useState(""); const [vUrl, setVUrl] = useState("");
  const [emTo, setEmTo] = useState(""); const [emSub, setEmSub] = useState(""); const [emBody, setEmBody] = useState("");
  const [smsNum, setSmsNum] = useState(""); const [smsMsg, setSmsMsg] = useState("");
  const [telNum, setTelNum] = useState("");

  const [bcFormat, setBcFormat] = useState("CODE128"); const [bcValue, setBcValue] = useState("");

  const [ecc, setEcc] = useState("M");
  const [fg, setFg] = useState("#11181f"); const [bg, setBg] = useState("#ffffff");
  const [margin, setMargin] = useState(4);
  const [logo, setLogo] = useState(null);

  useEffect(() => { document.documentElement.setAttribute("lang", lang === "en" ? "en" : "es-MX"); try { localStorage.setItem("acacia-lang", lang); } catch (e) {} }, [lang]);

  const onLogo = useCallback((e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setLogo(reader.result); setEcc("H"); };
    reader.readAsDataURL(file);
  }, []);

  const qrData = useMemo(() => {
    switch (tab) {
      case "url": return url.trim();
      case "text": return text;
      case "wifi": {
        if (!ssid) return "";
        const p = wenc === "nopass" ? "" : `P:${escWifi(wpass)};`;
        return `WIFI:T:${wenc};S:${escWifi(ssid)};${p}${hidden ? "H:true;" : ""};`;
      }
      case "vcard": {
        if (!vName && !vPhone && !vEmail) return "";
        const L = ["BEGIN:VCARD", "VERSION:3.0"];
        if (vName) { L.push(`N:${vName};;;;`); L.push(`FN:${vName}`); }
        if (vOrg) L.push(`ORG:${vOrg}`);
        if (vPhone) L.push(`TEL;TYPE=CELL:${vPhone}`);
        if (vEmail) L.push(`EMAIL:${vEmail}`);
        if (vUrl) L.push(`URL:${vUrl}`);
        L.push("END:VCARD"); return L.join("\n");
      }
      case "email": {
        if (!emTo) return "";
        const q = []; if (emSub) q.push("subject=" + enc(emSub)); if (emBody) q.push("body=" + enc(emBody));
        return `mailto:${emTo}${q.length ? "?" + q.join("&") : ""}`;
      }
      case "sms": return smsNum ? `SMSTO:${smsNum}:${smsMsg}` : "";
      case "tel": return telNum ? `tel:${telNum}` : "";
      default: return "";
    }
  }, [tab, url, text, ssid, wpass, wenc, hidden, vName, vPhone, vEmail, vOrg, vUrl, emTo, emSub, emBody, smsNum, smsMsg, telNum]);

  // Render output (svg string + readiness) for current mode
  const out = useMemo(() => {
    if (mode === "barcode") {
      if (!bcValue) return { ready: false, empty: true };
      try { return { ready: true, svg: barcodeSvg(bcValue, bcFormat, fg, bg) }; }
      catch (e) { return { ready: false, error: "bc_invalid" }; }
    }
    const m = buildMatrix(qrData, ecc);
    if (!m) return { ready: false, empty: true };
    if (m.error) return { ready: false, error: "too_long" };
    return { ready: true, svg: qrSvg(m, fg, bg, margin, logo), matrix: m };
  }, [mode, bcValue, bcFormat, qrData, ecc, fg, bg, margin, logo]);

  const name = mode === "barcode" ? "codigo-barras" : "codigo-qr";
  const getCanvas = useCallback(() => {
    if (mode === "barcode") return Promise.resolve(barcodeCanvas(bcValue, bcFormat, fg, bg));
    return qrCanvas(out.matrix, fg, bg, margin, logo, 1024);
  }, [mode, bcValue, bcFormat, out.matrix, fg, bg, margin, logo]);

  return (
    <LangContext.Provider value={lang}>
      <div className="app">
        <div className="wrap">
          <div className="topbar">
            <a className="brand" href="/" aria-label="ACACIA inicio">
              <img src="/assets/acacia-logo.jpg" alt="ACACIA" width="28" height="28" /> ACACIA
            </a>
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
            <h1>{t("h1")}<span style={{ color: "var(--accent-2)" }}>{mode === "barcode" ? t("mode_bc") : t("mode_qr")}</span></h1>
            <p>{t("hero_p")}</p>
            <span className="privacy-chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              {t("privacy_chip")}
            </span>
          </header>

          <div className="modebar" role="group" aria-label="modo">
            <button type="button" aria-pressed={mode === "qr"} onClick={() => setMode("qr")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="14" y2="21"/><line x1="21" y1="14" x2="21" y2="21"/><line x1="17.5" y1="17.5" x2="17.5" y2="17.5"/></svg>
              {t("mode_qr")}
            </button>
            <button type="button" aria-pressed={mode === "barcode"} onClick={() => setMode("barcode")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="5" x2="4" y2="19"/><line x1="7" y1="5" x2="7" y2="19"/><line x1="11" y1="5" x2="11" y2="19"/><line x1="14" y1="5" x2="14" y2="19"/><line x1="17" y1="5" x2="17" y2="19"/><line x1="20" y1="5" x2="20" y2="19"/></svg>
              {t("mode_bc")}
            </button>
          </div>

          {mode === "qr" && (
            <div className="tabs" role="tablist" aria-label="tipo de QR">
              {QR_TABS.map((tb) => (
                <button key={tb.id} className="tab" role="tab" aria-selected={tab === tb.id} onClick={() => setTab(tb.id)}>{t(tb.key)}</button>
              ))}
            </div>
          )}

          <div className="layout">
            <div className="card">
              {mode === "barcode" ? (
                <React.Fragment>
                  <Field label={t("bc_format")}>
                    <select value={bcFormat} onChange={(e) => setBcFormat(e.target.value)}>
                      {BC_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </Field>
                  <Field label={t("bc_value")} hint={t("bc_value_hint")}>
                    <input type="text" value={bcValue} onChange={(e) => setBcValue(e.target.value)} placeholder={bcFormat === "EAN13" ? "123456789012" : bcFormat === "UPC" ? "12345678901" : "ABC-12345"} />
                  </Field>
                </React.Fragment>
              ) : (
                <React.Fragment>
                  {tab === "url" && <Field label={t("url_label")} hint={t("url_hint")}><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("url_ph")} /></Field>}
                  {tab === "text" && <Field label={t("text_label")}><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("text_ph")} /></Field>}
                  {tab === "wifi" && (
                    <React.Fragment>
                      <Field label={t("wifi_ssid")}><input type="text" value={ssid} onChange={(e) => setSsid(e.target.value)} placeholder="Mi-WiFi" /></Field>
                      <div className="row2">
                        <Field label={t("wifi_enc")}>
                          <select value={wenc} onChange={(e) => setWenc(e.target.value)}>
                            <option value="WPA">WPA / WPA2 / WPA3</option>
                            <option value="WEP">WEP</option>
                            <option value="nopass">{t("wifi_none")}</option>
                          </select>
                        </Field>
                        <Field label={t("wifi_pass")}><input type="text" value={wpass} disabled={wenc === "nopass"} onChange={(e) => setWpass(e.target.value)} placeholder="••••••••" /></Field>
                      </div>
                      <div className="field checkbox"><input id="hidden" type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /><label htmlFor="hidden">{t("wifi_hidden")}</label></div>
                    </React.Fragment>
                  )}
                  {tab === "vcard" && (
                    <React.Fragment>
                      <Field label={t("vc_name")}><input type="text" value={vName} onChange={(e) => setVName(e.target.value)} /></Field>
                      <div className="row2">
                        <Field label={t("vc_phone")}><input type="tel" value={vPhone} onChange={(e) => setVPhone(e.target.value)} /></Field>
                        <Field label={t("vc_email")}><input type="email" value={vEmail} onChange={(e) => setVEmail(e.target.value)} /></Field>
                      </div>
                      <div className="row2">
                        <Field label={t("vc_org")}><input type="text" value={vOrg} onChange={(e) => setVOrg(e.target.value)} /></Field>
                        <Field label={t("vc_url")}><input type="url" value={vUrl} onChange={(e) => setVUrl(e.target.value)} /></Field>
                      </div>
                    </React.Fragment>
                  )}
                  {tab === "email" && (
                    <React.Fragment>
                      <Field label={t("em_to")}><input type="email" value={emTo} onChange={(e) => setEmTo(e.target.value)} placeholder="correo@ejemplo.com" /></Field>
                      <Field label={t("em_subject")}><input type="text" value={emSub} onChange={(e) => setEmSub(e.target.value)} /></Field>
                      <Field label={t("em_body")}><textarea value={emBody} onChange={(e) => setEmBody(e.target.value)} /></Field>
                    </React.Fragment>
                  )}
                  {tab === "sms" && (
                    <React.Fragment>
                      <Field label={t("sms_num")}><input type="tel" value={smsNum} onChange={(e) => setSmsNum(e.target.value)} placeholder="+52..." /></Field>
                      <Field label={t("sms_msg")}><textarea value={smsMsg} onChange={(e) => setSmsMsg(e.target.value)} /></Field>
                    </React.Fragment>
                  )}
                  {tab === "tel" && <Field label={t("tel_num")}><input type="tel" value={telNum} onChange={(e) => setTelNum(e.target.value)} placeholder="+52..." /></Field>}
                </React.Fragment>
              )}

              <div className="field opt-head"><label>{t("options")}</label></div>
              <div className="row2">
                {mode === "qr" ? (
                  <Field label={t("ecc")} hint={t("ecc_hint")}>
                    <select value={ecc} onChange={(e) => setEcc(e.target.value)}>
                      <option value="L">L · 7%</option><option value="M">M · 15%</option><option value="Q">Q · 25%</option><option value="H">H · 30%</option>
                    </select>
                  </Field>
                ) : <div className="field" />}
                {mode === "qr" && (
                  <Field label={t("margin")}>
                    <input type="number" min="0" max="16" value={margin} onChange={(e) => setMargin(Math.max(0, Math.min(16, parseInt(e.target.value) || 0)))} />
                  </Field>
                )}
              </div>
              <div className="row2">
                <Field label={t("color_fg")}>
                  <div className="swatches">
                    <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} aria-label={t("color_fg")} />
                    {FG_PRESETS.map((c) => <button key={c} type="button" className="swatch" style={{ background: c }} aria-pressed={fg.toLowerCase() === c} onClick={() => setFg(c)} aria-label={c} />)}
                  </div>
                </Field>
                <Field label={t("color_bg")}><input type="color" value={bg} onChange={(e) => setBg(e.target.value)} aria-label={t("color_bg")} /></Field>
              </div>

              {mode === "qr" && (
                <Field label={t("logo")} hint={t("logo_hint")}>
                  <div className="logo-row">
                    <div className="logo-prev">{logo ? <img src={logo} alt="logo" /> : (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5L9 20"/></svg>
                    )}</div>
                    <label className="btn-mini" style={{ cursor: "pointer" }}>
                      {t("logo_add")}
                      <input type="file" accept="image/*" onChange={onLogo} style={{ display: "none" }} />
                    </label>
                    {logo && <button type="button" className="btn-mini" onClick={() => setLogo(null)}>{t("logo_remove")}</button>}
                  </div>
                </Field>
              )}
            </div>

            <div className="preview">
              <div className="out-frame">
                {out.ready ? (
                  <div dangerouslySetInnerHTML={{ __html: out.svg }} />
                ) : (
                  <span className={"out-empty" + (out.error ? " out-error" : "")}>{out.error ? t(out.error) : t("empty")}</span>
                )}
              </div>
              <div className="dl">
                <button className="btn btn-primary" disabled={!out.ready} onClick={() => exportPNG(getCanvas, name)}>PNG</button>
                <button className="btn" disabled={!out.ready} onClick={() => exportSVG(out.svg, name)}>SVG</button>
                <button className="btn" disabled={!out.ready} onClick={() => exportPDF(getCanvas, name)}>PDF</button>
              </div>
              <p className="note">{t("note")}</p>
            </div>
          </div>

          <div className="cta">
            <h3>{t("cta_h3")}</h3>
            <p>{t("cta_p")}</p>
            <a className="btn btn-primary" style={{ flex: "none", display: "inline-flex" }} href="/contacto">{t("cta_btn")}</a>
          </div>

          <div style={{ marginTop: 8 }}>
            <h2 className="section-title">{t("faq_title")}</h2>
            {t("faq").map(([q, a], i) => <details key={i}><summary>{q}</summary><p>{a}</p></details>)}
          </div>

          <footer className="foot">
            <span>{t("foot_free")}</span>
            <span className="foot-credit">
              {t("foot_crafted")} <span className="foot-heart" aria-label="love">♥</span> {t("foot_by")}{" "}
              <a className="foot-link" href="https://acaciaco.com.mx" target="_blank" rel="noopener noreferrer">ACACIA Consultoría</a>
            </span>
            <span><a href="/freeware">{t("foot_tools")}</a> · <a href="/legal/privacidad">{t("foot_privacy")}</a> · <a href="/contacto">{t("foot_contact")}</a></span>
          </footer>
        </div>
      </div>
    </LangContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
