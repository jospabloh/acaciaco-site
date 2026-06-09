// Presupuesto 50/30/20 — ACACIA freeware. 100% en el navegador. ES/EN. Acento verde lima.
const { useState, useEffect, useMemo } = React;

const STRINGS = {
  es: {
    nav_more:"← Más herramientas", theme_label:"Cambiar tema", lang_label:"Idioma", eyebrow:"Herramienta gratis",
    h1:"Presupuesto ", h1b:"50/30/20",
    hero_p:"Escribe tu ingreso neto mensual y reparte tu dinero en necesidades, gustos y ahorro. Ajusta los porcentajes a tu medida.",
    privacy_chip:"Se calcula en tu navegador. Nada se guarda ni se sube.",
    income:"Ingreso neto mensual", preset:"Método",
    p_503020:"50/30/20", p_702010:"70/20/10", p_custom:"Personalizado",
    needs:"Necesidades", wants:"Gustos", savings:"Ahorro / deudas",
    needs_sub:"Renta, comida, servicios, transporte", wants_sub:"Salidas, suscripciones, hobbies", savings_sub:"Fondo de emergencia, inversión, deudas",
    weekly:"≈ {v} por semana", reset:"Restablecer",
    sumwarn:"Los porcentajes suman {n}% (deberían sumar 100%).",
    cta_h3:"¿Quieres llevar las finanzas de tu hogar o negocio en orden?", cta_p:"FlowFin de ACACIA organiza tus finanzas personales, en pareja y familiares. Échale un ojo.", cta_btn:"Conocer FlowFin",
    faq_title:"Preguntas frecuentes",
    faq:[["¿Qué es la regla 50/30/20?","Repartir tu ingreso: 50% necesidades, 30% gustos y 20% ahorro o pago de deudas."],["¿Puedo cambiar los porcentajes?","Sí, usa 'Personalizado' y ajústalos; los montos se recalculan al instante."],["¿Se guardan mis datos?","No. Todo ocurre en tu navegador."]],
    foot_free:"© 2026 ACACIA · Herramienta gratis", foot_tools:"Herramientas", foot_privacy:"Privacidad", foot_contact:"Contacto", foot_crafted:"hecho con", foot_by:"por",
  },
  en: {
    nav_more:"← More tools", theme_label:"Toggle theme", lang_label:"Language", eyebrow:"Free tool",
    h1:"Budget ", h1b:"50/30/20",
    hero_p:"Enter your monthly net income and split it into needs, wants and savings. Adjust the percentages to fit you.",
    privacy_chip:"Calculated in your browser. Nothing is stored or uploaded.",
    income:"Monthly net income", preset:"Method",
    p_503020:"50/30/20", p_702010:"70/20/10", p_custom:"Custom",
    needs:"Needs", wants:"Wants", savings:"Savings / debt",
    needs_sub:"Rent, food, utilities, transport", wants_sub:"Dining, subscriptions, hobbies", savings_sub:"Emergency fund, investing, debt",
    weekly:"≈ {v} per week", reset:"Reset",
    sumwarn:"Percentages add up to {n}% (should be 100%).",
    cta_h3:"Want your household or business finances in order?", cta_p:"ACACIA's FlowFin organizes your personal, couple and family finances. Take a look.", cta_btn:"Explore FlowFin",
    faq_title:"FAQ",
    faq:[["What is the 50/30/20 rule?","Split your income: 50% needs, 30% wants, 20% savings or debt."],["Can I change the percentages?","Yes, use 'Custom' and adjust them; amounts recalculate instantly."],["Is my data stored?","No. Everything happens in your browser."]],
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
  const [income,setIncome]=useState("");
  const [preset,setPreset]=useState("503020");
  const [pct,setPct]=useState({n:50,w:30,s:20});
  useEffect(()=>{document.documentElement.setAttribute("data-theme",theme);try{localStorage.setItem("acacia-theme",theme);}catch(e){}},[theme]);
  useEffect(()=>{document.documentElement.setAttribute("lang",lang);try{localStorage.setItem("acacia-lang",lang);}catch(e){}},[lang]);

  const choosePreset=(p)=>{setPreset(p);if(p==="503020")setPct({n:50,w:30,s:20});else if(p==="702010")setPct({n:70,w:20,s:10});};
  const setP=(k,v)=>{setPreset("custom");setPct(p=>({...p,[k]:Math.max(0,Math.min(100,parseInt(v)||0))}));};

  const inc=num(income);
  const sum=pct.n+pct.w+pct.s;
  const amt=useMemo(()=>({n:inc*pct.n/100,w:inc*pct.w/100,s:inc*pct.s/100}),[inc,pct]);
  const C={n:"var(--need)",w:"var(--want)",s:"var(--save)"};

  const bucket=(k,name,sub)=>(
    <div className="bucket">
      <div className="bk-head">
        <div>
          <div className="bk-title"><span className="dot2" style={{background:C[k]}}></span>{name} <span style={{color:"var(--ink-3)",fontWeight:400}}>· {pct[k]}%</span></div>
          <div className="bk-sub">{sub}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div className="bk-amt mono" style={{color:C[k]}}>{money(amt[k])}</div>
          <div className="bk-sub mono">{t("weekly",{v:money(amt[k]/4.33)})}</div>
        </div>
      </div>
      {preset==="custom" && <div className="pctrow"><input type="range" min="0" max="100" value={pct[k]} onChange={(e)=>setP(k,e.target.value)} /><span className="pv mono">{pct[k]}%</span></div>}
    </div>
  );

  return (
    <LangContext.Provider value={lang}>
      <div className="app"><div className="wrap">
        <div className="topbar">
          <a className="brand" href="/" aria-label="ACACIA inicio"><img src="/assets/acacia-logo.jpg" alt="ACACIA" width="28" height="28" /> ACACIA</a>
          <div className="topbar-actions">
            <a className="ghost-link" href="/freeware">{t("nav_more")}</a>
            <div className="lang-seg" role="group" aria-label={t("lang_label")}><button type="button" aria-pressed={lang==="es"} onClick={()=>setLang("es")}>ES</button><button type="button" aria-pressed={lang==="en"} onClick={()=>setLang("en")}>EN</button></div>
            <button className="icon-btn" onClick={()=>setTheme(theme==="dark"?"light":"dark")} aria-label={t("theme_label")}>
              <svg className="moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              <svg className="sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            </button>
          </div>
        </div>
        <header className="hero">
          <span className="eyebrow"><span className="dot" aria-hidden="true"></span> {t("eyebrow")}</span>
          <h1>{t("h1")}<span style={{color:"var(--accent-2)"}}>{t("h1b")}</span></h1>
          <p>{t("hero_p")}</p>
          <span className="privacy-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>{t("privacy_chip")}</span>
        </header>

        <div className="card">
          <div className="field"><label>{t("income")}</label><input type="number" inputMode="decimal" min="0" placeholder="0.00" value={income} onChange={(e)=>setIncome(e.target.value)} /></div>
          <div className="seg" role="group" aria-label={t("preset")}>
            <button type="button" aria-pressed={preset==="503020"} onClick={()=>choosePreset("503020")}>{t("p_503020")}</button>
            <button type="button" aria-pressed={preset==="702010"} onClick={()=>choosePreset("702010")}>{t("p_702010")}</button>
            <button type="button" aria-pressed={preset==="custom"} onClick={()=>setPreset("custom")}>{t("p_custom")}</button>
          </div>

          <div className="bar" aria-hidden="true">
            <span style={{width:pct.n+"%",background:"var(--need)"}}></span>
            <span style={{width:pct.w+"%",background:"var(--want)"}}></span>
            <span style={{width:pct.s+"%",background:"var(--save)"}}></span>
          </div>

          {bucket("n",t("needs"),t("needs_sub"))}
          {bucket("w",t("wants"),t("wants_sub"))}
          {bucket("s",t("savings"),t("savings_sub"))}

          {preset==="custom" && sum!==100 && <div className="warn">{t("sumwarn",{n:sum})} <button className="btn" style={{marginLeft:6}} onClick={()=>choosePreset("503020")}>{t("reset")}</button></div>}
        </div>

        <div className="cta"><h3>{t("cta_h3")}</h3><p>{t("cta_p")}</p><a className="btn-primary" href="/apps/flowfin">{t("cta_btn")}</a></div>
        <div style={{marginTop:8}}><h2 className="section-title">{t("faq_title")}</h2>{t("faq").map(([q,a],i)=><details key={i}><summary>{q}</summary><p>{a}</p></details>)}</div>
        <footer className="foot"><span>{t("foot_free")}</span><span className="foot-credit">{t("foot_crafted")} <span className="foot-heart" aria-label="love">♥</span> {t("foot_by")} <a className="foot-link" href="https://acaciaco.com.mx" target="_blank" rel="noopener noreferrer">ACACIA Consultoría</a></span><span><a href="/freeware">{t("foot_tools")}</a> · <a href="/legal/privacidad">{t("foot_privacy")}</a> · <a href="/contacto">{t("foot_contact")}</a></span></footer>
      </div></div>
    </LangContext.Provider>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
