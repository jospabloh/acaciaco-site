// Método de Cubetas — ACACIA freeware. 100% en el navegador. ES/EN.
// Reparte tu ingreso con metodologías reales de finanzas personales.
const { useState, useEffect, useMemo, useRef } = React;

/* ── Metodologías (cada una con su fuente bibliográfica) ───────────────── */
const METHODS = [
  {
    id: "503020",
    es: { name: "50/30/20", tag: "El equilibrio clásico", src: 'E. Warren & A. W. Tyagi · “All Your Worth” (2005)' },
    en: { name: "50/30/20", tag: "The classic balance", src: 'E. Warren & A. W. Tyagi · “All Your Worth” (2005)' },
    buckets: [
      { id: "nec", c: "var(--c-blue)",  pct: 50, es: { n: "Necesidades", s: "Renta, comida, servicios, transporte" }, en: { n: "Needs", s: "Rent, food, utilities, transport" } },
      { id: "want", c: "var(--c-amber)", pct: 30, es: { n: "Gustos", s: "Salidas, suscripciones, hobbies" }, en: { n: "Wants", s: "Dining, subscriptions, hobbies" } },
      { id: "save", c: "var(--c-green)", pct: 20, es: { n: "Ahorro / deuda", s: "Fondo de emergencia, inversión, deudas" }, en: { n: "Savings / debt", s: "Emergency fund, investing, debt" } },
    ],
  },
  {
    id: "jars",
    es: { name: "6 Jarras", tag: "El sistema JARS", src: 'T. Harv Eker · “Los secretos de la mente millonaria” (2005)' },
    en: { name: "6 Jars", tag: "The JARS system", src: 'T. Harv Eker · “Secrets of the Millionaire Mind” (2005)' },
    buckets: [
      { id: "nec",  c: "var(--c-blue)",   pct: 55, es: { n: "Necesidades (NEC)", s: "Gastos esenciales del día a día" }, en: { n: "Necessities (NEC)", s: "Essential everyday expenses" } },
      { id: "ffa",  c: "var(--c-green)",  pct: 10, es: { n: "Libertad financiera (FFA)", s: "Invertir; esta jarra nunca se gasta" }, en: { n: "Financial freedom (FFA)", s: "Invest; this jar is never spent" } },
      { id: "ltss", c: "var(--c-teal)",   pct: 10, es: { n: "Ahorro a largo plazo (LTSS)", s: "Metas grandes: casa, auto, imprevistos" }, en: { n: "Long-term savings (LTSS)", s: "Big goals: home, car, big-ticket items" } },
      { id: "edu",  c: "var(--c-violet)", pct: 10, es: { n: "Educación (EDU)", s: "Cursos, libros, formación" }, en: { n: "Education (EDU)", s: "Courses, books, growth" } },
      { id: "play", c: "var(--c-amber)",  pct: 10, es: { n: "Diversión (PLAY)", s: "Gástala toda cada mes, sin culpa" }, en: { n: "Play (PLAY)", s: "Spend it all each month, guilt-free" } },
      { id: "give", c: "var(--c-rose)",   pct: 5,  es: { n: "Dar (GIVE)", s: "Donativos, regalos, generosidad" }, en: { n: "Give (GIVE)", s: "Donations, gifts, generosity" } },
    ],
  },
  {
    id: "barefoot",
    es: { name: "Barefoot", tag: "Cubetas Gastar y Crecer", src: 'Scott Pape · “The Barefoot Investor” (2016)' },
    en: { name: "Barefoot", tag: "Blow & Grow buckets", src: 'Scott Pape · “The Barefoot Investor” (2016)' },
    buckets: [
      { id: "daily",  c: "var(--c-blue)",  pct: 60, es: { n: "Diario", s: "Gastos fijos y del día a día" }, en: { n: "Daily", s: "Fixed and everyday expenses" } },
      { id: "splurge",c: "var(--c-amber)", pct: 10, es: { n: "Caprichos", s: "Date gustos sin remordimiento" }, en: { n: "Splurge", s: "Treat yourself, guilt-free" } },
      { id: "smile",  c: "var(--c-violet)",pct: 10, es: { n: "Sonríe", s: "Metas que ilusionan: viaje, fiesta" }, en: { n: "Smile", s: "Goals that excite: a trip, a party" } },
      { id: "grow",   c: "var(--c-green)", pct: 20, es: { n: "Crecer (Extintor)", s: "Paga deudas, ahorra el “Mojo” e invierte" }, en: { n: "Grow (Fire extinguisher)", s: "Kill debt, build “Mojo”, invest" } },
    ],
  },
  {
    id: "profit",
    es: { name: "Profit First", tag: "Para negocio o freelance", src: 'Mike Michalowicz · “Profit First” (2017)' },
    en: { name: "Profit First", tag: "For business or freelancers", src: 'Mike Michalowicz · “Profit First” (2017)' },
    buckets: [
      { id: "pay",    c: "var(--c-blue)",  pct: 50, es: { n: "Pago del dueño", s: "Tu sueldo por el trabajo que haces" }, en: { n: "Owner’s pay", s: "Your salary for the work you do" } },
      { id: "opex",   c: "var(--c-slate)", pct: 30, es: { n: "Gastos operativos", s: "Insumos, renta, software, servicios" }, en: { n: "Operating expenses", s: "Supplies, rent, software, services" } },
      { id: "tax",    c: "var(--c-amber)", pct: 15, es: { n: "Impuestos", s: "Aparta lo del SAT antes de gastarlo" }, en: { n: "Taxes", s: "Set aside tax before you spend it" } },
      { id: "profit", c: "var(--c-green)", pct: 5,  es: { n: "Ganancia", s: "La ganancia va primero, no al final" }, en: { n: "Profit", s: "Profit comes first, not last" } },
    ],
  },
  {
    id: "payfirst",
    es: { name: "Págate primero", tag: "La regla de Babilonia", src: 'G. S. Clason (1926) · D. Bach (2003)' },
    en: { name: "Pay yourself first", tag: "The Babylon rule", src: 'G. S. Clason (1926) · D. Bach (2003)' },
    buckets: [
      { id: "save", c: "var(--c-green)", pct: 20, es: { n: "Págate primero", s: "Ahorro e inversión, automático y al inicio" }, en: { n: "Pay yourself first", s: "Save & invest first, automatically" } },
      { id: "nec",  c: "var(--c-blue)",  pct: 50, es: { n: "Necesidades", s: "Lo indispensable para vivir" }, en: { n: "Needs", s: "Life’s essentials" } },
      { id: "life", c: "var(--c-amber)", pct: 25, es: { n: "Estilo de vida", s: "Gustos y disfrute del presente" }, en: { n: "Lifestyle", s: "Wants and enjoying today" } },
      { id: "give", c: "var(--c-rose)",  pct: 5,  es: { n: "Dar", s: "Comparte una parte de lo que ganas" }, en: { n: "Give", s: "Share a part of what you earn" } },
    ],
  },
];

