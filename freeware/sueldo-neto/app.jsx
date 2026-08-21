// Calculadora de Sueldo Neto e ISR 2026 (México) — ACACIA freeware.
// ISR con tarifa oficial SAT (Anexo 8 RMF 2026, art. 96). 100% en el navegador. ES/EN. Acento verde esmeralda.

const { useState, useEffect, useMemo, useCallback } = React;

/* ---------- Datos oficiales 2026 (editables) ---------- */
// Tarifa mensual ISR 2026 — SAT, Anexo 8 RMF (DOF 28/12/2025), art. 96 LISR.
// [límite inferior, cuota fija, % sobre excedente]
const ISR_2026 = [
  [0.01, 0.00, 1.92],
  [844.60, 16.22, 6.40],
  [7168.52, 420.95, 10.88],
  [12598.03, 1011.68, 16.00],
  [14644.65, 1339.14, 17.92],
  [17533.65, 1856.84, 21.36],
  [35362.84, 5665.16, 23.52],
  [55736.69, 10457.09, 30.00],
  [106410.51, 25659.23, 32.00],
  [141880.67, 37009.69, 34.00],
  [425642.00, 133488.54, 35.00],
];
const SUBSIDIO_2026 = 536.22;     // subsidio al empleo mensual 2026
const SUBSIDIO_TOPE = 11492.66;   // ingreso gravable mensual máximo para el subsidio
const UMA_2026 = 113.14;          // UMA diaria (se usa para topes IMSS) — ajustable
const FACTOR_INTEGRACION = 1.0493; // factor de integración mínimo (aguinaldo 15 + prima vac. 25% sobre 12 días)

function isrMensual(base) {
  if (base <= 0) return { isr: 0, row: ISR_2026[0] };
  let row = ISR_2026[0];
  for (const r of ISR_2026) { if (base >= r[0]) row = r; else break; }
  return { isr: row[1] + (base - row[0]) * (row[2] / 100), row };
}
function imssObrero(brutoMensual) {
  const sd = brutoMensual / 30;
  let sbc = sd * FACTOR_INTEGRACION;
  const tope = 25 * UMA_2026;
  if (sbc > tope) sbc = tope;
  const dias = 30.4;
  let q = 0;
  if (sbc > 3 * UMA_2026) q += (sbc - 3 * UMA_2026) * 0.0040 * dias; // EyM especie (excedente 3 UMA)
  q += sbc * 0.0025 * dias;   // EyM prestaciones en dinero
  q += sbc * 0.00375 * dias;  // EyM gastos médicos pensionados
  q += sbc * 0.00625 * dias;  // invalidez y vida
  q += sbc * 0.01125 * dias;  // cesantía y vejez
  return q;
}

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });
const money = (n) => (isFinite(n) ? mxn.format(Math.max(0, n)) : "—");
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

