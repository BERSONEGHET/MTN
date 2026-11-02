import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {exportCatalog,importCatalog} from '../../../lib/catalog-transfer.mjs';
export const dynamic='force-dynamic';
const response=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){
 const user=await getChatGPTUser();if(!user)return response({error:'Entre com sua conta.'},401);
 try{return new Response(JSON.stringify(await exportCatalog(env.DB,user.userId)),{headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Content-Disposition':'attachment; filename="MTN-transferencia-online.json"'}});}
 catch{return response({error:'Não foi possível preparar a transferência. O histórico pode exceder o limite automático.'},400);}
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return response({error:'Entre com sua conta.'},401);
 if(request.headers.get('origin')!==new URL(request.url).origin)return response({error:'Origem inválida.'},403);
 try{const text=await request.text();if(text.length>5000000)return response({error:'Arquivo muito grande.'},413);return response(await importCatalog(env.DB,user.userId,JSON.parse(text)));}
 catch{return response({error:'Não foi possível importar. Confira se o arquivo foi gerado pelo MTN e se o cadastro de destino está vazio.'},400);}
}
