// Dividir PDF — ACACIA freeware. 100% en el navegador (pdf-lib). ES/EN. Acento violeta.
const { useState, useEffect, useCallback, useRef } = React;

const STRINGS = {
  es: {
    nav_more:"← Más herramientas", lang_label:"Idioma", eyebrow:"Herramienta gratis",
    nav_merge:"Unir", nav_compress:"Comprimir", nav_split:"Dividir", nav_p2j:"PDF a JPG", nav_j2p:"JPG a PDF",
    h1:"Dividir ", h1b:"PDF",
    hero_p:"Extrae un rango de páginas o separa cada página en archivos independientes. Sin subir tus documentos.",
    privacy_chip:"Todo ocurre en tu navegador: tus PDF nunca se suben.",
    drop_h:"Arrastra tu archivo PDF aquí", drop_p:"o haz clic para elegirlo",
    pages:"páginas", range_label:"Páginas a extraer", range_hint:"ej. 1-3,5,8-10",
    each:"Separar cada página en un archivo (.zip)",
    split:"Dividir", working:"Procesando…", clear:"Quitar",
    err_range:"Rango inválido. Usa números dentro del total de páginas.", err_read:"No se pudo leer el PDF (¿protegido?).",
    cta_h3:"¿Tu empresa maneja muchos documentos?", cta_p:"En ACACIA digitalizamos y automatizamos procesos para PyMEs. Hablemos.", cta_btn:"Hablar con ACACIA",
    faq_title:"Preguntas frecuentes",
    faq:[["¿Cómo dividir un PDF?","Sube el PDF, escribe el rango (ej. 1-3,5) o separa cada página, y descarga el resultado."],["¿Se suben mis documentos?","No. Todo ocurre en tu navegador; nada se envía a ningún servidor."]],
    foot_free:"© 2026 ACACIA · Herramienta gratis", foot_tools:"Herramientas", foot_privacy:"Privacidad", foot_contact:"Contacto", foot_crafted:"hecho con", foot_by:"por",
  },
  en: {
    nav_more:"← More tools", lang_label:"Language", eyebrow:"Free tool",
    nav_merge:"Merge", nav_compress:"Compress", nav_split:"Split", nav_p2j:"PDF to JPG", nav_j2p:"JPG to PDF",
    h1:"Split ", h1b:"PDF",
    hero_p:"Extract a page range or split every page into separate files. Your documents are never uploaded.",
    privacy_chip:"Everything happens in your browser: your PDFs are never uploaded.",
    drop_h:"Drag your PDF file here", drop_p:"or click to choose it",
    pages:"pages", range_label:"Pages to extract", range_hint:"e.g. 1-3,5,8-10",
    each:"Split every page into a file (.zip)",
    split:"Split", working:"Processing…", clear:"Remove",
    err_range:"Invalid range. Use numbers within the total page count.", err_read:"Couldn't read the PDF (protected?).",
    cta_h3:"Does your company handle lots of documents?", cta_p:"At ACACIA we digitize and automate processes for SMBs. Let's talk.", cta_btn:"Talk to ACACIA",
    faq_title:"FAQ",
    faq:[["How do I split a PDF?","Upload the PDF, type the range (e.g. 1-3,5) or split each page, and download the result."],["Are my documents uploaded?","No. Everything happens in your browser; nothing is sent to any server."]],
    foot_free:"© 2026 ACACIA · Free tool", foot_tools:"Tools", foot_privacy:"Privacy", foot_contact:"Contact", foot_crafted:"crafted with", foot_by:"by",
  },
};
function makeT(lang){return (k,v)=>{let s=(STRINGS[lang]&&STRINGS[lang][k])!=null?STRINGS[lang][k]:(STRINGS.es[k]!=null?STRINGS.es[k]:k);if(v&&typeof s==="string")for(var x in v)s=s.split("{"+x+"}").join(v[x]);return s;};}
const LangContext=React.createContext("es");
function triggerDownload(blob,filename){var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function detectLang(){try{var s=localStorage.getItem("acacia-lang");if(s==="es"||s==="en")return s;}catch(e){}return "es";}
function parseRanges(str,max){
  const out=[]; const parts=(str||"").split(",");
  for(const p of parts){ const s=p.trim(); if(!s)continue;
    const m=s.match(/^(\d+)\s*-\s*(\d+)$/);
    if(m){ let a=+m[1],b=+m[2]; if(a>b)[a,b]=[b,a]; for(let i=a;i<=b;i++){ if(i>=1&&i<=max)out.push(i-1); else return null; } }
    else if(/^\d+$/.test(s)){ const i=+s; if(i>=1&&i<=max)out.push(i-1); else return null; }
    else return null;
  }
  return out.length?out:null;
}

function PdfNav({t,current}){
  const items=[["unir-pdf","nav_merge"],["comprimir-pdf","nav_compress"],["dividir-pdf","nav_split"],["pdf-a-jpg","nav_p2j"],["jpg-a-pdf","nav_j2p"]];
  return <nav className="pdfnav" aria-label="PDF">{items.map(([slug,key])=><a key={slug} href={"/freeware/"+slug} aria-current={current===slug?"true":undefined}>{t(key)}</a>)}</nav>;
}

function App(){
  const [lang,setLang]=useState(detectLang);
  const t=makeT(lang);
  const [file,setFile]=useState(null); const [pages,setPages]=useState(null);
  const [range,setRange]=useState(""); const [each,setEach]=useState(false);
  const [over,setOver]=useState(false); const [busy,setBusy]=useState(false); const [err,setErr]=useState("");
  const inputRef=useRef(null);
  useEffect(()=>{document.documentElement.setAttribute("lang", lang === "en" ? "en" : "es-MX");try{localStorage.setItem("acacia-lang",lang);}catch(e){}},[lang]);

  const load=useCallback(async(f)=>{
    if(!f||!(f.type==="application/pdf"||/\.pdf$/i.test(f.name)))return;
    setErr(""); setFile(f); setPages(null);
    try{ const doc=await PDFLib.PDFDocument.load(await f.arrayBuffer(),{ignoreEncryption:true}); setPages(doc.getPageCount()); }
    catch(e){ setErr(t("err_read")); setFile(null); }
  },[lang]);
  const onDrop=(e)=>{e.preventDefault();setOver(false);if(e.dataTransfer.files&&e.dataTransfer.files[0])load(e.dataTransfer.files[0]);};

  const run=async()=>{
    if(!file||busy)return; setErr(""); setBusy(true);
    try{
      const src=await PDFLib.PDFDocument.load(await file.arrayBuffer(),{ignoreEncryption:true});
      const total=src.getPageCount();
      const baseName=file.name.replace(/\.pdf$/i,"");
      if(each){
        const zip=new window.JSZip();
        for(let i=0;i<total;i++){ const d=await PDFLib.PDFDocument.create(); const [pg]=await d.copyPages(src,[i]); d.addPage(pg); const b=await d.save(); zip.file(baseName+"-"+(i+1)+".pdf",b); }
        triggerDownload(await zip.generateAsync({type:"blob"}),baseName+"-paginas.zip");
      } else {
        const idx=parseRanges(range,total);
        if(!idx){ setErr(t("err_range")); setBusy(false); return; }
        const d=await PDFLib.PDFDocument.create(); const pgs=await d.copyPages(src,idx); pgs.forEach(p=>d.addPage(p));
        const b=await d.save(); triggerDownload(new Blob([b],{type:"application/pdf"}),baseName+"-extraido.pdf");
      }
    }catch(e){ setErr(t("err_read")); }
    setBusy(false);
  };

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
          <PdfNav t={t} current="dividir-pdf" />
          <div><span className="privacy-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>{t("privacy_chip")}</span></div>
        </header>

        {!file ? (
          <div className={"drop"+(over?" over":"")} onClick={()=>inputRef.current&&inputRef.current.click()} onDragOver={(e)=>{e.preventDefault();setOver(true);}} onDragLeave={()=>setOver(false)} onDrop={onDrop}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <h2>{t("drop_h")}</h2><p>{t("drop_p")}</p>
            <input ref={inputRef} type="file" accept="application/pdf" style={{display:"none"}} onChange={(e)=>load(e.target.files[0])} />
          </div>
        ) : (
          <div className="card">
            <div className="filehead">
              <div className="pdf-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
              <div style={{flex:1,minWidth:0}}><div className="n" style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{file.name}</div><div className="m mono">{pages!=null?pages+" "+t("pages"):"…"}</div></div>
              <button className="btn" onClick={()=>{setFile(null);setPages(null);setErr("");}}>{t("clear")}</button>
            </div>
            <div className="field"><label>{t("range_label")} <span className="hint">· {t("range_hint")}</span></label><input type="text" value={range} disabled={each} onChange={(e)=>setRange(e.target.value)} placeholder="1-3,5" /></div>
            <div className="field checkbox"><input id="each" type="checkbox" checked={each} onChange={(e)=>setEach(e.target.checked)} /><label htmlFor="each">{t("each")}</label></div>
            {err?<p style={{color:"oklch(0.6 0.18 25)",fontSize:13,margin:"0 0 12px"}}>{err}</p>:null}
            <div className="bar"><button className="btn btn-primary" onClick={run} disabled={busy||(!each&&!range.trim())}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {busy?t("working"):t("split")}</button></div>
          </div>
        )}

        <div className="cta"><h3>{t("cta_h3")}</h3><p>{t("cta_p")}</p><a className="btn btn-primary" style={{display:"inline-flex"}} href="/contacto">{t("cta_btn")}</a></div>
        <div style={{marginTop:8}}><h2 className="section-title">{t("faq_title")}</h2>{t("faq").map(([q,a],i)=><details key={i}><summary>{q}</summary><p>{a}</p></details>)}</div>
        <footer className="foot"><span>{t("foot_free")}</span><span className="foot-credit">{t("foot_crafted")} <span className="foot-heart" aria-label="love">♥</span> {t("foot_by")} <a className="foot-link" href="https://acaciaco.com.mx" target="_blank" rel="noopener noreferrer">ACACIA Consultoría</a></span><span><a href="/freeware">{t("foot_tools")}</a> · <a href="/legal/privacidad">{t("foot_privacy")}</a> · <a href="/contacto">{t("foot_contact")}</a></span></footer>
      </div></div>
    </LangContext.Provider>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
