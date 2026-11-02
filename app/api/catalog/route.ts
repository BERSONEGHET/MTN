import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../chatgpt-auth";
import {lookup,colors,sizes,genders,prefixFor,makeSku,MIN_PRODUCT_SEQUENCE,variationBase,variationSku,productName} from "../../../lib/catalog.mjs";
export const dynamic="force-dynamic";
const response=(data:any,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
const uuid=()=>crypto.randomUUID();
function short(v:any,max=160){return String(v??"").trim().slice(0,max);}
function money(v:any,nullable=false){if(nullable&&v===null)return null;if(!Number.isSafeInteger(v)||v<0||v>100000000)throw new Error("Valor monetário inválido.");return v;}
function manualCode(v:any){const sku=String(v??"").trim().toUpperCase();if(!/^[A-Z0-9][A-Z0-9._-]{2,59}$/.test(sku))throw new Error("Use de 3 a 60 letras, números, pontos, hífens ou sublinhados no SKU.");return sku;}
function qty(v:any){if(!Number.isInteger(v)||v<0||v>1000000)throw new Error("Quantidade inválida.");return v;}
const db=()=>env.DB as D1Database;
export async function GET(){
 const user=await getChatGPTUser();if(!user)return response({error:"Entre com sua conta ChatGPT.",signin:"/signin-with-chatgpt?return_to=%2F"},401);
 try{
 const [records,models,counter]=await Promise.all([
 db().prepare("SELECT id, model_id AS modelId, name, gender, seq, sku, color, size, supplier, supplier_ref AS supplierRef, quantity, cost, price, legacy, version, updated_at AS updatedAt FROM products WHERE owner=? ORDER BY created_at DESC, rowid DESC LIMIT 10001").bind(user.userId).all(),
 db().prepare("SELECT id,name,gender,prefix,seq FROM models WHERE owner=? ORDER BY seq DESC").bind(user.userId).all(),
 db().prepare("SELECT value FROM counters WHERE owner=?").bind(user.userId).first<{value:number}>()
 ]);
 return response({rows:records.results,models:models.results,nextSequence:Math.max(counter?.value??0,MIN_PRODUCT_SEQUENCE-1)+1,partial:records.results.length>10000});
 }catch{return response({error:"Não foi possível carregar os dados. Tente atualizar."},500);}
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return response({error:"Entre com sua conta ChatGPT."},401);
 if(request.headers.get("origin")!==new URL(request.url).origin)return response({error:"Origem inválida."},403);
 try{
 if(Number(request.headers.get("content-length")||0)>1000000)return response({error:"Arquivo muito grande."},413);
 const body=await request.json() as any;const owner=user.userId,now=new Date().toISOString();
 if(body.action==="import"){
 if(!/^[a-f0-9]{64}$/.test(body.sourceHash)||!Array.isArray(body.rows)||body.rows.length<1||body.rows.length>80)throw new Error("Lote de importação inválido.");
 const prepared=body.rows.map((r:any)=>{
 if(!Number.isInteger(r.sourceRow)||r.sourceRow<2)throw new Error("Linha inválida.");
 const sku=short(r.sku,60);if(!sku)throw new Error("SKU ausente.");
 const name=productName(r.name);if(!name)throw new Error("Produto ausente.");
 const match=sku.match(/^([^0-9]+)([0-9]{8})$/);
 const seq=match?Number(match[2].slice(0,4)):null;
 const gender=match&&/[FMU]$/.test(match[1])?match[1].slice(-1):"";
 return {r,sku,name,seq,gender};
 });
 const statements=prepared.map(({r,sku,name,seq,gender}:any)=>db().prepare("INSERT OR IGNORE INTO products (id,owner,name,gender,seq,sku,color,size,supplier,supplier_ref,quantity,cost,price,legacy,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,1,?,?)")
 .bind(owner+":"+body.sourceHash+":"+r.sourceRow,owner,name,gender,seq,sku,short(r.color,60),short(r.size,30),short(r.supplier),short(r.supplierRef),qty(r.quantity),money(r.cost),money(r.price,true),now,now));
 const maxSeq=Math.max(MIN_PRODUCT_SEQUENCE-1,...prepared.map((x:any)=>x.seq||0));
 statements.push(db().prepare("INSERT INTO counters(owner,value) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET value=MAX(value,excluded.value)").bind(owner,maxSeq));
 const results=await db().batch(statements);return response({ok:true,imported:results.slice(0,-1).reduce((n,r)=>n+(r.meta.changes||0),0)});
 }
 if(body.action==="delete"){
 const id=short(body.id,250);if(!id||!Number.isInteger(body.version)||body.version<1)throw new Error("Identificação do cadastro inválida.");
 const current=await db().prepare("SELECT version FROM products WHERE id=? AND owner=?").bind(id,owner).first<any>();
 if(!current)return response({error:"Cadastro não encontrado. Atualize a tabela."},404);
 if(current.version!==body.version)return response({error:"Este item foi alterado em outra janela. Atualize antes de excluir."},409);
 const result=await db().prepare("DELETE FROM products WHERE id=? AND owner=? AND version=?").bind(id,owner,body.version).run();
 if(!result.meta.changes)return response({error:"Este cadastro mudou em outra janela. Atualize antes de excluir."},409);
 return response({ok:true,deletedId:id});
 }
 if(body.action==="update"){
 const r=body.row;const quantity=qty(r.quantity),cost=money(r.cost),price=money(r.price,true);
 const current=await db().prepare("SELECT sku,sku_key,version FROM products WHERE id=? AND owner=?").bind(short(r.id,250),owner).first<any>();
 if(!current)return response({error:"Produto não encontrado."},404);
 if(current.version!==r.version)return response({error:"Este item foi alterado em outra janela. Atualize antes de salvar."},409);
 const changed=String(r.sku??"").trim()!==current.sku;
 const sku=changed?manualCode(r.sku):current.sku;
 if(changed && await db().prepare("SELECT id FROM products WHERE owner=? AND UPPER(sku)=UPPER(?) AND id<>? LIMIT 1").bind(owner,sku,r.id).first())throw new Error("Este SKU já está em uso por outro item.");
 const operations=[];
 if(changed)operations.push(db().prepare("INSERT INTO sku_history(id,owner,product_id,old_sku,new_sku,changed_at) SELECT ?,owner,id,sku,?,? FROM products WHERE id=? AND owner=? AND version=?").bind(uuid(),sku,now,r.id,owner,r.version));
 operations.push(db().prepare("UPDATE products SET sku=?,sku_key=?,supplier=?,supplier_ref=?,quantity=?,cost=?,price=?,version=version+1,updated_at=? WHERE id=? AND owner=? AND version=?")
 .bind(sku,changed?sku:current.sku_key,short(r.supplier),short(r.supplierRef),quantity,cost,price,now,r.id,owner,r.version));
 const results=await db().batch(operations);
 if(!results[results.length-1].meta.changes)return response({error:"Este item foi alterado em outra janela. Atualize antes de salvar."},409);
 return response({ok:true,sku});
 }
 if(body.action==="create"){
 if(!/^[a-f0-9-]{36}$/.test(body.requestId))throw new Error("Identificador de envio inválido.");
 const existingMutation=await db().prepare("SELECT id FROM mutations WHERE id=? AND owner=?").bind(owner+":"+body.requestId,owner).first();
 if(existingMutation)return response({ok:true,alreadySaved:true});
 const color=lookup(colors,body.color);if(!color)throw new Error("Selecione uma cor da tabela.");
 const requested=body.variants===undefined?[{size:body.size,quantity:body.quantity}]:body.variants;
 if(!Array.isArray(requested)||requested.length<1||requested.length>sizes.length)throw new Error("Selecione entre 1 e "+sizes.length+" tamanhos.");
 const used=new Set();
 const variants=requested.map((v:any)=>{const size=lookup(sizes,v?.size);if(!size)throw new Error("Selecione um tamanho da tabela.");if(used.has(size[0]))throw new Error("O mesmo tamanho foi selecionado mais de uma vez.");used.add(size[0]);return {size,quantity:qty(v.quantity)};});
 if(variants.length>1&&body.manualSku)throw new Error("Para editar o SKU manualmente, cadastre um tamanho por vez.");
 const cost=money(body.cost),price=money(body.price,true);
 let model:any=null;let newModel=false;let sourceSku="";
 if(body.sourceProductId){
 const source=await db().prepare("SELECT model_id,name,gender,sku FROM products WHERE id=? AND owner=?").bind(short(body.sourceProductId,200),owner).first<any>();
 if(!source)throw new Error("Produto de origem não encontrado.");
 const base=variationBase(source.sku);if(!base)throw new Error("Este SKU não permite identificar o início do modelo. Revise o código antes de adicionar uma variação.");
 sourceSku=source.sku;model={id:source.model_id,name:source.name,gender:source.gender,seq:base.seq};
 }
 else if(body.modelId){model=await db().prepare("SELECT * FROM models WHERE id=? AND owner=?").bind(short(body.modelId),owner).first();if(!model)throw new Error("Produto não encontrado.");}
 else {
 const name=productName(body.name);const g=lookup(genders,body.gender);if(!name||!g)throw new Error("Preencha produto e gênero.");
 const prefix=prefixFor(name);
 const next=await db().prepare("INSERT INTO counters(owner,value) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET value=MAX(value,?)+1 RETURNING value").bind(owner,MIN_PRODUCT_SEQUENCE,MIN_PRODUCT_SEQUENCE-1).first<{value:number}>();
 if(!next||next.value>9999)throw new Error("A sequência de quatro dígitos foi esgotada.");
 model={id:uuid(),name,gender:g[0],prefix,seq:next.value};newModel=true;
 }
 const prepared=variants.map(({size,quantity}:any)=>({size,quantity,sku:body.manualSku?manualCode(body.manualSku):(sourceSku?variationSku(sourceSku,size[0],color[0]):makeSku(model.prefix,model.gender,model.seq,size[0],color[0]))}));
 for(const {sku} of prepared){if(await db().prepare("SELECT id FROM products WHERE owner=? AND UPPER(sku)=UPPER(?) LIMIT 1").bind(owner,sku).first())throw new Error("O SKU "+sku+" já está cadastrado. Retire esse tamanho da seleção ou edite o item existente. Nenhuma variação deste envio foi salva.");}
 const operations=[];
 if(newModel)operations.push(db().prepare("INSERT INTO models(id,owner,name,gender,prefix,seq,created_at) VALUES(?,?,?,?,?,?,?)").bind(model.id,owner,model.name,model.gender,model.prefix,model.seq,now));
 for(const {sku,size,quantity} of prepared)operations.push(db().prepare("INSERT INTO products(id,owner,model_id,name,gender,seq,sku,sku_key,color,size,supplier,supplier_ref,quantity,cost,price,legacy,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,1,?,?)")
 .bind(uuid(),owner,model.id,model.name,model.gender,model.seq,sku,sku,color[1],size[1],short(body.supplier),short(body.supplierRef),quantity,cost,price,now,now));
 operations.push(db().prepare("INSERT INTO mutations(id,owner,created_at) VALUES(?,?,?)").bind(owner+":"+body.requestId,owner,now));
 await db().batch(operations);
 return response({ok:true,sku:prepared[0].sku,skus:prepared.map((v:any)=>v.sku),created:prepared.length,modelId:model.id});
 }
 return response({error:"Operação inválida."},400);
 }catch(e:any){
 const message=e?.message||"Não foi possível salvar.";
 return response({error:/UNIQUE constraint/.test(message)?"Este envio ou SKU já foi registrado. Atualize a tabela antes de tentar novamente.":message.slice(0,200)},400);
 }
}
