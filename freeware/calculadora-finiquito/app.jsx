// Calculadora de Finiquito, Aguinaldo y Vacaciones — ACACIA freeware.
// 100% en el navegador: ningún dato sale del dispositivo.
// Reglas conforme a la Ley Federal del Trabajo (LFT) vigente y valores 2026.
// Bilingüe ES/EN con toggle visible.

const { useState, useEffect, useMemo, useCallback } = React;

/* ---------- Constantes oficiales 2026 ---------- */
const SALARIO_MINIMO_2026 = { general: 315.04, frontera: 440.87 }; // CONASAMI, vigentes 01/01/2026
const AGUINALDO_DIAS_MIN = 15;   // LFT art. 87
const PRIMA_VACACIONAL_MIN = 25; // % — LFT art. 80

/* ---------- i18n ---------- */
const STRINGS = {
  es: {
    nav_more: "← Más herramientas",
    theme_label: "Cambiar tema",
    lang_label: "Idioma",
    eyebrow: "Herramienta gratis",
    h1_a: "Calculadora de finiquito y liquidación ",
    hero_p: "Estima lo que te corresponde conforme a la Ley Federal del Trabajo. Sin instalar, sin cuenta y sin compartir tus datos.",
    privacy_chip: "Todo se calcula en tu navegador. Nada se sube a internet.",
    mx_chip: "🇲🇽 México · basada en la Ley Federal del Trabajo (LFT) 2026",
    tab_finiquito: "Finiquito",
    tab_aguinaldo: "Aguinaldo",
    tab_vacaciones: "Vacaciones",
    salary: "Salario",
    salary_hint: "bruto, sin descuentos",
    monthly: "Mensual",
    daily: "Diario",
    copy: "Copiar desglose",
    print: "Imprimir / PDF",
    copied: "¡Copiado!",
    // Aguinaldo
    ag_days_worked: "Días trabajados en el año",
    ag_days_worked_hint: "365 = año completo",
    ag_days: "Días de aguinaldo",
    ag_days_hint: "por contrato",
    r_salary_daily: "Salario diario",
    r_ag_days: "Días de aguinaldo",
    r_ag_days_sub: "mínimo legal: 15",
    r_proportion: "Proporción del año",
    r_proportion_sub: "{d} de 365 días",
    total_aguinaldo: "Aguinaldo",
    ag_note: "El aguinaldo es de al menos 15 días de salario y se paga a más tardar el 20 de diciembre. Los primeros 30 días de UMA están exentos de ISR; el resto es gravable.",
    // Vacaciones
    vac_years: "Antigüedad",
    vac_years_hint: "años cumplidos",
    prima: "Prima vacacional",
    prima_hint: "mínimo 25%",
    r_vac_days: "Días de vacaciones que te corresponden",
    r_vac_days_sub: "LFT art. 76",
    r_vac_pay: "Pago de días de vacaciones",
    r_vac_pay_sub: "si no las disfrutas",
    r_prima: "Prima vacacional ({p}%)",
    r_prima_sub: "siempre se paga",
    total_vac: "Pago de vacaciones + prima",
    vac_note: "Desde el primer año te corresponden 12 días, y aumentan 2 días por año hasta 20 (al 5º año). A partir del 6º año suben 2 días por cada 5 de antigüedad. La prima vacacional mínima es 25% sobre los días de vacaciones.",
    days_unit: "días",
    // Finiquito
    date_in: "Fecha de ingreso",
    date_out: "Fecha de baja",
    date_out_hint: "último día laborado",
    days_pending: "Días de salario pendientes",
    days_pending_hint: "del último periodo no pagado",
    vac_pending: "Vacaciones no disfrutadas",
    vac_pending_hint: "días — autocalculado, editable",
    r_seniority: "Antigüedad",
    r_years: "{y} años",
    r_salaries_pending: "Salarios pendientes",
    r_ag_prop: "Aguinaldo proporcional",
    r_ag_prop_sub: "{d} días del año",
    r_vac_unused: "Vacaciones no disfrutadas",
    r_days_sub: "{d} día(s)",
    total_finiquito: "Total del finiquito",
    fin_invalid: "Captura una fecha de ingreso y de baja válidas para ver el cálculo.",
    fin_disclaimer_html: "<strong>Finiquito ≠ Liquidación.</strong> Este cálculo es para <strong>renuncia o término de contrato</strong> e incluye lo que el patrón te debe (salarios, aguinaldo y vacaciones proporcionales + prima). La <strong>liquidación</strong> aplica solo en despido injustificado e incluye además 3 meses de salario, 20 días por año y prima de antigüedad.",
    tab_liquidacion: "Liquidación",
    liq_zona: "Zona (salario mínimo)", liq_zona_g: "General", liq_zona_f: "Frontera norte",
    liq_include20: "Incluir 20 días por año", liq_include20_hint: "aplica en ciertos despidos",
    group_finiquito: "Partes proporcionales (finiquito)",
    r_sdi: "Salario diario integrado (SDI)",
    r_indemn3: "3 meses de salario (90 días)", r_sdi_sub: "sobre el SDI",
    r_20dias: "20 días por año de servicio",
    r_prima_antig: "Prima de antigüedad", r_prima_antig_sub: "12 días/año, tope 2× SM",
    total_liquidacion: "Total de la liquidación",
    liq_note: "La liquidación aplica en despido injustificado: suma las partes proporcionales (finiquito) más la indemnización de 3 meses (90 días), 20 días por año de servicio y la prima de antigüedad. La indemnización se calcula sobre el salario diario integrado (SDI); la prima de antigüedad topa el salario a 2 veces el salario mínimo.",
    disclaimer_html: "<strong>Aviso:</strong> esta calculadora aplica <strong>únicamente a México</strong> y se basa en la Ley Federal del Trabajo (LFT) y los valores 2026 (salario mínimo general $315.04, frontera norte $440.87). Si nos visitas desde otro país, los resultados no corresponden a tu legislación local. Es una estimación informativa, no asesoría legal ni contable; para casos específicos —ISR, prima de antigüedad o despido— consulta a un profesional.",
    cta_h3: "¿Manejas nómina o RH en tu empresa?",
    cta_p: "En ACACIA automatizamos cálculos de nómina, finiquitos y prestaciones para PyMEs. Hablemos.",
    cta_btn: "Contactar a ACACIA",
    faq_title: "Preguntas frecuentes",
    faq: [
      ["¿Cómo se calcula el aguinaldo?", "Aguinaldo = salario diario × 15 × (días trabajados ÷ 365). El mínimo legal son 15 días de salario y, si no trabajaste el año completo, se paga la parte proporcional."],
      ["¿Cuántos días de vacaciones me tocan?", "El primer año son 12 días y aumentan 2 por año hasta llegar a 20 en el quinto año. Después suben 2 días por cada 5 años de antigüedad. Siempre se paga una prima vacacional mínima del 25%."],
      ["¿Qué incluye un finiquito por renuncia?", "Salarios pendientes, aguinaldo proporcional, vacaciones no disfrutadas y su prima vacacional. No incluye indemnización: eso corresponde a una liquidación por despido injustificado."],
      ["¿Mis datos se guardan o se envían?", "No. Todo el cálculo ocurre en tu navegador; ningún dato sale de tu dispositivo ni se almacena en ningún servidor."],
    ],
    foot_free: "© 2026 ACACIA · Herramienta gratis",
    foot_tools: "Herramientas",
    foot_privacy: "Privacidad",
    foot_contact: "Contacto",
    foot_crafted: "hecho con",
    foot_by: "por",
  },
  en: {
    nav_more: "← More tools",
    theme_label: "Toggle theme",
    lang_label: "Language",
    eyebrow: "Free tool",
    h1_a: "Severance & layoff pay calculator ",
    hero_p: "Estimate what you're owed under Mexico's Federal Labor Law (LFT). No install, no account, and your data stays private.",
    privacy_chip: "Everything is calculated in your browser. Nothing is uploaded.",
    mx_chip: "🇲🇽 Mexico only · based on the Federal Labor Law (LFT) 2026",
    tab_finiquito: "Severance",
    tab_aguinaldo: "Bonus",
    tab_vacaciones: "Vacation",
    salary: "Salary",
    salary_hint: "gross, before deductions",
    monthly: "Monthly",
    daily: "Daily",
    copy: "Copy breakdown",
    print: "Print / PDF",
    copied: "Copied!",
    ag_days_worked: "Days worked this year",
    ag_days_worked_hint: "365 = full year",
    ag_days: "Bonus days",
    ag_days_hint: "per contract",
    r_salary_daily: "Daily salary",
    r_ag_days: "Bonus days",
    r_ag_days_sub: "legal minimum: 15",
    r_proportion: "Proportion of year",
    r_proportion_sub: "{d} of 365 days",
    total_aguinaldo: "Year-end bonus",
    ag_note: "The year-end bonus (aguinaldo) is at least 15 days of salary and must be paid by December 20. The first 30 days of UMA are income-tax exempt; the rest is taxable.",
    vac_years: "Seniority",
    vac_years_hint: "full years",
    prima: "Vacation premium",
    prima_hint: "minimum 25%",
    r_vac_days: "Vacation days you're entitled to",
    r_vac_days_sub: "LFT art. 76",
    r_vac_pay: "Vacation days pay",
    r_vac_pay_sub: "if not taken",
    r_prima: "Vacation premium ({p}%)",
    r_prima_sub: "always paid",
    total_vac: "Vacation pay + premium",
    vac_note: "From the first year you get 12 days, increasing by 2 per year up to 20 (5th year). From the 6th year they rise 2 days every 5 years of seniority. The minimum vacation premium is 25% of the vacation days.",
    days_unit: "days",
    date_in: "Start date",
    date_out: "End date",
    date_out_hint: "last day worked",
    days_pending: "Unpaid salary days",
    days_pending_hint: "from the last unpaid period",
    vac_pending: "Unused vacation",
    vac_pending_hint: "days — auto-calculated, editable",
    r_seniority: "Seniority",
    r_years: "{y} years",
    r_salaries_pending: "Pending wages",
    r_ag_prop: "Prorated bonus",
    r_ag_prop_sub: "{d} days of the year",
    r_vac_unused: "Unused vacation",
    r_days_sub: "{d} day(s)",
    total_finiquito: "Total severance",
    fin_invalid: "Enter valid start and end dates to see the result.",
    fin_disclaimer_html: "<strong>Severance (finiquito) ≠ Layoff pay (liquidación).</strong> This calculation is for <strong>resignation or end of contract</strong> and covers what the employer owes you (wages, prorated bonus and vacation + premium). <strong>Layoff pay</strong> applies only to unjustified dismissal and additionally includes 3 months of salary, 20 days per year and a seniority premium.",
    tab_liquidacion: "Layoff pay",
    liq_zona: "Zone (minimum wage)", liq_zona_g: "General", liq_zona_f: "Northern border",
    liq_include20: "Include 20 days per year", liq_include20_hint: "applies in certain dismissals",
    group_finiquito: "Prorated amounts (severance)",
    r_sdi: "Integrated daily wage (SDI)",
    r_indemn3: "3 months of salary (90 days)", r_sdi_sub: "on the SDI",
    r_20dias: "20 days per year of service",
    r_prima_antig: "Seniority premium", r_prima_antig_sub: "12 days/year, capped at 2× MW",
    total_liquidacion: "Total layoff pay",
    liq_note: "Layoff pay applies to unjustified dismissal: it adds the prorated amounts (severance) plus the 3-month indemnity (90 days), 20 days per year of service and the seniority premium. The indemnity is computed on the integrated daily wage (SDI); the seniority premium caps the wage at twice the minimum wage.",
    disclaimer_html: "<strong>Disclaimer:</strong> this calculator applies <strong>to Mexico only</strong> and is based on Mexico's Federal Labor Law (LFT) and 2026 figures (minimum wage $315.04 general, $440.87 northern border). If you're visiting from another country, the results won't match your local regulations. It is an informational estimate, not legal or accounting advice; for specific cases —income tax, seniority premium or dismissal— consult a professional.",
    cta_h3: "Do you run payroll or HR at your company?",
    cta_p: "At ACACIA we automate payroll, severance and benefits calculations for SMBs. Let's talk.",
    cta_btn: "Contact ACACIA",
    faq_title: "FAQ",
    faq: [
      ["How is the year-end bonus calculated?", "Bonus = daily salary × 15 × (days worked ÷ 365). The legal minimum is 15 days of salary; if you didn't work the full year, the proportional part is paid."],
      ["How many vacation days do I get?", "The first year is 12 days, increasing by 2 per year up to 20 in the fifth year. After that they rise 2 days for every 5 years of seniority. A minimum 25% vacation premium is always paid."],
      ["What does a severance for resignation include?", "Pending wages, prorated bonus, unused vacation and its vacation premium. It does not include indemnity: that belongs to layoff pay for unjustified dismissal."],
      ["Is my data stored or sent anywhere?", "No. All calculations happen in your browser; no data leaves your device or is stored on any server."],
    ],
    foot_free: "© 2026 ACACIA · Free tool",
    foot_tools: "Tools",
    foot_privacy: "Privacy",
    foot_contact: "Contact",
    foot_crafted: "crafted with",
    foot_by: "by",
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

/* ---------- Helpers ---------- */
const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });
const money = (n) => (isFinite(n) ? mxn.format(Math.max(0, n)) : "—");
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

