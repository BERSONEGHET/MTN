import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { colors, sizes, genders, lookup, prefixFor, makeSku, cents, suggested, inspectRows } from "../lib/catalog.mjs";
const require=createRequire(import.meta.url);
const {build}=require("esbuild");
mkdirSync("outputs",{recursive:true});
await build({entryPoints:["app/api/catalog/route.ts"],outfile:"outputs/api-test.mjs",bundle:true,platform:"node",format:"esm",target:"node24",plugins:[{name:"test-bindings",setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:"env",namespace:"fixture"}));
 b.onResolve({filter:/chatgpt-auth$/},()=>({path:"auth",namespace:"fixture"}));
 b.onLoad({filter:/.*/,namespace:"fixture"},args=>({contents:args.path==="env"?'export const env={get DB(){return globalThis.testDB}};':'export async function getChatGPTUser(){return globalThis.testUser};',loader:"js"}));
}}]});
const api=await import("../outputs/api-test.mjs");
class Statement {
 constructor(db,sql,args=[]){this.db=db;this.sql=sql;this.args=args;}
 bind(...args){return new Statement(this.db,this.sql,args);}
 async first(){return this.db.prepare(this.sql).get(...this.args)||null;}
 async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}
 async run(){const r=this.db.prepare(this.sql).run(...this.args);return {success:true,meta:{changes:Number(r.changes)}};}
}
function database(){
 const native=new DatabaseSync(":memory:");
 for(const file of readdirSync("drizzle").filter(x=>x.endsWith(".sql")).sort())native.exec(readFileSync("drizzle/"+file,"utf8"));
 return {native,prepare(sql){return new Statement(native,sql);},async batch(statements){native.exec("BEGIN");try{const results=[];for(const st of statements)results.push(await st.run());native.exec("COMMIT");return results;}catch(e){native.exec("ROLLBACK");throw e;}}};
}
function context(owner="bernardo"){const db=database();globalThis.testDB=db;globalThis.testUser={userId:owner,email:owner+"@example.test"};return db;}
async function send(body,origin="https://catalog.test"){const r=await api.POST(new Request("https://catalog.test/api/catalog",{method:"POST",headers:{"Content-Type":"application/json","Origin":origin},body:JSON.stringify(body)}));return {status:r.status,data:await r.json()};}
const sourceHash="a".repeat(64);
const legacy=(sourceRow,sku="BLUDRF03391409",size="14")=>({sourceRow,sku,name:"BLUSA DECOTE RENDA",color:"Off",size,quantity:1,cost:6590,price:14990,supplier:"Fornecedor",supplierRef:"N"});
const fresh=(extra={})=>({action:"create",requestId:crypto.randomUUID(),name:"Saia longa drapeada",gender:"Feminino",color:"Preto",size:"18",quantity:1,cost:6590,price:16475,...extra});
async function data(){const r=await api.GET();return r.json();}
test("regras: todos os tamanhos confirmados e gêneros F/M/U",()=>{
 assert.equal(sizes.length,25);for(const x of ["12","14","16","18","20","34","36","38","40","42","44","46","48","50","52","54","56"])assert.deepEqual(lookup(sizes,x),[x,x]);
 assert.equal(lookup(genders,"unissex")[0],"U");assert.equal(lookup(sizes,"G1")[0],"06");assert.equal(lookup(sizes,"XG")[0],"06");assert.equal(lookup(sizes,"único")[0],"07");
 assert.equal(lookup(colors,"azul claro estonado")[0],"18");
 assert.equal(makeSku(prefixFor("Saia longa drapeada"),"F",345,"18","01"),"SAIF03451801");
 assert.equal(makeSku("CAM","U",345,"03","01"),"CAMU03450301");
});
test("valores monetários em centavos e sugestão 2,5x",()=>{
 assert.equal(cents("R$ 1.234,56"),123456);assert.equal(cents(65.9),6590);assert.equal(suggested(6590),16475);assert.equal(cents(""),null);
 for(const value of ["-1","abc",Infinity])assert.throws(()=>cents(value));
});
test("importação preserva SKU duplicado antigo e reinício não duplica linhas",async()=>{
 context();const rows=[legacy(2),legacy(3,"BLUDRF03391409","16"),legacy(4,"BLURT03440720","Único")];
 let r=await send({action:"import",sourceHash,rows});assert.equal(r.status,200);assert.equal(r.data.imported,3);
 r=await send({action:"import",sourceHash,rows});assert.equal(r.data.imported,0);
 const d=await data();assert.equal(d.rows.length,3);assert.equal(d.rows.filter(r=>r.sku==="BLUDRF03391409").length,2);assert.equal(d.nextSequence,380);
});
test("novo produto começa depois da sequência importada; variações mantêm a sequência",async()=>{
 context();await send({action:"import",sourceHash,rows:[legacy(2,"BLURT03440720","Único")]});
 const a=await send(fresh());assert.equal(a.status,200);assert.equal(a.data.sku,"SAIF03801801");
 const b=await send(fresh({modelId:a.data.modelId,size:"20"}));assert.equal(b.data.sku,"SAIF03802001");
 const c=await send(fresh({modelId:a.data.modelId,size:"20"}));assert.equal(c.status,400);assert.match(c.data.error,/já está cadastrad[ao]/);
 assert.equal((await data()).nextSequence,381);
});
test("SKU manual em novo produto e atualização de preço não o sobrescrevem",async()=>{
 const db=context();const a=await send(fresh({manualSku:"MEU-SKU-001"}));assert.equal(a.status,200);assert.equal(a.data.sku,"MEU-SKU-001");
 const row=(await data()).rows[0];let r=await send({action:"update",row:{...row,cost:7000,price:17000}});assert.equal(r.status,200);assert.equal((await data()).rows[0].sku,"MEU-SKU-001");
 assert.equal(db.native.prepare("SELECT COUNT(*) AS n FROM sku_history").get().n,0);
});
test("SKU antigo só muda por edição explícita e deixa histórico",async()=>{
 const db=context();await send({action:"import",sourceHash,rows:[legacy(2)]});
 let row=(await data()).rows[0];
 let r=await send({action:"update",row:{...row,price:18000}});assert.equal(r.status,200);assert.equal((await data()).rows[0].sku,row.sku);
 row=(await data()).rows[0];r=await send({action:"update",row:{...row,sku:"MANUAL-099"}});assert.equal(r.status,200);
 assert.equal((await data()).rows[0].sku,"MANUAL-099");
 const audit=db.native.prepare("SELECT * FROM sku_history").get();assert.equal(audit.old_sku,"BLUDRF03391409");assert.equal(audit.new_sku,"MANUAL-099");
});
test("permite manter duplicidade antiga; bloqueia novo SKU que já existe",async()=>{
 context();await send({action:"import",sourceHash,rows:[legacy(2),legacy(3,"BLUDRF03391409","16"),legacy(4,"OUTRO-CODIGO","18")]});
 const d=await data();const row=d.rows.find(r=>r.size==="16");assert.equal((await send({action:"update",row:{...row,cost:6000}})).status,200);
 const other=d.rows.find(r=>r.sku==="OUTRO-CODIGO");const r=await send({action:"update",row:{...other,sku:"bludrf03391409"}});assert.equal(r.status,400);assert.match(r.data.error,/já está em uso/);
 assert.equal((await send(fresh({manualSku:"BLUDRF03391409"}))).status,400);
});
test("versão impede sobrescrever edição de outra janela",async()=>{
 context();await send(fresh());const row=(await data()).rows[0];
 assert.equal((await send({action:"update",row:{...row,price:18000}})).status,200);
 assert.equal((await send({action:"update",row:{...row,price:19000}})).status,409);
 assert.equal((await data()).rows[0].price,18000);
});
test("envio repetido de novo produto é idempotente",async()=>{
 context();const body=fresh();assert.equal((await send(body)).status,200);assert.equal((await send(body)).data.alreadySaved,true);assert.equal((await data()).rows.length,1);
});
test("isolamento por usuário, origem e autenticação",async()=>{
 context("one");await send(fresh());globalThis.testUser={userId:"two",email:"two@example.test"};assert.equal((await data()).rows.length,0);
 assert.equal((await send(fresh(),"https://evil.test")).status,403);
 globalThis.testUser=null;assert.equal((await api.GET()).status,401);assert.equal((await send(fresh())).status,401);
});
test("lote inválido não importa parcialmente",async()=>{
 context();const r=await send({action:"import",sourceHash,rows:[legacy(2),{...legacy(3),quantity:-1}]});assert.equal(r.status,400);assert.equal((await data()).rows.length,0);
});
test("auditoria sinaliza divergências sem alterar os códigos",()=>{
 const original=[{sku:"BLUDRF03391409",color:"Off",size:"14",price:14990},{sku:"BLUDRF03391409",color:"Off",size:"16",price:14990}];
 const result=inspectRows(original);assert.equal(result[0].sku,original[0].sku);assert.ok(result[1].issues.includes("Tamanho diverge do SKU"));assert.ok(result[1].issues.includes("SKU repetido"));
});

