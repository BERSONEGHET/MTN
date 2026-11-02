"use client";
import {useEffect,useMemo,useState,useRef} from "react";
import {createPortal} from "react-dom";
import {renderLabelImage,renderLabelCanvas,imagePrintDocument,layoutLabelName,singleLineNameFit} from "../lib/label-print.mjs";
import {labelPdf,monochromeRaster,pngWithDpi} from "../lib/label-pdf.mjs";
import {normalize} from "../lib/catalog.mjs";
import {labelCardCss,labelSettings,MAX_LABELS,prepareLabels,selectLabelProducts,DEFAULT_LABEL_APPEARANCE,labelAppearance,labelContentLayout,barcodeWidthPercent,rebalanceLabelAppearance,stretchLabelBarcode,labelNameWidthMm} from "../lib/labels.mjs";

type Product={id:string;sku:string;name:string;color:string;size:string;quantity:number;price:number|null};
type Barcode={path:string;width:number;height:number};
const money=(n:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n/100);
function LabelCard({row,barcode,width,height,showPrice,appearance,guides=false}:{row:Product;barcode:Barcode;width:number;height:number;showPrice:boolean;appearance:Record<string,number>;guides?:boolean}){
 const layout=labelContentLayout(height,appearance,showPrice);
 return <article className={"mtnLabel"+(height<25?" mtnLabelSmall":"")+(guides?" mtnLabelGuides":"")} style={{width:width+"mm",height:height+"mm",justifyContent:"flex-start",paddingTop:appearance.marginTop+"mm",paddingBottom:appearance.marginBottom+"mm"}}>
  <div className="mtnLabelName" style={{fontSize:appearance.nameFont+"pt",height:layout.nameHeight+"mm",width:(labelNameWidthMm(width,height,appearance,barcode)/(width-(height<25?2:4))*100)+"%",whiteSpace:appearance.nameLines===1?"nowrap":"normal"}}>{row.name}</div>
  <svg className="mtnLabelBarcode" style={{marginTop:appearance.gapNameBarcode+"mm",height:Math.max(3,layout.barcodeHeight)+"mm",width:barcodeWidthPercent(appearance.barcodeWidth)+"%",flex:"0 0 auto"}} viewBox={`0 0 ${barcode.width} ${barcode.height}`} preserveAspectRatio="none" role="img" aria-label={"Código de barras de "+row.sku}>
   <rect width={barcode.width} height={barcode.height} fill="white"/><path d={barcode.path} fill="black"/>
  </svg>
  <div className="mtnLabelSku" style={{fontSize:appearance.skuFont+"pt",marginTop:appearance.gapBarcodeSku+"mm",whiteSpace:"nowrap"}}>{row.sku}</div>
  {showPrice&&<div className="mtnLabelPrice" style={{fontSize:appearance.priceFont+"pt",marginTop:appearance.gapSkuPrice+"mm"}}>{row.price===null?"Sem preço":money(row.price)}</div>}
 </article>;
}
export default function LabelGenerator({rows,initialProductId=""}:{rows:Product[];initialProductId?:string}){
 const [showGuides,setShowGuides]=useState(true);
 const [compatiblePrint,setCompatiblePrint]=useState(true),[printing,setPrinting]=useState(false),[printError,setPrintError]=useState("");
 const printFrame=useRef<HTMLIFrameElement|null>(null);
 useEffect(()=>()=>{printFrame.current?.remove();},[]);
 const [query,setQuery]=useState(""),[page,setPage]=useState(1),[quantities,setQuantities]=useState<Record<string,string>>(()=>initialProductId?{[initialProductId]:"1"}:{});
 const [width,setWidth]=useState("50"),[height,setHeight]=useState("30"),[columns,setColumns]=useState("1"),[gap,setGap]=useState("0"),[verticalGap,setVerticalGap]=useState("0"),[showPrice,setShowPrice]=useState(true),[mounted,setMounted]=useState(false);
 const [appearanceForm,setAppearanceForm]=useState<Record<string,number|string>>({...DEFAULT_LABEL_APPEARANCE});
 const [appliedAppearance,setAppliedAppearance]=useState<Record<string,number>>({...DEFAULT_LABEL_APPEARANCE}),[appliedNotice,setAppliedNotice]=useState(false);
 useEffect(()=>{try{const saved=localStorage.getItem("mtn-label-appearance");if(saved){const value=labelAppearance({...JSON.parse(saved),nameLines:1});setAppearanceForm(value);setAppliedAppearance(value);}}catch{}setMounted(true);},[]);
 let appearance:any=null,appearanceError="";try{appearance=labelAppearance(appearanceForm);}catch(e:any){appearanceError=e.message;}
 useEffect(()=>{if(mounted){try{localStorage.setItem("mtn-label-appearance",JSON.stringify(appliedAppearance));}catch{}}},[mounted,appliedAppearance]);
 const appearancePending=!!appearance&&Object.keys(DEFAULT_LABEL_APPEARANCE).some(key=>appearance[key]!==appliedAppearance[key]);
 const filtered=rows.filter(r=>normalize([r.name,r.sku,r.color,r.size].join(" ")).includes(normalize(query))),pages=Math.max(1,Math.ceil(filtered.length/40)),visible=filtered.slice((page-1)*40,page*40);
 const selection=useMemo(()=>{try{return {...prepareLabels(rows,quantities),error:""};}catch(e:any){return {entries:[],total:0,error:e.message};}},[rows,quantities]);
 let settings:any=null,settingsError="";try{settings=labelSettings({width:Number(width),height:Number(height),columns:Number(columns),gap:Number(gap),verticalGap:Number(verticalGap)});}catch(e:any){settingsError=e.message;}
 const first=selection.entries[0];
 const liveLayout=appearance&&settings?labelContentLayout(settings.height,appearance,showPrice):null;
 function changeAppearance(key:string,value:string){setAppearanceForm(previous=>rebalanceLabelAppearance(previous,key,value,settings?.height||30,showPrice));}

 const contentFits=!!(settings&&appearance&&labelContentLayout(settings.height,appearance,showPrice).fits);
 const contentError=settings&&appearance&&!contentFits?"As margens, fontes, espaços ou barras ultrapassam a altura da etiqueta. Reduza os valores ou aumente a etiqueta.":"";
 const longSku=!!(settings&&appearance&&selection.entries.some((entry:any)=>entry.row.sku.length*appearance.skuFont*25.4/72*.6>settings.width-(settings.height<25?2:4)));
 const nameFit=useMemo(()=>{
  if(!mounted||!settings||!appearance)return {overflow:[] as string[],first:null as any};
  const context=document.createElement("canvas").getContext("2d");if(!context)return {overflow:[] as string[],first:null as any};
  context.font=`${appearance.nameFont*300/72}px Arial`;const measure=(text:string)=>context.measureText(text).width;
  const checked=selection.entries.map((entry:any)=>({name:entry.row.name,...singleLineNameFit(entry.row.name,measure,labelNameWidthMm(settings.width,settings.height,appearance,entry.barcode)*300/25.4)}));
  return {overflow:checked.filter((entry:any)=>!entry.fits).map((entry:any)=>entry.name),first:checked[0]||null};
 },[mounted,width,height,appearanceForm,selection.entries]);
 const selectedCount=rows.filter(r=>Object.hasOwn(quantities,r.id)).length;
 const missingPrices=selection.entries.filter((e:any)=>e.row.price===null).length;
 const dense=first&&settings&&appearance&&((settings.width-(settings.height<25?2:4))*barcodeWidthPercent(appearance.barcodeWidth)/100)/first.barcode.width<.19;
 function toggle(id:string){setQuantities(previous=>{const next={...previous};if(Object.hasOwn(next,id))delete next[id];else next[id]="1";return next;});}
 function selectPage(){setQuantities(previous=>selectLabelProducts(visible,previous));}
 function selectAll(){setQuantities(previous=>selectLabelProducts(rows,previous));}
 const copies:any[]=selection.entries.flatMap((entry:any)=>Array.from({length:entry.quantity},(_,i)=>({...entry,key:entry.row.id+":"+i})));
 const printRows:any[][]=[];if(settings)for(let i=0;i<copies.length;i+=settings.columns)printRows.push(copies.slice(i,i+settings.columns));
 function saveLabelFile(blob:Blob,name:string){const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 function downloadLabel(){
  if(!first||!settings)return;setPrintError("");try{const image=renderLabelImage(first.row,first.barcode,settings,appliedAppearance,showPrice);saveLabelFile(pngWithDpi(image,300),"Etiqueta_"+first.row.sku.replace(/[^A-Za-z0-9._-]/g,"_")+"_"+settings.width+"x"+settings.height+"mm_300dpi.png");}catch(e:any){setPrintError(e.message);}
 }
 async function downloadPdf(testOnly=false){
  if(!settings||!first||appearancePending)return;setPrinting(true);setPrintError("");try{
   const target=testOnly?labelSettings({width:50,height:30,columns:1,gap:0,verticalGap:0}):settings;
   if(!labelContentLayout(target.height,appliedAppearance,showPrice).fits)throw new Error("O layout aplicado não cabe em 50 × 30 mm. Reduza as margens, fontes ou barras para o teste.");
   const entries=testOnly?[first]:selection.entries,rasters=new Map();
   for(const entry of entries){const canvas=renderLabelCanvas(entry.row,entry.barcode,target,appliedAppearance,showPrice);rasters.set(entry.row.id,monochromeRaster(canvas));}
   const ids=testOnly?[first.row.id]:copies.map(entry=>entry.row.id),bytes=labelPdf(rasters,ids,target);
   saveLabelFile(new Blob([bytes],{type:"application/pdf"}),(testOnly?"Teste_1_etiqueta_50x30mm":"Etiquetas_"+target.paperWidth+"x"+target.paperHeight+"mm")+".pdf");
  }catch(e:any){setPrintError(e.message||"Não foi possível gerar o PDF.");}finally{setPrinting(false);}
 }
 async function printSelected(){
  if(!compatiblePrint){window.print();return;}if(!settings||!contentFits||appearancePending)return;
  setPrinting(true);setPrintError("");try{
   const images=new Map<string,string>();for(const entry of selection.entries){images.set(entry.row.id,renderLabelImage(entry.row,entry.barcode,settings,appliedAppearance,showPrice));}
   const html=imagePrintDocument(copies.map(entry=>images.get(entry.row.id)!),settings);
   printFrame.current?.remove();const frame=document.createElement("iframe");printFrame.current=frame;
   frame.title="Impressão de etiquetas MTN";frame.style.cssText="position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0;";
   await new Promise<void>((resolve,reject)=>{frame.onload=()=>resolve();frame.onerror=()=>reject(new Error("Não foi possível abrir a impressão."));frame.srcdoc=html;document.body.appendChild(frame);});
   const win=frame.contentWindow,doc=frame.contentDocument;if(!win||!doc)throw new Error("Não foi possível carregar a página de etiquetas.");
   await Promise.all(Array.from(doc.images).map(image=>image.decode()));
   if(doc.fonts)await doc.fonts.ready;
   await new Promise<void>(resolve=>window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>resolve())));
   win.focus();win.print();
  }catch(e:any){setPrintError(e.message||"Não foi possível imprimir. Tente baixar o PDF em tamanho real.");}finally{setPrinting(false);}
 }
 return <section className="labelsWorkspace">
  <style>{labelCardCss}</style>
  <div className="labelsControls panel">
   <div className="labelsSectionTitle"><h2>Formato da etiqueta</h2><span>Código de barras Code 128</span></div>
   <div className="labelPresets"><button type="button" className={width==="50"&&height==="30"?"selectedPreset":""} onClick={()=>{setWidth("50");setHeight("30");}}>50 × 30 mm</button><button type="button" className={width==="33"&&height==="21"?"selectedPreset":""} onClick={()=>{setWidth("33");setHeight("21");}}>33 × 21 mm</button></div>
   <div className="formGrid"><label className="field">Largura (mm)<input type="number" min="20" max="100" step=".5" value={width} onChange={e=>setWidth(e.target.value)}/></label><label className="field">Altura (mm)<input type="number" min="15" max="100" step=".5" value={height} onChange={e=>setHeight(e.target.value)}/></label></div>
   <div className="formGrid"><label className="field">Colunas na bobina<input type="number" min="1" max="4" step="1" value={columns} onChange={e=>setColumns(e.target.value)}/></label><label className="field">Espaço horizontal (mm)<input type="number" min="0" max="10" step=".5" value={gap} onChange={e=>setGap(e.target.value)}/></label></div>
   <label className="field">Espaço vertical entre etiquetas (mm)<input type="number" min="0" max="20" step=".5" value={verticalGap} onChange={e=>setVerticalGap(e.target.value)}/><small>Distância entre o fim de uma etiqueta e o início da próxima linha.</small></label>
   <label className="checkLabel"><input type="checkbox" checked={showPrice} onChange={e=>setShowPrice(e.target.checked)}/>Mostrar preço de venda</label>
   <details className="labelAppearanceEditor" open><summary>Editar layout da etiqueta</summary>
    <div className="labelEditHeading">Margens dentro da etiqueta (mm)</div><div className="formGrid">{[["marginTop","Superior"],["marginBottom","Inferior"]].map(([key,label])=><label className="field" key={key}>{label}<input type="number" min="0" max="20" step=".1" value={appearanceForm[key]} onChange={e=>changeAppearance(key,e.target.value)}/></label>)}</div>
    <div className="labelEditHeading">Tamanho do código de barras</div><div className="formGrid"><label className="field">Altura das barras (mm)<input type="number" min="-80" max="80" step=".5" value={liveLayout?Number(liveLayout.barcodeHeight.toFixed(2)):appearanceForm.barcodeHeight} onChange={e=>changeAppearance("barcodeHeight",e.target.value)}/><small>Altura real. Aumentar redistribui o espaço livre.</small></label><label className="field">Largura do código (%)<input type="number" min="-80" max="100" step="1" value={appearance?barcodeWidthPercent(appearance.barcodeWidth):appearanceForm.barcodeWidth} onChange={e=>changeAppearance("barcodeWidth",e.target.value)}/><small>Largura real: aumentar alarga; diminuir estreita.</small></label></div>
    {liveLayout&&<label className="field labelHeightSlider">Esticar as barras: {liveLayout.barcodeHeight.toFixed(1)} mm<input type="range" min="3" max={settings.height} step=".2" value={Math.max(3,liveLayout.barcodeHeight)} onChange={e=>changeAppearance("barcodeHeight",e.target.value)}/></label>}
    <button type="button" className="stretchBarcodeButton" onClick={()=>{try{setAppearanceForm(stretchLabelBarcode(appearanceForm));}catch{}}}>Esticar até perto do nome</button>
    <small>Nome em uma linha, com a mesma largura das barras do código. O programa avisa se o texto ultrapassar.</small>
    <small>As margens são interligadas: aumentar uma consome o espaço livre das outras áreas. As fontes são preservadas.</small>
    <div className="labelEditHeading">Tamanho das fontes (pt)</div><div className="labelFontGrid">{[["nameFont","Nome"],["skuFont","SKU"],["priceFont","Preço"]].map(([key,label])=><label className="field" key={key}>{label}<input type="number" min="4" max="30" step=".5" value={appearanceForm[key]} onChange={e=>changeAppearance(key,e.target.value)}/></label>)}</div>
    <div className="labelEditHeading">Espaço entre os itens (mm)</div>{[["gapNameBarcode","Nome → Código de barras"],["gapBarcodeSku","Código de barras → SKU"],["gapSkuPrice","SKU → Preço"]].map(([key,label])=><label className="field labelGapControl" key={key}><span>{label}</span><input type="number" min="-10" max="10" step=".1" value={appearanceForm[key]} onChange={e=>changeAppearance(key,e.target.value)}/></label>)}
    <small>Valores negativos aproximam os itens e deslocam para cima; positivos aumentam o espaço.</small>
    <button className="primary applyLabelAppearance" type="button" disabled={!appearance||!contentFits} onClick={()=>{setAppliedAppearance({...appearance});setAppliedNotice(true);}}>Aplicar a todas as etiquetas</button>
    <button type="button" onClick={()=>setAppearanceForm({...DEFAULT_LABEL_APPEARANCE})}>Restaurar configurações</button><small>Edite a prévia e clique em Aplicar. Os ajustes serão usados em todas as cópias dos produtos selecionados e ficarão salvos neste navegador.</small>
   </details>
   <label className="checkLabel labelPreviewGuides"><input type="checkbox" checked={showGuides} onChange={e=>setShowGuides(e.target.checked)}/>Mostrar limites dos itens na prévia</label>
   <div className="labelPreviewArea"><span>PRÉVIA AMPLIADA</span>{first&&settings&&appearance?<div className="labelPreviewZoom"><LabelCard row={first.row} barcode={first.barcode} width={settings.width} height={settings.height} showPrice={showPrice} appearance={appearance} guides={showGuides}/></div>:<p>{first?"Confira os ajustes de dimensão e fonte para visualizar a etiqueta.":"Selecione um produto para visualizar sua etiqueta."}</p>}</div>
   {appearancePending&&<p className="labelHint" role="status">Há ajustes na prévia. Clique em “Aplicar a todas as etiquetas” antes de imprimir.</p>}
   {appliedNotice&&!appearancePending&&<p className="labelAppliedNotice" role="status">✓ Ajustes aplicados a todas as etiquetas dos produtos selecionados.</p>}
   {(selection.error||settingsError||appearanceError||contentError)&&<div className="banner error" role="alert">{selection.error||settingsError||appearanceError||contentError}</div>}
   {nameFit.first?.fits&&<p className="labelSpacingSummary">Nome em uma linha: {nameFit.first.remainingLetters>0?"espaço aproximado para mais "+nameFit.first.remainingLetters+" letras.":"próximo do limite da largura das barras."}</p>}
   {nameFit.overflow.length>0&&<div className="labelNameWarning" role="status"><strong>Nome maior que o espaço da etiqueta</strong><span>{nameFit.overflow.length} produto(s) podem ter o nome cortado com {appearance?.nameLines} linha(s) e fonte {appearance?.nameFont} pt. Abrevie o nome ou reduza a fonte; o nome permanece em uma linha.</span><small title={nameFit.overflow.join(" · ")}>{nameFit.overflow[0]}</small></div>}
   {longSku&&<p className="labelHint">A fonte do SKU pode ultrapassar a largura disponível. Confira a prévia e reduza a fonte ou aumente a largura.</p>}
   {dense&&<p className="labelHint">Este SKU fica denso neste tamanho. Teste a leitura ou use uma etiqueta mais larga.</p>}
   {showPrice&&missingPrices>0&&<p className="labelHint">{missingPrices} produto(s) sem preço definido aparecerão com “Sem preço”.</p>}
   {settings&&<p className="labelSpacingSummary">Etiqueta: {settings.width} × {settings.height} mm · Espaço: {settings.gap} mm horizontal / {settings.verticalGap} mm vertical</p>}
   <div className="labelPrintSummary"><strong>{selection.total} etiqueta(s)</strong><span>{selectedCount} produto(s) selecionado(s)</span></div>
   <div className="labelPdfGuide"><strong>Imprimir em tamanho real</strong><p>Para sua bobina 50 × 30 mm, comece pelo PDF de teste: uma etiqueta, sem espaço extra de avanço.</p><p>No leitor de PDF: papel <b>50 × 30 mm</b>, <b>Tamanho real / 100%</b>, uma página por folha. Desative Pôster, Mosaico e ajuste automático. Confira a orientação no driver.</p></div>
   <button type="button" className="primary printLabelsButton" disabled={!first||!settings||!appearance||!contentFits||appearancePending||printing} onClick={()=>downloadPdf(true)}>Baixar PDF de teste — 1 etiqueta 50 × 30</button>
   <button type="button" className="downloadLabelImage" disabled={!first||!settings||!appearance||!contentFits||appearancePending||printing} onClick={()=>downloadPdf(false)}>Baixar PDF das etiquetas — tamanho real</button>
   <label className="checkLabel compatiblePrintOption"><input type="checkbox" checked={compatiblePrint} onChange={e=>setCompatiblePrint(e.target.checked)}/>Impressão compatível: enviar como imagem</label>
   {printError&&<div className="banner error" role="alert">{printError}</div>}
   <button className="downloadLabelImage" type="button" disabled={printing||!mounted||!selection.total||!!selection.error||!settings||!appearance||!contentFits||appearancePending} onClick={printSelected}>{printing?"Preparando impressão…":"Imprimir pelo navegador (alternativo)"}</button>
   <button type="button" className="downloadLabelImage" disabled={!first||!settings||!appearance||!contentFits||appearancePending||printing} onClick={downloadLabel}>Baixar etiqueta selecionada em PNG</button>
   <small className="labelHint">O PNG contém a primeira etiqueta, com resolução de 300 dpi. Para imprimir, prefira o PDF: visualizadores de fotos podem ampliar a imagem para o papel selecionado.</small>
   <p className="labelHint">Na impressão, use escala 100%, sem margens e sem cabeçalhos. Configure a impressora com o tamanho {settings?settings.paperWidth+" × "+settings.paperHeight:"da etiqueta"} mm. Faça primeiro uma impressão de teste.</p>
  </div>
  <div className="panel labelProductPanel"><div className="panelHeading"><div><h2>Escolha os produtos</h2><span>Marque os itens e informe quantas etiquetas deseja.</span></div></div>
   <div className="labelSelectionTools"><input aria-label="Buscar produtos para etiquetas" placeholder="Buscar nome, SKU, tamanho ou cor" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/><button type="button" onClick={selectAll} disabled={!rows.length} title="Selecionar todos os produtos, inclusive nas outras páginas e fora da busca">Marcar todos ({rows.length})</button><button type="button" onClick={selectPage} disabled={!visible.length}>Marcar esta página</button><button type="button" onClick={()=>setQuantities({})} disabled={!selectedCount}>Limpar seleção</button></div>
   <div className="tableScroll"><table className="labelProductTable"><thead><tr><th>SELECIONAR</th><th>PRODUTO / SKU</th><th>TAM. / COR</th><th>VENDA</th><th>ETIQUETAS</th></tr></thead><tbody>{visible.map(r=><tr key={r.id} className={Object.hasOwn(quantities,r.id)?"selectedLabelProduct":""}><td><input type="checkbox" aria-label={"Imprimir etiqueta de "+r.name+", "+r.size+", "+r.color} checked={Object.hasOwn(quantities,r.id)} onChange={()=>toggle(r.id)}/></td><td><strong>{r.name}</strong><code>{r.sku}</code></td><td>{r.size} / {r.color}</td><td>{r.price===null?"Sem preço":money(r.price)}</td><td>{Object.hasOwn(quantities,r.id)?<input className="labelCount" aria-label={"Quantidade de etiquetas para "+r.sku} type="number" min="1" max={MAX_LABELS} step="1" value={quantities[r.id]} onChange={e=>setQuantities(previous=>({...previous,[r.id]:e.target.value}))}/>:"—"}</td></tr>)}{!visible.length&&<tr><td colSpan={5} className="empty">{rows.length?"Nenhum produto encontrado.":"Cadastre ou importe seus produtos para gerar etiquetas."}</td></tr>}</tbody></table></div>
   <footer className="tableFooter"><span>Até {MAX_LABELS} etiquetas por impressão</span><div><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>{page} de {pages}</span><button disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Próxima</button></div></footer>
  </div>
  {mounted&&!compatiblePrint&&createPortal(<section id="mtn-label-print" aria-hidden="true">
   {settings&&<style media="print">{`@page {size:${settings.paperWidth}mm ${settings.paperHeight}mm;margin:0;}html,body{margin:0!important;padding:0!important;background:white!important;}body>*:not(#mtn-label-print){display:none!important;}#mtn-label-print{display:block!important;margin:0;padding:0;width:${settings.paperWidth}mm;}#mtn-label-print .labelPrintRow{display:flex;gap:${settings.gap}mm;height:${settings.paperHeight}mm;width:${settings.paperWidth}mm;box-sizing:border-box;margin:0;padding:0 0 ${settings.verticalGap}mm;break-inside:avoid;overflow:hidden;}#mtn-label-print .labelPrintRow:not(:last-child){break-after:page;}*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}${labelCardCss}`}</style>}
   {settings&&appearance&&printRows.map((row,index)=><div className="labelPrintRow" key={index}>{row.map(entry=><LabelCard key={entry.key} row={entry.row} barcode={entry.barcode} width={settings.width} height={settings.height} showPrice={showPrice} appearance={appliedAppearance}/>)}</div>)}
  </section>,document.body)}
 </section>;
}
