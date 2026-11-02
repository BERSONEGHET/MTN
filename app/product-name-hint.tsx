"use client";
import {useEffect,useState} from "react";
import {barcodeData,labelAppearance,labelNameWidthMm} from "../lib/labels.mjs";
import {singleLineNameFit} from "../lib/label-print.mjs";

export default function ProductNameHint({name,sku}:{name:string;sku:string}){
 const [fit,setFit]=useState<{fits:boolean;remainingLetters:number}|null>(null);
 useEffect(()=>{
  try{
   const raw=localStorage.getItem("mtn-label-appearance"),appearance=labelAppearance(raw?JSON.parse(raw):{});
   let barcode;try{barcode=barcodeData(sku);}catch{barcode=barcodeData("SAIF03801801");}
   const context=document.createElement("canvas").getContext("2d");if(!context)return;
   context.font=`${appearance.nameFont*300/72}px Arial`;
   setFit(singleLineNameFit(name,text=>context.measureText(text).width,labelNameWidthMm(50,30,appearance,barcode)*300/25.4));
  }catch{setFit(null);}
 },[name,sku]);
 if(!name.trim()||!fit)return null;
 return <small className={fit.fits?"nameLabelFits":"fieldError"} role="status">Etiqueta 50 × 30 mm · uma linha: {fit.fits?(fit.remainingLetters?`cabem aproximadamente mais ${fit.remainingLetters} letras.`:"o nome cabe, mas está próximo do limite."):"o nome ultrapassa a largura das barras. Abrevie o nome ou reduza a fonte da etiqueta."}</small>;
}