// Tabla de vacaciones (LFT art. 76, reforma "Vacaciones Dignas"):
// 1er año 12 días, +2 por año hasta 20 (5º año), luego +2 por cada 5 años.
function diasVacaciones(anios) {
  const a = Math.floor(anios);
  if (a <= 0) return 0;
  if (a <= 5) return 10 + a * 2;          // 12,14,16,18,20
  return 20 + 2 * (Math.floor((a - 6) / 5) + 1); // 6-10:22, 11-15:24, 16-20:26 ...
}

const parseDate = (s) => { if (!s) return null; const d = new Date(s + "T00:00:00"); return isNaN(d.getTime()) ? null : d; };
const daysBetween = (a, b) => Math.round((b - a) / 86400000);
const todayISO = () => new Date().toISOString().slice(0, 10);

/* ---------- UI atoms ---------- */
function Field({ label, hint, children, full }) {
  return (
    <div className={"field" + (full ? " full" : "")}>
      <label>{label}{hint ? <span className="hint"> · {hint}</span> : null}</label>
      {children}
    </div>
  );
}

function SalaryInput({ monto, setMonto, modo, setModo }) {
  const t = useT();
  return (
    <Field label={t("salary")} hint={t("salary_hint")} full>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input type="number" inputMode="decimal" min="0" placeholder="0.00"
          value={monto} onChange={(e) => setMonto(e.target.value)} style={{ flex: "1 1 180px" }} />
        <div className="seg" role="group" aria-label={t("salary")}>
          <button type="button" aria-pressed={modo === "mensual"} onClick={() => setModo("mensual")}>{t("monthly")}</button>
          <button type="button" aria-pressed={modo === "diario"} onClick={() => setModo("diario")}>{t("daily")}</button>
        </div>
      </div>
    </Field>
  );
}

