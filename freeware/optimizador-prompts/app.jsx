// Optimizador de Prompts para IA — ACACIA freeware. 100% en el navegador. ES/EN. Acento púrpura.
const { useState, useEffect, useMemo } = React;

const STRINGS = {
  es: {
    nav_more:"← Más herramientas", lang_label:"Idioma", eyebrow:"Herramienta gratis",
    h1:"Optimizador de ", h1b:"prompts IA",
    hero_p:"Convierte una idea en un prompt profesional para ChatGPT, Gemini o Claude. Rellena los campos y copia.",
    privacy_chip:"El prompt se arma en tu navegador. Nada se sube.",
    presets:"Plantillas rápidas",
    p_blog:"Artículo de blog", p_resumen:"Resumir texto", p_codigo:"Generar código", p_email:"Email de ventas", p_plan:"Plan / estrategia",
    role:"Rol (actúa como…)", role_ph:"experto en marketing digital",
    task:"Tarea / objetivo", task_ph:"¿Qué quieres que haga la IA?",
    context:"Contexto", context_ph:"Información de fondo, datos, situación…",
    audience:"Público objetivo", audience_ph:"p. ej. dueños de PyMEs",
    format:"Formato de salida", tone:"Tono", length:"Longitud", language:"Idioma de respuesta",
    constraints:"Restricciones / qué evitar", constraints_ph:"evita tecnicismos, no inventes datos…",
    examples:"Ejemplos (opcional)", examples_ph:"Entrada → salida deseada…",
    f_free:"(libre)", f_list:"Lista con viñetas", f_table:"Tabla", f_steps:"Pasos numerados", f_json:"JSON", f_essay:"Texto/ensayo",
    t_pro:"Profesional", t_casual:"Casual", t_persuasive:"Persuasivo", t_friendly:"Cercano", t_formal:"Formal",
    l_short:"Breve", l_medium:"Media", l_long:"Detallada",
    stepwise:"Pedir razonamiento paso a paso", askback:"Que pregunte si falta información",
    output:"Tu prompt optimizado", copy:"Copiar", copied:"¡Copiado!", clear:"Limpiar",
    cta_h3:"¿Quieres integrar IA en tu negocio de verdad?", cta_p:"En ACACIA desarrollamos soluciones con IA a la medida para PyMEs. Hablemos.", cta_btn:"Hablar con ACACIA",
    faq_title:"Preguntas frecuentes",
    faq:[["¿Cómo escribo un buen prompt?","Define rol, contexto, tarea, formato y tono. Esta herramienta arma esa estructura por ti."],["¿Sirve para ChatGPT, Gemini y Claude?","Sí, genera texto que pegas en cualquier asistente de IA."],["¿Se suben mis datos?","No. Todo ocurre en tu navegador."]],
    foot_free:"© 2026 ACACIA · Herramienta gratis", foot_tools:"Herramientas", foot_privacy:"Privacidad", foot_contact:"Contacto", foot_crafted:"hecho con", foot_by:"por",
    // labels usados en el prompt generado
    L_role:"Actúa como", L_context:"Contexto", L_task:"Tarea", L_audience:"Público objetivo", L_format:"Formato de salida", L_tone:"Tono", L_length:"Extensión", L_constraints:"Restricciones", L_examples:"Ejemplos", L_lang:"Responde en", L_step:"Antes de responder, razona paso a paso y luego entrega la respuesta final.", L_ask:"Si te falta información para hacerlo bien, hazme primero las preguntas necesarias.",
  },
  en: {
    nav_more:"← More tools", lang_label:"Language", eyebrow:"Free tool",
    h1:"AI prompt ", h1b:"optimizer",
    hero_p:"Turn an idea into a professional prompt for ChatGPT, Gemini or Claude. Fill the fields and copy.",
    privacy_chip:"The prompt is built in your browser. Nothing is uploaded.",
    presets:"Quick templates",
    p_blog:"Blog article", p_resumen:"Summarize text", p_codigo:"Generate code", p_email:"Sales email", p_plan:"Plan / strategy",
    role:"Role (act as…)", role_ph:"digital marketing expert",
    task:"Task / goal", task_ph:"What do you want the AI to do?",
    context:"Context", context_ph:"Background info, data, situation…",
    audience:"Target audience", audience_ph:"e.g. SMB owners",
    format:"Output format", tone:"Tone", length:"Length", language:"Response language",
    constraints:"Constraints / avoid", constraints_ph:"avoid jargon, don't make up data…",
    examples:"Examples (optional)", examples_ph:"Input → desired output…",
    f_free:"(free)", f_list:"Bullet list", f_table:"Table", f_steps:"Numbered steps", f_json:"JSON", f_essay:"Prose/essay",
    t_pro:"Professional", t_casual:"Casual", t_persuasive:"Persuasive", t_friendly:"Friendly", t_formal:"Formal",
    l_short:"Short", l_medium:"Medium", l_long:"Detailed",
    stepwise:"Ask for step-by-step reasoning", askback:"Ask back if info is missing",
    output:"Your optimized prompt", copy:"Copy", copied:"Copied!", clear:"Clear",
    cta_h3:"Want to truly integrate AI in your business?", cta_p:"At ACACIA we build custom AI solutions for SMBs. Let's talk.", cta_btn:"Talk to ACACIA",
    faq_title:"FAQ",
    faq:[["How do I write a good prompt?","Define role, context, task, format and tone. This tool builds that structure for you."],["Does it work with ChatGPT, Gemini and Claude?","Yes, it generates text you paste into any AI assistant."],["Is my data uploaded?","No. Everything happens in your browser."]],
    foot_free:"© 2026 ACACIA · Free tool", foot_tools:"Tools", foot_privacy:"Privacy", foot_contact:"Contact", foot_crafted:"crafted with", foot_by:"by",
    L_role:"Act as", L_context:"Context", L_task:"Task", L_audience:"Target audience", L_format:"Output format", L_tone:"Tone", L_length:"Length", L_constraints:"Constraints", L_examples:"Examples", L_lang:"Respond in", L_step:"Before answering, reason step by step and then give the final answer.", L_ask:"If you lack information to do it well, ask me the necessary questions first.",
  },
};
function makeT(lang){return (k,v)=>{let s=(STRINGS[lang]&&STRINGS[lang][k])!=null?STRINGS[lang][k]:(STRINGS.es[k]!=null?STRINGS.es[k]:k);if(v&&typeof s==="string")for(var x in v)s=s.split("{"+x+"}").join(v[x]);return s;};}
const LangContext=React.createContext("es");
function detectLang(){try{var s=localStorage.getItem("acacia-lang");if(s==="es"||s==="en")return s;}catch(e){}return (navigator.language||"es").toLowerCase().indexOf("en")===0?"en":"es";}

