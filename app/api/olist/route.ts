import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {OlistError,callbackUri,saveCredentials,withConnection,startOAuth,review,resumeReview,sendQueuedItem,sendPlan,reconcile} from '../../../lib/olist.mjs';
export const dynamic='force-dynamic';
const response=(data:any,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store',...headers}});
const db=()=>env.DB as D1Database;
const secret=()=>String((env as any).OLIST_ENCRYPTION_KEY||'');
export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user)return response({error:'Entre com sua conta.'},401);
 try{
  const record=await db().prepare('SELECT tokens FROM olist_connections WHERE owner=?').bind(user.userId).first();
  const links=await db().prepare('SELECT product_id AS productId,remote_id AS remoteId,synced_at AS syncedAt FROM olist_links WHERE owner=?').bind(user.userId).all();
  const history=await db().prepare('SELECT id,state,result,plan FROM olist_plans WHERE owner=? AND state<>\'superseded\' ORDER BY rowid DESC LIMIT 1000').bind(user.userId).all();
  return response({configured:!!record,connected:!!record?.tokens,protected:!!secret(),callback:callbackUri(new URL(request.url).origin),links:links.results,history:history.results.map((h:any)=>({id:h.id,state:h.state,result:h.result,productIds:JSON.parse(h.plan).rows.map((r:any)=>r.id),skus:JSON.parse(h.plan).rows.map((r:any)=>r.sku)}))});
 }catch{return response({error:'Não foi possível carregar a integração. Feche e abra o cadastro pelo atalho para atualizar o banco.'},503);}
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return response({error:'Entre com sua conta.'},401);
 if(request.headers.get('origin')!==new URL(request.url).origin)return response({error:'Origem inválida.'},403);
 try{
  const raw=await request.text();if(raw.length>12000)return response({error:'Solicitação muito grande.'},413);
  const body=JSON.parse(raw),owner=user.userId;
  if(body.action==='configure'){
   const existing=await db().prepare('SELECT owner FROM olist_connections WHERE owner=?').bind(owner).first();
   const save=()=>saveCredentials(db(),secret(),owner,body);
   return response(existing?await withConnection(db(),secret(),owner,save):await save());
  }
  const browser=crypto.randomUUID();
  const result=await withConnection(db(),secret(),owner,async(c:any)=>{
   if(body.action==='connect')return startOAuth(c,new URL(request.url).origin,browser);
   if(body.action==='review')return review(c,body.ids);
   if(body.action==='resume')return resumeReview(c,String(body.id||''));
   if(body.action==='sendQueued')return sendQueuedItem(c,String(body.id||''));
   if(body.action==='send')return sendPlan(c,String(body.id||''));
   if(body.action==='reconcile')return reconcile(c,String(body.id||''));
   if(body.action==='disconnect'){await db().prepare('UPDATE olist_connections SET tokens=NULL,epoch=? WHERE owner=?').bind(crypto.randomUUID(),owner).run();return {ok:true};}
   throw new OlistError('Ação inválida.');
  });
  return response(result,200,body.action==='connect'?{'Set-Cookie':'mtn_olist_oauth='+browser+'; HttpOnly; SameSite=Lax; Path=/api/olist/callback; Max-Age=600'+(new URL(request.url).protocol==='https:'?'; Secure':'')}:{});
 }catch(e:any){return response({error:e instanceof OlistError?e.message:'Não foi possível concluir a operação. Confira a conexão e tente novamente.'},e instanceof OlistError?e.status:500);}
}