function Breakdown({ rows }) {
  return (
    <div className="breakdown">
      {rows.map((r, i) => (
        <div className="row" key={i}>
          <span className="k">{r.k}{r.sub ? <small>{r.sub}</small> : null}</span>
          <span className="v mono">{r.v}</span>
        </div>
      ))}
    </div>
  );
}

function ResultActions({ buildText }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try { await navigator.clipboard.writeText(buildText()); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch (e) { /* clipboard no disponible */ }
  }, [buildText]);
  return (
    <div className="actions">
      <button className="btn" type="button" onClick={copy}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        {t("copy")}
      </button>
      <button className="btn" type="button" onClick={() => window.print()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        {t("print")}
      </button>
      {copied ? <span className="copied">{t("copied")}</span> : null}
    </div>
  );
}

/* ---------- Tab: Aguinaldo ---------- */
function Aguinaldo() {
  const t = useT();
  const [monto, setMonto] = useState("");
  const [modo, setModo] = useState("mensual");
  const [dias, setDias] = useState("365");
  const [diasAg, setDiasAg] = useState(String(AGUINALDO_DIAS_MIN));

  const sd = modo === "mensual" ? num(monto) / 30 : num(monto);
  const diasTrab = Math.min(366, Math.max(0, num(dias)));
  const factor = diasTrab / 365;
  const total = sd * num(diasAg) * factor;

  const rows = [
    { k: t("r_salary_daily"), v: money(sd) },
    { k: t("r_ag_days"), sub: t("r_ag_days_sub"), v: num(diasAg).toString() },
    { k: t("r_proportion"), sub: t("r_proportion_sub", { d: diasTrab }), v: (factor * 100).toFixed(1) + "%" },
  ];
  const buildText = () =>
    `${t("total_aguinaldo")} 2026\n${t("r_salary_daily")}: ${money(sd)}\n${t("r_ag_days")}: ${num(diasAg)}\n${t("ag_days_worked")}: ${diasTrab}/365\n${t("total_aguinaldo")}: ${money(total)}\n\nacaciaco.com.mx/freeware/calculadora-finiquito`;

  return (
    <div className="card">
      <div className="grid">
        <SalaryInput monto={monto} setMonto={setMonto} modo={modo} setModo={setModo} />
        <Field label={t("ag_days_worked")} hint={t("ag_days_worked_hint")}>
          <input type="number" inputMode="numeric" min="0" max="366" value={dias} onChange={(e) => setDias(e.target.value)} />
        </Field>
        <Field label={t("ag_days")} hint={t("ag_days_hint")}>
          <input type="number" inputMode="numeric" min="15" value={diasAg} onChange={(e) => setDiasAg(e.target.value)} />
        </Field>
      </div>

      <div className="result">
        <Breakdown rows={rows} />
        <div className="total"><span className="k">{t("total_aguinaldo")}</span><span className="v mono">{money(total)}</span></div>
        <ResultActions buildText={buildText} />
        <p className="note">{t("ag_note")}</p>
      </div>
    </div>
  );
}