function App(){
  const [lang,setLang]=useState(detectLang);
  const t=makeT(lang);
  const [f,setF]=useState({role:"",task:"",context:"",audience:"",format:"free",tone:"t_pro",length:"l_medium",language:"",constraints:"",examples:""});
  const [step,setStep]=useState(true); const [ask,setAsk]=useState(false);
  const [copied,setCopied]=useState(false);
  useEffect(()=>{document.documentElement.setAttribute("lang",lang);try{localStorage.setItem("acacia-lang",lang);}catch(e){}},[lang]);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const applyPreset=(p)=>{
    const P={
      p_blog:{role:t("role_ph"),task:lang==="es"?"Escribe un artículo de blog sobre [tema]":"Write a blog article about [topic]",format:"f_essay",tone:"t_friendly",length:"l_long"},
      p_resumen:{role:lang==="es"?"editor experto":"expert editor",task:lang==="es"?"Resume el siguiente texto destacando los puntos clave":"Summarize the following text highlighting key points",format:"f_list",tone:"t_pro",length:"l_short"},
      p_codigo:{role:lang==="es"?"desarrollador senior":"senior developer",task:lang==="es"?"Escribe una función que [haga X] e incluye comentarios":"Write a function that [does X] with comments",format:"f_free",tone:"t_pro",length:"l_medium"},
      p_email:{role:lang==="es"?"copywriter de ventas":"sales copywriter",task:lang==="es"?"Redacta un email para vender [producto]":"Write an email to sell [product]",format:"f_free",tone:"t_persuasive",length:"l_short"},
      p_plan:{role:lang==="es"?"consultor de negocios":"business consultant",task:lang==="es"?"Crea un plan paso a paso para [objetivo]":"Create a step-by-step plan for [goal]",format:"f_steps",tone:"t_pro",length:"l_long"},
    }[p];
    setF(prev=>({...prev,...P}));
  };

  const prompt=useMemo(()=>{
    const fmtMap={free:t("f_free"),f_list:t("f_list"),f_table:t("f_table"),f_steps:t("f_steps"),f_json:t("f_json"),f_essay:t("f_essay")};
    const parts=[];
    if(f.role.trim()) parts.push(t("L_role")+" "+f.role.trim()+".");
    if(f.context.trim()) parts.push(t("L_context")+": "+f.context.trim());
    if(f.task.trim()) parts.push(t("L_task")+": "+f.task.trim());
    if(f.audience.trim()) parts.push(t("L_audience")+": "+f.audience.trim());
    if(f.format!=="free") parts.push(t("L_format")+": "+fmtMap[f.format]);
    parts.push(t("L_tone")+": "+t(f.tone)+" · "+t("L_length")+": "+t(f.length));
    if(f.constraints.trim()) parts.push(t("L_constraints")+": "+f.constraints.trim());
    if(f.examples.trim()) parts.push(t("L_examples")+":\n"+f.examples.trim());
    if(f.language.trim()) parts.push(t("L_lang")+" "+f.language.trim()+".");
    if(ask) parts.push(t("L_ask"));
    if(step) parts.push(t("L_step"));
    return parts.join("\n\n");
  },[f,step,ask,lang]);

  const copy=async()=>{try{await navigator.clipboard.writeText(prompt);setCopied(true);setTimeout(()=>setCopied(false),1600);if(window.acaciaTrack)window.acaciaTrack("prompt_copy",{});}catch(e){}};
  const clear=()=>setF({role:"",task:"",context:"",audience:"",format:"free",tone:"t_pro",length:"l_medium",language:"",constraints:"",examples:""});

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

        <div className="presets" aria-label={t("presets")}>
          {["p_blog","p_resumen","p_codigo","p_email","p_plan"].map(p=><button key={p} type="button" className="preset" onClick={()=>applyPreset(p)}>{t(p)}</button>)}
        </div>

        <div className="io">
          <div className="card">
            <div className="field"><label>{t("role")}</label><input type="text" value={f.role} onChange={(e)=>set("role",e.target.value)} placeholder={t("role_ph")} /></div>
            <div className="field"><label>{t("task")}</label><textarea value={f.task} onChange={(e)=>set("task",e.target.value)} placeholder={t("task_ph")} /></div>
            <div className="field"><label>{t("context")}</label><textarea value={f.context} onChange={(e)=>set("context",e.target.value)} placeholder={t("context_ph")} /></div>
            <div className="field"><label>{t("audience")}</label><input type="text" value={f.audience} onChange={(e)=>set("audience",e.target.value)} placeholder={t("audience_ph")} /></div>
            <div className="row2">
              <div className="field"><label>{t("format")}</label><select value={f.format} onChange={(e)=>set("format",e.target.value)}><option value="free">{t("f_free")}</option><option value="f_list">{t("f_list")}</option><option value="f_table">{t("f_table")}</option><option value="f_steps">{t("f_steps")}</option><option value="f_json">{t("f_json")}</option><option value="f_essay">{t("f_essay")}</option></select></div>
              <div className="field"><label>{t("tone")}</label><select value={f.tone} onChange={(e)=>set("tone",e.target.value)}><option value="t_pro">{t("t_pro")}</option><option value="t_casual">{t("t_casual")}</option><option value="t_persuasive">{t("t_persuasive")}</option><option value="t_friendly">{t("t_friendly")}</option><option value="t_formal">{t("t_formal")}</option></select></div>
            </div>
            <div className="row2">
              <div className="field"><label>{t("length")}</label><select value={f.length} onChange={(e)=>set("length",e.target.value)}><option value="l_short">{t("l_short")}</option><option value="l_medium">{t("l_medium")}</option><option value="l_long">{t("l_long")}</option></select></div>
              <div className="field"><label>{t("language")}</label><input type="text" value={f.language} onChange={(e)=>set("language",e.target.value)} placeholder={lang==="es"?"español":"english"} /></div>
            </div>
            <div className="field"><label>{t("constraints")}</label><textarea value={f.constraints} onChange={(e)=>set("constraints",e.target.value)} placeholder={t("constraints_ph")} /></div>
            <div className="field"><label>{t("examples")}</label><textarea value={f.examples} onChange={(e)=>set("examples",e.target.value)} placeholder={t("examples_ph")} /></div>
            <label className="chk"><input type="checkbox" checked={step} onChange={(e)=>setStep(e.target.checked)} /> {t("stepwise")}</label>
            <label className="chk"><input type="checkbox" checked={ask} onChange={(e)=>setAsk(e.target.checked)} /> {t("askback")}</label>
          </div>

          <div className="card">
            <div className="out-head"><label>{t("output")}</label>
              <span style={{display:"flex",gap:8,alignItems:"center"}}>
                {copied?<span className="copied">{t("copied")}</span>:null}
                <button className="btn" onClick={clear}>{t("clear")}</button>
                <button className="btn btn-primary" onClick={copy} disabled={!prompt.trim()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>{t("copy")}
                </button>
              </span>
            </div>
            <div className="prompt">{prompt || "…"}</div>
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
