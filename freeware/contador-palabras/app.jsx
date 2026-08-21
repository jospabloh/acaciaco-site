// Contador de Palabras y Caracteres — ACACIA freeware. 100% en el navegador. ES/EN. Acento índigo.
const { useState, useEffect, useMemo } = React;
const STRINGS = {
  es: {
    nav_more:"← Más herramientas", lang_label:"Idioma", eyebrow:"Herramienta gratis",
    h1:"Contador de ", h1b:"palabras",
    hero_p:"Cuenta palabras, caracteres, oraciones, párrafos y tiempo de lectura mientras escribes.",
    privacy_chip:"Tu texto no se sube: todo ocurre en tu navegador.",
    words:"Palabras", chars:"Caracteres", chars_ns:"Sin espacios", sentences:"Oraciones", paragraphs:"Párrafos", reading:"Lectura",
    placeholder:"Escribe o pega tu texto aquí…",
    copy:"Copiar", clear:"Limpiar", copied:"¡Copiado!", min:"min",
    cta_h3:"¿Necesitas contenido o sistemas para tu negocio?",
    cta_p:"En ACACIA creamos sitios, sistemas y soluciones a la medida para PyMEs. Hablemos.",
    cta_btn:"Hablar con ACACIA", faq_title:"Preguntas frecuentes",
    faq:[["¿Mi texto se guarda o se sube?","No. El conteo ocurre en tu navegador; el texto nunca se envía a ningún servidor."],["¿Cómo se calcula el tiempo de lectura?","Con un promedio de 200 palabras por minuto, la velocidad media de un adulto."]],
    foot_free:"© 2026 ACACIA · Herramienta gratis", foot_tools:"Herramientas", foot_privacy:"Privacidad", foot_contact:"Contacto", foot_crafted:"hecho con", foot_by:"por",
  },
  en: {
    nav_more:"← More tools", lang_label:"Language", eyebrow:"Free tool",
    h1:"Word ", h1b:"counter",
    hero_p:"Count words, characters, sentences, paragraphs and reading time as you type.",
    privacy_chip:"Your text isn't uploaded: everything happens in your browser.",
    words:"Words", chars:"Characters", chars_ns:"No spaces", sentences:"Sentences", paragraphs:"Paragraphs", reading:"Reading",
    placeholder:"Type or paste your text here…",
    copy:"Copy", clear:"Clear", copied:"Copied!", min:"min",
    cta_h3:"Need content or systems for your business?",
    cta_p:"At ACACIA we build custom sites, systems and solutions for SMBs. Let's talk.",
    cta_btn:"Talk to ACACIA", faq_title:"FAQ",
    faq:[["Is my text stored or uploaded?","No. Counting happens in your browser; the text is never sent to any server."],["How is reading time calculated?","Using an average of 200 words per minute, a typical adult's reading speed."]],
    foot_free:"© 2026 ACACIA · Free tool", foot_tools:"Tools", foot_privacy:"Privacy", foot_contact:"Contact", foot_crafted:"crafted with", foot_by:"by",
  },
};
function makeT(lang){return (k,v)=>{let s=(STRINGS[lang]&&STRINGS[lang][k])!=null?STRINGS[lang][k]:(STRINGS.es[k]!=null?STRINGS.es[k]:k);if(v&&typeof s==="string")for(var x in v)s=s.split("{"+x+"}").join(v[x]);return s;};}
const LangContext=React.createContext("es");
function detectLang(){try{var s=localStorage.getItem("acacia-lang");if(s==="es"||s==="en")return s;}catch(e){}return (navigator.language||"es").toLowerCase().indexOf("en")===0?"en":"es";}

function App(){
  const [lang,setLang]=useState(detectLang);
  const t=makeT(lang);
  const [text,setText]=useState("");
  const [copied,setCopied]=useState(false);
  useEffect(()=>{document.documentElement.setAttribute("lang",lang);try{localStorage.setItem("acacia-lang",lang);}catch(e){}},[lang]);

  const s=useMemo(()=>{
    const trimmed=text.trim();
    const words=trimmed?trimmed.split(/\s+/).length:0;
    const chars=text.length;
    const charsNs=text.replace(/\s/g,"").length;
    const sentences=(text.match(/[^.!?…]+[.!?…]+/g)||[]).length || (trimmed?1:0);
    const paragraphs=trimmed?trimmed.split(/\n{1,}/).filter(p=>p.trim()).length:0;
    const mins=Math.max(words?1:0,Math.round(words/200));
    return {words,chars,charsNs,sentences,paragraphs,mins};
  },[text]);

  const copy=async()=>{try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),1600);}catch(e){}};

  const CARDS=[["words",s.words],["chars",s.chars],["chars_ns",s.charsNs],["reading",s.mins+" "+t("min")],["sentences",s.sentences],["paragraphs",s.paragraphs]];
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
          </div>
        </div>
        <header className="hero">
          <span className="eyebrow"><span className="dot" aria-hidden="true"></span> {t("eyebrow")}</span>
          <h1>{t("h1")}<span style={{color:"var(--accent-2)"}}>{t("h1b")}</span></h1>
          <p>{t("hero_p")}</p>
          <span className="privacy-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>{t("privacy_chip")}</span>
        </header>
        <div className="stats">
          {CARDS.map(([k,v])=><div className="stat" key={k}><div className="n mono">{v}</div><div className="l">{t(k)}</div></div>)}
        </div>
        <textarea value={text} onChange={(e)=>setText(e.target.value)} placeholder={t("placeholder")} aria-label={t("h1")+t("h1b")} />
        <div className="bar">
          <span></span>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {copied?<span className="copied">{t("copied")}</span>:null}
            <button className="btn" onClick={copy} disabled={!text}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>{t("copy")}
            </button>
            <button className="btn" onClick={()=>setText("")} disabled={!text}>{t("clear")}</button>
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