const STRINGS = {
  es: {
    nav_more: "← Más herramientas", lang_label: "Idioma", eyebrow: "Herramienta gratis",
    h1: "Método de ", h1b: "Cubetas",
    hero_p: "Divide tu ingreso en “cubetas” con la metodología que más te late. Elige un método probado, ajústalo a tu medida y mira al instante cuánto va a cada cubeta.",
    privacy_chip: "Se calcula en tu navegador. Nada se guarda ni se sube.",
    income: "Tu ingreso neto", period: "Periodo", per_month: "Mensual", per_fortnight: "Quincenal", per_week: "Semanal",
    method: "Metodología", source: "Fuente",
    adjust: "Ajustar porcentajes", adjust_on: "Personalizando", reset: "Restablecer", normalize: "Normalizar a 100%",
    sumwarn: "Tus cubetas suman {n}% (deberían sumar 100%).",
    eq_month: "≈ {v}/mes", eq_week: "≈ {v}/sem", custom_badge: "personalizado",
    total: "Total repartido", copy: "Copiar resumen", copied: "¡Copiado!",
    cta_h3: "Lleva tus cubetas más allá de la calculadora",
    cta_p: "FlowFin de ACACIA convierte este método en tu día a día: presupuestos por categoría, metas de ahorro, escaneo de recibos y reportes claros — solo, en pareja o en familia.",
    cta_btn: "Conoce FlowFin", cta_note: "Prueba gratis 30 días",
    faq_title: "Preguntas frecuentes",
    faq: [
      ["¿Qué es el método de cubetas?", "Es repartir tu ingreso en grupos o “cubetas” con un destino claro (necesidades, ahorro, gustos…). Cada peso sabe a dónde va antes de gastarlo, así evitas llegar a fin de mes sin saber en qué se fue."],
      ["¿Cuál metodología me conviene?", "Si empiezas, 50/30/20 es la más simple. Si quieres más detalle y disciplina de inversión, prueba las 6 Jarras o Barefoot. Si tienes un negocio o eres freelance, Profit First está pensado para ti."],
      ["¿Puedo cambiar los porcentajes?", "Sí. Activa “Ajustar porcentajes” y mueve cada cubeta; los montos se recalculan al instante. Si no suman 100%, puedes normalizarlos con un clic."],
      ["¿Se guardan mis datos?", "No. Todo el cálculo ocurre en tu navegador; no se guarda ni se envía nada."],
    ],
    foot_free: "© 2026 ACACIA · Herramienta gratis", foot_tools: "Herramientas", foot_privacy: "Privacidad", foot_contact: "Contacto", foot_crafted: "hecho con", foot_by: "por",
    sum_head: "Reparto de {v} ({p})",
  },
  en: {
    nav_more: "← More tools", lang_label: "Language", eyebrow: "Free tool",
    h1: "The Bucket ", h1b: "Method",
    hero_p: "Split your income into “buckets” with the methodology that fits you. Pick a proven method, tweak it to your reality and see exactly how much goes to each bucket.",
    privacy_chip: "Calculated in your browser. Nothing is stored or uploaded.",
    income: "Your net income", period: "Period", per_month: "Monthly", per_fortnight: "Fortnightly", per_week: "Weekly",
    method: "Methodology", source: "Source",
    adjust: "Adjust percentages", adjust_on: "Customizing", reset: "Reset", normalize: "Normalize to 100%",
    sumwarn: "Your buckets add up to {n}% (should be 100%).",
    eq_month: "≈ {v}/mo", eq_week: "≈ {v}/wk", custom_badge: "custom",
    total: "Total allocated", copy: "Copy summary", copied: "Copied!",
    cta_h3: "Take your buckets beyond the calculator",
    cta_p: "ACACIA’s FlowFin turns this method into your daily routine: category budgets, savings goals, receipt scanning and clear reports — solo, as a couple or as a family.",
    cta_btn: "Explore FlowFin", cta_note: "Free 30-day trial",
    faq_title: "FAQ",
    faq: [
      ["What is the bucket method?", "It means splitting your income into groups or “buckets”, each with a clear purpose (needs, savings, fun…). Every peso knows where it goes before you spend it, so you never reach month-end wondering where it went."],
      ["Which methodology is right for me?", "Starting out? 50/30/20 is the simplest. Want more detail and investing discipline? Try the 6 Jars or Barefoot. Run a business or freelance? Profit First is built for you."],
      ["Can I change the percentages?", "Yes. Turn on “Adjust percentages” and move each bucket; amounts recalculate instantly. If they don’t add to 100%, normalize them in one click."],
      ["Is my data stored?", "No. Everything is computed in your browser; nothing is stored or sent."],
    ],
    foot_free: "© 2026 ACACIA · Free tool", foot_tools: "Tools", foot_privacy: "Privacy", foot_contact: "Contact", foot_crafted: "crafted with", foot_by: "by",
    sum_head: "Allocation of {v} ({p})",
  },
};