/* ---------- Tab: Vacaciones ---------- */
function Vacaciones() {
  const t = useT();
  const [monto, setMonto] = useState("");
  const [modo, setModo] = useState("mensual");
  const [anios, setAnios] = useState("1");
  const [primaPct, setPrimaPct] = useState(String(PRIMA_VACACIONAL_MIN));

  const sd = modo === "mensual" ? num(monto) / 30 : num(monto);
  const dias = diasVacaciones(num(anios));
  const pagoDias = sd * dias;
  const prima = pagoDias * (num(primaPct) / 100);

  const rows = [
    { k: t("r_vac_days"), sub: t("r_vac_days_sub"), v: dias + " " + t("days_unit") },
    { k: t("r_salary_daily"), v: money(sd) },
    { k: t("r_vac_pay"), sub: t("r_vac_pay_sub"), v: money(pagoDias) },
    { k: t("r_prima", { p: num(primaPct) }), sub: t("r_prima_sub"), v: money(prima) },
  ];
  const buildText = () =>
    `${t("tab_vacaciones")} 2026 (LFT)\n${t("vac_years")}: ${num(anios)}\n${t("r_vac_days")}: ${dias}\n${t("r_salary_daily")}: ${money(sd)}\n${t("r_vac_pay")}: ${money(pagoDias)}\n${t("r_prima", { p: num(primaPct) })}: ${money(prima)}\nTotal: ${money(pagoDias + prima)}\n\nacaciaco.com.mx/freeware/calculadora-finiquito`;

  return (
    <div className="card">
      <div className="grid">
        <SalaryInput monto={monto} setMonto={setMonto} modo={modo} setModo={setModo} />
        <Field label={t("vac_years")} hint={t("vac_years_hint")}>
          <input type="number" inputMode="numeric" min="0" value={anios} onChange={(e) => setAnios(e.target.value)} />
        </Field>
        <Field label={t("prima")} hint={t("prima_hint")}>
          <input type="number" inputMode="decimal" min="25" value={primaPct} onChange={(e) => setPrimaPct(e.target.value)} />
        </Field>
      </div>

      <div className="result">
        <Breakdown rows={rows} />
        <div className="total"><span className="k">{t("total_vac")}</span><span className="v mono">{money(pagoDias + prima)}</span></div>
        <ResultActions buildText={buildText} />
        <p className="note">{t("vac_note")}</p>
      </div>
    </div>
  );
}

