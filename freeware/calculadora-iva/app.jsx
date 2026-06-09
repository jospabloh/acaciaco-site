// Calculadora de IVA — ACACIA freeware. 100% en el navegador. ES/EN. Acento cian.
const { useState, useEffect, useMemo } = React;
const STRINGS = {
  es: {
    nav_more:"← Más herramientas", theme_label:"Cambiar tema", lang_label:"Idioma", eyebrow:"Herramienta gratis",
    h1:"Calculadora de ", h1b:"IVA",
    hero_p:"Agrega el IVA a un precio o desglósalo de un precio que ya lo incluye. Tasas 16%, 8% o personalizada.",
    privacy_chip:"Se calcula en tu navegador. Nada se guarda ni se sube.",
    tab_add:"Agregar IVA", tab_rem:"Desglosar IVA",
    amount_add:"Precio sin IVA", amount_rem:"Precio con IVA", rate:"Tasa de IVA",
    r_sub:"Subtotal", r_iva:"IVA", r_total:"Total",
    total_total:"Total con IVA", total_sub:"Subtotal sin IVA",
    cta_h3:"¿Facturación y contabilidad sin dolores de cabeza?",
    cta_p:"En ACACIA implementamos facturación, finanzas y control para PyMEs. Hablemos.",
    cta_btn:"Hablar con ACACIA", faq_title:"Preguntas frecuentes",
    faq:[["¿Cómo se calcula el IVA?","Para agregarlo: IVA = precio × tasa (16% = ×0.16). Para desglosarlo de un precio con IVA: subtotal = total ÷ 1.16 y el IVA es la diferencia."],["¿Cuál es la tasa en México?","La general es 16%; en la frontera 8% bajo requisitos; algunos bienes están a 0% o exentos."]],
    foot_free:"© 2026 ACACIA · Herramienta gratis", foot_tools:"Herramientas", foot_privacy:"Privacidad", foot_contact:"Contacto", foot_crafted:"hecho con", foot_by:"por",
  },
  en: {
    nav_more:"← More tools", theme_label:"Toggle theme", lang_label:"Language", eyebrow:"Free tool",
    h1:"VAT (", h1b:"IVA) calculator",
    hero_p:"Add VAT to a price or break it out of a VAT-inclusive price. Rates 16%, 8% or custom.",
    privacy_chip:"Calculated in your browser. Nothing stored or uploaded.",
    tab_add:"Add VAT", tab_rem:"Remove VAT",
    amount_add:"Price without VAT", amount_rem:"Price with VAT", rate:"VAT rate",
    r_sub:"Subtotal", r_iva:"VAT", r_total:"Total",
    total_total:"Total with VAT", total_sub:"Subtotal without VAT",
    cta_h3:"Invoicing and accounting without headaches?",
    cta_p:"At ACACIA we implement invoicing, finance and control for SMBs. Let's talk.",
    cta_btn:"Talk to ACACIA", faq_title:"FAQ",
    faq:[["How is VAT calculated?","To add it: VAT = price × rate (16% = ×0.16). To break it out of a VAT-inclusive price: subtotal = total ÷ 1.16 and VAT is the difference."],["What's the rate in Mexico?","General is 16%; border region 8% under requirements; some goods are 0% or exempt."]],
    foot_free:"© 2026 ACACIA · Free tool", foot_tools:"Tools", foot_privacy:"Privacy", foot_contact:"Contact", foot_crafted:"crafted with", foot_by:"by",
  },
};
function makeT(lang){return (k,v)=>{let s=(STRINGS[lang]&&STRINGS[lang][k])!=null?STRINGS[lang][k]:(STRINGS.es[k]!=null?STRINGS.es[k]:k);if(v&&typeof s==="string")for(var x in v)s=s.split("{"+x+"}").join(v[x]);return s;};}
const LangContext=React.createContext("es");
const mxn=new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:2});
const money=(n)=>isFinite(n)?mxn.format(Math.max(0,n)):"—";
const num=(v)=>{const n=parseFloat(v);return isFinite(n)?n:0;};
function detectLang(){try{var s=localStorage.getItem("acacia-lang");if(s==="es"||s==="en")return s;}catch(e){}return (navigator.language||"es").toLowerCase().indexOf("en")===0?"en":"es";}

