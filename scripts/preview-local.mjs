import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {spawn,spawnSync} from "node:child_process";
import path from "node:path";
import {prepareOlistKey} from "./olist-local-key.mjs";
prepareOlistKey();
const root=process.cwd();
const hostname="127.0.0.1",port=5173,origin="http://"+hostname+":"+port;
const manifest=JSON.parse(readFileSync(path.join(root,".openai/hosting.json"),"utf8"));
if(manifest.project_id!=="appgprj_6ae755d48c308191af261ebed1d77075"||manifest.d1!=="DB")throw new Error("Esta pasta nao corresponde ao cadastro MTN.");
const localEnv={...process.env,CLOUDFLARE_CF_FETCH_ENABLED:"false",WRANGLER_SEND_METRICS:"false",WRANGLER_WRITE_LOGS:"false",CI:"1"};
const wrangler=path.join(root,"node_modules/wrangler/bin/wrangler.js");
const configPath=path.join(root,".sites-runtime/preview-d1.json");
mkdirSync(path.dirname(configPath),{recursive:true});
writeFileSync(configPath,JSON.stringify({name:"mtn-cadastro-local",compatibility_date:"2026-05-15",d1_databases:[{binding:"DB",database_name:"site-creator-d1",database_id:"00000000-0000-4000-8000-000000000000",migrations_dir:path.join(root,"drizzle")}]},null,2));
const logPath=path.join(root,".sites-runtime/preview-status.txt");
try{
 const health=await fetch(origin+"/api/catalog",{signal:AbortSignal.timeout(1000)});
 if(health.ok||health.status===401)throw new Error("Ja existe um servidor nessa porta. Use a janela da previa ja aberta ou feche esse servidor antes de continuar.");
}catch(e){if(e.message.startsWith("Ja existe"))throw e;}
console.log("Preparando somente o banco de dados LOCAL da previa...");
const migrated=spawnSync(process.execPath,["--import","./scripts/sites-env.mjs",wrangler,"d1","migrations","apply","DB","--local","--config",configPath,"--persist-to",".wrangler/state"],{cwd:root,env:localEnv,stdio:"inherit",windowsHide:true});
if(migrated.error||migrated.status!==0){writeFileSync(logPath,"FALHA_BANCO_LOCAL");throw migrated.error||new Error("Nao foi possivel preparar o banco local.");}
console.log("\nIniciando previa somente neste computador. Mantenha esta janela aberta.");
console.log("Envios ao Olist exigem conexao e confirmacao na aba Integracoes.\n");
const server=spawn(process.execPath,["scripts/run-framework.mjs","dev","--hostname",hostname],{cwd:root,env:localEnv,stdio:"inherit",windowsHide:true});
let done=false;server.on("exit",(code)=>{done=true;process.exitCode=code||0;});
process.once("SIGINT",()=>server.kill("SIGINT"));
let ready=false;
for(let i=0;i<90&&!done;i++){
 await new Promise(r=>setTimeout(r,1000));
 try{const response=await fetch(origin,{redirect:"manual",signal:AbortSignal.timeout(2000)});if(response.status===200||response.status===302||response.status===307){ready=true;break;}}catch{}
}
if(ready){
 const url=origin+"/signin-with-chatgpt?return_to=%2F";
 writeFileSync(logPath,"PRONTO\n"+url);
 console.log("\nPREVIA PRONTA: "+url+"\n");
 if(process.platform==="win32")spawn("cmd.exe",["/d","/c","start","",url],{cwd:root,env:localEnv,stdio:"ignore",windowsHide:true});
}else{
 writeFileSync(logPath,"FALHA_INICIALIZACAO");
 console.error("A previa nao confirmou inicializacao. Informe a ultima mensagem da janela.");
 server.kill();
}
