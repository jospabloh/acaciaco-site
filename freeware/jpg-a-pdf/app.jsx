// JPG a PDF — ACACIA freeware. 100% en el navegador (pdf-lib). ES/EN. Acento violeta.
const { useState, useEffect, useCallback, useRef } = React;

const STRINGS = {
  es: {
    nav_more:"← Más herramientas", theme_label:"Cambiar tema", lang_label:"Idioma", eyebrow:"Herramienta gratis",
    nav_merge:"Unir", nav_compress:"Comprimir", nav_split:"Dividir", nav_p2j:"PDF a JPG", nav_j2p:"JPG a PDF",
    h1:"JPG a ", h1b:"PDF",
    hero_p:"Convierte imágenes JPG o PNG en un PDF y une varias en un solo documento. Ordénalas y descárgalo.",
    privacy_chip:"La conversión ocurre en tu navegador: tus imágenes no se suben.",
    drop_h:"Arrastra tus imágenes aquí", drop_p:"o haz clic para elegirlas · JPG, PNG",
    pagesize:"Tamaño de página", fit:"Ajustar a la imagen", a4:"A4 (vertical)",
    create:"Crear PDF", working:"Generando…", clear:"Limpiar", up:"Subir", down:"Bajar", remove:"Quitar",
    cta_h3:"¿Necesitas digitalizar documentos o procesos?", cta_p:"En ACACIA creamos soluciones a la medida para PyMEs. Hablemos.", cta_btn:"Hablar con ACACIA",
    faq_title:"Preguntas frecuentes",
    faq:[["¿Cómo convertir imágenes a PDF?","Sube tus imágenes, ordénalas y pulsa Crear PDF. Se combinan en un solo documento."],["¿Se suben mis imágenes?","No. Todo ocurre en tu navegador; nada se envía a ningún servidor."]],
    foot_free:"© 2026 ACACIA · Herramienta gratis", foot_tools:"Herramientas", foot_privacy:"Privacidad", foot_contact:"Contacto", foot_crafted:"hecho con", foot_by:"por",
  },
  en: {
    nav_more:"← More tools", theme_label:"Toggle theme", lang_label:"Language", eyebrow:"Free tool",
    nav_merge:"Merge", nav_compress:"Compress", nav_split:"Split", nav_p2j:"PDF to JPG", nav_j2p:"JPG to PDF",
    h1:"JPG to ", h1b:"PDF",
    hero_p:"Convert JPG or PNG images into a PDF and combine several into one document. Reorder and download.",
    privacy_chip:"Conversion happens in your browser: your images aren't uploaded.",
    drop_h:"Drag your images here", drop_p:"or click to choose them · JPG, PNG",
    pagesize:"Page size", fit:"Fit to image", a4:"A4 (portrait)",
    create:"Create PDF", working:"Generating…", clear:"Clear", up:"Up", down:"Down", remove:"Remove",
    cta_h3:"Need to digitize documents or processes?", cta_p:"At ACACIA we build custom solutions for SMBs. Let's talk.", cta_btn:"Talk to ACACIA",
    faq_title:"FAQ",
    faq:[["How to convert images to PDF?","Upload your images, reorder them and press Create PDF. They combine into a single document."],["Are my images uploaded?","No. Everything happens in your browser; nothing is sent to any server."]],
    foot_free:"© 2026 ACACIA · Free tool", foot_tools:"Tools", foot_privacy:"Privacy", foot_contact:"Contact", foot_crafted:"crafted with", foot_by:"by",
  },
};
function makeT(lang){return (k,v)=>{let s=(STRINGS[lang]&&STRINGS[lang][k])!=null?STRINGS[lang][k]:(STRINGS.es[k]!=null?STRINGS.es[k]:k);if(v&&typeof s==="string")for(var x in v)s=s.split("{"+x+"}").join(v[x]);return s;};}
const LangContext=React.createContext("es");
const uid=()=>Math.random().toString(36).slice(2,9);
function triggerDownload(blob,filename){var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function detectLang(){try{var s=localStorage.getItem("acacia-lang");if(s==="es"||s==="en")return s;}catch(e){}return (navigator.language||"es").toLowerCase().indexOf("en")===0?"en":"es";}
function PdfNav({t,current}){const items=[["unir-pdf","nav_merge"],["comprimir-pdf","nav_compress"],["dividir-pdf","nav_split"],["pdf-a-jpg","nav_p2j"],["jpg-a-pdf","nav_j2p"]];return <nav className="pdfnav" aria-label="PDF">{items.map(([s,k])=><a key={s} href={"/freeware/"+s} aria-current={current===s?"true":undefined}>{t(k)}</a>)}</nav>;}

function App(){
  const [lang,setLang]=useState(detectLang);
  const [theme,setTheme]=useState(()=>{try{return localStorage.getItem("acacia-theme")||"light";}catch(e){return "light";}});
  const t=makeT(lang);
  const [items,setItems]=useState([]); // {id,file,url,name}
  const [size,setSize]=useState("fit"); const [over,setOver]=useState(false); const [busy,setBusy]=useState(false);
  const inputRef=useRef(null);
  useEffect(()=>{document.documentElement.setAttribute("data-theme",theme);try{localStorage.setItem("acacia-theme",theme);}catch(e){}},[theme]);
  useEffect(()=>{document.documentElement.setAttribute("lang",lang);try{localStorage.setItem("acacia-lang",lang);}catch(e){}},[lang]);

  const addFiles=useCallback((list)=>{
    const arr=[...list].filter(f=>/image\/(jpeg|png)/.test(f.type)||/\.(jpe?g|png)$/i.test(f.name)).map(f=>({id:uid(),file:f,name:f.name,url:URL.createObjectURL(f)}));
    if(arr.length)setItems(p=>[...p,...arr]);
  },[]);
  const move=(i,d)=>setItems(p=>{const a=[...p];const j=i+d;if(j<0||j>=a.length)return p;const tm=a[i];a[i]=a[j];a[j]=tm;return a;});
  const removeItem=(id)=>setItems(p=>{const it=p.find(x=>x.id===id);if(it)URL.revokeObjectURL(it.url);return p.filter(x=>x.id!==id);});
  const clearAll=()=>{items.forEach(it=>URL.revokeObjectURL(it.url));setItems([]);};
  const onDrop=(e)=>{e.preventDefault();setOver(false);if(e.dataTransfer.files)addFiles(e.dataTransfer.files);};

  const create=async()=>{
    if(!items.length||busy)return; setBusy(true);
    try{
      const doc=await PDFLib.PDFDocument.create();
      for(const it of items){
        const bytes=new Uint8Array(await it.file.arrayBuffer());
        const isPng=/png/i.test(it.file.type)||/\.png$/i.test(it.name);
        const img=isPng?await doc.embedPng(bytes):await doc.embedJpg(bytes);
        if(size==="a4"){
          const pw=595.28, ph=841.89, m=24; const maxW=pw-m*2, maxH=ph-m*2;
          const sc=Math.min(maxW/img.width, maxH/img.height); const w=img.width*sc, h=img.height*sc;
          const page=doc.addPage([pw,ph]); page.drawImage(img,{x:(pw-w)/2,y:(ph-h)/2,width:w,height:h});
        } else {
          const page=doc.addPage([img.width,img.height]); page.drawImage(img,{x:0,y:0,width:img.width,height:img.height});
        }
      }
      const out=await doc.save(); triggerDownload(new Blob([out],{type:"application/pdf"}),"imagenes.pdf");
    }catch(e){ /* noop */ }
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
          <PdfNav t={t} current="jpg-a-pdf" />
          <div><span className="privacy-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>{t("privacy_chip")}</span></div>
        </header>

        <div className={"drop"+(over?" over":"")} onClick={()=>inputRef.current&&inputRef.current.click()} onDragOver={(e)=>{e.preventDefault();setOver(true);}} onDragLeave={()=>setOver(false)} onDrop={onDrop}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <h2>{t("drop_h")}</h2><p>{t("drop_p")}</p>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png" multiple style={{display:"none"}} onChange={(e)=>addFiles(e.target.files)} />
        </div>

        {items.length>0 && (
          <React.Fragment>
            <div className="grid">
              {items.map((it,i)=>(
                <div className="pg" key={it.id}>
                  <img src={it.url} alt={it.name} loading="lazy" />
                  <div className="lab">{i+1}. {it.name}</div>
                  <div className="pgbtns">
                    <button onClick={()=>move(i,-1)} disabled={i===0} aria-label={t("up")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
                    <button onClick={()=>move(i,1)} disabled={i===items.length-1} aria-label={t("down")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
                    <button onClick={()=>removeItem(it.id)} aria-label={t("remove")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="bar">
              <label className="opts">{t("pagesize")}: <select value={size} onChange={(e)=>setSize(e.target.value)}><option value="fit">{t("fit")}</option><option value="a4">{t("a4")}</option></select></label>
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-primary" onClick={create} disabled={busy}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  {busy?t("working"):t("create")}
                </button>
                <button className="btn" onClick={clearAll} disabled={busy}>{t("clear")}</button>
              </div>
            </div>
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