test("sequência inicia em 0380 sem alterar códigos anteriores e respeita contador maior",async()=>{
 const db=context();assert.equal((await data()).nextSequence,380);
 db.native.prepare("INSERT INTO counters(owner,value) VALUES(?,?)").run("bernardo",379);
 const first=await send(fresh());assert.equal(first.data.sku,"SAIF03801801");
 assert.equal((await data()).nextSequence,381);
 db.native.prepare("UPDATE counters SET value=512 WHERE owner=?").run("bernardo");
 const later=await send(fresh());assert.equal(later.data.sku,"SAIF05131801");
 assert.ok((await data()).rows.some(r=>r.sku==="SAIF03801801"));
});

test("botão de variação mantém início, nome e gênero do modelo sem consumir sequencial",async()=>{
 context();const original=await send(fresh());const before=await data();const row=before.rows[0];
 const size=await send(fresh({sourceProductId:row.id,size:"20",name:"Nome alterado",gender:"Masculino"}));
 assert.equal(size.status,200);assert.equal(size.data.sku,"SAIF03802001");
 const color=await send(fresh({sourceProductId:row.id,color:"Branco"}));assert.equal(color.data.sku,"SAIF03801802");
 const after=await data();assert.equal(after.nextSequence,before.nextSequence);assert.equal(after.models.length,1);
 assert.ok(after.rows.every(r=>r.modelId===original.data.modelId&&r.name===row.name&&r.gender===row.gender));
 const duplicate=await send(fresh({sourceProductId:row.id,size:"20"}));assert.equal(duplicate.status,400);
});
test("variação de SKU importado preserva abreviação longa e produto antigo",async()=>{
 context();await send({action:"import",sourceHash,rows:[legacy(2)]});const row=(await data()).rows[0];
 const result=await send(fresh({sourceProductId:row.id,size:"18",color:"Preto"}));
 assert.equal(result.status,200);assert.equal(result.data.sku,"BLUDRF03391801");
 const after=await data();assert.equal(after.nextSequence,380);assert.equal(after.models.length,0);
 assert.equal(after.rows.find(r=>r.id===row.id).sku,"BLUDRF03391409");
 const again=await send(fresh({sourceProductId:after.rows.find(r=>r.sku===result.data.sku).id,size:"20"}));
 assert.equal(again.data.sku,"BLUDRF03392001");
});
test("variação respeita o SKU editado manualmente e rejeita origem inacessível ou ambígua",async()=>{
 const db=context();await send(fresh({manualSku:"CAMU04001801"}));let row=(await data()).rows[0];
 let r=await send(fresh({sourceProductId:row.id,size:"20"}));assert.equal(r.data.sku,"CAMU04002001");
 globalThis.testUser={userId:"outra-conta"};r=await send(fresh({sourceProductId:row.id}));assert.equal(r.status,400);assert.match(r.data.error,/origem não encontrado/);
 globalThis.testUser={userId:"bernardo"};
 await send({action:"update",row:{...row,sku:"MEU-CODIGO"}});
 r=await send(fresh({sourceProductId:row.id}));assert.equal(r.status,400);assert.match(r.data.error,/identificar/);
 assert.equal((await data()).nextSequence,381);
});

