// Comparar textos (diff) — ACACIA freeware. 100% en el navegador. ES/EN. Acento azul.
const { useState, useEffect, useMemo } = React;

const STRINGS = {
  es: {
    nav_more:"← Más herramientas", theme_label:"Cambiar tema", lang_label:"Idioma", eyebrow:"Herramienta gratis",
    h1:"Comparar ", h1b:"textos",
    hero_p:"Pega dos versiones y mira qué se agregó, eliminó o cambió, línea por línea. Para contratos, código y documentos.",
    privacy_chip:"La comparación ocurre en tu navegador. Nada se sube.",
    original:"Texto original", modified:"Texto modificado",
    ph_o:"Pega aquí la versión original…", ph_m:"Pega aquí la versión modificada…",
    ignorecase:"Ignorar mayúsculas", ignorews:"Ignorar espacios",
    added:"agregadas", removed:"eliminadas", same:"Sin diferencias.",
    empty:"Pega texto en ambos lados para comparar.",
    toobig:"Los textos son muy largos para comparar aquí (máx. ~4000 líneas por lado).",
    cta_h3:"¿Manejas contratos, versiones o documentación?", cta_p:"En ACACIA digitalizamos y controlamos procesos documentales para PyMEs. Hablemos.", cta_btn:"Hablar con ACACIA",
    faq_title:"Preguntas frecuentes",
    faq:[["¿Cómo comparo dos textos?","Pega el original a la izquierda y el modificado a la derecha; se resalta en rojo lo eliminado y en verde lo agregado."],["¿Se suben mis textos?","No. Todo ocurre en tu navegador; nada se envía a ningún servidor."]],
    foot_free:"© 2026 ACACIA · Herramienta gratis", foot_tools:"Herramientas", foot_privacy:"Privacidad", foot_contact:"Contacto", foot_crafted:"hecho con", foot_by:"por",
  },
  en: {
    nav_more:"← More tools", theme_label:"Toggle theme", lang_label:"Language", eyebrow:"Free tool",
    h1:"Compare ", h1b:"text",
    hero_p:"Paste two versions and see what was added, removed or changed, line by line. For contracts, code and documents.",
    privacy_chip:"The comparison happens in your browser. Nothing is uploaded.",
    original:"Original text", modified:"Modified text",
    ph_o:"Paste the original version here…", ph_m:"Paste the modified version here…",
    ignorecase:"Ignore case", ignorews:"Ignore whitespace",
    added:"added", removed:"removed", same:"No differences.",
    empty:"Paste text on both sides to compare.",
    toobig:"The texts are too long to compare here (max ~4000 lines per side).",
    cta_h3:"Do you handle contracts, versions or documentation?", cta_p:"At ACACIA we digitize and control document processes for SMBs. Let's talk.", cta_btn:"Talk to ACACIA",
    faq_title:"FAQ",
    faq:[["How do I compare two texts?","Paste the original on the left and the modified on the right; removed lines are red and added lines are green."],["Are my texts uploaded?","No. Everything happens in your browser; nothing is sent to any server."]],
    foot_free:"© 2026 ACACIA · Free tool", foot_tools:"Tools", foot_privacy:"Privacy", foot_contact:"Contact", foot_crafted:"crafted with", foot_by:"by",
  },
};
function makeT(lang){return (k,v)=>{let s=(STRINGS[lang]&&STRINGS[lang][k])!=null?STRINGS[lang][k]:(STRINGS.es[k]!=null?STRINGS.es[k]:k);if(v&&typeof s==="string")for(var x in v)s=s.split("{"+x+"}").join(v[x]);return s;};}
const LangContext=React.createContext("es");
function detectLang(){try{var s=localStorage.getItem("acacia-lang");if(s==="es"||s==="en")return s;}catch(e){}return (navigator.language||"es").toLowerCase().indexOf("en")===0?"en":"es";}

function diffLines(a, b) {
  const n = a.length, m = b.length;
  const dp = []; for (let i = 0; i <= n; i++) dp.push(new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i].k === b[j].k ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i].k === b[j].k) { ops.push({ t: "eq", l: a[i].t, ln: i + 1, rn: j + 1 }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ t: "del", l: a[i].t, ln: i + 1 }); i++; }
    else { ops.push({ t: "add", l: b[j].t, rn: j + 1 }); j++; }
  }
  while (i < n) { ops.push({ t: "del", l: a[i].t, ln: i + 1 }); i++; }
  while (j < m) { ops.push({ t: "add", l: b[j].t, rn: j + 1 }); j++; }
  return ops;
}
function buildRows(ops) {
  const rows = []; let pd = [], pa = [];
  const flush = () => { const mx = Math.max(pd.length, pa.length); for (let i = 0; i < mx; i++) rows.push({ L: pd[i] || null, R: pa[i] || null }); pd = []; pa = []; };
  ops.forEach((o) => {
    if (o.t === "eq") { flush(); rows.push({ L: { n: o.ln, t: o.l, c: "" }, R: { n: o.rn, t: o.l, c: "" } }); }
    else if (o.t === "del") pd.push({ n: o.ln, t: o.l, c: "del" });
    else pa.push({ n: o.rn, t: o.l, c: "add" });
  });
  flush();
  return rows;
}

