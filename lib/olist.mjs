// Dedicated seller OAuth application. Never uses ChatGPT connector credentials.
import {variationBase} from './catalog.mjs';
export const API='https://api.tiny.com.br/public-api/v3';
export const AUTH='https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/';
export class OlistError extends Error {constructor(message,status=400,reason='unknown'){super(message);this.status=status;this.reason=reason;}}
const fail=(message,status=400,definite=false)=>{const e=new OlistError(message,status);e.definite=definite;throw e};
export function networkReason(error){
 const codes=[error?.code,error?.cause?.code,error?.name,error?.cause?.name].join(' ');
 const message=String(error?.message||'')+' '+String(error?.cause?.message||'');
 if(/ENOTFOUND|EAI_AGAIN/.test(codes)||/DNS|resolve host|hostname.*resolv/i.test(message))return 'dns';
 if(/CERT|TLS|SSL/.test(codes)||/certificate|certificado|TLS handshake/i.test(message))return 'tls';
 if(/TimeoutError|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT/.test(codes))return 'timeout';
 if(/EACCES|EPERM/.test(codes)||/operation not permitted|permission denied/i.test(message))return 'blocked';
 if(/redirect/i.test(message))return 'redirect';
 return 'network';
}
const uuid=()=>crypto.randomUUID();
const same=(a,b)=>String(a??'').trim().toUpperCase()===String(b??'').trim().toUpperCase();
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const base64=a=>btoa(String.fromCharCode(...a));
async function key(secret){if(!secret||bytes(secret).length!==32)fail('Feche e abra o cadastro pelo atalho para preparar a conexão protegida.',503);return crypto.subtle.importKey('raw',bytes(secret),'AES-GCM',false,['encrypt','decrypt']);}
export async function seal(value,secret,owner){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(owner)},await key(secret),new TextEncoder().encode(JSON.stringify(value)));return base64(iv)+'.'+base64(new Uint8Array(data));}
export async function unseal(value,secret,owner){const [iv,data]=value.split('.');return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv),additionalData:new TextEncoder().encode(owner)},await key(secret),bytes(data))));}
export async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export function callbackUri(origin){const url=new URL(origin);if(url.protocol!=='https:'&&!['127.0.0.1','localhost','[::1]'].includes(url.hostname))fail('Use HTTPS para conectar o Olist.');return url.origin+'/api/olist/callback';}
export async function saveCredentials(db,secret,owner,body){
 const clientId=String(body.clientId||'').trim(),clientSecret=String(body.clientSecret||'').trim();
 if(!/^[\w.-]{3,200}$/.test(clientId)||clientSecret.length<8||clientSecret.length>1000)fail('Informe o Client ID e o Client Secret do aplicativo criado para este cadastro.');
 const old=await db.prepare('SELECT credentials FROM olist_connections WHERE owner=?').bind(owner).first();
 if(old){const previous=await unseal(old.credentials,secret,owner);if(previous.clientId!==clientId){const linked=await db.prepare('SELECT product_id FROM olist_links WHERE owner=? LIMIT 1').bind(owner).first();const pending=await db.prepare("SELECT id FROM olist_plans WHERE owner=? AND state IN ('sending','unknown') LIMIT 1").bind(owner).first();if(linked||pending)fail('Existem produtos vinculados a este aplicativo. Mantenha o mesmo Client ID para preservar os vínculos.');}}
 const credentials=await seal({clientId,clientSecret},secret,owner),epoch=uuid();
 await db.prepare('INSERT INTO olist_connections(owner,credentials,epoch) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET credentials=excluded.credentials,tokens=NULL,epoch=excluded.epoch').bind(owner,credentials,epoch).run();
 return {ok:true};
}
export async function withConnection(db,secret,owner,fn){
 const lock=uuid(),now=Date.now();
 const claimed=await db.prepare('UPDATE olist_connections SET lock_id=?,lock_until=? WHERE owner=? AND lock_until<? RETURNING *').bind(lock,now+90000,owner,now).first();
 if(!claimed){const exists=await db.prepare('SELECT owner FROM olist_connections WHERE owner=?').bind(owner).first();fail(exists?'Há uma operação em andamento. Aguarde e tente novamente.':'Configure o aplicativo Olist primeiro.',exists?409:400);}
 try{const c={db,secret,owner,record:claimed,credentials:await unseal(claimed.credentials,secret,owner),deadline:now+60000,calls:0};return await fn(c);}finally{await db.prepare('UPDATE olist_connections SET lock_id=NULL,lock_until=0 WHERE owner=? AND lock_id=?').bind(owner,lock).run();}
}
export async function oauthTokenFetch(credentials,fields){
 const body=new URLSearchParams({...fields,client_id:credentials.clientId,client_secret:credentials.clientSecret});
 let url=new URL(AUTH+'token');
 const trustedHosts=new Set(['accounts.tiny.com.br','accounts.olist.com']);
 for(let hop=0;hop<4;hop++){
  const res=await fetch(url.href,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(15000)});
  if(![301,302,303,307,308].includes(res.status))return res;
  const location=res.headers.get('location');
  if(!location)throw new OlistError('O Olist retornou um redirecionamento sem destino.',502,'redirect');
  const next=new URL(location,url);
  // OAuth token parameters must never be forwarded to arbitrary URLs.
  if(next.protocol!=='https:'||!trustedHosts.has(next.hostname)||next.port||next.username||next.password||next.search||next.hash||!/^\/realms\/tiny\/protocol\/openid-connect\/token\/?$/.test(next.pathname)||res.status===303)
   throw new OlistError('O redirecionamento não corresponde ao servidor de autorização permitido.',502,'redirect');
  await res.body?.cancel();
  url=next;
 }
 throw new OlistError('O Olist retornou redirecionamentos em excesso.',502,'redirect');
}
async function tokenRequest(credentials,fields){
 let res;try{res=await oauthTokenFetch(credentials,fields);}catch(e){if(e instanceof OlistError)throw e;throw new OlistError('Não foi possível acessar a autorização do Olist. Tente conectar novamente.',502,networkReason(e));}
 const data=await res.json().catch(()=>null);
 if(!res.ok||!data?.access_token||!data.refresh_token){const reasons={invalid_client:'credentials',unauthorized_client:'credentials',invalid_grant:'code',invalid_scope:'scope',access_denied:'denied'};throw new OlistError('O Olist recusou a autorização. Confira o aplicativo e conecte novamente.',401,reasons[data?.error]||'token');}
 return {accessToken:data.access_token,refreshToken:data.refresh_token,expires:Date.now()+Number(data.expires_in||14400)*1000};
}
async function storeTokens(c,tokens){await c.db.prepare('UPDATE olist_connections SET tokens=? WHERE owner=? AND epoch=?').bind(await seal(tokens,c.secret,c.owner),c.owner,c.record.epoch).run();c.tokens=tokens;}
async function access(c){
 if(!c.tokens){if(!c.record.tokens)fail('Clique em Autorizar no Olist para conectar.',401);c.tokens=await unseal(c.record.tokens,c.secret,c.owner);}
 if(c.tokens.expires<Date.now()+60000)await storeTokens(c,await tokenRequest(c.credentials,{grant_type:'refresh_token',refresh_token:c.tokens.refreshToken}));
 return c.tokens.accessToken;
}
export async function startOAuth(c,origin,browser){
 const state=uuid()+uuid(),redirect=callbackUri(origin);
 await c.db.prepare('DELETE FROM olist_oauth WHERE owner=? OR expires<?').bind(c.owner,Date.now()).run();
 await c.db.prepare('INSERT INTO olist_oauth(state,owner,browser,epoch,redirect_uri,expires) VALUES(?,?,?,?,?,?)').bind(await digest(state),c.owner,await digest(browser),c.record.epoch,redirect,Date.now()+600000).run();
 return {url:AUTH+'auth?'+new URLSearchParams({client_id:c.credentials.clientId,redirect_uri:redirect,scope:'openid',response_type:'code',state}).toString()};
}
export async function finishOAuth(c,url,browser){
 const state=url.searchParams.get('state')||'';
 const found=await c.db.prepare('DELETE FROM olist_oauth WHERE state=? AND owner=? AND browser=? AND epoch=? AND expires>? RETURNING *').bind(await digest(state),c.owner,await digest(browser),c.record.epoch,Date.now()).first();
 if(!found||found.redirect_uri!==callbackUri(url.origin))throw new OlistError('Autorização expirada ou inválida. Abra Integrações e conecte novamente.',400,'state');
 const code=url.searchParams.get('code');if(!code||url.searchParams.has('error'))throw new OlistError('A autorização não foi concluída no Olist.',400,'denied');
 await storeTokens(c,await tokenRequest(c.credentials,{grant_type:'authorization_code',code,redirect_uri:found.redirect_uri}));
}
export async function olistApiFetch(path,options){
 let url=new URL(API+path);
 const original=new URL(url),deadline=Date.now()+15000;
 const trustedHosts=new Set(['api.tiny.com.br','api.olist.com','api.erp.olist.com']);
 for(let hop=0;hop<4;hop++){
  const res=await fetch(url.href,{...options,redirect:'manual',signal:AbortSignal.timeout(Math.max(1,deadline-Date.now()))});
  if(![301,302,303,307,308].includes(res.status))return res;
  const location=res.headers.get('location');
  if(!location)throw new OlistError('A API do Olist retornou um redirecionamento sem destino.',502,'redirect');
  const next=new URL(location,url);
  if(next.protocol!=='https:'||!trustedHosts.has(next.hostname)||next.port||next.username||next.password||next.hash||next.pathname.replace(/\/$/,'')!==original.pathname.replace(/\/$/,'')||next.search!==original.search||(res.status===303&&options.method!=='GET'))
   throw new OlistError('A API do Olist redirecionou para um endereço não permitido. Nenhuma credencial foi enviada ao novo endereço.',502,'redirect');
  await res.body?.cancel();url=next;
 }
 throw new OlistError('A API do Olist retornou redirecionamentos em excesso.',502,'redirect');
}
async function call(c,path,method='GET',body){
 if(++c.calls>24||Date.now()>c.deadline)fail('A conferência excedeu o limite deste lote. Selecione menos produtos.',429);
 let token;try{token=await access(c);}catch(e){e.definite=true;throw e;}const delay=Math.max(0,c.record.next_request-Date.now());
 if(delay>10000)fail('O Olist pediu uma pausa. Aguarde um minuto antes de conferir novamente.',429);
 if(Date.now()+delay>=c.deadline)fail('A conferência demorou demais. Selecione menos itens.',429,true);
 if(delay)await new Promise(r=>setTimeout(r,delay));
 c.record.next_request=Date.now()+2100;
 await c.db.prepare('UPDATE olist_connections SET next_request=? WHERE owner=?').bind(c.record.next_request,c.owner).run();
 let res;try{res=await olistApiFetch(path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(Math.max(1,Math.min(15000,c.deadline-Date.now())))});}catch(e){if(method==='GET'){if(e instanceof OlistError)throw e;const reasons={dns:'Falha de DNS ao localizar a API do Olist.',tls:'Falha no certificado HTTPS da API do Olist.',timeout:'A API do Olist demorou demais para responder.',blocked:'A conexão com a API do Olist foi bloqueada.',redirect:'A API do Olist retornou um redirecionamento não permitido.'};fail((reasons[networkReason(e)]||'Falha de comunicação com a API do Olist.')+' Nenhum envio foi iniciado.',502);}fail('O Olist não confirmou o resultado. Confira o SKU no ERP antes de tentar outro envio.',502);}
 if(res.status===429){c.record.next_request=Date.now()+Math.max(60000,(Number(res.headers.get('retry-after'))||60)*1000);await c.db.prepare('UPDATE olist_connections SET next_request=? WHERE owner=?').bind(c.record.next_request,c.owner).run();fail('Limite de consultas do Olist atingido. Aguarde um minuto.',429,true);}
 if(res.status===401||res.status===403)fail('Acesso recusado. Autorize o aplicativo com Produtos: leitura e inclusão/edição.',res.status,true);
 if(!res.ok)fail('O Olist recusou a operação (HTTP '+res.status+'). Confira o cadastro e as permissões no ERP.',502,res.status<500);
 if(res.status===204)return {};
 const data=await res.json().catch(()=>null);if(!data)fail('O Olist retornou uma resposta inválida. Confira o resultado no ERP.',502);return data;
}
export async function exact(c,sku){
 const found=new Map();
 for(let offset=0;offset<1000;offset+=100){
  const data=await call(c,'/produtos?'+new URLSearchParams({codigo:sku,limit:'100',offset:String(offset)}));
  if(!Array.isArray(data.itens)||!Number.isInteger(data.paginacao?.total))fail('Não foi possível conferir todos os resultados do Olist.',502);
  for(const p of data.itens)if(same(p.sku,sku)){if(!Number.isSafeInteger(p.id)||p.id<1)fail('Identificador inválido no Olist.');found.set(p.id,p);}
  if(offset+data.itens.length>=data.paginacao.total){if(found.size>1)fail('Há mais de um produto no Olist com o SKU '+sku+'. Resolva a duplicidade no ERP.');return [...found.values()][0]||null;}
  if(data.itens.length<100)fail('O Olist retornou uma página incompleta. Envio bloqueado para evitar duplicação.');
 }
 fail('Muitos resultados para o SKU. Revise o código antes de enviar.');
}
function validateRow(r){if(!r||!r.sku||!r.name||!r.color||!r.size||!Number.isSafeInteger(r.price)||r.price<0||r.price>100000000)fail('Preencha nome, SKU, cor, tamanho e preço de venda antes de enviar.');}
const variant=r=>({sku:r.sku,precos:{preco:r.price/100},grade:[{chave:'Cor',valor:r.color},{chave:'Tamanho',valor:r.size}]});
const snapshot=p=>JSON.stringify({id:p.id,sku:p.sku,parent:p.produtoPai?.id||null,price:p.precos?.preco??null,promotion:p.precos?.precoPromocional??null,situacao:p.situacao});
async function row(c,id){return c.db.prepare('SELECT * FROM products WHERE owner=? AND id=?').bind(c.owner,id).first();}
async function duplicateLocal(c,r){const d=await c.db.prepare('SELECT COUNT(*) AS n FROM products WHERE owner=? AND UPPER(TRIM(sku))=?').bind(c.owner,r.sku.trim().toUpperCase()).first();if(d.n!==1)fail('SKU repetido no cadastro local: '+r.sku+'. Corrija antes de enviar.');}
async function findRemote(c,r){
 const link=await c.db.prepare('SELECT * FROM olist_links WHERE owner=? AND product_id=?').bind(c.owner,r.id).first();
 if(link&&!same(link.sku,r.sku))fail('O SKU vinculado mudou. Revise o vínculo no ERP antes de continuar.');
 const found=await exact(c,r.sku);if(link&&(!found||found.id!==link.remote_id))fail('O vínculo com o Olist mudou. Nenhum produto será recriado automaticamente.');
 if(!found)return null;
 const detail=await call(c,'/produtos/'+found.id);
 if(!same(detail.sku,r.sku)||detail.situacao!=='A'||detail.tipoVariacao==='P')fail('O SKU corresponde a um produto pai, inativo ou inconsistente no ERP. Revise o vínculo.');
 return detail;
}
export async function review(c,ids){
 if(!Array.isArray(ids)||ids.length<1||ids.length>5||new Set(ids).size!==ids.length)fail('Selecione de 1 a 5 itens por conferência.');
 const plans=[],newGroups=new Map();
 for(const id of ids){
  const r=await row(c,id);validateRow(r);await duplicateLocal(c,r);
  const uncertain=await c.db.prepare("SELECT p.id FROM olist_plans p, json_each(p.plan, '$.rows') r WHERE p.owner=? AND p.state IN ('sending','unknown') AND json_extract(r.value,'$.id')=? LIMIT 1").bind(c.owner,String(id)).first();
  if(uncertain)fail('Há um envio sem confirmação para este item. Confira o resultado no Olist usando o botão Reconciliar.');
  const remote=await findRemote(c,r);
  if(remote){plans.push({kind:'price',rows:[r],remote:{id:remote.id,parentId:remote.produtoPai?.id||null,snapshot:snapshot(remote)},previous:remote.precos?.preco??null,payload:{preco:r.price/100,precoPromocional:remote.precos?.precoPromocional??null}});continue;}
  const base=variationBase(r.sku)?.initial;
  if(!base){plans.push({kind:'simple',rows:[r],payload:{sku:r.sku,descricao:r.name+' / '+r.color+' / '+r.size,tipo:'S',unidade:'UN',precos:{preco:r.price/100,precoCusto:r.cost/100}}});continue;}
  const group=newGroups.get(base)||[];group.push(r);newGroups.set(base,group);
 }
 for(const [base,rows] of newGroups){
  if(new Set(rows.map(r=>r.name)).size!==1)fail('O mesmo início de SKU possui nomes diferentes. Revise o modelo.');
  const parent=await exact(c,base);
  if(parent){const detail=await call(c,'/produtos/'+parent.id);if(detail.tipoVariacao!=='P'||detail.situacao!=='A'||detail.descricao!==rows[0].name)fail('O código do modelo já existe no ERP com outro nome ou tipo. Revise antes de adicionar tamanhos.');
   for(const r of rows)plans.push({kind:'variation',rows:[r],parentId:parent.id,parentSku:base,payload:variant(r)});
  }else plans.push({kind:'group',rows,parentSku:base,payload:{sku:base,descricao:rows[0].name,tipo:'V',unidade:'UN',grade:['Cor','Tamanho'],variacoes:rows.map(variant)}});
 }
 const result=[];
 for(const plan of plans){const id=uuid();await c.db.prepare('INSERT INTO olist_plans(id,owner,epoch,plan,expires) VALUES(?,?,?,?,?)').bind(id,c.owner,c.record.epoch,JSON.stringify(plan),Date.now()+600000).run();result.push({id,kind:plan.kind,parentSku:plan.parentSku,previous:plan.previous,rows:plan.rows.map(r=>({id:r.id,name:r.name,sku:r.sku,color:r.color,size:r.size,price:r.price}))});}
 return {plans:result};
}
async function saveLinks(c,plan,remote){
 const links=[];
 if(plan.kind==='group'&&(!Number.isSafeInteger(remote.id)||remote.id<1))fail('Modelo sem identificador confirmado. Confira no ERP.',502);
 for(const r of plan.rows){const match=plan.kind==='group'?remote.variacoes?.find(v=>same(v.sku??v.codigo,r.sku)):remote;const id=match?.id;if(!Number.isSafeInteger(id)||id<1)fail('Envio sem identificador confirmado. Confira o SKU no ERP antes de repetir.',502);
  links.push(c.db.prepare('INSERT INTO olist_links(owner,product_id,remote_id,parent_id,sku,synced_at) VALUES(?,?,?,?,?,?) ON CONFLICT(owner,product_id) DO UPDATE SET remote_id=excluded.remote_id,parent_id=excluded.parent_id,sku=excluded.sku,synced_at=excluded.synced_at').bind(c.owner,r.id,id,plan.kind==='group'?remote.id:plan.parentId||plan.remote?.parentId||null,r.sku,new Date().toISOString()));}
 await c.db.batch(links);
}
export async function sendPlan(c,id){
 const stored=await c.db.prepare('SELECT * FROM olist_plans WHERE owner=? AND id=?').bind(c.owner,id).first();
 if(!stored)fail('Conferência não encontrada.');if(stored.state==='done')return {ok:true,alreadySent:true};
 if(stored.epoch!==c.record.epoch||stored.expires<Date.now()||stored.state!=='ready')fail('Faça uma nova conferência. Envios sem confirmação precisam ser reconciliados.');
 const p=JSON.parse(stored.plan);
 for(const r of p.rows){
  const pending=await c.db.prepare("SELECT p.id FROM olist_plans p, json_each(p.plan, '$.rows') r WHERE p.owner=? AND p.id<>? AND p.state IN ('sending','unknown') AND json_extract(r.value,'$.id')=? LIMIT 1").bind(c.owner,id,r.id).first();
  if(pending)fail('Outro envio deste item não foi confirmado. Reconcilie o resultado no ERP antes de continuar.');
  const current=await row(c,r.id);if(!current||current.version!==r.version||current.updated_at!==r.updated_at)fail('O cadastro mudou depois da conferência. Confira novamente.');await duplicateLocal(c,current);
 }
 if(p.kind==='price'){const remote=await findRemote(c,p.rows[0]);if(!remote||snapshot(remote)!==p.remote.snapshot)fail('O produto no Olist mudou depois da conferência. Confira novamente.');}
 else {for(const r of p.rows)if(await exact(c,r.sku))fail('Este SKU já existe no Olist. Faça uma nova conferência para vinculá-lo.');
  if(p.kind==='group'&&await exact(c,p.parentSku))fail('O modelo foi criado no Olist. Confira novamente para adicionar as variações.');
  if(p.kind==='variation'){const parent=await call(c,'/produtos/'+p.parentId);if(!same(parent.sku,p.parentSku)||parent.tipoVariacao!=='P'||parent.descricao!==p.rows[0].name||parent.situacao!=='A')fail('O modelo no Olist mudou. Confira novamente.');}}
 await c.db.prepare("UPDATE olist_plans SET state='sending' WHERE owner=? AND id=? AND state='ready'").bind(c.owner,id).run();
 try{
  let remote;
  if(p.kind==='price'){const path=p.remote.parentId?'/produtos/'+p.remote.parentId+'/variacoes/'+p.remote.id+'/preco':'/produtos/'+p.remote.id+'/preco';await call(c,path,'PUT',p.payload);remote={id:p.remote.id};}
  else remote=await call(c,p.kind==='variation'?'/produtos/'+p.parentId+'/variacoes':'/produtos','POST',p.payload);
  await saveLinks(c,p,remote);
  await c.db.prepare("UPDATE olist_plans SET state='done',result='Confirmado pelo Olist' WHERE owner=? AND id=?").bind(c.owner,id).run();return {ok:true};
 }catch(e){
  await c.db.prepare("UPDATE olist_plans SET state=?,result='Confira o resultado no ERP antes de repetir' WHERE owner=? AND id=?").bind(e.definite?'failed':'unknown',c.owner,id).run();
  if(!e.definite){try{await reconcile(c,id);return {ok:true,reconciled:true};}catch{/* Keep the unknown state; never repeat the write. */}}
  throw e;
 }
}
export async function reconcile(c,id){
 const stored=await c.db.prepare("SELECT * FROM olist_plans WHERE owner=? AND id=? AND state IN ('unknown','sending')").bind(c.owner,id).first();if(!stored)fail('Envio pendente não encontrado.');
 const p=JSON.parse(stored.plan),matches=[],parents=new Map();
 for(const r of p.rows){const match=await exact(c,r.sku);if(!match)fail('O SKU '+r.sku+' ainda não foi localizado. Confira manualmente no ERP; o reenvio continua bloqueado.');let detail=await call(c,'/produtos/'+match.id);
 if(['group','variation'].includes(p.kind)){
  let parentId=p.kind==='variation'?p.parentId:detail.produtoPai?.id;
  if(!parentId){const foundParent=await exact(c,p.parentSku);parentId=foundParent?.id;}
  if(!Number.isSafeInteger(parentId))fail('Não foi possível localizar o modelo da variação no ERP.');
  if(!parents.has(parentId))parents.set(parentId,await call(c,'/produtos/'+parentId));
  const parent=parents.get(parentId);
  if(parent.id!==parentId||!same(parent.sku,p.parentSku)||parent.tipoVariacao!=='P'||parent.situacao!=='A')fail('O modelo da variação no ERP não corresponde ao envio.');
  const children=(parent.variacoes||[]).filter(v=>v.id===match.id&&same(v.sku,r.sku));
  if(children.length!==1)fail('A variação não foi localizada de forma única no modelo esperado.');
  const child=children[0];
  detail={...detail,grade:child.grade,precos:child.precos||detail.precos,produtoPai:{id:parentId,sku:parent.sku}};
 }
 if(detail.id!==match.id||!same(detail.sku,r.sku)||detail.situacao!=='A')fail('O produto localizado no ERP não corresponde ao envio. Confira o vínculo.');
 if(p.kind==='price'&&(detail.id!==p.remote.id||(detail.produtoPai?.id||null)!==p.remote.parentId||(detail.precos?.precoPromocional??null)!==p.payload.precoPromocional))fail('O vínculo ou a promoção no ERP mudou. Confira antes de confirmar.');
 if(p.kind==='variation'&&detail.produtoPai?.id!==p.parentId)fail('A variação foi localizada em outro modelo no ERP.');
 if(['group','variation'].includes(p.kind)&&(!detail.grade?.some(g=>same(g.chave,'Cor')&&same(g.valor,r.color))||!detail.grade?.some(g=>same(g.chave,'Tamanho')&&same(g.valor,r.size))))fail('A cor ou o tamanho no ERP não corresponde ao envio.');
 if(p.kind==='simple'&&detail.descricao!==r.name+' / '+r.color+' / '+r.size)fail('A descrição no ERP não corresponde ao cadastro enviado.');
 if(Math.round((detail.precos?.preco??-1)*100)!==r.price)fail('O preço no ERP não corresponde ao envio. Confira manualmente antes de continuar.');matches.push(detail);}
 const remote=p.kind==='group'?{id:matches[0].produtoPai?.id,variacoes:matches}:matches[0];
 if(p.kind==='group'&&(!Number.isSafeInteger(remote.id)||matches.some(m=>m.produtoPai?.id!==remote.id||!same(m.produtoPai?.sku,p.parentSku))))fail('Não foi possível confirmar o modelo das variações no ERP.');
 await saveLinks(c,p,remote);await c.db.prepare("UPDATE olist_plans SET state='done',result='Conferido pelo SKU no ERP' WHERE owner=? AND id=?").bind(c.owner,id).run();return {ok:true};
}

