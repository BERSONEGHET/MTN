const encode=value=>new TextEncoder().encode(value);
function join(parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const part of parts){out.set(part,at);at+=part.length;}return out;}
export function monochromeRaster(canvas){
 const {width,height}=canvas,data=canvas.getContext("2d").getImageData(0,0,width,height).data;
 const stride=Math.ceil(width/8),bytes=new Uint8Array(stride*height);bytes.fill(255);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;if(data[i+3]>127&&(data[i]*.299+data[i+1]*.587+data[i+2]*.114)<160)bytes[y*stride+(x>>3)]&=~(128>>(x&7));}
 return {width,height,bytes};
}
// Embed monochrome image data into pages whose MediaBox is in physical points.
// No browser paper-size inference or PNG resolution metadata is involved.
export function labelPdf(rasters,copies,settings){
 if(!copies.length)throw new Error("Selecione pelo menos uma etiqueta.");
 const pt=72/25.4,number=n=>Number(n.toFixed(5)),objects=[null];
 const reserve=()=>{objects.push(null);return objects.length-1;};
 const catalog=reserve(),pages=reserve(),imageIds=new Map();
 function stream(dictionary,data){return join([encode(`<< ${dictionary} /Length ${data.length} >>\nstream\n`),data,encode("\nendstream")]);}
 for(const [key,image] of rasters){
  if(!Number.isInteger(image.width)||!Number.isInteger(image.height)||image.width<1||image.height<1||image.bytes.length!==Math.ceil(image.width/8)*image.height)throw new Error("Imagem da etiqueta inválida.");
  const id=reserve();imageIds.set(key,id);objects[id]=stream(`/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceGray /BitsPerComponent 1 /Interpolate false`,image.bytes);
 }
 const pageIds=[];
 for(let i=0;i<copies.length;i+=settings.columns){
  const row=copies.slice(i,i+settings.columns),pageId=reserve(),contentId=reserve();pageIds.push(pageId);
  let commands="",resources="";
  row.forEach((key,column)=>{const image=imageIds.get(key);if(!image)throw new Error("Etiqueta ausente no arquivo.");resources+=`/L${column} ${image} 0 R `;commands+=`q ${number(settings.width*pt)} 0 0 ${number(settings.height*pt)} ${number(column*(settings.width+settings.gap)*pt)} ${number((settings.paperHeight-settings.height)*pt)} cm /L${column} Do Q\n`;});
  objects[contentId]=stream("",encode(commands));
  const box=`0 0 ${number(settings.paperWidth*pt)} ${number(settings.paperHeight*pt)}`;
  objects[pageId]=encode(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [${box}] /CropBox [${box}] /Rotate 0 /Resources << /XObject << ${resources} >> >> /Contents ${contentId} 0 R >>`);
 }
 objects[catalog]=encode(`<< /Type /Catalog /Pages ${pages} 0 R /ViewerPreferences << /PrintScaling /None /PickTrayByPDFSize true /Duplex /Simplex >> >>`);
 objects[pages]=encode(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>id+" 0 R").join(" ")}] >>`);
 const parts=[encode("%PDF-1.4\n")],offsets=[0];let offset=parts[0].length;
 for(let id=1;id<objects.length;id++){offsets.push(offset);const part=join([encode(`${id} 0 obj\n`),objects[id],encode("\nendobj\n")]);parts.push(part);offset+=part.length;}
 const xref=offset;
 parts.push(encode(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,"0")+" 00000 n \n").join("")}trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
 return join(parts);
}
function crc32(bytes){let crc=-1;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^-1)>>>0;}
export function pngWithDpi(dataUrl,dpi=300){
 const source=Uint8Array.from(atob(dataUrl.split(",")[1]||""),c=>c.charCodeAt(0)),view=new DataView(source.buffer);
 if(source.length<33||view.getUint32(0)!==0x89504e47)throw new Error("PNG inválido.");
 const chunk=new Uint8Array(21),v=new DataView(chunk.buffer);v.setUint32(0,9);chunk.set(encode("pHYs"),4);v.setUint32(8,Math.round(dpi/.0254));v.setUint32(12,Math.round(dpi/.0254));chunk[16]=1;v.setUint32(17,crc32(chunk.subarray(4,17)));
 const parts=[source.subarray(0,8)];let added=false;
 for(let p=8;p+12<=source.length;){const length=view.getUint32(p),end=p+length+12;if(end>source.length)throw new Error("PNG incompleto.");const type=String.fromCharCode(...source.subarray(p+4,p+8));if(type!=="pHYs")parts.push(source.subarray(p,end));if(type==="IHDR"){parts.push(chunk);added=true;}p=end;}
 if(!added)throw new Error("PNG inválido.");return new Blob([join(parts)],{type:"image/png"});
}
