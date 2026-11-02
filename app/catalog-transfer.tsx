"use client";
import {useState} from 'react';
export default function CatalogTransfer(){
 const [file,setFile]=useState<any>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 return <section className="panel integrationInfo"><h2>Transferir o cadastro para a versão online</h2><p>Os cadastros local e online usam bancos separados. Leve os produtos, SKUs, vínculos e histórico usando o arquivo de transferência. As chaves e a autorização do Olist não entram nesse arquivo.</p>
 <a className="secondary" href="/api/transfer" download>Baixar arquivo de transferência</a>
 <details style={{marginTop:20}}><summary>Importar em um cadastro vazio</summary><p>Na versão online, entre com sua conta e selecione o arquivo baixado neste computador. Após importar, configure e autorize o Olist com o endereço de retorno online.</p><label className="field">Arquivo de transferência<input type="file" accept=".json,application/json" disabled={busy} onChange={async e=>{setError('');setMessage('');setFile(null);try{const f=e.target.files?.[0];if(!f)return;if(f.size>5000000)throw new Error('Use um arquivo de até 5 MB.');const data=JSON.parse(await f.text());if(data.format!=='mtn-catalog-transfer'||data.version!==1)throw new Error('Arquivo de transferência inválido.');setFile(data);}catch(e:any){setError(e.message);}}}/></label>
 {file&&<p>{file.data?.products?.length||0} produto(s) e {file.data?.olist_links?.length||0} vínculo(s) com o Olist.</p>}
 <button className="primary" disabled={busy||!file} onClick={async()=>{setBusy(true);setError('');try{const res=await fetch('/api/transfer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(file)}),data=await res.json();if(!res.ok)throw new Error(data.error);setFile(null);setMessage(data.products+' produtos transferidos. Atualize a página para carregá-los.');}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>{busy?'Importando…':'Importar os cadastros neste banco vazio'}</button></details>
 {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 </section>;
}