function makeT(lang) {
  return (k, v) => {
    let s = (STRINGS[lang] && STRINGS[lang][k]) != null ? STRINGS[lang][k] : (STRINGS.es[k] != null ? STRINGS.es[k] : k);
    if (v && typeof s === "string") for (var x in v) s = s.split("{" + x + "}").join(v[x]);
    return s;
  };
}
const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const mxn2 = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });
const money = (n) => (isFinite(n) ? mxn.format(Math.max(0, n)) : "—");
const money2 = (n) => (isFinite(n) ? mxn2.format(Math.max(0, n)) : "—");
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const PERIOD_TO_MONTH = { month: 1, fortnight: 2, week: 4.333 };
function detectLang() { try { var s = localStorage.getItem("acacia-lang"); if (s === "es" || s === "en") return s; } catch (e) {} return "es"; }

function App() {
  const [lang, setLang] = useState(detectLang);
  const t = makeT(lang);

  const [income, setIncome] = useState("");
  const [period, setPeriod] = useState("month");
  const [methodId, setMethodId] = useState("503020");
  const [adjust, setAdjust] = useState(false);
  const [pcts, setPcts] = useState(() => Object.fromEntries(METHODS[0].buckets.map((b) => [b.id, b.pct])));
  const [customized, setCustomized] = useState(false);
  const [copied, setCopied] = useState(false);

  const method = useMemo(() => METHODS.find((m) => m.id === methodId) || METHODS[0], [methodId]);

  useEffect(() => { document.documentElement.setAttribute("lang", lang === "en" ? "en" : "es-MX"); try { localStorage.setItem("acacia-lang", lang); } catch (e) {} }, [lang]);

  const pickMethod = (id) => {
    const m = METHODS.find((x) => x.id === id) || METHODS[0];
    setMethodId(id);
    setPcts(Object.fromEntries(m.buckets.map((b) => [b.id, b.pct])));
    setCustomized(false);
  };
  const setP = (k, v) => { setCustomized(true); setPcts((p) => ({ ...p, [k]: Math.max(0, Math.min(100, Math.round(parseFloat(v) || 0))) })); };
  const resetPct = () => { setPcts(Object.fromEntries(method.buckets.map((b) => [b.id, b.pct]))); setCustomized(false); };
  const normalize = () => {
    const sum = method.buckets.reduce((a, b) => a + (pcts[b.id] || 0), 0) || 1;
    const next = {}; method.buckets.forEach((b) => { next[b.id] = Math.round(((pcts[b.id] || 0) * 100) / sum); });
    setPcts(next);
  };

  const inc = num(income);
  const sum = method.buckets.reduce((a, b) => a + (pcts[b.id] || 0), 0);
  const toMonth = PERIOD_TO_MONTH[period];
  const periodName = period === "month" ? t("per_month") : period === "fortnight" ? t("per_fortnight") : t("per_week");

  const amt = (b) => inc * (pcts[b.id] || 0) / 100; // en el periodo elegido
  const subFor = (b) => {
    const a = amt(b);
    if (period === "month") return t("eq_week", { v: money(a / 4.333) });
    return t("eq_month", { v: money(a * toMonth) });
  };

  const copySummary = () => {
    const lines = [];
    lines.push(t("sum_head", { v: money2(inc) + "/" + periodName.toLowerCase(), p: (method[lang] || method.es).name }));
    method.buckets.forEach((b) => { const tx = b[lang] || b.es; lines.push("• " + tx.n + " (" + (pcts[b.id] || 0) + "%): " + money2(amt(b))); });
    lines.push("— ACACIA · acaciaco.com.mx/freeware/metodo-cubetas");
    const text = lines.join("\n");
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1800); if (window.acaciaTrack) window.acaciaTrack("cubetas_copy", { method: methodId }); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
    else { try { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); } catch (e) {} done(); }
  };

  const src = (method[lang] || method.es).src;

  return (
    <div className="app"><div className="wrap">
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
        <span className="privacy-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>{t("privacy_chip")}</span>
      </header>

      <div className="card">
        <div className="grid2">
          <div className="field"><label>{t("income")}</label><input type="number" inputMode="decimal" min="0" placeholder="0.00" value={income} onChange={(e) => setIncome(e.target.value)} /></div>
          <div className="field"><label>{t("period")}</label>
            <div className="seg" role="group" aria-label={t("period")}>
              <button type="button" aria-pressed={period === "month"} onClick={() => setPeriod("month")}>{t("per_month")}</button>
              <button type="button" aria-pressed={period === "fortnight"} onClick={() => setPeriod("fortnight")}>{t("per_fortnight")}</button>
              <button type="button" aria-pressed={period === "week"} onClick={() => setPeriod("week")}>{t("per_week")}</button>
            </div>
          </div>
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label>{t("method")}</label>
          <div className="method-tabs" role="tablist" aria-label={t("method")}>
            {METHODS.map((m) => {
              const mx = m[lang] || m.es;
              return (
                <button key={m.id} role="tab" type="button" aria-selected={m.id === methodId} className={"mtab" + (m.id === methodId ? " on" : "")} onClick={() => pickMethod(m.id)}>
                  <span className="mtab-n">{mx.name}</span>
                  <span className="mtab-t">{mx.tag}</span>
                </button>
              );
            })}
          </div>
          <div className="src-chip"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg><span>{t("source")}: {src}</span></div>
        </div>

        <div className="bar" aria-hidden="true">
          {method.buckets.map((b) => <span key={b.id} style={{ width: (sum ? (pcts[b.id] || 0) / sum * 100 : 0) + "%", background: b.c }} title={(b[lang] || b.es).n}></span>)}
        </div>

        <div className="adjust-row">
          <button type="button" className={"toggle" + (adjust ? " on" : "")} aria-pressed={adjust} onClick={() => setAdjust(!adjust)}>
            <span className="knob"></span>{adjust ? t("adjust_on") : t("adjust")}
          </button>
          {customized && <button className="btn" onClick={resetPct}>{t("reset")}</button>}
        </div>

        {method.buckets.map((b) => {
          const tx = b[lang] || b.es;
          return (
            <div className="bucket" key={b.id}>
              <div className="bk-head">
                <div className="bk-left">
                  <span className="dot2" style={{ background: b.c }}></span>
                  <div>
                    <div className="bk-title">{tx.n} <span className="bk-pct">· {pcts[b.id] || 0}%</span></div>
                    <div className="bk-sub">{tx.s}</div>
                  </div>
                </div>
                <div className="bk-right">
                  <div className="bk-amt mono" style={{ color: b.c }}>{money2(amt(b))}</div>
                  <div className="bk-sub mono">{subFor(b)}</div>
                </div>
              </div>
              {adjust && <div className="pctrow"><input type="range" min="0" max="100" value={pcts[b.id] || 0} onChange={(e) => setP(b.id, e.target.value)} aria-label={tx.n} style={{ accentColor: b.c }} /><span className="pv mono">{pcts[b.id] || 0}%</span></div>}
            </div>
          );
        })}

        {adjust && sum !== 100 && (
          <div className="warn">{t("sumwarn", { n: sum })} <button className="btn btn-accent" style={{ marginLeft: 6 }} onClick={normalize}>{t("normalize")}</button></div>
        )}

        <div className="total-row">
          <span>{t("total")}: <strong className="mono">{money2(inc * sum / 100)}</strong> {customized && <em className="custom-badge">{t("custom_badge")}</em>}</span>
          <button className="btn copy-btn" onClick={copySummary} disabled={!inc}>
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      </div>

      <div className="cta">
        <h3>{t("cta_h3")}</h3>
        <p>{t("cta_p")}</p>
        <a className="btn-primary" href="/apps/flowfin" onClick={() => { if (window.acaciaTrack) window.acaciaTrack("promo_click", { app: "flowfin", from: location.pathname }); }}>{t("cta_btn")}</a>
        <div className="cta-note">{t("cta_note")}</div>
      </div>

      <div style={{ marginTop: 8 }}>
        <h2 className="section-title">{t("faq_title")}</h2>
        {t("faq").map(([q, a], i) => <details key={i}><summary>{q}</summary><p>{a}</p></details>)}
      </div>

      <footer className="foot">
        <span>{t("foot_free")}</span>
        <span className="foot-credit">{t("foot_crafted")} <span className="foot-heart" aria-label="love">♥</span> {t("foot_by")} <a className="foot-link" href="https://acaciaco.com.mx" target="_blank" rel="noopener noreferrer">ACACIA Consultoría</a></span>
        <span><a href="/freeware">{t("foot_tools")}</a> · <a href="/legal/privacidad">{t("foot_privacy")}</a> · <a href="/contacto">{t("foot_contact")}</a></span>
      </footer>
    </div></div>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
