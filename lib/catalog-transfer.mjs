const columns={
 models:['id','name','gender','prefix','seq','created_at'],
 products:['id','model_id','name','gender','seq','sku','sku_key','color','size','supplier','supplier_ref','quantity','cost','price','legacy','version','created_at','updated_at'],
 counters:['value'],
 sku_history:['id','product_id','old_sku','new_sku','changed_at'],
 olist_links:['product_id','remote_id','parent_id','sku','synced_at'],
 olist_plans:['id','epoch','plan','state','expires','result']
};
const numeric=new Set(['seq','quantity','cost','price','legacy','version','value','remote_id','parent_id','expires']);
const nullable=new Set(['model_id','seq','sku_key','price','parent_id','result']);
export async function exportCatalog(db,owner){
 const data={};let count=0;
 for(const [table,fields] of Object.entries(columns)){
  const rows=await db.prepare('SELECT '+fields.join(',')+' FROM '+table+' WHERE owner=? LIMIT 901').bind(owner).all();
  data[table]=rows.results;count+=rows.results.length;
 }
 if(count>900)throw new Error('O histórico é grande para a transferência automática. Solicite uma migração assistida.');
 return {format:'mtn-catalog-transfer',version:1,createdAt:new Date().toISOString(),data};
}
export function validateTransfer(input){
 if(input?.format!=='mtn-catalog-transfer'||input.version!==1||!input.data)throw new Error('Use um arquivo de transferência gerado pelo cadastro MTN.');
 let count=0;
 for(const [table,fields] of Object.entries(columns)){
  const records=input.data[table];if(!Array.isArray(records))throw new Error('Arquivo incompleto.');count+=records.length;
  for(const r of records)for(const f of fields){
   const v=r[f];if(v===null&&nullable.has(f))continue;
   if(numeric.has(f)){if(!Number.isSafeInteger(v)||v<0)throw new Error('Valor inválido no arquivo de transferência.');}
   else if(typeof v!=='string'||v.length>(f==='plan'?100000:1000))throw new Error('Campo inválido no arquivo de transferência.');
  }
 }
 if(count>900||!input.data.products.length||input.data.counters.length>1)throw new Error('Quantidade de registros inválida para esta transferência.');
 const ids=new Set(input.data.products.map(r=>r.id));
 if(ids.size!==input.data.products.length)throw new Error('Produtos repetidos no arquivo.');
 for(const l of input.data.olist_links)if(!ids.has(l.product_id))throw new Error('Vínculo Olist sem produto correspondente.');
 for(const p of input.data.olist_plans){let rows;try{rows=JSON.parse(p.plan).rows;}catch{}if(!Array.isArray(rows))throw new Error('Histórico inválido.');}
 return input;
}
export async function importCatalog(db,owner,input){
 validateTransfer(input);
 const existing=await db.prepare('SELECT id FROM products WHERE owner=? LIMIT 1').bind(owner).first();
 if(existing)throw new Error('Este cadastro já tem produtos. A transferência só pode ser feita para um cadastro vazio.');
 const statements=[db.prepare('INSERT INTO mutations(id,owner,created_at) VALUES(?,?,?)').bind(owner+':catalog-transfer',owner,new Date().toISOString())];
 for(const [table,fields] of Object.entries(columns))for(const row of input.data[table]){
  const all=['owner',...fields],values=[owner,...fields.map(f=>row[f])];
  statements.push(db.prepare('INSERT INTO '+table+' ('+all.join(',')+') VALUES ('+all.map(()=>'?').join(',')+')').bind(...values));
 }
 await db.batch(statements);
 return {ok:true,products:input.data.products.length,links:input.data.olist_links.length};
}