function App(){
  const [lang,setLang]=useState(detectLang);
  const [theme,setTheme]=useState(()=>{try{return localStorage.getItem("acacia-theme")||"light";}catch(e){return "light";}});
  const t=makeT(lang);
  const [a,setA]=useState(""); const [b,setB]=useState("");
  const [ic,setIc]=useState(false); const [iw,setIw]=useState(false);
  useEffect(()=>{document.documentElement.setAttribute("data-theme",theme);try{localStorage.setItem("acacia-theme",theme);}catch(e){}},[theme]);
  useEffect(()=>{document.documentElement.setAttribute("lang",lang);try{localStorage.setItem("acacia-lang",lang);}catch(e){}},[lang]);

  const diff=useMemo(()=>{
    if(!a && !b) return {state:"empty"};
    const norm=(s)=>{let k=s; if(iw)k=k.replace(/\s+/g," ").trim(); if(ic)k=k.toLowerCase(); return k;};
    const A=a.split("\n").map(t=>({t,k:norm(t)}));
    const B=b.split("\n").map(t=>({t,k:norm(t)}));
    if(A.length>4000||B.length>4000) return {state:"toobig"};
    const ops=diffLines(A,B);
    const rows=buildRows(ops);
    const added=ops.filter(o=>o.t==="add").length, removed=ops.filter(o=>o.t==="del").length;
    return {state:"ok",rows,added,removed};
  },[a,b,ic,iw]);

  useEffect(()=>{ if(diff.state==="ok"&&(diff.added||diff.removed)&&window.acaciaTrack){ /* count once per change burst */ } },[diff.state]);

  const cell=(d)=> d ? <div className={"dl "+d.c}><span className="ln">{d.n}</span><span className="tx">{d.t===""?" ":d.t}</span></div> : <div className="dl empty"><span className="ln"></span><span className="tx"> </span></div>;

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

        <div className="io">
          <div className="panel"><div className="ph">{t("original")}</div><textarea value={a} onChange={(e)=>setA(e.target.value)} placeholder={t("ph_o")} spellCheck="false" /></div>
          <div className="panel"><div className="ph">{t("modified")}</div><textarea value={b} onChange={(e)=>setB(e.target.value)} placeholder={t("ph_m")} spellCheck="false" /></div>
        </div>
        <div className="controls">
          <label className="chk"><input type="checkbox" checked={ic} onChange={(e)=>setIc(e.target.checked)} /> {t("ignorecase")}</label>
          <label className="chk"><input type="checkbox" checked={iw} onChange={(e)=>setIw(e.target.checked)} /> {t("ignorews")}</label>
          {diff.state==="ok" && <span className="stat"><span className="a">+{diff.added} {t("added")}</span> · <span className="d">−{diff.removed} {t("removed")}</span></span>}
        </div>

        <div className="result">
          {diff.state==="empty" && <div className="empty-msg">{t("empty")}</div>}
          {diff.state==="toobig" && <div className="toobig">{t("toobig")}</div>}
          {diff.state==="ok" && (diff.added===0&&diff.removed===0
            ? <div className="empty-msg">{t("same")}</div>
            : <div className="diff">
                <div className="side left">{diff.rows.map((r,i)=><React.Fragment key={i}>{cell(r.L)}</React.Fragment>)}</div>
                <div className="side right">{diff.rows.map((r,i)=><React.Fragment key={i}>{cell(r.R)}</React.Fragment>)}</div>
              </div>)}
        </div>

        <div className="cta"><h3>{t("cta_h3")}</h3><p>{t("cta_p")}</p><a className="btn btn-primary" href="/contacto">{t("cta_btn")}</a></div>
        <div style={{marginTop:8}}><h2 className="section-title">{t("faq_title")}</h2>{t("faq").map(([q,aa],i)=><details key={i}><summary>{q}</summary><p>{aa}</p></details>)}</div>
        <footer className="foot"><span>{t("foot_free")}</span><span className="foot-credit">{t("foot_crafted")} <span className="foot-heart" aria-label="love">♥</span> {t("foot_by")} <a className="foot-link" href="https://acaciaco.com.mx" target="_blank" rel="noopener noreferrer">ACACIA Consultoría</a></span><span><a href="/freeware">{t("foot_tools")}</a> · <a href="/legal/privacidad">{t("foot_privacy")}</a> · <a href="/contacto">{t("foot_contact")}</a></span></footer>
      </div></div>
    </LangContext.Provider>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