/* ---------- Tab: Finiquito ---------- */
function Finiquito() {
  const t = useT();
  const [monto, setMonto] = useState("");
  const [modo, setModo] = useState("mensual");
  const [ingreso, setIngreso] = useState("");
  const [baja, setBaja] = useState(todayISO());
  const [diasSalario, setDiasSalario] = useState("0");
  const [primaPct, setPrimaPct] = useState(String(PRIMA_VACACIONAL_MIN));
  const [vacOverride, setVacOverride] = useState(null); // string | null

  const sd = modo === "mensual" ? num(monto) / 30 : num(monto);
  const dIng = parseDate(ingreso);
  const dBaja = parseDate(baja);
  const valid = dIng && dBaja && dBaja >= dIng;

  const calc = useMemo(() => {
    if (!valid) return null;
    const antigDias = daysBetween(dIng, dBaja);
    const antigYears = antigDias / 365.25;
    const antigEnt = Math.floor(antigYears);

    const yearStart = new Date(dBaja.getFullYear(), 0, 1);
    const start = dIng > yearStart ? dIng : yearStart;
    const diasAnio = Math.min(366, Math.max(0, daysBetween(start, dBaja) + 1));

    const entitlement = diasVacaciones(antigEnt >= 1 ? antigEnt : 1);
    const lastAnniv = new Date(dIng); lastAnniv.setFullYear(dIng.getFullYear() + antigEnt);
    const fracDays = Math.max(0, daysBetween(lastAnniv, dBaja));
    const vacSugeridas = Math.round(entitlement * (fracDays / 365) * 10) / 10;

    return { antigYears, antigEnt, diasAnio, vacSugeridas };
  }, [valid, ingreso, baja]);

  const vacPendNum = vacOverride !== null ? num(vacOverride) : (calc ? calc.vacSugeridas : 0);
  const vacPendDisplay = vacOverride !== null ? vacOverride : (calc ? String(calc.vacSugeridas) : "0");

  const aguinaldoProp = calc ? sd * AGUINALDO_DIAS_MIN * (calc.diasAnio / 365) : 0;
  const pagoVac = sd * vacPendNum;
  const prima = pagoVac * (num(primaPct) / 100);
  const salariosPend = sd * num(diasSalario);
  const total = aguinaldoProp + pagoVac + prima + salariosPend;

  const rows = [
    { k: t("r_salary_daily"), v: money(sd) },
    { k: t("r_seniority"), v: calc ? t("r_years", { y: calc.antigYears.toFixed(2) }) : "—" },
    { k: t("r_salaries_pending"), sub: t("r_days_sub", { d: num(diasSalario) }), v: money(salariosPend) },
    { k: t("r_ag_prop"), sub: calc ? t("r_ag_prop_sub", { d: calc.diasAnio }) : "", v: money(aguinaldoProp) },
    { k: t("r_vac_unused"), sub: t("r_days_sub", { d: vacPendNum }), v: money(pagoVac) },
    { k: t("r_prima", { p: num(primaPct) }), v: money(prima) },
  ];
  const buildText = () =>
    `${t("total_finiquito")} 2026 (LFT)\n${t("r_salary_daily")}: ${money(sd)}\n${t("r_seniority")}: ${calc ? calc.antigYears.toFixed(2) : 0}\n${t("r_salaries_pending")}: ${money(salariosPend)}\n${t("r_ag_prop")}: ${money(aguinaldoProp)}\n${t("r_vac_unused")}: ${money(pagoVac)}\n${t("r_prima", { p: num(primaPct) })}: ${money(prima)}\n${t("total_finiquito")}: ${money(total)}\n\nacaciaco.com.mx/freeware/calculadora-finiquito`;

  return (
    <div className="card">
      <div className="grid">
        <SalaryInput monto={monto} setMonto={setMonto} modo={modo} setModo={setModo} />
        <Field label={t("date_in")}>
          <input type="date" value={ingreso} max={baja} onChange={(e) => { setIngreso(e.target.value); setVacOverride(null); }} />
        </Field>
        <Field label={t("date_out")} hint={t("date_out_hint")}>
          <input type="date" value={baja} onChange={(e) => { setBaja(e.target.value); setVacOverride(null); }} />
        </Field>
        <Field label={t("days_pending")} hint={t("days_pending_hint")}>
          <input type="number" inputMode="numeric" min="0" value={diasSalario} onChange={(e) => setDiasSalario(e.target.value)} />
        </Field>
        <Field label={t("vac_pending")} hint={t("vac_pending_hint")}>
          <input type="number" inputMode="decimal" min="0" value={vacPendDisplay} onChange={(e) => setVacOverride(e.target.value)} />
        </Field>
        <Field label={t("prima")} hint={t("prima_hint")}>
          <input type="number" inputMode="decimal" min="25" value={primaPct} onChange={(e) => setPrimaPct(e.target.value)} />
        </Field>
      </div>

      {valid ? (
        <div className="result">
          <Breakdown rows={rows} />
          <div className="total"><span className="k">{t("total_finiquito")}</span><span className="v mono">{money(total)}</span></div>
          <ResultActions buildText={buildText} />
        </div>
      ) : (
        <p className="note" style={{ marginTop: 16 }}>{t("fin_invalid")}</p>
      )}

      <div className="disclaimer" dangerouslySetInnerHTML={{ __html: t("fin_disclaimer_html") }} />
    </div>
  );
}

