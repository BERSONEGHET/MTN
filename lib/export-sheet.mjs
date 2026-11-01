// Excel Open XML, stored ZIP entries: no network or extra dependencies.
const encoder = new TextEncoder();
const xml = v => String(v ?? "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
function crc32(bytes) { let crc = -1; for (const b of bytes) { crc ^= b; for (let i=0;i<8;i++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); } return (crc^-1)>>>0; }
function zip(files) {
 const chunks=[],directory=[];let offset=0,size=0;
 for(const [path,content] of Object.entries(files)) {
  const name=encoder.encode(path),data=encoder.encode(content),crc=crc32(data);
  const local=new Uint8Array(30+name.length),v=new DataView(local.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);local.set(name,30);
  const central=new Uint8Array(46+name.length),c=new DataView(central.buffer);
  c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(14,33,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.set(name,46);
  chunks.push(local,data);directory.push(central);offset+=local.length+data.length;size+=central.length;
 }
 const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,directory.length,true);e.setUint16(10,directory.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
 const result=new Uint8Array(offset+size+22);let p=0;for(const part of [...chunks,...directory,end]){result.set(part,p);p+=part.length;}return result;
}
function sheet(headers,rows,widths) {
 const cell=(value,column,row,style=0)=>{const ref=String.fromCharCode(65+column)+row;return typeof value==="number"?`<c r="${ref}" s="${style}"><v>${value}</v></c>`:`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;};
 const data=rows.map((row,i)=>`<row r="${i+2}">${row.map((value,j)=>value&&typeof value==="object"?`<c r="${String.fromCharCode(65+j)}${i+2}" s="2"${value.value===""?' t="str"':""}><f>${xml(value.formula)}</f><v>${value.value}</v></c>`:cell(value,j,i+2,j>=6?2:0)).join("")}</row>`).join("");
 return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData><row r="1" ht="24" customHeight="1">${headers.map((h,i)=>cell(h,i,1,1)).join("")}</row>${data}</sheetData><autoFilter ref="A1:${String.fromCharCode(64+headers.length)}${rows.length+1}"/></worksheet>`;
}
export function exportWorkbook(products) {
 const rows=products.map((r,i)=>{const n=i+2,p=r.price===null?"":r.price/100,c=r.cost/100,q=r.quantity;return [r.sku,r.supplier,r.name,r.color,r.size,q,c,{formula:`F${n}*G${n}`,value:q*c},p,{formula:`IF(I${n}="","",F${n}*I${n})`,value:p===""?"":q*p},{formula:`IF(I${n}="","",I${n}-G${n})`,value:p===""?"":p-c},r.supplierRef];});
 const stock=products.map(r=>[r.sku,r.name,r.quantity,"",""]);
 const ns="http://schemas.openxmlformats.org";
 return zip({
  "[Content_Types].xml":`<Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${[1,2].map(i=>`<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
  "_rels/.rels":`<Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  "xl/workbook.xml":`<workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets><sheet name="Cadastro Produtos" sheetId="1" r:id="rId1"/><sheet name="Estoque" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
  "xl/_rels/workbook.xml.rels":`<Relationships xmlns="${ns}/package/2006/relationships">${[1,2].map(i=>`<Relationship Id="rId${i}" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`).join("")}<Relationship Id="rId3" Type="${ns}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  "xl/styles.xml":`<styleSheet xmlns="${ns}/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF24634D"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf xfId="0"/><xf xfId="0" fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf xfId="0" numFmtId="4" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  "xl/worksheets/sheet1.xml":sheet(["Código","Fornecedor","Produto","Cor","Tamanho","Quantidade","Custo Uni","Custo Total","Valor Venda","Valor Total","Lucro","REF FORNECEDOR"],rows,[23,24,42,24,12,14,16,18,16,18,18,24]),
  "xl/worksheets/sheet2.xml":sheet(["Código","Produto","Quantidade","Entrada","Saída"],stock,[23,42,16,16,16])
 });
}
