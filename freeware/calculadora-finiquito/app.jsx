// Calculadora de Finiquito, Aguinaldo y Vacaciones — ACACIA freeware.
// 100% en el navegador: ningún dato sale del dispositivo.
// Reglas conforme a la Ley Federal del Trabajo (LFT) vigente y valores 2026.

const { useState, useEffect, useMemo, useCallback } = React;

/* ---------- Constantes oficiales 2026 ---------- */
const SALARIO_MINIMO_2026 = { general: 315.04, frontera: 440.87 }; // CONASAMI, vigentes 01/01/2026
const AGUINALDO_DIAS_MIN = 15;   // LFT art. 87
const PRIMA_VACACIONAL_MIN = 25; // % — LFT art. 80

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
  return (
    <Field label="Salario" hint="bruto, sin descuentos" full>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input type="number" inputMode="decimal" min="0" placeholder="0.00"
          value={monto} onChange={(e) => setMonto(e.target.value)} style={{ flex: "1 1 180px" }} />
        <div className="seg" role="group" aria-label="Periodicidad del salario">
          <button type="button" aria-pressed={modo === "mensual"} onClick={() => setModo("mensual")}>Mensual</button>
          <button type="button" aria-pressed={modo === "diario"} onClick={() => setModo("diario")}>Diario</button>
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
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try { await navigator.clipboard.writeText(buildText()); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch (e) { /* clipboard no disponible */ }
  }, [buildText]);
  return (
    <div className="actions">
      <button className="btn" type="button" onClick={copy}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copiar desglose
      </button>
      <button className="btn" type="button" onClick={() => window.print()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Imprimir / PDF
      </button>
      {copied ? <span className="copied">¡Copiado!</span> : null}
    </div>
  );
}

/* ---------- Tab: Aguinaldo ---------- */
function Aguinaldo() {
  const [monto, setMonto] = useState("");
  const [modo, setModo] = useState("mensual");
  const [dias, setDias] = useState("365");
  const [diasAg, setDiasAg] = useState(String(AGUINALDO_DIAS_MIN));

  const sd = modo === "mensual" ? num(monto) / 30 : num(monto);
  const diasTrab = Math.min(366, Math.max(0, num(dias)));
  const factor = diasTrab / 365;
  const total = sd * num(diasAg) * factor;

  const rows = [
    { k: "Salario diario", v: money(sd) },
    { k: "Días de aguinaldo", sub: "mínimo legal: 15", v: num(diasAg).toString() },
    { k: "Proporción del año", sub: diasTrab + " de 365 días", v: (factor * 100).toFixed(1) + "%" },
  ];
  const buildText = () =>
    `Aguinaldo 2026\nSalario diario: ${money(sd)}\nDías de aguinaldo: ${num(diasAg)}\nDías trabajados: ${diasTrab}/365\nAguinaldo: ${money(total)}\n\nCalculado en acaciaco.com.mx/freeware/calculadora-finiquito`;

  return (
    <div className="card">
      <div className="grid">
        <SalaryInput monto={monto} setMonto={setMonto} modo={modo} setModo={setModo} />
        <Field label="Días trabajados en el año" hint="365 = año completo">
          <input type="number" inputMode="numeric" min="0" max="366" value={dias} onChange={(e) => setDias(e.target.value)} />
        </Field>
        <Field label="Días de aguinaldo" hint="por contrato">
          <input type="number" inputMode="numeric" min="15" value={diasAg} onChange={(e) => setDiasAg(e.target.value)} />
        </Field>
      </div>

      <div className="result">
        <Breakdown rows={rows} />
        <div className="total"><span className="k">Aguinaldo</span><span className="v mono">{money(total)}</span></div>
        <ResultActions buildText={buildText} />
        <p className="note">El aguinaldo es de al menos 15 días de salario y se paga a más tardar el 20 de diciembre. Los primeros 30 días de UMA están exentos de ISR; el resto es gravable.</p>
      </div>
    </div>
  );
}

