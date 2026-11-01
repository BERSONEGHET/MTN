export async function readSpreadsheet(file:File):Promise<any[][]>{
 const buffer=await file.arrayBuffer();
 if(/\.csv$/i.test(file.name)){const text=new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/,"");return parseCsv(text);}
 if(!/\.xlsx$/i.test(file.name))throw new Error("Use um arquivo .xlsx ou .csv.");
 const bytes=new Uint8Array(buffer),view=new DataView(buffer);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw new Error("Arquivo Excel inválido.");
 const entries=new Map<string,{offset:number,size:number,method:number}>();let p=view.getUint32(end+16,true);
 const count=view.getUint16(end+10,true);if(count>5000)throw new Error("Arquivo muito complexo.");
 for(let i=0;i<count;i++){
 if(view.getUint32(p,true)!==0x02014b50)throw new Error("Estrutura Excel inválida.");
 const len=view.getUint16(p+28,true),extra=view.getUint16(p+30,true),comment=view.getUint16(p+32,true);
 const name=new TextDecoder().decode(bytes.slice(p+46,p+46+len));const size=view.getUint32(p+20,true);
 if(view.getUint32(p+24,true)>30000000)throw new Error("Planilha muito grande.");
 entries.set(name,{offset:view.getUint32(p+42,true),size,method:view.getUint16(p+10,true)});p+=46+len+extra+comment;
 }
 async function xml(path:string){
 const e=entries.get(path);if(!e)return null;
 const start=e.offset+30+view.getUint16(e.offset+26,true)+view.getUint16(e.offset+28,true);
 const data=bytes.slice(start,start+e.size);let text="";
 if(e.method===0)text=new TextDecoder().decode(data);
 else if(e.method===8){const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));text=await new Response(stream).text();}
 else throw new Error("Compressão de Excel não suportada.");
 const doc=new DOMParser().parseFromString(text,"application/xml");if(doc.querySelector("parsererror"))throw new Error("Não foi possível ler a planilha.");return doc;
 }
 const sharedDoc=await xml("xl/sharedStrings.xml");
 const shared=sharedDoc?Array.from(sharedDoc.getElementsByTagName("si")).map(si=>Array.from(si.getElementsByTagName("t")).map(t=>t.textContent||"").join("")):[];
 const workbook=await xml("xl/workbook.xml"),rels=await xml("xl/_rels/workbook.xml.rels");
 const sheets=Array.from(workbook?.getElementsByTagName("sheet")||[]);
 const chosen=sheets.find(s=>/cadastro.*produt/i.test(s.getAttribute("name")||""))||sheets[0];
 const relId=chosen?.getAttribute("r:id");
 const rel=Array.from(rels?.getElementsByTagName("Relationship")||[]).find(r=>r.getAttribute("Id")===relId);
 let target=rel?.getAttribute("Target")||"worksheets/sheet1.xml";
 target=target.startsWith("/")?target.slice(1):"xl/"+target.replace(/^\.\//,"");
 const sheet=await xml(target);if(!sheet)throw new Error("Aba de produtos não encontrada.");
 return Array.from(sheet.getElementsByTagName("row")).map(row=>{
 const result:any[]=[];
 for(const c of Array.from(row.getElementsByTagName("c"))){
 const ref=c.getAttribute("r")||"A1";let col=0;for(const letter of ref.replace(/[0-9]/g,""))col=col*26+letter.charCodeAt(0)-64;
 const type=c.getAttribute("t"),raw=c.getElementsByTagName("v")[0]?.textContent??"";
 result[col-1]=type==="s"?shared[Number(raw)]||"":type==="inlineStr"?Array.from(c.getElementsByTagName("t")).map(t=>t.textContent||"").join(""):type==="str"?raw:raw!==""?Number(raw):"";
 }
 return result;
 });
}
function parseCsv(text:string){
 const delimiter=text.split(/\r?\n/)[0].includes(";")?";":",";const rows:any[][]=[];let row:string[]=[],cell="",quoted=false;
 for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
 else if(ch===delimiter&&!quoted){row.push(cell);cell="";}else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&text[i+1]==="\n")i++;row.push(cell);rows.push(row);row=[];cell="";}else cell+=ch;}
 if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
