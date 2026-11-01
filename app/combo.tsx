"use client";
import {useEffect,useId,useRef,useState} from "react";
import {normalize} from "../lib/catalog.mjs";

type Props={label:string;value:string;onChange:(value:string)=>void;options:string[][];required?:boolean;allowCustom?:boolean;showCodes?:boolean;autoFocus?:boolean};
export default function Combo({label,value,onChange,options,required=false,allowCustom=false,showCodes=true,autoFocus=false}:Props){
 const [open,setOpen]=useState(false);
 // null means the user opened the list, not that they typed a filter.
 const [query,setQuery]=useState<string|null>(null);
 const [active,setActive]=useState(0);
 const id=useId(),ref=useRef<HTMLDivElement>(null);
 const list=query===null?options:options.filter(([code,name])=>normalize(name).includes(normalize(query))||normalize(code)===normalize(query));
 useEffect(()=>{
  function close(event:MouseEvent){if(!ref.current?.contains(event.target as Node))setOpen(false);}
  document.addEventListener("mousedown",close);
  return()=>document.removeEventListener("mousedown",close);
 },[]);
 function choose(name:string){onChange(name);setQuery(null);setOpen(false);setActive(0);}
 function reveal(){setQuery(null);setActive(0);setOpen(true);}
 return <div className="field"><label htmlFor={id}>{label}{required&&" *"}</label>
 <div className="combo" ref={ref}>
  <input autoFocus={autoFocus} id={id} required={required} role="combobox" autoComplete="off" aria-expanded={open} aria-controls={id+"-options"} aria-autocomplete="list" aria-activedescendant={open&&list[active]?id+"-option-"+active:undefined}
   placeholder="Digite ou selecione" value={value}
   onFocus={reveal}
   onChange={event=>{onChange(event.target.value);setQuery(event.target.value);setActive(0);setOpen(true);}}
   onBlur={event=>{if(!ref.current?.contains(event.relatedTarget as Node))setOpen(false);}}
   onKeyDown={event=>{
    if(event.key==="Escape"){event.preventDefault();setOpen(false);}
    if(event.key==="ArrowDown"){event.preventDefault();if(!open)reveal();else setActive(i=>Math.min(i+1,list.length-1));}
    if(event.key==="ArrowUp"){event.preventDefault();if(!open){setQuery(null);setOpen(true);setActive(Math.max(0,options.length-1));}else setActive(i=>Math.max(0,i-1));}
    if(event.key==="Enter"&&open){event.preventDefault();if(list[active])choose(list[active][1]);else if(allowCustom)setOpen(false);}
    if(event.key==="Tab")setOpen(false);
   }}/>
  <button tabIndex={-1} type="button" aria-label={"Selecionar "+label} onMouseDown={event=>event.preventDefault()} onClick={()=>{if(open)setOpen(false);else reveal();}}>
   <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m6 9 6 6 6-6"/></svg>
  </button>
  {open&&<div className="options" role="listbox" id={id+"-options"} aria-label={label}>
   {list.map(([code,name],index)=><button key={code} type="button" role="option" id={id+"-option-"+index} aria-selected={value===name} data-active={active===index?"true":undefined}
    onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>choose(name)}>
    <span>{name}</span>{showCodes&&<small>{code}</small>}
   </button>)}
   {!list.length&&<p>{allowCustom?(options.length?"Fornecedor novo: pode manter o nome digitado.":"Os fornecedores aparecerão aqui após importar ou salvar seus produtos. Você também pode digitar um novo nome."):"Escolha um valor cadastrado."}</p>}
  </div>}
 </div>{allowCustom&&<small>Digite para buscar ou clique na seta para ver os fornecedores cadastrados. Novos nomes também são aceitos.</small>}
 </div>;
}