const STRINGS = {
  es: {
    nav_more: "← Más herramientas", lang_label: "Idioma",
    eyebrow: "Herramienta gratis",
    h1: "Calculadora de sueldo neto e ", h1b: "ISR 2026",
    hero_p: "Calcula cuánto te queda de sueldo después del ISR y el IMSS, con la tarifa oficial del SAT 2026 y el subsidio al empleo.",
    mx_chip: "🇲🇽 México · tarifa SAT (Anexo 8 RMF) 2026",
    privacy_chip: "Se calcula en tu navegador. Nada se guarda ni se sube.",
    tab_net: "Sueldo neto", tab_isr: "Solo ISR",
    salary: "Sueldo bruto mensual", salary_hint: "antes de impuestos", base: "Ingreso gravable mensual",
    incImss: "Descontar IMSS (estimado)",
    r_bruto: "Sueldo bruto", r_isr: "ISR", r_sub: "Subsidio al empleo", r_imss: "IMSS (cuota obrero)", r_net: "Sueldo neto",
    total_net: "Sueldo neto mensual", total_isr: "ISR a retener (mensual)",
    eff: "Tasa efectiva", biweekly: "Equivale a {v} quincenal",
    copy: "Copiar", copied: "¡Copiado!",
    disclaimer: "<strong>Aviso:</strong> aplica <strong>únicamente a México</strong>. El ISR usa la tarifa mensual oficial del SAT (Anexo 8 RMF 2026, art. 96) y el subsidio al empleo 2026; el <strong>IMSS es una estimación</strong> porque depende del salario base de cotización de cada persona. Es informativa y no sustituye tu recibo de nómina ni asesoría profesional. Si visitas desde otro país, no corresponde a tu legislación.",
    cta_h3: "¿Quieres automatizar tu nómina sin errores?",
    cta_p: "En ACACIA implementamos nómina, timbrado y control de personal para PyMEs. Hablemos.",
    cta_btn: "Hablar con ACACIA",
    faq_title: "Preguntas frecuentes",
    faq: [
      ["¿Cómo se calcula el sueldo neto?", "Al bruto se le resta el ISR (tarifa mensual del SAT, ya con el subsidio al empleo) y las cuotas obrero del IMSS. Lo que queda es tu neto."],
      ["¿Qué es el subsidio al empleo 2026?", "Un apoyo que reduce el ISR de menores ingresos: $536.22 al mes cuando el ingreso gravado no supera $11,492.66."],
      ["¿Es exacto?", "El ISR usa la tarifa oficial del SAT. El IMSS es estimado porque depende del salario base de cotización. Úsalo como referencia, no como recibo."],
    ],
    foot_free: "© 2026 ACACIA · Herramienta gratis", foot_tools: "Herramientas", foot_privacy: "Privacidad", foot_contact: "Contacto", foot_crafted: "hecho con", foot_by: "por",
  },
  en: {
    nav_more: "← More tools", lang_label: "Language",
    eyebrow: "Free tool",
    h1: "Net salary & ", h1b: "income-tax (ISR) 2026",
    hero_p: "See how much of your salary is left after income tax (ISR) and social security (IMSS), using Mexico's official 2026 SAT brackets and the employment subsidy.",
    mx_chip: "🇲🇽 Mexico only · official SAT 2026 brackets",
    privacy_chip: "Calculated in your browser. Nothing stored or uploaded.",
    tab_net: "Net salary", tab_isr: "ISR only",
    salary: "Gross monthly salary", salary_hint: "before taxes", base: "Monthly taxable income",
    incImss: "Deduct IMSS (estimate)",
    r_bruto: "Gross salary", r_isr: "Income tax (ISR)", r_sub: "Employment subsidy", r_imss: "IMSS (worker quota)", r_net: "Net salary",
    total_net: "Monthly net salary", total_isr: "ISR to withhold (monthly)",
    eff: "Effective rate", biweekly: "About {v} biweekly",
    copy: "Copy", copied: "Copied!",
    disclaimer: "<strong>Disclaimer:</strong> applies <strong>to Mexico only</strong>. ISR uses the official SAT monthly table (Anexo 8 RMF 2026, art. 96) and the 2026 employment subsidy; <strong>IMSS is an estimate</strong> since it depends on each person's contribution base. Informational only — not a payslip or professional advice. If you visit from another country, it won't match your regulations.",
    cta_h3: "Want to automate payroll without errors?",
    cta_p: "At ACACIA we implement payroll, CFDI stamping and HR for SMBs. Let's talk.",
    cta_btn: "Talk to ACACIA",
    faq_title: "FAQ",
    faq: [
      ["How is net salary calculated?", "From gross we subtract ISR (SAT monthly table, with the employment subsidy applied) and the worker's IMSS quotas. What remains is your net."],
      ["What is the 2026 employment subsidy?", "A benefit that lowers ISR for lower incomes: $536.22/month when taxable income doesn't exceed $11,492.66."],
      ["Is it exact?", "ISR uses the official SAT table. IMSS is estimated because it depends on the contribution base. Use it as a reference, not a payslip."],
    ],
    foot_free: "© 2026 ACACIA · Free tool", foot_tools: "Tools", foot_privacy: "Privacy", foot_contact: "Contact", foot_crafted: "crafted with", foot_by: "by",
  },
};
function makeT(lang) { return (k, v) => { let s = (STRINGS[lang] && STRINGS[lang][k]) != null ? STRINGS[lang][k] : (STRINGS.es[k] != null ? STRINGS.es[k] : k); if (v && typeof s === "string") for (var x in v) s = s.split("{" + x + "}").join(v[x]); return s; }; }
const LangContext = React.createContext("es");

function detectLang() { try { var s = localStorage.getItem("acacia-lang"); if (s === "es" || s === "en") return s; } catch (e) {} return (navigator.language || "es").toLowerCase().indexOf("en") === 0 ? "en" : "es"; }

