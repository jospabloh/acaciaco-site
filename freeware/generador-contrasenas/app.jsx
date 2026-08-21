// Generador de Contraseñas — ACACIA freeware.
// crypto.getRandomValues, 100% en el navegador: nada se guarda ni se envía. ES/EN. Acento dorado.

const { useState, useEffect, useCallback, useMemo } = React;

const STRINGS = {
  es: {
    nav_more: "← Más herramientas", lang_label: "Idioma",
    eyebrow: "Herramienta gratis",
    h1: "Generador de ", h1b: "contraseñas",
    hero_p: "Crea contraseñas aleatorias seguras o frases fáciles de recordar. Ajusta longitud y caracteres; nada se guarda ni se envía.",
    privacy_chip: "Generadas con criptografía en tu navegador. Nada se guarda ni se sube.",
    tab_pw: "Contraseña", tab_phrase: "Frase",
    length: "Longitud", words: "Palabras", separator: "Separador",
    upper: "Mayúsculas (A-Z)", lower: "Minúsculas (a-z)", numbers: "Números (0-9)", symbols: "Símbolos (!@#)", noambig: "Evitar caracteres ambiguos", cap: "Capitalizar palabras", addnum: "Añadir número",
    copy: "Copiar", regen: "Generar otra", copied: "¡Copiado!",
    strength: "Fortaleza", entropy: "{b} bits",
    s0: "Muy débil", s1: "Débil", s2: "Aceptable", s3: "Fuerte", s4: "Muy fuerte",
    need_set: "Selecciona al menos un tipo de carácter.",
    cta_h3: "¿Tu empresa necesita seguridad y sistemas confiables?",
    cta_p: "En ACACIA construimos software seguro a la medida para PyMEs. Hablemos.",
    cta_btn: "Hablar con ACACIA",
    faq_title: "Preguntas frecuentes",
    faq: [
      ["¿Qué hace segura a una contraseña?", "La longitud y la aleatoriedad. 16+ caracteres con variedad, o una frase de varias palabras al azar, es muy difícil de adivinar."],
      ["¿Se guarda o envía mi contraseña?", "No. Se genera en tu navegador con criptografía segura y nunca se guarda ni se envía a ningún servidor."],
      ["¿Qué es una frase de contraseña?", "Una contraseña de varias palabras al azar (p. ej. roble-faro-nube-42): muy segura y más fácil de recordar."],
    ],
    foot_free: "© 2026 ACACIA · Herramienta gratis", foot_tools: "Herramientas", foot_privacy: "Privacidad", foot_contact: "Contacto", foot_crafted: "hecho con", foot_by: "por",
  },
  en: {
    nav_more: "← More tools", lang_label: "Language",
    eyebrow: "Free tool",
    h1: "Password ", h1b: "generator",
    hero_p: "Create strong random passwords or memorable passphrases. Tune length and characters; nothing is stored or sent.",
    privacy_chip: "Generated with cryptography in your browser. Nothing is stored or uploaded.",
    tab_pw: "Password", tab_phrase: "Passphrase",
    length: "Length", words: "Words", separator: "Separator",
    upper: "Uppercase (A-Z)", lower: "Lowercase (a-z)", numbers: "Numbers (0-9)", symbols: "Symbols (!@#)", noambig: "Avoid ambiguous characters", cap: "Capitalize words", addnum: "Add a number",
    copy: "Copy", regen: "Generate another", copied: "Copied!",
    strength: "Strength", entropy: "{b} bits",
    s0: "Very weak", s1: "Weak", s2: "Fair", s3: "Strong", s4: "Very strong",
    need_set: "Select at least one character type.",
    cta_h3: "Does your company need security and reliable systems?",
    cta_p: "At ACACIA we build secure custom software for SMBs. Let's talk.",
    cta_btn: "Talk to ACACIA",
    faq_title: "FAQ",
    faq: [
      ["What makes a password strong?", "Length and randomness. 16+ varied characters, or a multi-word random passphrase, is very hard to guess."],
      ["Is my password stored or sent?", "No. It's generated in your browser with secure cryptography and never stored or sent to any server."],
      ["What is a passphrase?", "A password made of several random words (e.g. oak-beacon-cloud-42): very secure and easier to remember."],
    ],
    foot_free: "© 2026 ACACIA · Free tool", foot_tools: "Tools", foot_privacy: "Privacy", foot_contact: "Contact", foot_crafted: "crafted with", foot_by: "by",
  },
};
function makeT(lang) { return (k, v) => { let s = (STRINGS[lang] && STRINGS[lang][k]) != null ? STRINGS[lang][k] : (STRINGS.es[k] != null ? STRINGS.es[k] : k); if (v && typeof s === "string") for (var x in v) s = s.split("{" + x + "}").join(v[x]); return s; }; }
const LangContext = React.createContext("es");