export async function resumeReview(c,id){
 const old=await c.db.prepare("SELECT plan FROM olist_plans WHERE owner=? AND id=? AND state IN ('ready','failed')").bind(c.owner,id).first();
 if(!old)fail('Esta conferência não está mais pendente. Atualize a página.');
 const ids=JSON.parse(old.plan).rows.map(r=>r.id);
 const result=await review(c,ids);
 await c.db.prepare("UPDATE olist_plans SET state='superseded' WHERE owner=? AND id=? AND state IN ('ready','failed')").bind(c.owner,id).run();
 return result;
}

// Refresh a single reviewed item immediately before its explicit queued send.
// This also resolves a model created by an earlier item in the same queue.
export async function sendQueuedItem(c,id){
 const source=await c.db.prepare('SELECT * FROM olist_plans WHERE owner=? AND id=?').bind(c.owner,id).first();
 if(!source)fail('Revisão não encontrada.');
 if(source.state==='done'||(source.state==='superseded'&&source.result==='Enviado pela fila'))return {ok:true,alreadySent:true};
 if(source.state!=='ready'||source.epoch!==c.record.epoch)fail('Este item precisa de nova revisão ou reconciliação antes do envio.');
 const approved=JSON.parse(source.plan);
 if(approved.rows.length!==1)fail('Revise os itens pela seleção em lote antes de enviar pela fila.');
 const original=approved.rows[0],current=await row(c,original.id);
 if(!current||current.version!==original.version||current.updated_at!==original.updated_at)fail('O cadastro mudou depois da revisão. Revise novamente: '+original.sku);
 const refreshed=await review(c,[original.id]);
 const freshRecord=await c.db.prepare('SELECT plan FROM olist_plans WHERE owner=? AND id=?').bind(c.owner,refreshed.plans[0].id).first();
 const fresh=JSON.parse(freshRecord.plan);
 let compatible=fresh.kind===approved.kind;
 if(compatible&&approved.kind==='price')compatible=fresh.remote.snapshot===approved.remote.snapshot;
 if(compatible&&approved.kind==='variation')compatible=fresh.parentId===approved.parentId;
 if(compatible&&approved.kind==='group')compatible=fresh.parentSku===approved.parentSku;
 if(approved.kind==='group'&&fresh.kind==='variation'&&fresh.parentSku===approved.parentSku){
  const created=await c.db.prepare("SELECT p.id FROM olist_plans p WHERE p.owner=? AND p.state='done' AND json_extract(p.plan,'$.kind')='group' AND json_extract(p.plan,'$.parentSku')=? AND EXISTS (SELECT 1 FROM olist_links l WHERE l.owner=p.owner AND l.parent_id=?) LIMIT 1").bind(c.owner,approved.parentSku,fresh.parentId).first();
  compatible=!!created;
 }
 if(!compatible){await c.db.prepare("UPDATE olist_plans SET state='superseded' WHERE owner=? AND id=?").bind(c.owner,refreshed.plans[0].id).run();fail('A operação no Olist mudou depois da revisão. Revise novamente: '+original.sku);}
 await sendPlan(c,refreshed.plans[0].id);
 await c.db.prepare("UPDATE olist_plans SET state='superseded',result='Enviado pela fila' WHERE owner=? AND id=?").bind(c.owner,id).run();
 return {ok:true};
}
