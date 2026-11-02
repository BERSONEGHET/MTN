import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {OlistError,withConnection,finishOAuth} from '../../../../lib/olist.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':'mtn_olist_oauth=; HttpOnly; SameSite=Lax; Path=/api/olist/callback; Max-Age=0'};
 const user=await getChatGPTUser();if(!user)return new Response('Entre no cadastro e conecte novamente.',{status:401,headers});
 try{
  const browser=request.headers.get('cookie')?.match(/(?:^|;\s*)mtn_olist_oauth=([^;]+)/)?.[1];if(!browser)throw new OlistError('Sessão do navegador não encontrada.',400,'cookie');
  await withConnection(env.DB,String((env as any).OLIST_ENCRYPTION_KEY||''),user.userId,c=>finishOAuth(c,new URL(request.url),browser));
  return new Response(null,{status:303,headers:{...headers,Location:'/?olist=connected'}});
 }catch(e){const allowed=['dns','tls','timeout','blocked','redirect','network','credentials','code','scope','denied','token','state','cookie'];const reason=e instanceof OlistError&&allowed.includes(e.reason)?e.reason:'unknown';return new Response(null,{status:303,headers:{...headers,Location:'/?olist=error&reason='+reason}});}
}
