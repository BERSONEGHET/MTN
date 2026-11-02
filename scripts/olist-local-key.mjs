import {existsSync,readFileSync,appendFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
// The ignored dev binding is server-only. Never overwrite an existing key:
// previous encrypted credentials and refresh tokens depend on it.
export function prepareOlistKey(){
 const path='.dev.vars',existing=existsSync(path)?readFileSync(path,'utf8'):'';
 if(!/^OLIST_ENCRYPTION_KEY\s*=/m.test(existing)){
  const line='OLIST_ENCRYPTION_KEY="'+randomBytes(32).toString('base64')+'"\n';
  if(existsSync(path))appendFileSync(path,'\n'+line);else writeFileSync(path,line,{flag:'wx',mode:0o600});
 }
}