/* ---------- Tab: Vacaciones ---------- */
function Vacaciones() {
  const [monto, setMonto] = useState("");
  const [modo, setModo] = useState("mensual");
  const [anios, setAnios] = useState("1");
  const [primaPct, setPrimaPct] = useState(String(PRIMA_VACACIONAL_MIN));

  const sd = modo === "mensual" ? num(monto) / 30 : num(monto);
  const dias = diasVacaciones(num(anios));
  const pagoDias = sd * dias;
  const prima = pagoDias * (num(primaPct) / 100);

  const rows = [
    { k: "Días de vacaciones que te corresponden", sub: "LFT art. 76", v: dias + " días" },
    { k: "Salario diario", v: money(sd) },
    { k: "Pago de días de vacaciones", sub: "si no las disfrutas", v: money(pagoDias) },
    { k: `Prima vacacional (${num(primaPct)}%)`, sub: "siempre se paga", v: money(prima) },
  ];
  const buildText = () =>
    `Vacaciones 2026 (LFT)\nAntigüedad: ${num(anios)} año(s)\nDías de vacaciones: ${dias}\nSalario diario: ${money(sd)}\nPago de vacaciones: ${money(pagoDias)}\nPrima vacacional (${num(primaPct)}%): ${money(prima)}\nTotal: ${money(pagoDias + prima)}\n\nCalculado en acaciaco.com.mx/freeware/calculadora-finiquito`;

  return (
    <div className="card">
      <div className="grid">
        <SalaryInput monto={monto} setMonto={setMonto} modo={modo} setModo={setModo} />
        <Field label="Antigüedad" hint="años cumplidos">
          <input type="number" inputMode="numeric" min="0" value={anios} onChange={(e) => setAnios(e.target.value)} />
        </Field>
        <Field label="Prima vacacional" hint="mínimo 25%">
          <input type="number" inputMode="decimal" min="25" value={primaPct} onChange={(e) => setPrimaPct(e.target.value)} />
        </Field>
      </div>

      <div className="result">
        <Breakdown rows={rows} />
        <div className="total"><span className="k">Pago de vacaciones + prima</span><span className="v mono">{money(pagoDias + prima)}</span></div>
        <ResultActions buildText={buildText} />
        <p className="note">Desde el primer año te corresponden 12 días, y aumentan 2 días por año hasta 20 (al 5º año). A partir del 6º año suben 2 días por cada 5 de antigüedad. La prima vacacional mínima es 25% sobre los días de vacaciones.</p>
      </div>
    </div>
  );
}

