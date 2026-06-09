// CSV/Excel → JSON / SQL — ACACIA freeware. 100% en el navegador. ES/EN. Acento fucsia.
const { useState, useEffect, useMemo, useRef } = React;

const STRINGS = {
  es: {
    nav_more:"← Más herramientas", theme_label:"Cambiar tema", lang_label:"Idioma", eyebrow:"Herramienta gratis",
    h1:"CSV / Excel a ", h1b:"JSON y SQL",
    hero_p:"Pega tus datos o sube un CSV y conviértelos a JSON o a sentencias SQL (INSERT) al instante.",
    privacy_chip:"La conversión ocurre en tu navegador. Nada se sube.",
    input:"Entrada (CSV / pegar de Excel)", output:"Resultado", upload:"Subir CSV",
    delim:"Separador", d_auto:"Detectar", d_comma:"Coma (,)", d_semi:"Punto y coma (;)", d_tab:"Tabulador", d_pipe:"Barra (|)",
    header:"Primera fila = encabezados", infer:"Inferir números/booleanos",
    format:"Formato", f_json:"JSON", f_jsonl:"JSON por línea", f_sql:"SQL (INSERT)",
    table:"Nombre de tabla", placeholder:"nombre,correo,edad\\nAna,ana@mail.com,30\\nLuis,luis@mail.com,25",
    copy:"Copiar", download:"Descargar", copied:"¡Copiado!", rows:"{n} filas",
    empty:"Pega o sube datos para ver el resultado.",
    cta_h3:"¿Necesitas mover o integrar datos de tu negocio?", cta_p:"En ACACIA conectamos hojas, sistemas y bases de datos para PyMEs. Hablemos.", cta_btn:"Hablar con ACACIA",
    faq_title:"Preguntas frecuentes",
    faq:[["¿Cómo convierto CSV a JSON?","Pega el CSV o súbelo, marca si la primera fila son encabezados y elige JSON. Obtienes un arreglo de objetos."],["¿También genera SQL?","Sí, elige el formato SQL e indica el nombre de la tabla para obtener sentencias INSERT."],["¿Mis datos se suben?","No. Todo ocurre en tu navegador; los datos nunca salen de tu dispositivo."]],
    foot_free:"© 2026 ACACIA · Herramienta gratis", foot_tools:"Herramientas", foot_privacy:"Privacidad", foot_contact:"Contacto", foot_crafted:"hecho con", foot_by:"por",
  },
  en: {
    nav_more:"← More tools", theme_label:"Toggle theme", lang_label:"Language", eyebrow:"Free tool",
    h1:"CSV / Excel to ", h1b:"JSON & SQL",
    hero_p:"Paste your data or upload a CSV and convert it to JSON or SQL (INSERT) statements instantly.",
    privacy_chip:"Conversion happens in your browser. Nothing is uploaded.",
    input:"Input (CSV / paste from Excel)", output:"Result", upload:"Upload CSV",
    delim:"Delimiter", d_auto:"Detect", d_comma:"Comma (,)", d_semi:"Semicolon (;)", d_tab:"Tab", d_pipe:"Pipe (|)",
    header:"First row = headers", infer:"Infer numbers/booleans",
    format:"Format", f_json:"JSON", f_jsonl:"JSON per line", f_sql:"SQL (INSERT)",
    table:"Table name", placeholder:"name,email,age\\nAna,ana@mail.com,30\\nLuis,luis@mail.com,25",
    copy:"Copy", download:"Download", copied:"Copied!", rows:"{n} rows",
    empty:"Paste or upload data to see the result.",
    cta_h3:"Need to move or integrate your business data?", cta_p:"At ACACIA we connect spreadsheets, systems and databases for SMBs. Let's talk.", cta_btn:"Talk to ACACIA",
    faq_title:"FAQ",
    faq:[["How do I convert CSV to JSON?","Paste or upload the CSV, mark whether the first row are headers and pick JSON. You get an array of objects."],["Does it generate SQL too?","Yes, pick the SQL format and set the table name to get INSERT statements."],["Is my data uploaded?","No. Everything happens in your browser; data never leaves your device."]],
    foot_free:"© 2026 ACACIA · Free tool", foot_tools:"Tools", foot_privacy:"Privacy", foot_contact:"Contact", foot_crafted:"crafted with", foot_by:"by",
  },
};
function makeT(lang){return (k,v)=>{let s=(STRINGS[lang]&&STRINGS[lang][k])!=null?STRINGS[lang][k]:(STRINGS.es[k]!=null?STRINGS.es[k]:k);if(v&&typeof s==="string")for(var x in v)s=s.split("{"+x+"}").join(v[x]);return s;};}
const LangContext=React.createContext("es");
function detectLang(){try{var s=localStorage.getItem("acacia-lang");if(s==="es"||s==="en")return s;}catch(e){}return (navigator.language||"es").toLowerCase().indexOf("en")===0?"en":"es";}
function triggerDownload(text,filename,mime){var blob=new Blob([text],{type:mime||"text/plain"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}

function parseCSV(text, delim){
  const rows=[]; let row=[], field="", i=0, inQ=false;
  while(i<text.length){
    const c=text[i];
    if(inQ){ if(c==='"'){ if(text[i+1]==='"'){field+='"';i+=2;continue;} inQ=false;i++;continue;} field+=c;i++;continue; }
    if(c==='"'){inQ=true;i++;continue;}
    if(c===delim){row.push(field);field="";i++;continue;}
    if(c==='\r'){i++;continue;}
    if(c==='\n'){row.push(field);rows.push(row);row=[];field="";i++;continue;}
    field+=c;i++;
  }
  row.push(field); rows.push(row);
  while(rows.length && rows[rows.length-1].length===1 && rows[rows.length-1][0]==="") rows.pop();
  return rows;
}
function detectDelim(text){
  const line=(text.split(/\r?\n/)[0]||"");
  const counts={",":0,";":0,"\t":0,"|":0};
  for(const ch of line){ if(counts[ch]!=null) counts[ch]++; }
  let best=",", bestN=-1; for(const k in counts){ if(counts[k]>bestN){bestN=counts[k];best=k;} }
  return best;
}
function coerce(v, infer){
  if(!infer) return v;
  const s=v.trim();
  if(s==="") return null;
  if(/^-?\d+$/.test(s)) return parseInt(s,10);
  if(/^-?\d*\.\d+$/.test(s)) return parseFloat(s);
  if(/^(true|false)$/i.test(s)) return s.toLowerCase()==="true";
  return v;
}
function toObjects(rows, hasHeader, infer){
  if(!rows.length) return {headers:[],data:[]};
  let headers, body;
  if(hasHeader){ headers=rows[0].map((h,i)=>h.trim()||("col"+(i+1))); body=rows.slice(1); }
  else { const n=Math.max(...rows.map(r=>r.length)); headers=Array.from({length:n},(_,i)=>"col"+(i+1)); body=rows; }
  const data=body.map(r=>{ const o={}; headers.forEach((h,i)=>{ o[h]=coerce(r[i]!=null?r[i]:"", infer); }); return o; });
  return {headers,data};
}
function toJSON(rows,hasHeader,infer,perLine){
  const {data}=toObjects(rows,hasHeader,infer);
  if(perLine) return data.map(o=>JSON.stringify(o)).join("\n");
  return JSON.stringify(data,null,2);
}
function sqlVal(v){
  if(v===null||v===undefined||v==="") return "NULL";
  if(typeof v==="number") return String(v);
  if(typeof v==="boolean") return v?"TRUE":"FALSE";
  return "'"+String(v).replace(/'/g,"''")+"'";
}
function toSQL(rows,hasHeader,infer,table){
  const {headers,data}=toObjects(rows,hasHeader,infer);
  if(!data.length) return "";
  const t=(table||"tabla").trim().replace(/[^A-Za-z0-9_]/g,"_")||"tabla";
  const cols=headers.map(h=>"`"+h.replace(/`/g,"")+"`").join(", ");
  return data.map(o=>"INSERT INTO `"+t+"` ("+cols+") VALUES ("+headers.map(h=>sqlVal(o[h])).join(", ")+");").join("\n");
}

function App(){
  const [lang,setLang]=useState(detectLang);
  const [theme,setTheme]=useState(()=>{try{return localStorage.getItem("acacia-theme")||"light";}catch(e){return "light";}});
  const t=makeT(lang);
  const [input,setInput]=useState("");
  const [delim,setDelim]=useState("auto");
  const [hasHeader,setHasHeader]=useState(true);
  const [infer,setInfer]=useState(true);
  const [format,setFormat]=useState("json");
  const [table,setTable]=useState("mi_tabla");
  const [copied,setCopied]=useState(false);
  const fileRef=useRef(null);
  useEffect(()=>{document.documentElement.setAttribute("data-theme",theme);try{localStorage.setItem("acacia-theme",theme);}catch(e){}},[theme]);
  useEffect(()=>{document.documentElement.setAttribute("lang",lang);try{localStorage.setItem("acacia-lang",lang);}catch(e){}},[lang]);

  const result=useMemo(()=>{
    if(!input.trim()) return {out:"",n:0,err:""};
    try{
      const d=delim==="auto"?detectDelim(input):(delim==="tab"?"\t":delim);
      const rows=parseCSV(input,d);
      const n=Math.max(0,rows.length-(hasHeader?1:0));
      let out="";
      if(format==="json") out=toJSON(rows,hasHeader,infer,false);
      else if(format==="jsonl") out=toJSON(rows,hasHeader,infer,true);
      else out=toSQL(rows,hasHeader,infer,table);
      return {out,n,err:""};
    }catch(e){ return {out:"",n:0,err:String(e.message||e)}; }
  },[input,delim,hasHeader,infer,format,table]);

  const onFile=(e)=>{const f=e.target.files&&e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>setInput(String(r.result||""));r.readAsText(f);};
  const copy=async()=>{try{await navigator.clipboard.writeText(result.out);setCopied(true);setTimeout(()=>setCopied(false),1600);if(window.acaciaTrack)window.acaciaTrack("csv_convert",{format});}catch(e){}};
  const dl=()=>{const ext=format==="sql"?"sql":(format==="jsonl"?"jsonl":"json");triggerDownload(result.out,"datos."+ext,format==="sql"?"text/sql":"application/json");if(window.acaciaTrack)window.acaciaTrack("csv_convert",{format});};

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

        <div className="controls">
          <div className="field"><label>{t("format")}</label>
            <select value={format} onChange={(e)=>setFormat(e.target.value)}><option value="json">{t("f_json")}</option><option value="jsonl">{t("f_jsonl")}</option><option value="sql">{t("f_sql")}</option></select>
          </div>
          <div className="field"><label>{t("delim")}</label>
            <select value={delim} onChange={(e)=>setDelim(e.target.value)}><option value="auto">{t("d_auto")}</option><option value=",">{t("d_comma")}</option><option value=";">{t("d_semi")}</option><option value="tab">{t("d_tab")}</option><option value="|">{t("d_pipe")}</option></select>
          </div>
          {format==="sql" && <div className="field"><label>{t("table")}</label><input type="text" value={table} onChange={(e)=>setTable(e.target.value)} /></div>}
          <label className="chk"><input type="checkbox" checked={hasHeader} onChange={(e)=>setHasHeader(e.target.checked)} /> {t("header")}</label>
          <label className="chk"><input type="checkbox" checked={infer} onChange={(e)=>setInfer(e.target.checked)} /> {t("infer")}</label>
          <label className="btn" style={{cursor:"pointer"}}>{t("upload")}<input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={onFile} style={{display:"none"}} /></label>
        </div>

        <div className="io">
          <div className="panel">
            <div className="ph"><label>{t("input")}</label></div>
            <textarea value={input} onChange={(e)=>setInput(e.target.value)} placeholder={t("placeholder")} spellCheck="false" />
          </div>
          <div className="panel">
            <div className="ph"><label>{t("output")} {result.n>0?<span className="small">· {t("rows",{n:result.n})}</span>:null}</label>
              <span style={{display:"flex",gap:8,alignItems:"center"}}>
                {copied?<span className="copied">{t("copied")}</span>:result.err?<span className="err">⚠</span>:null}
                <button className="btn" onClick={copy} disabled={!result.out}>{t("copy")}</button>
                <button className="btn btn-primary" onClick={dl} disabled={!result.out}>{t("download")}</button>
              </span>
            </div>
            <textarea readOnly value={result.out || (result.err?("// "+result.err):t("empty"))} spellCheck="false" />
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