/* ---------- Tab: Liquidación (despido injustificado) ---------- */
function Liquidacion() {
  const t = useT();
  const [monto, setMonto] = useState("");
  const [modo, setModo] = useState("mensual");
  const [ingreso, setIngreso] = useState("");
  const [baja, setBaja] = useState(todayISO());
  const [diasSalario, setDiasSalario] = useState("0");
  const [primaPct, setPrimaPct] = useState(String(PRIMA_VACACIONAL_MIN));
  const [zona, setZona] = useState("general");
  const [inc20, setInc20] = useState(true);
  const [vacOverride, setVacOverride] = useState(null);

  const sd = modo === "mensual" ? num(monto) / 30 : num(monto);
  const dIng = parseDate(ingreso);
  const dBaja = parseDate(baja);
  const valid = dIng && dBaja && dBaja >= dIng;

  const calc = useMemo(() => {
    if (!valid) return null;
    const antigYears = daysBetween(dIng, dBaja) / 365.25;
    const antigEnt = Math.floor(antigYears);
    const yearStart = new Date(dBaja.getFullYear(), 0, 1);
    const start = dIng > yearStart ? dIng : yearStart;
    const diasAnio = Math.min(366, Math.max(0, daysBetween(start, dBaja) + 1));
    const entitlement = diasVacaciones(antigEnt >= 1 ? antigEnt : 1);
    const lastAnniv = new Date(dIng); lastAnniv.setFullYear(dIng.getFullYear() + antigEnt);
    const fracDays = Math.max(0, daysBetween(lastAnniv, dBaja));
    const vacSug = Math.round(entitlement * (fracDays / 365) * 10) / 10;
    return { antigYears, antigEnt, diasAnio, entitlement, vacSug };
  }, [valid, ingreso, baja]);

  const vacPendNum = vacOverride !== null ? num(vacOverride) : (calc ? calc.vacSug : 0);
  const vacPendDisplay = vacOverride !== null ? vacOverride : (calc ? String(calc.vacSug) : "0");

  const aguinaldoProp = calc ? sd * AGUINALDO_DIAS_MIN * (calc.diasAnio / 365) : 0;
  const pagoVac = sd * vacPendNum;
  const prima = pagoVac * (num(primaPct) / 100);
  const salariosPend = sd * num(diasSalario);
  const subFiniquito = salariosPend + aguinaldoProp + pagoVac + prima;

  // Indemnización (sobre salario diario integrado) + prima de antigüedad (tope 2x SM)
  const sdi = calc ? sd * (1 + AGUINALDO_DIAS_MIN / 365 + (calc.entitlement * (num(primaPct) / 100)) / 365) : sd;
  const indemn3 = 90 * sdi;
  const dias20 = inc20 && calc ? 20 * calc.antigYears * sdi : 0;
  const sm = SALARIO_MINIMO_2026[zona === "frontera" ? "frontera" : "general"];
  const salarioTopado = Math.min(sd, 2 * sm);
  const primaAntig = calc ? 12 * calc.antigYears * salarioTopado : 0;

  const total = subFiniquito + indemn3 + dias20 + primaAntig;

  const rows = [
    { k: t("r_seniority"), v: calc ? t("r_years", { y: calc.antigYears.toFixed(2) }) : "—" },
    { k: t("group_finiquito"), sub: t("r_days_sub", { d: vacPendNum }) + " · " + t("tab_vacaciones").toLowerCase(), v: money(subFiniquito) },
    { k: t("r_sdi"), v: money(sdi) },
    { k: t("r_indemn3"), sub: t("r_sdi_sub"), v: money(indemn3) },
  ];
  if (inc20) rows.push({ k: t("r_20dias"), sub: t("r_sdi_sub"), v: money(dias20) });
  rows.push({ k: t("r_prima_antig"), sub: t("r_prima_antig_sub"), v: money(primaAntig) });

  const buildText = () =>
    `${t("total_liquidacion")} 2026 (LFT)\n${t("r_seniority")}: ${calc ? calc.antigYears.toFixed(2) : 0}\n${t("group_finiquito")}: ${money(subFiniquito)}\n${t("r_sdi")}: ${money(sdi)}\n${t("r_indemn3")}: ${money(indemn3)}\n${inc20 ? t("r_20dias") + ": " + money(dias20) + "\n" : ""}${t("r_prima_antig")}: ${money(primaAntig)}\n${t("total_liquidacion")}: ${money(total)}\n\nacaciaco.com.mx/freeware/calculadora-finiquito`;

  return (
    <div className="card">
      <div className="grid">
        <SalaryInput monto={monto} setMonto={setMonto} modo={modo} setModo={setModo} />
        <Field label={t("date_in")}>
          <input type="date" value={ingreso} max={baja} onChange={(e) => { setIngreso(e.target.value); setVacOverride(null); }} />
        </Field>
        <Field label={t("date_out")} hint={t("date_out_hint")}>
          <input type="date" value={baja} onChange={(e) => { setBaja(e.target.value); setVacOverride(null); }} />
        </Field>
        <Field label={t("days_pending")} hint={t("days_pending_hint")}>
          <input type="number" inputMode="numeric" min="0" value={diasSalario} onChange={(e) => setDiasSalario(e.target.value)} />
        </Field>
        <Field label={t("vac_pending")} hint={t("vac_pending_hint")}>
          <input type="number" inputMode="decimal" min="0" value={vacPendDisplay} onChange={(e) => setVacOverride(e.target.value)} />
        </Field>
        <Field label={t("liq_zona")}>
          <select value={zona} onChange={(e) => setZona(e.target.value)}>
            <option value="general">{t("liq_zona_g")}</option>
            <option value="frontera">{t("liq_zona_f")}</option>
          </select>
        </Field>
        <Field label={t("prima")} hint={t("prima_hint")}>
          <input type="number" inputMode="decimal" min="25" value={primaPct} onChange={(e) => setPrimaPct(e.target.value)} />
        </Field>
        <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 9, alignSelf: "end" }}>
          <input id="inc20" type="checkbox" checked={inc20} onChange={(e) => setInc20(e.target.checked)} style={{ width: "auto" }} />
          <label htmlFor="inc20">{t("liq_include20")} <span className="hint">· {t("liq_include20_hint")}</span></label>
        </div>
      </div>

      {valid ? (
        <div className="result">
          <Breakdown rows={rows} />
          <div className="total"><span className="k">{t("total_liquidacion")}</span><span className="v mono">{money(total)}</span></div>
          <ResultActions buildText={buildText} />
          <p className="note">{t("liq_note")}</p>
        </div>
      ) : (
        <p className="note" style={{ marginTop: 16 }}>{t("fin_invalid")}</p>
      )}
    </div>
  );
}

