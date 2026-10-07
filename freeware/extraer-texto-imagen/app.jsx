// Extraer texto de imagen (OCR) — ACACIA freeware. Tesseract.js en el navegador. ES/EN. Acento cian.
const { useState, useEffect, useRef, useCallback } = React;

const STRINGS = {
  es: {
    nav_more:"← Más herramientas", lang_label:"Idioma", eyebrow:"Herramienta gratis",
    h1:"Extraer texto de ", h1b:"una imagen",
    hero_p:"Convierte una foto, captura o documento escaneado en texto editable con OCR. La imagen no se sube.",
    privacy_chip:"El OCR ocurre en tu navegador. Tu imagen no se sube.",
    drop_h:"Arrastra una imagen aquí", drop_p:"o haz clic para elegirla · JPG, PNG…",
    ocrlang:"Idioma del texto", spa:"Español", eng:"Inglés", both:"Español + Inglés",
    extract:"Extraer texto", working:"Procesando…", change:"Cambiar imagen",
    output:"Texto extraído", copy:"Copiar", download:"Descargar", copied:"¡Copiado!", empty:"El texto reconocido aparecerá aquí.",
    err:"No se pudo procesar la imagen. Intenta con otra más nítida.",
    cta_h3:"¿Digitalizas muchos documentos o formatos?", cta_p:"En ACACIA automatizamos captura y procesamiento de documentos para PyMEs. Hablemos.", cta_btn:"Hablar con ACACIA",
    faq_title:"Preguntas frecuentes",
    faq:[["¿Cómo extraigo texto de una imagen?","Sube la imagen, elige el idioma y pulsa Extraer; copia o descarga el texto."],["¿Mi imagen se sube?","No. El OCR corre en tu navegador; solo se descarga una vez el modelo de idioma."],["¿Sirve con manuscrito?","Funciona mejor con texto impreso y nítido; el manuscrito es menos preciso."]],
    foot_free:"© 2026 ACACIA · Herramienta gratis", foot_tools:"Herramientas", foot_privacy:"Privacidad", foot_contact:"Contacto", foot_crafted:"hecho con", foot_by:"por",
  },
  en: {
    nav_more:"← More tools", lang_label:"Language", eyebrow:"Free tool",
    h1:"Extract text from ", h1b:"an image",
    hero_p:"Turn a photo, screenshot or scanned document into editable text with OCR. The image isn't uploaded.",
    privacy_chip:"OCR runs in your browser. Your image isn't uploaded.",
    drop_h:"Drag an image here", drop_p:"or click to choose it · JPG, PNG…",
    ocrlang:"Text language", spa:"Spanish", eng:"English", both:"Spanish + English",
    extract:"Extract text", working:"Processing…", change:"Change image",
    output:"Extracted text", copy:"Copy", download:"Download", copied:"Copied!", empty:"The recognized text will appear here.",
    err:"Couldn't process the image. Try a sharper one.",
    cta_h3:"Do you digitize lots of documents or forms?", cta_p:"At ACACIA we automate document capture and processing for SMBs. Let's talk.", cta_btn:"Talk to ACACIA",
    faq_title:"FAQ",
    faq:[["How do I extract text from an image?","Upload the image, pick the language and press Extract; copy or download the text."],["Is my image uploaded?","No. OCR runs in your browser; only the language model is downloaded once."],["Does it work with handwriting?","It works best with sharp printed text; handwriting is less accurate."]],
    foot_free:"© 2026 ACACIA · Free tool", foot_tools:"Tools", foot_privacy:"Privacy", foot_contact:"Contact", foot_crafted:"crafted with", foot_by:"by",
  },
};
function makeT(lang){return (k,v)=>{let s=(STRINGS[lang]&&STRINGS[lang][k])!=null?STRINGS[lang][k]:(STRINGS.es[k]!=null?STRINGS.es[k]:k);if(v&&typeof s==="string")for(var x in v)s=s.split("{"+x+"}").join(v[x]);return s;};}
const LangContext=React.createContext("es");
function detectLang(){try{var s=localStorage.getItem("acacia-lang");if(s==="es"||s==="en")return s;}catch(e){}return "es";}
function triggerDownload(text,filename){var blob=new Blob([text],{type:"text/plain"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}

function App(){
  const [lang,setLang]=useState(detectLang);
  const t=makeT(lang);
  const [file,setFile]=useState(null); const [url,setUrl]=useState(null);
  const [ocrLang,setOcrLang]=useState("spa+eng");
  const [busy,setBusy]=useState(false); const [prog,setProg]=useState(0);
  const [text,setText]=useState(""); const [err,setErr]=useState(""); const [copied,setCopied]=useState(false);
  const inputRef=useRef(null); const [over,setOver]=useState(false);
  useEffect(()=>{document.documentElement.setAttribute("lang", lang === "en" ? "en" : "es-MX");try{localStorage.setItem("acacia-lang",lang);}catch(e){}},[lang]);

  const pick=useCallback((f)=>{ if(!f||!/image\//.test(f.type))return; setErr(""); setText(""); setFile(f); setUrl(u=>{ if(u)URL.revokeObjectURL(u); return URL.createObjectURL(f); }); },[]);
  const onDrop=(e)=>{e.preventDefault();setOver(false);if(e.dataTransfer.files&&e.dataTransfer.files[0])pick(e.dataTransfer.files[0]);};

  const extract=async()=>{
    if(!file||busy||!window.Tesseract)return;
    setBusy(true);setProg(0);setErr("");setText("");
    try{
      const { data }=await window.Tesseract.recognize(file, ocrLang, { logger:(m)=>{ if(m&&typeof m.progress==="number"&&(m.status==="recognizing text"||m.status==="recognizing")) setProg(Math.round(m.progress*100)); } });
      setText((data&&data.text)?data.text.trim():"");
      if(window.acaciaTrack)window.acaciaTrack("ocr_extract",{lang:ocrLang});
    }catch(e){ setErr(t("err")); }
    setBusy(false);
  };
  const copy=async()=>{try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),1600);}catch(e){}};

  return (
    <LangContext.Provider value={lang}>
      <div className="app"><div className="wrap">
        <div className="topbar">
          <a className="brand" href="/" aria-label="ACACIA inicio"><img src="/assets/acacia-logo.jpg" alt="ACACIA" width="28" height="28" /> ACACIA</a>
          <div className="topbar-actions">
            <a className="ghost-link" href="/freeware">{t("nav_more")}</a>
            <div className="lang-seg" role="group" aria-label={t("lang_label")}><button type="button" aria-pressed={lang==="es"} onClick={()=>setLang("es")}>ES</button><button type="button" aria-pressed={lang==="en"} onClick={()=>setLang("en")}>EN</button></div>
          </div>
        </div>
        <header className="hero">
          <span className="eyebrow"><span className="dot" aria-hidden="true"></span> {t("eyebrow")}</span>
          <h1>{t("h1")}<span style={{color:"var(--accent-2)"}}>{t("h1b")}</span></h1>
          <p>{t("hero_p")}</p>
          <span className="privacy-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>{t("privacy_chip")}</span>
        </header>

        <div className="io">
          <div>
            {!url ? (
              <div className={"drop"+(over?" over":"")} onClick={()=>inputRef.current&&inputRef.current.click()} onDragOver={(e)=>{e.preventDefault();setOver(true);}} onDragLeave={()=>setOver(false)} onDrop={onDrop}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5L9 20"/></svg>
                <h2>{t("drop_h")}</h2><p>{t("drop_p")}</p>
                <input ref={inputRef} type="file" accept="image/*" style={{display:"none"}} onChange={(e)=>pick(e.target.files[0])} />
              </div>
            ) : (
              <div>
                <div className="prev"><img src={url} alt="preview" /></div>
                <div className="controls">
                  <div className="field"><label>{t("ocrlang")}</label><select value={ocrLang} onChange={(e)=>setOcrLang(e.target.value)} disabled={busy}><option value="spa">{t("spa")}</option><option value="eng">{t("eng")}</option><option value="spa+eng">{t("both")}</option></select></div>
                  <button className="btn btn-primary" onClick={extract} disabled={busy}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V5a2 2 0 0 1 2-2h2"/><path d="M20 7V5a2 2 0 0 0-2-2h-2"/><path d="M4 17v2a2 2 0 0 0 2 2h2"/><path d="M20 17v2a2 2 0 0 1-2 2h-2"/><path d="M8 12h8"/></svg>
                    {busy?t("working")+" "+prog+"%":t("extract")}
                  </button>
                  <button className="btn" onClick={()=>{setFile(null);setUrl(u=>{if(u)URL.revokeObjectURL(u);return null;});setText("");setErr("");}} disabled={busy}>{t("change")}</button>
                </div>
                {busy && <div className="progress"><span style={{width:prog+"%"}}></span></div>}
                {err && <p className="status" style={{color:"oklch(0.62 0.18 25)"}}>{err}</p>}
              </div>
            )}
          </div>
          <div>
            <div className="out-head"><label>{t("output")}</label>
              <span style={{display:"flex",gap:8,alignItems:"center"}}>
                {copied?<span className="copied">{t("copied")}</span>:null}
                <button className="btn" onClick={copy} disabled={!text}>{t("copy")}</button>
                <button className="btn" onClick={()=>triggerDownload(text,"texto-extraido.txt")} disabled={!text}>{t("download")}</button>
              </span>
            </div>
            <textarea value={text} onChange={(e)=>setText(e.target.value)} placeholder={t("empty")} spellCheck="false" />
          </div>
        </div>

        <div className="cta"><h3>{t("cta_h3")}</h3><p>{t("cta_p")}</p><a className="btn btn-primary" href="/contacto">{t("cta_btn")}</a></div>
        <div style={{marginTop:8}}><h2 className="section-title">{t("faq_title")}</h2>{t("faq").map(([q,a],i)=><details key={i}><summary>{q}</summary><p>{a}</p></details>)}</div>
        <footer className="foot"><span>{t("foot_free")}</span><span className="foot-credit">{t("foot_crafted")} <span className="foot-heart" aria-label="love">♥</span> {t("foot_by")} <a className="foot-link" href="https://acaciaco.com.mx" target="_blank" rel="noopener noreferrer">ACACIA Consultoría</a></span><span><a href="/freeware">{t("foot_tools")}</a> · <a href="/legal/privacidad">{t("foot_privacy")}</a> · <a href="/contacto">{t("foot_contact")}</a></span></footer>
      </div></div>
    </LangContext.Provider>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