const WORDS = ("able acid aqua arch atom aura bath bean bear bell bird blue boat bold bone book brave brick calm cane card cave city clay cloud coal coin cool copper coral crane cube dawn deer disk dome dove drum dune duty east echo edge ember fern fire flag fox frost gate gem gold grape green grove hawk herb hill iris iron ivory jade jazz kelp kite lake lamp leaf lime lion lotus luck lunar maple mint mist moon moss nest noble north nova oak oasis ocean olive onyx opal orbit otter palm peak pearl pine plum pond quartz quiet rain reed reef river robin rose ruby sage salt sand seal silver sky slate snow solar spark stone storm swan teal tide tiger topaz tower vine violet wave willow wolf zinc").split(" ");

const SETS = { upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", lower: "abcdefghijklmnopqrstuvwxyz", numbers: "0123456789", symbols: "!@#$%^&*()-_=+[]{};:,.?" };
const AMBIG = "il1Lo0O";

function randInts(n) { const a = new Uint32Array(n); crypto.getRandomValues(a); return a; }
function genPassword(len, opts) {
  let pool = "";
  if (opts.upper) pool += SETS.upper;
  if (opts.lower) pool += SETS.lower;
  if (opts.numbers) pool += SETS.numbers;
  if (opts.symbols) pool += SETS.symbols;
  if (opts.noambig) pool = pool.split("").filter((c) => AMBIG.indexOf(c) === -1).join("");
  if (!pool) return { value: "", pool: 0 };
  const r = randInts(len); let out = "";
  for (let i = 0; i < len; i++) out += pool[r[i] % pool.length];
  return { value: out, pool: pool.length };
}
function genPhrase(count, sep, cap, addnum) {
  const r = randInts(count); const ws = [];
  for (let i = 0; i < count; i++) { let w = WORDS[r[i] % WORDS.length]; if (cap) w = w[0].toUpperCase() + w.slice(1); ws.push(w); }
  let s = ws.join(sep);
  if (addnum) { const n = randInts(1); s += sep + (10 + (n[0] % 90)); }
  return s;
}

function detectLang() { try { var s = localStorage.getItem("acacia-lang"); if (s === "es" || s === "en") return s; } catch (e) {} return (navigator.language || "es").toLowerCase().indexOf("en") === 0 ? "en" : "es"; }

function App() {
  const [lang, setLang] = useState(detectLang);
  const t = makeT(lang);

  const [tab, setTab] = useState("pw");
  const [len, setLen] = useState(16);
  const [opts, setOpts] = useState({ upper: true, lower: true, numbers: true, symbols: true, noambig: false });
  const [wcount, setWcount] = useState(4);
  const [sep, setSep] = useState("-");
  const [cap, setCap] = useState(true);
  const [addnum, setAddnum] = useState(true);
  const [value, setValue] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => { document.documentElement.setAttribute("lang", lang); try { localStorage.setItem("acacia-lang", lang); } catch (e) {} }, [lang]);

  const anySet = opts.upper || opts.lower || opts.numbers || opts.symbols;

  const generate = useCallback(() => {
    if (tab === "pw") { setValue(genPassword(len, opts).value); }
    else { setValue(genPhrase(wcount, sep, cap, addnum)); }
    setCopied(false);
  }, [tab, len, opts, wcount, sep, cap, addnum]);

  useEffect(() => { generate(); }, [generate]);

  const bits = useMemo(() => {
    if (tab === "pw") { const p = genPassword(len, opts).pool; return p > 1 ? Math.round(len * Math.log2(p)) : 0; }
    let b = wcount * Math.log2(WORDS.length); if (addnum) b += Math.log2(90);
    return Math.round(b);
  }, [tab, len, opts, wcount, addnum]);

  const level = bits < 40 ? 0 : bits < 60 ? 1 : bits < 80 ? 2 : bits < 112 ? 3 : 4;
  const COLORS = ["oklch(0.6 0.2 25)", "oklch(0.68 0.17 55)", "oklch(0.78 0.15 95)", "oklch(0.6 0.15 150)", "oklch(0.55 0.16 155)"];
  const sLabel = t("s" + level);

  const copy = async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (e) {} };

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

          <div className="tabs" role="tablist" aria-label="tipo">
            <button className="tab" role="tab" aria-selected={tab === "pw"} onClick={() => setTab("pw")}>{t("tab_pw")}</button>
            <button className="tab" role="tab" aria-selected={tab === "phrase"} onClick={() => setTab("phrase")}>{t("tab_phrase")}</button>
          </div>

          <div className="out">
            <div className="pw">
              <div className="pw-text mono">{value || (tab === "pw" && !anySet ? t("need_set") : "…")}</div>
              <div className="pw-actions">
                <button className="iconbtn" onClick={generate} aria-label={t("regen")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></button>
                <button className="iconbtn" onClick={copy} aria-label={t("copy")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
              </div>
            </div>
            <div className="strength">
              <div className="meter">{[0, 1, 2, 3].map((i) => <span className="seg" key={i} style={{ background: i <= level - 1 || (level === 4) ? COLORS[level] : (i < level ? COLORS[level] : "var(--line)") }} />)}</div>
              <div className="strength-row"><span>{t("strength")}: <strong style={{ color: COLORS[level] }}>{sLabel}</strong></span><span className="mono">{copied ? <span className="copied">{t("copied")}</span> : t("entropy", { b: bits })}</span></div>
            </div>
          </div>

          <div className="controls">
            {tab === "pw" ? (
              <React.Fragment>
                <div className="ctl-row"><label>{t("length")}</label><span className="range-val mono">{len}</span></div>
                <input type="range" min="6" max="48" value={len} onChange={(e) => setLen(parseInt(e.target.value))} />
                <div className="checks">
                  {["upper", "lower", "numbers", "symbols", "noambig"].map((k) => (
                    <label className="chk" key={k}><input type="checkbox" checked={opts[k]} onChange={(e) => setOpts((p) => ({ ...p, [k]: e.target.checked }))} /> {t(k === "noambig" ? "noambig" : k)}</label>
                  ))}
                </div>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <div className="ctl-row"><label>{t("words")}</label><span className="range-val mono">{wcount}</span></div>
                <input type="range" min="3" max="8" value={wcount} onChange={(e) => setWcount(parseInt(e.target.value))} />
                <div className="ctl-row">
                  <label>{t("separator")}</label>
                  <select value={sep} onChange={(e) => setSep(e.target.value)}>
                    <option value="-">- (guion)</option><option value=".">. (punto)</option><option value="_">_ (guion bajo)</option><option value=" ">␣ (espacio)</option>
                  </select>
                </div>
                <div className="checks">
                  <label className="chk"><input type="checkbox" checked={cap} onChange={(e) => setCap(e.target.checked)} /> {t("cap")}</label>
                  <label className="chk"><input type="checkbox" checked={addnum} onChange={(e) => setAddnum(e.target.checked)} /> {t("addnum")}</label>
                </div>
              </React.Fragment>
            )}
            <button className="btn btn-primary" onClick={generate}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              {t("regen")}
            </button>
          </div>

          <div className="cta"><h3>{t("cta_h3")}</h3><p>{t("cta_p")}</p><a className="btn btn-primary" style={{ width: "auto", display: "inline-flex" }} href="/contacto">{t("cta_btn")}</a></div>

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