/* ---------- FAQ ---------- */
function FAQ() {
  const t = useT();
  const items = t("faq");
  return (
    <div style={{ marginTop: 8 }}>
      <h2 className="section-title">{t("faq_title")}</h2>
      {items.map(([q, a], i) => (
        <details key={i}><summary>{q}</summary><p>{a}</p></details>
      ))}
    </div>
  );
}

/* ---------- App ---------- */
const TABS = [
  { id: "finiquito", key: "tab_finiquito" },
  { id: "liquidacion", key: "tab_liquidacion" },
  { id: "aguinaldo", key: "tab_aguinaldo" },
  { id: "vacaciones", key: "tab_vacaciones" },
];

function detectLang() {
  try {
    const saved = localStorage.getItem("acacia-lang");
    if (saved === "es" || saved === "en") return saved;
  } catch (e) {}
  return (navigator.language || "es").toLowerCase().startsWith("en") ? "en" : "es";
}

function App() {
  const [tab, setTab] = useState("finiquito");
  const [lang, setLang] = useState(detectLang);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("acacia-theme") || "light"; } catch (e) { return "light"; }
  });
  const t = makeT(lang);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("acacia-theme", theme); } catch (e) {}
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("lang", lang);
    try { localStorage.setItem("acacia-lang", lang); } catch (e) {}
  }, [lang]);

  return (
    <LangContext.Provider value={lang}>
      <div className="app">
        <div className="wrap">
          <div className="topbar">
            <a className="brand" href="/" aria-label="ACACIA inicio">
              <img src="/assets/acacia-logo.jpg" alt="ACACIA" width="28" height="28" />
              ACACIA
            </a>
            <div className="topbar-actions">
              <a className="ghost-link" href="/freeware">{t("nav_more")}</a>
              <div className="seg lang-seg" role="group" aria-label={t("lang_label")}>
                <button type="button" aria-pressed={lang === "es"} onClick={() => setLang("es")}>ES</button>
                <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
              </div>
              <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={t("theme_label")}>
                <svg className="moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                <svg className="sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              </button>
            </div>
          </div>

          <header className="hero">
            <span className="eyebrow"><span className="dot" aria-hidden="true"></span> {t("eyebrow")}</span>
            <h1>{t("h1_a")}<span style={{ color: "var(--accent-2)" }}>2026</span></h1>
            <p>{t("hero_p")}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span className="privacy-chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                {t("privacy_chip")}
              </span>
              <span className="privacy-chip">{t("mx_chip")}</span>
            </div>
          </header>

          <div className="tabs" role="tablist" aria-label="modos">
            {TABS.map((tb) => (
              <button key={tb.id} className="tab" role="tab" aria-selected={tab === tb.id} onClick={() => setTab(tb.id)}>{t(tb.key)}</button>
            ))}
          </div>

          {tab === "finiquito" && <Finiquito />}
          {tab === "liquidacion" && <Liquidacion />}
          {tab === "aguinaldo" && <Aguinaldo />}
          {tab === "vacaciones" && <Vacaciones />}

          <div className="disclaimer" style={{ marginTop: 18 }} dangerouslySetInnerHTML={{ __html: t("disclaimer_html") }} />

          <div className="cta">
            <h3>{t("cta_h3")}</h3>
            <p>{t("cta_p")}</p>
            <a className="btn btn-primary" href="/contacto">{t("cta_btn")}</a>
          </div>

          <FAQ />

          <footer className="foot">
            <span>{t("foot_free")}</span>
            <span className="foot-credit">
              {t("foot_crafted")} <span className="foot-heart" aria-label="love">♥</span> {t("foot_by")}{" "}
              <a className="foot-link" href="https://acaciaco.com.mx" target="_blank" rel="noopener noreferrer">ACACIA Consultoría</a>
            </span>
            <span>
              <a href="/freeware">{t("foot_tools")}</a> · <a href="/legal/privacidad">{t("foot_privacy")}</a> · <a href="/contacto">{t("foot_contact")}</a>
            </span>
          </footer>
        </div>
      </div>
    </LangContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
