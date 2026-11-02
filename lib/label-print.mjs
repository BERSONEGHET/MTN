import {labelContentLayout,barcodeWidthPercent,labelNameWidthMm} from "./labels.mjs";

// Rasterize the complete label locally; no SVG, fonts, or stylesheets need to
// reach the printer driver. This does not send anything until the user prints.
export function renderLabelCanvas(row,barcode,settings,appearance,showPrice,documentRef=document){
 const dpi=300,mm=dpi/25.4,pt=dpi/72,canvas=documentRef.createElement("canvas");
 canvas.width=Math.round(settings.width*mm);canvas.height=Math.round(settings.height*mm);
 const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Não foi possível preparar a imagem da etiqueta.");
 ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#000";ctx.textAlign="center";ctx.textBaseline="top";
 const side=settings.height<25?1:2,available=(settings.width-2*side)*mm,layout=labelContentLayout(settings.height,appearance,showPrice);
 ctx.font=`${appearance.nameFont*pt}px Arial`;
 const nameWidth=labelNameWidthMm(settings.width,settings.height,appearance,barcode)*mm;
 const lines=wrapLabelName(row.name,text=>ctx.measureText(text).width,nameWidth,appearance.nameLines||1);
 const lineHeight=appearance.nameFont*pt*1.1,nameTop=appearance.marginTop*mm+(layout.nameHeight*mm-lines.length*lineHeight)/2;
 ctx.save();ctx.beginPath();ctx.rect((canvas.width-nameWidth)/2,appearance.marginTop*mm,nameWidth,layout.nameHeight*mm);ctx.clip();
 lines.forEach((line,i)=>ctx.fillText(line,canvas.width/2,nameTop+i*lineHeight));ctx.restore();
 const barTop=(appearance.marginTop+layout.nameHeight+appearance.gapNameBarcode)*mm;
 const barWidth=available*barcodeWidthPercent(appearance.barcodeWidth)/100,barLeft=(canvas.width-barWidth)/2,scale=barWidth/barcode.width;
 const barHeight=layout.barcodeHeight*mm;
 // Round black and white boundaries to full pixels for a monochrome image.
 for(let i=0;i<barcode.bits.length;){if(barcode.bits[i]==="0"){i++;continue;}const start=i;while(barcode.bits[i]==="1")i++;
  const left=Math.round(barLeft+(start+10)*scale),right=Math.round(barLeft+(i+10)*scale);
  ctx.fillRect(left,Math.round(barTop),right-left,Math.round(barHeight));
 }
 const skuTop=barTop+barHeight+appearance.gapBarcodeSku*mm;
 ctx.font=`${appearance.skuFont*pt}px Arial`;ctx.fillText(row.sku,canvas.width/2,skuTop);
 if(showPrice){ctx.font=`bold ${appearance.priceFont*pt}px Arial`;const price=row.price===null?"Sem preço":new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(row.price/100);ctx.fillText(price,canvas.width/2,skuTop+(appearance.skuFont*25.4/72*1.15+appearance.gapSkuPrice)*mm);}
 return canvas;
}
export function layoutLabelName(value,measure,width,maxLines=2){
 const chars=Array.from(String(value)),lines=[];let current="";
 for(let i=0;i<chars.length;i++){
  const next=current+chars[i];
  if(current&&measure(next)>width){lines.push(current.trim());current=chars[i].trimStart();if(lines.length===maxLines)return {lines,truncated:chars.slice(i).join("").trim().length>0};}
  else current=next;
 }
 if(current||!lines.length)lines.push(current.trim());return {lines:lines.slice(0,maxLines),truncated:false};
}
export function wrapLabelName(...args){return layoutLabelName(...args).lines;}
export function imagePrintDocument(images,settings){
 for(const image of images)if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image))throw new Error("Imagem da etiqueta inválida.");
 const rows=[];for(let i=0;i<images.length;i+=settings.columns)rows.push('<div class="printRow">'+images.slice(i,i+settings.columns).map(src=>'<img src="'+src+'" alt="Etiqueta" width="'+settings.width+'" height="'+settings.height+'">').join("")+"</div>");
 return `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Etiquetas MTN</title><style>
 @page{size:${settings.paperWidth}mm ${settings.paperHeight}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000}body{width:${settings.paperWidth}mm}.printRow{display:flex;gap:${settings.gap}mm;width:${settings.paperWidth}mm;height:${settings.paperHeight}mm;padding:0 0 ${settings.verticalGap}mm;overflow:hidden;break-inside:avoid}.printRow:not(:last-child){break-after:page}img{display:block;flex-shrink:0;width:${settings.width}mm;height:${settings.height}mm;margin:0;padding:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
 </style></head><body>${rows.join("")}</body></html>`;
}

export function renderLabelImage(...args){return renderLabelCanvas(...args).toDataURL("image/png");}

export function singleLineNameFit(value,measure,width){
 const text=String(value??"").trim(),used=measure(text),average=measure("ABCDEFGHIJKLMNOPQRSTUVWXYZ")/26;
 return {fits:used<=width+.01,remainingLetters:Math.max(0,Math.floor((width-used)/Math.max(.01,average)))};
}
