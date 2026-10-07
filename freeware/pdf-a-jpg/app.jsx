// PDF a JPG — ACACIA freeware. 100% en el navegador (PDF.js). ES/EN. Acento violeta.
const { useState, useEffect, useCallback, useRef } = React;
if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

const STRINGS = {
  es: {
    nav_more:"← Más herramientas", lang_label:"Idioma", eyebrow:"Herramienta gratis",
    nav_merge:"Unir", nav_compress:"Comprimir", nav_split:"Dividir", nav_p2j:"PDF a JPG", nav_j2p:"JPG a PDF",
    h1:"PDF a ", h1b:"JPG",
    hero_p:"Convierte cada página de un PDF en una imagen JPG de buena calidad. Descarga una o todas en ZIP.",
    privacy_chip:"La conversión ocurre en tu navegador: tu PDF no se sube.",
    drop_h:"Arrastra tu archivo PDF aquí", drop_p:"o haz clic para elegirlo",
    converting:"Convirtiendo páginas…", page:"Página", download:"Descargar", download_all:"Descargar todas (.zip)", clear:"Quitar",
    err:"No se pudo convertir el PDF (¿protegido?).",
    cta_h3:"¿Necesitas digitalizar y procesar documentos?", cta_p:"En ACACIA creamos soluciones documentales a la medida para PyMEs. Hablemos.", cta_btn:"Hablar con ACACIA",
    faq_title:"Preguntas frecuentes",
    faq:[["¿Cómo convertir PDF a JPG?","Sube el PDF; cada página se convierte en una imagen JPG que puedes descargar por separado o en ZIP."],["¿Se sube mi archivo?","No. Todo ocurre en tu navegador; el PDF nunca se envía a ningún servidor."]],
    foot_free:"© 2026 ACACIA · Herramienta gratis", foot_tools:"Herramientas", foot_privacy:"Privacidad", foot_contact:"Contacto", foot_crafted:"hecho con", foot_by:"por",
  },
  en: {
    nav_more:"← More tools", lang_label:"Language", eyebrow:"Free tool",
    nav_merge:"Merge", nav_compress:"Compress", nav_split:"Split", nav_p2j:"PDF to JPG", nav_j2p:"JPG to PDF",
    h1:"PDF to ", h1b:"JPG",
    hero_p:"Convert each PDF page into a good-quality JPG image. Download one or all as a ZIP.",
    privacy_chip:"Conversion happens in your browser: your PDF isn't uploaded.",
    drop_h:"Drag your PDF file here", drop_p:"or click to choose it",
    converting:"Converting pages…", page:"Page", download:"Download", download_all:"Download all (.zip)", clear:"Remove",
    err:"Couldn't convert the PDF (protected?).",
    cta_h3:"Need to digitize and process documents?", cta_p:"At ACACIA we build custom document solutions for SMBs. Let's talk.", cta_btn:"Talk to ACACIA",
    faq_title:"FAQ",
    faq:[["How to convert PDF to JPG?","Upload the PDF; each page becomes a JPG you can download separately or as a ZIP."],["Is my file uploaded?","No. Everything happens in your browser; the PDF is never sent to any server."]],
    foot_free:"© 2026 ACACIA · Free tool", foot_tools:"Tools", foot_privacy:"Privacy", foot_contact:"Contact", foot_crafted:"crafted with", foot_by:"by",
  },
};
function makeT(lang){return (k,v)=>{let s=(STRINGS[lang]&&STRINGS[lang][k])!=null?STRINGS[lang][k]:(STRINGS.es[k]!=null?STRINGS.es[k]:k);if(v&&typeof s==="string")for(var x in v)s=s.split("{"+x+"}").join(v[x]);return s;};}
const LangContext=React.createContext("es");
function triggerDownload(blob,filename){var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function detectLang(){try{var s=localStorage.getItem("acacia-lang");if(s==="es"||s==="en")return s;}catch(e){}return "es";}
function PdfNav({t,current}){const items=[["unir-pdf","nav_merge"],["comprimir-pdf","nav_compress"],["dividir-pdf","nav_split"],["pdf-a-jpg","nav_p2j"],["jpg-a-pdf","nav_j2p"]];return <nav className="pdfnav" aria-label="PDF">{items.map(([s,k])=><a key={s} href={"/freeware/"+s} aria-current={current===s?"true":undefined}>{t(k)}</a>)}</nav>;}

function App(){
  const [lang,setLang]=useState(detectLang);
  const t=makeT(lang);
  const [name,setName]=useState(""); const [imgs,setImgs]=useState([]); // {url,blob,n}
  const [over,setOver]=useState(false); const [busy,setBusy]=useState(false); const [err,setErr]=useState("");
  const inputRef=useRef(null);
  useEffect(()=>{document.documentElement.setAttribute("lang", lang === "en" ? "en" : "es-MX");try{localStorage.setItem("acacia-lang",lang);}catch(e){}},[lang]);

  const convert=useCallback(async(f)=>{
    if(!f||!(f.type==="application/pdf"||/\.pdf$/i.test(f.name)))return;
    setErr(""); setBusy(true); setImgs([]); setName(f.name.replace(/\.pdf$/i,""));
    try{
      const data=new Uint8Array(await f.arrayBuffer());
      const pdf=await pdfjsLib.getDocument({data}).promise;
      const results=[];
      for(let i=1;i<=pdf.numPages;i++){
        const page=await pdf.getPage(i);
        const vp=page.getViewport({scale:2}); // ~144 DPI
        const canvas=document.createElement("canvas"); canvas.width=Math.floor(vp.width); canvas.height=Math.floor(vp.height);
        const ctx=canvas.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,canvas.width,canvas.height);
        await page.render({canvasContext:ctx,viewport:vp}).promise;
        const blob=await new Promise(r=>canvas.toBlob(r,"image/jpeg",0.92));
        results.push({n:i,blob,url:URL.createObjectURL(blob)});
        canvas.width=canvas.height=0;
      }
      setImgs(results);
    }catch(e){ setErr(t("err")); }
    setBusy(false);
  },[lang]);
  const onDrop=(e)=>{e.preventDefault();setOver(false);if(e.dataTransfer.files&&e.dataTransfer.files[0])convert(e.dataTransfer.files[0]);};
  const reset=()=>{imgs.forEach(im=>URL.revokeObjectURL(im.url));setImgs([]);setName("");setErr("");};
  const dlAll=async()=>{const zip=new window.JSZip();imgs.forEach(im=>zip.file(name+"-"+im.n+".jpg",im.blob));triggerDownload(await zip.generateAsync({type:"blob"}),name+"-jpg.zip");};

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
          <PdfNav t={t} current="pdf-a-jpg" />
          <div><span className="privacy-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>{t("privacy_chip")}</span></div>
        </header>

        {imgs.length===0 && !busy ? (
          <div className={"drop"+(over?" over":"")} onClick={()=>inputRef.current&&inputRef.current.click()} onDragOver={(e)=>{e.preventDefault();setOver(true);}} onDragLeave={()=>setOver(false)} onDrop={onDrop}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <h2>{t("drop_h")}</h2><p>{t("drop_p")}</p>
            <input ref={inputRef} type="file" accept="application/pdf" style={{display:"none"}} onChange={(e)=>convert(e.target.files[0])} />
          </div>
        ) : null}
        {err?<p style={{color:"oklch(0.6 0.18 25)",fontSize:13}}>{err}</p>:null}
        {busy?<p className="loading">{t("converting")}</p>:null}
        {imgs.length>0 && (
          <React.Fragment>
            <div className="bar"><span className="total mono">{imgs.length} JPG · {name}</span><div style={{display:"flex",gap:8}}><button className="btn btn-primary" onClick={dlAll}>{t("download_all")}</button><button className="btn" onClick={reset}>{t("clear")}</button></div></div>
            <div className="grid">{imgs.map(im=><div className="pg" key={im.n}><img src={im.url} alt={t("page")+" "+im.n} loading="lazy" /><div className="lab">{t("page")} {im.n}</div><a href={im.url} download={name+"-"+im.n+".jpg"}>{t("download")}</a></div>)}</div>
          </React.Fragment>
        )}

        <div className="cta"><h3>{t("cta_h3")}</h3><p>{t("cta_p")}</p><a className="btn btn-primary" style={{display:"inline-flex"}} href="/contacto">{t("cta_btn")}</a></div>
        <div style={{marginTop:8}}><h2 className="section-title">{t("faq_title")}</h2>{t("faq").map(([q,a],i)=><details key={i}><summary>{q}</summary><p>{a}</p></details>)}</div>
        <footer className="foot"><span>{t("foot_free")}</span><span className="foot-credit">{t("foot_crafted")} <span className="foot-heart" aria-label="love">♥</span> {t("foot_by")} <a className="foot-link" href="https://acaciaco.com.mx" target="_blank" rel="noopener noreferrer">ACACIA Consultoría</a></span><span><a href="/freeware">{t("foot_tools")}</a> · <a href="/legal/privacidad">{t("foot_privacy")}</a> · <a href="/contacto">{t("foot_contact")}</a></span></footer>
      </div></div>
    </LangContext.Provider>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
