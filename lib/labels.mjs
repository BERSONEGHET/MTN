import JsBarcode from "../vendor/jsbarcode-code128.mjs";

export const MAX_LABELS = 500;
export function barcodeData(sku) {
 const value=String(sku??"");
 if(!value||value.length>60||!/^[\x20-\x7e]+$/.test(value))throw new Error("SKU incompatível com Code 128. Use até 60 caracteres sem acentos.");
 const result={};JsBarcode(result,value,{format:"CODE128",displayValue:false,margin:0,width:1,height:60});
 const bits=result.encodings.map(e=>e.data).join("");
 let path="";for(let i=0;i<bits.length;){if(bits[i]==="0"){i++;continue;}const start=i;while(bits[i]==="1")i++;path+=`M${start+10} 0h${i-start}v60h-${i-start}z`;}
 return {bits,path,width:bits.length+20,height:60};
}
export function labelSettings({width,height,columns,gap,verticalGap=0}) {
 for(const [value,min,max,name] of [[width,20,100,"largura"],[height,15,100,"altura"],[columns,1,4,"número de colunas"],[gap,0,10,"espaçamento horizontal"],[verticalGap,0,20,"espaçamento vertical"]]){
  if(!Number.isFinite(value)||value<min||value>max||(name==="número de colunas"&&!Number.isInteger(value)))throw new Error("Confira a "+name+" da etiqueta.");
 }
 return {width,height,columns,gap,verticalGap,paperWidth:width*columns+gap*(columns-1),paperHeight:height+verticalGap};
}
export function prepareLabels(rows,quantities){
 const selected=rows.filter(row=>Object.hasOwn(quantities,row.id));let total=0;
 const entries=selected.map(row=>{
  const quantity=Number(quantities[row.id]);
  if(!Number.isInteger(quantity)||quantity<1||quantity>MAX_LABELS)throw new Error("Informe de 1 a "+MAX_LABELS+" etiquetas por produto.");
  const barcode=barcodeData(row.sku);total+=quantity;
  return {row,quantity,barcode};
 });
 if(total>MAX_LABELS)throw new Error("Imprima até "+MAX_LABELS+" etiquetas por vez.");
 return {entries,total};
}
export const labelCardCss=`
.mtnLabel{box-sizing:border-box;background:#fff;color:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;padding:1.4mm 2mm;font-family:Arial,Helvetica,sans-serif;text-align:center;flex-shrink:0;break-inside:avoid;}
.mtnLabelName{width:100%;font-size:2.5mm;line-height:1.1;height:5.5mm;flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden;overflow-wrap:anywhere;}
.mtnLabelBarcode{width:100%;min-height:3mm;flex:1;display:block;}
.mtnLabelSku{width:100%;font-size:2.5mm;line-height:1.15;overflow-wrap:anywhere;flex-shrink:0;margin-top:.4mm;}
.mtnLabelPrice{font-size:3mm;line-height:1.15;font-weight:700;flex-shrink:0;margin-top:.3mm;}
.mtnLabelSmall .mtnLabelName{font-size:1.9mm;height:4.2mm}.mtnLabelSmall .mtnLabelSku{font-size:1.8mm}.mtnLabelSmall .mtnLabelPrice{font-size:2.3mm}.mtnLabelSmall{padding:.8mm 1mm}
`;

export function selectLabelProducts(rows,previous={}){
 return {...previous,...Object.fromEntries(rows.map(row=>[row.id,previous[row.id]??"1"]))};
}