/* ---------- Tab: Finiquito ---------- */
function Finiquito() {
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

  // Derivados
  const calc = useMemo(() => {
    if (!valid) return null;
    const antigDias = daysBetween(dIng, dBaja);
    const antigYears = antigDias / 365.25;
    const antigEnt = Math.floor(antigYears);

    // Días trabajados en el año natural de la baja (para aguinaldo proporcional)
    const yearStart = new Date(dBaja.getFullYear(), 0, 1);
    const start = dIng > yearStart ? dIng : yearStart;
    const diasAnio = Math.min(366, Math.max(0, daysBetween(start, dBaja) + 1));

    // Vacaciones proporcionales del año de servicio en curso
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
    { k: "Salario diario", v: money(sd) },
    { k: "Antigüedad", v: calc ? `${calc.antigYears.toFixed(2)} años` : "—" },
    { k: "Salarios pendientes", sub: `${num(diasSalario)} día(s)`, v: money(salariosPend) },
    { k: "Aguinaldo proporcional", sub: calc ? `${calc.diasAnio} días del año` : "", v: money(aguinaldoProp) },
    { k: "Vacaciones no disfrutadas", sub: `${vacPendNum} día(s)`, v: money(pagoVac) },
    { k: `Prima vacacional (${num(primaPct)}%)`, v: money(prima) },
  ];
  const buildText = () =>
    `Finiquito 2026 (LFT)\nSalario diario: ${money(sd)}\nAntigüedad: ${calc ? calc.antigYears.toFixed(2) : 0} años\nSalarios pendientes: ${money(salariosPend)}\nAguinaldo proporcional: ${money(aguinaldoProp)}\nVacaciones no disfrutadas: ${money(pagoVac)}\nPrima vacacional (${num(primaPct)}%): ${money(prima)}\nTOTAL FINIQUITO: ${money(total)}\n\nCalculado en acaciaco.com.mx/freeware/calculadora-finiquito`;

  return (
    <div className="card">
      <div className="grid">
        <SalaryInput monto={monto} setMonto={setMonto} modo={modo} setModo={setModo} />
        <Field label="Fecha de ingreso">
          <input type="date" value={ingreso} max={baja} onChange={(e) => { setIngreso(e.target.value); setVacOverride(null); }} />
        </Field>
        <Field label="Fecha de baja" hint="último día laborado">
          <input type="date" value={baja} onChange={(e) => { setBaja(e.target.value); setVacOverride(null); }} />
        </Field>
        <Field label="Días de salario pendientes" hint="del último periodo no pagado">
          <input type="number" inputMode="numeric" min="0" value={diasSalario} onChange={(e) => setDiasSalario(e.target.value)} />
        </Field>
        <Field label="Vacaciones no disfrutadas" hint="días — autocalculado, editable">
          <input type="number" inputMode="decimal" min="0" value={vacPendDisplay} onChange={(e) => setVacOverride(e.target.value)} />
        </Field>
        <Field label="Prima vacacional" hint="mínimo 25%">
          <input type="number" inputMode="decimal" min="25" value={primaPct} onChange={(e) => setPrimaPct(e.target.value)} />
        </Field>
      </div>

      {valid ? (
        <div className="result">
          <Breakdown rows={rows} />
          <div className="total"><span className="k">Total del finiquito</span><span className="v mono">{money(total)}</span></div>
          <ResultActions buildText={buildText} />
        </div>
      ) : (
        <p className="note" style={{ marginTop: 16 }}>Captura una fecha de ingreso y de baja válidas para ver el cálculo.</p>
      )}

      <div className="disclaimer">
        <strong>Finiquito ≠ Liquidación.</strong> Este cálculo es para <strong>renuncia o término de contrato</strong> e incluye lo que el patrón te debe (salarios, aguinaldo y vacaciones proporcionales + prima). La <strong>liquidación</strong> aplica solo en despido injustificado e incluye además 3 meses de salario, 20 días por año y prima de antigüedad.
      </div>
    </div>
  );
}

/* ---------- FAQ ---------- */
function FAQ() {
  const items = [
    ["¿Cómo se calcula el aguinaldo?", "Aguinaldo = salario diario × 15 × (días trabajados ÷ 365). El mínimo legal son 15 días de salario y, si no trabajaste el año completo, se paga la parte proporcional."],
    ["¿Cuántos días de vacaciones me tocan?", "El primer año son 12 días y aumentan 2 por año hasta llegar a 20 en el quinto año. Después suben 2 días por cada 5 años de antigüedad. Siempre se paga una prima vacacional mínima del 25%."],
    ["¿Qué incluye un finiquito por renuncia?", "Salarios pendientes, aguinaldo proporcional, vacaciones no disfrutadas y su prima vacacional. No incluye indemnización: eso corresponde a una liquidación por despido injustificado."],
    ["¿Mis datos se guardan o se envían?", "No. Todo el cálculo ocurre en tu navegador; ningún dato sale de tu dispositivo ni se almacena en ningún servidor."],
  ];
  return (
    <div style={{ marginTop: 8 }}>
      <h2 className="section-title">Preguntas frecuentes</h2>
      {items.map(([q, a], i) => (
        <details key={i}><summary>{q}</summary><p>{a}</p></details>
      ))}
    </div>
  );
}

/* ---------- App ---------- */
const TABS = [
  { id: "finiquito", label: "Finiquito" },
  { id: "aguinaldo", label: "Aguinaldo" },
  { id: "vacaciones", label: "Vacaciones" },
];

function App() {
  const [tab, setTab] = useState("finiquito");
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("acacia-theme") || "light"; } catch (e) { return "light"; }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("acacia-theme", theme); } catch (e) {}
  }, [theme]);

  return (
    <div className="app">
      <div className="wrap">
        <div className="topbar">
          <a className="brand" href="/" aria-label="ACACIA inicio">
            <img src="/assets/acacia-logo.jpg" alt="ACACIA" width="28" height="28" />
            ACACIA
          </a>
          <div className="topbar-actions">
            <a className="ghost-link" href="/freeware">← Más herramientas</a>
            <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Cambiar tema">
              <svg className="moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              <svg className="sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            </button>
          </div>
        </div>

        <header className="hero">
          <span className="eyebrow"><span className="dot" aria-hidden="true"></span> Herramienta gratis</span>
          <h1>Calculadora de finiquito, aguinaldo y vacaciones <span style={{ color: "var(--accent-2)" }}>2026</span></h1>
          <p>Estima lo que te corresponde conforme a la Ley Federal del Trabajo. Sin instalar, sin cuenta y sin compartir tus datos.</p>
          <span className="privacy-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Todo se calcula en tu navegador. Nada se sube a internet.
          </span>
        </header>

        <div className="tabs" role="tablist" aria-label="Tipo de cálculo">
          {TABS.map((t) => (
            <button key={t.id} className="tab" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {tab === "finiquito" && <Finiquito />}
        {tab === "aguinaldo" && <Aguinaldo />}
        {tab === "vacaciones" && <Vacaciones />}

        <div className="disclaimer" style={{ marginTop: 18 }}>
          <strong>Aviso:</strong> esta calculadora ofrece una estimación informativa basada en la LFT y los valores 2026 (salario mínimo general $315.04, frontera norte $440.87). No constituye asesoría legal ni contable. Para casos específicos —ISR, prima de antigüedad o despido— consulta a un profesional.
        </div>

        <div className="cta">
          <h3>¿Manejas nómina o RH en tu empresa?</h3>
          <p>En ACACIA automatizamos cálculos de nómina, finiquitos y prestaciones para PyMEs. Hablemos.</p>
          <a className="btn btn-primary" href="/contacto">Contactar a ACACIA</a>
        </div>

        <FAQ />

        <footer className="foot">
          <span>© 2026 ACACIA · Herramienta gratis</span>
          <span><a href="/freeware">Herramientas</a> · <a href="/legal/privacidad">Privacidad</a> · <a href="/contacto">Contacto</a></span>
        </footer>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
