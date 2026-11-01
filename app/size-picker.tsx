"use client";
import {useEffect,useId,useRef,useState} from "react";
import {normalize,sizes} from "../lib/catalog.mjs";

export default function SizePicker({values,onChange,autoFocus=false}:{values:string[];onChange:(values:string[])=>void;autoFocus?:boolean}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState("");
 const id=useId(),ref=useRef<HTMLDivElement>(null);
 const options=sizes.filter(([code,name]:string[])=>normalize(name).includes(normalize(query))||code===query.trim());
 useEffect(()=>{function close(e:MouseEvent){if(!ref.current?.contains(e.target as Node))setOpen(false);}document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close);},[]);
 function toggle(code:string){onChange(values.includes(code)?values.filter(v=>v!==code):[...values,code]);}
 return <div className="field sizePicker" ref={ref} onBlur={e=>{if(!ref.current?.contains(e.relatedTarget as Node))setOpen(false);}}>
  <label htmlFor={id}>Tamanhos *</label>
  <div className="combo">
   <input id={id} autoFocus={autoFocus} value={query} placeholder={values.length?values.length+" tamanho(s) selecionado(s)":"Selecione um ou vários"} autoComplete="off" aria-expanded={open} aria-controls={id+"-options"}
    onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true);}}
    onKeyDown={e=>{if(e.key==="Escape"){e.preventDefault();setOpen(false);}if(e.key==="ArrowDown"){e.preventDefault();setOpen(true);ref.current?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.focus();}if(e.key==="Enter"&&!e.ctrlKey&&!e.metaKey){e.preventDefault();if(options.length===1)toggle(options[0][0]);setOpen(true);}}}/>
   <button type="button" tabIndex={-1} aria-label="Selecionar tamanhos" onClick={()=>{setQuery("");setOpen(v=>!v);}}>⌄</button>
  </div>
  {open&&<div className="sizeOptions" id={id+"-options"} onBlur={e=>{if(!ref.current?.contains(e.relatedTarget as Node))setOpen(false);}}>
   <small>Marque quantos tamanhos quiser</small>
   <div className="sizeChoices">{options.map(([code,name]:string[])=><label key={code}><input type="checkbox" checked={values.includes(code)} onChange={()=>toggle(code)}/><span>{name}</span></label>)}</div>
   {!options.length&&<p>Nenhum tamanho encontrado.</p>}
   <button type="button" onClick={()=>{setOpen(false);setQuery("");}}>Concluir seleção ({values.length})</button>
  </div>}
  {values.length>0&&<small>{values.map(code=>sizes.find(([c]:string[])=>c===code)?.[1]).join(" · ")}</small>}
 </div>;
}