export const DEFAULT_LABEL_APPEARANCE={nameFont:7,skuFont:7,priceFont:9,gapNameBarcode:0,gapBarcodeSku:.4,gapSkuPrice:.3,marginTop:1.4,marginBottom:1.4,barcodeHeight:0,barcodeWidth:100,nameLines:1};
export function labelAppearance(input){
 const value={...DEFAULT_LABEL_APPEARANCE,...input};
 for(const key of Object.keys(DEFAULT_LABEL_APPEARANCE)){
  value[key]=Number(value[key]);const font=key.endsWith("Font"),gap=key.startsWith("gap"),margin=key.startsWith("margin");
  const min=key==="nameLines"?1:font?4:gap?-10:(key==="barcodeWidth"||key==="barcodeHeight")?-80:0,max=key==="nameLines"?3:font?30:gap?10:margin?20:key==="barcodeHeight"?80:100;
  if(!Number.isFinite(value[key])||value[key]<min||value[key]>max)throw new Error(font?"Use fontes entre 4 e 30 pontos.":gap?"Use espaçamentos internos entre -10 e 10 mm.":margin?"Use margens entre 0 e 20 mm.":"Confira as dimensões do código de barras.");
  if(key==="nameLines"&&!Number.isInteger(value[key]))throw new Error("Use de 1 a 3 linhas para o nome.");
  if(key==="barcodeWidth"&&barcodeWidthPercent(value[key])<20)throw new Error("A largura resultante deve ser pelo menos 20%.");
  if(key==="barcodeHeight"&&value[key]>0&&value[key]<3)throw new Error("A altura das barras deve ser pelo menos 3 mm, ou 0 para automática.");
 }
 return value;
}
export function labelContentLayout(height,appearance,showPrice){
 appearance={...DEFAULT_LABEL_APPEARANCE,...appearance};
 const pt=25.4/72;
 const nameHeight=appearance.nameFont*pt*1.1*appearance.nameLines;
 const used=appearance.marginTop+appearance.marginBottom+nameHeight+appearance.skuFont*pt*1.15+Math.max(0,appearance.gapNameBarcode)+Math.max(0,appearance.gapBarcodeSku)+(showPrice?appearance.priceFont*pt*1.15+Math.max(0,appearance.gapSkuPrice):0);
 const automaticHeight=height-used;
 const barcodeHeight=appearance.barcodeHeight<=0?automaticHeight+appearance.barcodeHeight:appearance.barcodeHeight;
 return {nameHeight,barcodeHeight,requiredHeight:used+barcodeHeight,automaticHeight,fits:barcodeHeight>=3&&used+barcodeHeight<=height+.000001};
}

export function barcodeWidthPercent(value){return value<0?100+value:value===0?100:value;}

export function rebalanceLabelAppearance(input,key,raw,height,showPrice){
 if(raw===""||raw==="-"||!Number.isFinite(Number(raw)))return {...input,[key]:raw};
 let previous,next;try{previous=labelAppearance(input);next=labelAppearance({...previous,[key]:Number(raw)});}catch{return {...input,[key]:raw};}
 if(key==="barcodeWidth")return {...next,barcodeWidth:barcodeWidthPercent(next.barcodeWidth)};
 if(key==="barcodeHeight")next.barcodeHeight=Math.max(3,labelContentLayout(height,next,showPrice).barcodeHeight);
 else if(next.barcodeHeight<=0)next.barcodeHeight=Math.max(3,labelContentLayout(height,previous,showPrice).barcodeHeight);
 let excess=Math.max(0,labelContentLayout(height,next,showPrice).requiredHeight-height);
 const fields=key==="marginTop"?["marginBottom","gapNameBarcode","gapBarcodeSku","gapSkuPrice"]:key==="marginBottom"?["marginTop","gapNameBarcode","gapBarcodeSku","gapSkuPrice"]:["gapNameBarcode","marginBottom","marginTop","gapBarcodeSku","gapSkuPrice"];
 for(const field of fields){if(field===key)continue;const take=Math.min(Math.max(0,next[field]),excess);next[field]=Math.round((next[field]-take)*1000)/1000;excess=Math.max(0,excess-take);}
 if(excess>0)next.barcodeHeight=Math.max(3,next.barcodeHeight-excess);
 const capacity=labelContentLayout(height,next,showPrice).automaticHeight;
 next.barcodeHeight=Math.max(3,Math.floor((Math.min(next.barcodeHeight,capacity)+1e-8)*1000)/1000);
 return next;
}
export function stretchLabelBarcode(input){return {...labelAppearance(input),nameLines:1,gapNameBarcode:0,barcodeHeight:0};}

export function labelNameWidthMm(width,height,appearance,barcode){
 const side=height<25?1:2;
 return (width-side*2)*barcodeWidthPercent(appearance.barcodeWidth)/100*barcode.bits.length/barcode.width;
}