function App(){
  const [lang,setLang]=useState(detectLang);
  const [theme,setTheme]=useState(()=>{try{return localStorage.getItem("acacia-theme")||"light";}catch(e){return "light";}});
  const t=makeT(lang);
  const [tab,setTab]=useState("add");
  const [monto,setMonto]=useState("");
  const [rate,setRate]=useState(16);
  useEffect(()=>{document.documentElement.setAttribute("data-theme",theme);try{localStorage.setItem("acacia-theme",theme);}catch(e){}},[theme]);
  useEffect(()=>{document.documentElement.setAttribute("lang",lang);try{localStorage.setItem("acacia-lang",lang);}catch(e){}},[lang]);

  const calc=useMemo(()=>{
    const m=num(monto), r=num(rate)/100;
    if(tab==="add"){ const sub=m; const iva=m*r; return {sub,iva,total:sub+iva}; }
    const sub=m/(1+r); return {sub,iva:m-sub,total:m};
  },[monto,rate,tab]);

  const RATES=[16,8,0];
  return (
    <LangContext.Provider value={lang}>
      <div className="app"><div className="wrap">
        <div className="topbar">
          <a className="brand" href="/" aria-label="ACACIA inicio"><img src="/assets/acacia-logo.jpg" alt="ACACIA" width="28" height="28" /> ACACIA</a>
          <div className="topbar-actions">
            <a className="ghost-link" href="/freeware">{t("nav_more")}</a>
            <div className="lang-seg" role="group" aria-label={t("lang_label")}>
              <button type="button" aria-pressed={lang==="es"} onClick={()=>setLang("es")}>ES</button>
              <button type="button" aria-pressed={lang==="en"} onClick={()=>setLang("en")}>EN</button>
            </div>
            <button className="icon-btn" onClick={()=>setTheme(theme==="dark"?"light":"dark")} aria-label={t("theme_label")}>
              <svg className="moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              <svg className="sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            </button>
          </div>
        </div>
        <header className="hero">
          <span className="eyebrow"><span className="dot" aria-hidden="true"></span> {t("eyebrow")}</span>
          <h1>{t("h1")}<span style={{color:"var(--accent-2)"}}>{t("h1b")}</span></h1>
          <p>{t("hero_p")}</p>
          <span className="privacy-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>{t("privacy_chip")}</span>
        </header>
        <div className="tabs" role="tablist" aria-label="modo">
          <button className="tab" role="tab" aria-selected={tab==="add"} onClick={()=>setTab("add")}>{t("tab_add")}</button>
          <button className="tab" role="tab" aria-selected={tab==="rem"} onClick={()=>setTab("rem")}>{t("tab_rem")}</button>
        </div>
        <div className="card">
          <div className="row2">
            <div className="field"><label>{tab==="add"?t("amount_add"):t("amount_rem")}</label><input type="number" inputMode="decimal" min="0" placeholder="0.00" value={monto} onChange={(e)=>setMonto(e.target.value)} /></div>
            <div className="field"><label>{t("rate")}</label>
              <div className="seg" role="group" aria-label={t("rate")}>
                {RATES.map((r)=><button key={r} type="button" aria-pressed={num(rate)===r} onClick={()=>setRate(r)}>{r}%</button>)}
                <input type="number" min="0" max="100" step="0.5" value={rate} onChange={(e)=>setRate(e.target.value)} style={{width:72}} aria-label={t("rate")} />
              </div>
            </div>
          </div>
          <div className="result">
            <div className="brow"><span className="k">{t("r_sub")}</span><span className="v mono">{money(calc.sub)}</span></div>
            <div className="brow"><span className="k">{t("r_iva")} ({num(rate)}%)</span><span className="v mono">{money(calc.iva)}</span></div>
            <div className="total"><span className="k">{tab==="add"?t("total_total"):t("total_sub")}</span><span className="v mono">{money(tab==="add"?calc.total:calc.sub)}</span></div>
          </div>
        </div>
        <div className="cta"><h3>{t("cta_h3")}</h3><p>{t("cta_p")}</p><a className="btn btn-primary" style={{display:"inline-flex"}} href="/contacto">{t("cta_btn")}</a></div>
        <div style={{marginTop:8}}><h2 className="section-title">{t("faq_title")}</h2>{t("faq").map(([q,a],i)=><details key={i}><summary>{q}</summary><p>{a}</p></details>)}</div>
        <footer className="foot">
          <span>{t("foot_free")}</span>
          <span className="foot-credit">{t("foot_crafted")} <span className="foot-heart" aria-label="love">♥</span> {t("foot_by")} <a className="foot-link" href="https://acaciaco.com.mx" target="_blank" rel="noopener noreferrer">ACACIA Consultoría</a></span>
          <span><a href="/freeware">{t("foot_tools")}</a> · <a href="/legal/privacidad">{t("foot_privacy")}</a> · <a href="/contacto">{t("foot_contact")}</a></span>
        </footer>
      </div></div>
    </LangContext.Provider>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