test("vários tamanhos criam um modelo, quantidades próprias e apenas um sequencial",async()=>{
 context();const request=fresh({size:undefined,quantity:undefined,variants:[{size:"P",quantity:2},{size:"M",quantity:3},{size:"G",quantity:0},{size:"18",quantity:5}]});
 const result=await send(request);assert.equal(result.status,200);assert.equal(result.data.created,4);
 assert.deepEqual(result.data.skus,["SAIF03800201","SAIF03800301","SAIF03800401","SAIF03801801"]);
 const saved=await data();assert.equal(saved.models.length,1);assert.equal(saved.nextSequence,381);assert.equal(saved.rows.length,4);
 for(const [size,quantity] of [["P",2],["M",3],["G",0],["18",5]]){const row=saved.rows.find(r=>r.size===size);assert.equal(row.quantity,quantity);assert.equal(row.cost,6590);assert.equal(row.price,16475);assert.equal(row.modelId,result.data.modelId);}
 assert.equal((await send(request)).data.alreadySaved,true);assert.equal((await data()).rows.length,4);
});
test("lote de variações importadas mantém início e não salva parcialmente se uma já existe",async()=>{
 context();await send({action:"import",sourceHash,rows:[legacy(2)]});const original=(await data()).rows[0];
 const duplicate=await send(fresh({sourceProductId:original.id,color:"Off",variants:[{size:"18",quantity:3},{size:"14",quantity:4}]}));
 assert.equal(duplicate.status,400);assert.equal((await data()).rows.length,1);
 const success=await send(fresh({sourceProductId:original.id,color:"Off",variants:[{size:"18",quantity:3},{size:"20",quantity:4}]}));
 assert.equal(success.status,200);assert.deepEqual(success.data.skus,["BLUDRF03391809","BLUDRF03392009"]);assert.equal((await data()).nextSequence,380);
});
test("lote inválido é rejeitado antes de reservar um novo sequencial",async()=>{
 context();
 for(const variants of [[],[{size:"P",quantity:1},{size:"02",quantity:2}],[{size:"12",quantity:-1}],[{size:"16",quantity:1.5}],[{size:"999",quantity:1}],Array.from({length:sizes.length+1},()=>({size:"P",quantity:1}))]){
  const result=await send(fresh({variants}));assert.equal(result.status,400);assert.equal((await data()).rows.length,0);assert.equal((await data()).nextSequence,380);
 }
 const manual=await send(fresh({manualSku:"MANUAL",variants:[{size:"P",quantity:1},{size:"M",quantity:1}]}));assert.equal(manual.status,400);assert.equal((await data()).nextSequence,380);
});
test("falha durante gravação reverte todas as variações e o modelo do lote",async()=>{
 const db=context();db.native.exec("CREATE TRIGGER reject_medium BEFORE INSERT ON products WHEN NEW.size='M' BEGIN SELECT RAISE(ABORT, 'falha simulada'); END;");
 const result=await send(fresh({variants:[{size:"P",quantity:1},{size:"M",quantity:1}]}));assert.equal(result.status,400);
 const saved=await data();assert.equal(saved.rows.length,0);assert.equal(saved.models.length,0);assert.equal(db.native.prepare("SELECT COUNT(*) AS n FROM mutations").get().n,0);
});