function App() {
  const [lang, setLang] = useState(detectLang);
  const t = makeT(lang);

  const [tab, setTab] = useState("net");
  const [monto, setMonto] = useState("");
  const [incImss, setIncImss] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => { document.documentElement.setAttribute("lang", lang); try { localStorage.setItem("acacia-lang", lang); } catch (e) {} }, [lang]);

  const calc = useMemo(() => {
    const base = num(monto);
    const { isr } = isrMensual(base);
    const sub = base <= SUBSIDIO_TOPE ? SUBSIDIO_2026 : 0;
    const isrNeto = Math.max(0, isr - sub);
    const imss = tab === "net" && incImss ? imssObrero(base) : 0;
    const neto = base - isrNeto - imss;
    const eff = base > 0 ? (isrNeto / base) * 100 : 0;
    return { base, isr, sub, isrNeto, imss, neto, eff };
  }, [monto, tab, incImss]);

  const buildText = () => {
    if (tab === "isr")
      return `ISR mensual 2026\nIngreso gravable: ${money(calc.base)}\nISR: ${money(calc.isr)}\nSubsidio: ${money(calc.sub)}\nISR a retener: ${money(calc.isrNeto)}\n\nacaciaco.com.mx/freeware/sueldo-neto`;
    return `Sueldo neto 2026\nBruto: ${money(calc.base)}\nISR: -${money(calc.isrNeto)}\nIMSS: -${money(calc.imss)}\nNeto: ${money(calc.neto)}\n\nacaciaco.com.mx/freeware/sueldo-neto`;
  };
  const copy = useCallback(async () => { try { await navigator.clipboard.writeText(buildText()); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (e) {} }, [calc, tab]);

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
            <div className="chips">
              <span className="chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>{t("privacy_chip")}</span>
              <span className="chip">{t("mx_chip")}</span>
            </div>
          </header>

          <div className="tabs" role="tablist" aria-label="modo">
            <button className="tab" role="tab" aria-selected={tab === "net"} onClick={() => setTab("net")}>{t("tab_net")}</button>
            <button className="tab" role="tab" aria-selected={tab === "isr"} onClick={() => setTab("isr")}>{t("tab_isr")}</button>
          </div>

          <div className="card">
            <div className="row2">
              <div className="field">
                <label>{tab === "isr" ? t("base") : t("salary")} {tab !== "isr" && <span className="hint">· {t("salary_hint")}</span>}</label>
                <input type="number" inputMode="decimal" min="0" placeholder="0.00" value={monto} onChange={(e) => setMonto(e.target.value)} />
              </div>
              {tab === "net" && (
                <div className="field" style={{ justifyContent: "flex-end" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
                    <input type="checkbox" style={{ width: "auto" }} checked={incImss} onChange={(e) => setIncImss(e.target.checked)} /> {t("incImss")}
                  </label>
                </div>
              )}
            </div>

            <div className="result">
              <div className="breakdown">
                {tab === "net" ? (
                  <React.Fragment>
                    <div className="brow"><span className="k">{t("r_bruto")}</span><span className="v mono">{money(calc.base)}</span></div>
                    <div className="brow"><span className="k">{t("r_isr")}{calc.sub > 0 ? <small>{t("r_sub")}: {money(calc.sub)}</small> : null}</span><span className="v mono neg">−{money(calc.isrNeto)}</span></div>
                    {incImss && <div className="brow"><span className="k">{t("r_imss")}</span><span className="v mono neg">−{money(calc.imss)}</span></div>}
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <div className="brow"><span className="k">{t("base")}</span><span className="v mono">{money(calc.base)}</span></div>
                    <div className="brow"><span className="k">{t("r_isr")} ({(calc.isr / (calc.base || 1) * 100).toFixed(1)}%)</span><span className="v mono">{money(calc.isr)}</span></div>
                    <div className="brow"><span className="k">{t("r_sub")}</span><span className="v mono pos">{calc.sub > 0 ? "−" : ""}{money(calc.sub)}</span></div>
                  </React.Fragment>
                )}
              </div>
              <div className="total"><span className="k">{tab === "net" ? t("total_net") : t("total_isr")}</span><span className="v mono">{money(tab === "net" ? calc.neto : calc.isrNeto)}</span></div>
              <div className="subline">{t("eff")}: <strong>{calc.eff.toFixed(1)}%</strong>{tab === "net" ? " · " + t("biweekly", { v: money(calc.neto / 2) }) : ""}</div>
              <div className="actions">
                <button className="btn" type="button" onClick={copy}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  {t("copy")}
                </button>
                {copied ? <span className="copied">{t("copied")}</span> : null}
              </div>
            </div>
          </div>

          <div className="disclaimer" dangerouslySetInnerHTML={{ __html: t("disclaimer") }} />

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
