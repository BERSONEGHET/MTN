"use client";
import {useEffect,useState,useRef} from 'react';
import CatalogTransfer from './catalog-transfer';
import {currentOlistHistory} from '../lib/olist-history.mjs';
type Row={id:string;name:string;sku:string;color:string;size:string;price:number|null};
const money=(v:number|null)=>v===null?'—':(v/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function OlistIntegration({rows}:{rows:Row[]}){
 const [status,setStatus]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[clientId,setClientId]=useState(''),[clientSecret,setClientSecret]=useState(''),[selected,setSelected]=useState<string[]>([]),[search,setSearch]=useState(''),[plans,setPlans]=useState<any[]>([]),[confirmed,setConfirmed]=useState(false),[settings,setSettings]=useState(false);
 const reviewRef=useRef<HTMLElement>(null),messageRef=useRef<HTMLElement>(null),pauseRef=useRef(false);
 const autoChecked=useRef(new Set<string>());
 const [pendingSelected,setPendingSelected]=useState<string[]>([]),[progress,setProgress]=useState<{phase:string;done:number;total:number}|null>(null);
 useEffect(()=>{if(plans.length)reviewRef.current?.scrollIntoView({behavior:'smooth',block:'start'});},[plans]);
 useEffect(()=>{if(error||notice)messageRef.current?.scrollIntoView({behavior:'smooth',block:'start'});},[error,notice]);
 async function prepareReview(ids:string[]){
  const unique=[...new Set(ids)];if(!unique.length)return;
  setPlans([]);setConfirmed(false);pauseRef.current=false;const prepared:any[]=[];
  try{for(const [index,id] of unique.entries()){if(pauseRef.current)break;setProgress({phase:'Conferindo',done:index,total:unique.length});const data=await post({action:'review',ids:[id]});prepared.push(...data.plans);setProgress({phase:'Conferindo',done:index+1,total:unique.length});}}
  catch(e:any){throw new Error('Conferidos '+prepared.length+' de '+unique.length+' produtos. '+e.message);}
  finally{setPlans(prepared);setProgress(null);await load();}
 }
 async function sendQueue(){
  pauseRef.current=false;const queue=[...plans];let done=0;
  try{for(const p of queue){if(pauseRef.current)break;setProgress({phase:'Enviando',done,total:queue.length});await post({action:'sendQueued',id:p.id});done++;setProgress({phase:'Enviando',done,total:queue.length});}
   setNotice(done===queue.length?'Envio confirmado pelo Olist: '+done+' produto(s).':'Fila pausada. '+done+' de '+queue.length+' produto(s) confirmado(s).');
  }catch(e:any){throw new Error('Fila interrompida: '+done+' de '+queue.length+' produto(s) confirmado(s). '+e.message);}
  finally{setPlans(queue.slice(done));setConfirmed(false);setPendingSelected([]);setSelected(previous=>previous.filter(id=>!queue.slice(0,done).some(p=>p.rows.some((r:Row)=>r.id===id))));setProgress(null);await load();}
 }
 async function load(){const res=await fetch('/api/olist',{cache:'no-store'}),data=await res.json();if(!res.ok)throw new Error(data.error);setStatus(data);}
 useEffect(()=>{load().catch(e=>setError(e.message));const result=new URLSearchParams(location.search).get('olist');if(result==='connected')setNotice('Autorização concluída. Selecione os produtos para conferir o envio.');if(result==='error'){const messages:Record<string,string>={dns:'Falha de DNS: o servidor local não conseguiu localizar accounts.tiny.com.br. A autorização não chegou ao Olist.',tls:'Falha de certificado HTTPS ao acessar o Olist. Verifique data e hora do Windows e certificados da rede.',timeout:'O servidor do Olist não respondeu dentro de 15 segundos. Tente novamente em alguns minutos.',blocked:'O Windows ou o ambiente do servidor bloqueou a conexão de saída para o Olist.',redirect:'O endereço de autorização do Olist retornou um redirecionamento inesperado. A conexão foi interrompida antes de enviar credenciais a outro endereço.',network:'O programa não conseguiu acessar o servidor de autorização do Olist. Confira sua conexão e tente autorizar novamente.',credentials:'O Olist recusou o Client ID ou Client Secret. Copie novamente as chaves do aplicativo Cadastro MTN em Configurar aplicativo e salve.',code:'O código de autorização expirou ou foi recusado. Confirme que a URL no Olist é exatamente a exibida em Configurar aplicativo e clique em Autorizar novamente.',scope:'O Olist recusou o acesso solicitado. Confira as permissões do aplicativo.',denied:'A autorização não foi concedida no Olist. Clique em Autorizar e conclua a confirmação.',cookie:'A sessão do navegador não voltou com a autorização. Inicie e conclua a conexão na mesma janela, usando 127.0.0.1, sem alternar para localhost.',state:'A autorização expirou ou foi iniciada em outra aba. Clique em Autorizar e conclua uma única tentativa.',token:'O Olist recusou a troca do código pelas chaves de acesso. Confira as credenciais e a URL de retorno.'};const reason=new URLSearchParams(location.search).get('reason')||'';setError(messages[reason]||'Não foi possível concluir a autorização. Clique em Autorizar novamente para identificar a etapa que falhou.');}},[]);
 useEffect(()=>{setPlans([]);setConfirmed(false);},[rows]);
 useEffect(()=>{
  if(busy||!status?.connected)return;
  const pending=status.history?.find((h:any)=>h.state==='unknown'&&!autoChecked.current.has(h.id));
  if(!pending)return;
  autoChecked.current.add(pending.id);
  run(async()=>{
   setProgress({phase:'Conferindo automaticamente no Olist',done:0,total:1});
   try{await post({action:'reconcile',id:pending.id});setNotice('Resultado confirmado automaticamente no Olist: '+pending.skus.join(', '));}
   catch{setNotice('A conferência automática não confirmou '+pending.skus.join(', ')+'. O item permanece pendente e não foi reenviado.');}
   finally{setProgress(null);await load();}
  });
 },[status,busy]);
 async function post(body:any){const res=await fetch('/api/olist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await res.json();if(!res.ok)throw new Error(data.error);return data;}
 async function run(task:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await task();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 function select(ids:string[]){setSelected(ids);setPlans([]);setConfirmed(false);}
 const filtered=rows.filter(r=>[r.name,r.sku,r.color,r.size].join(' ').toLowerCase().includes(search.toLowerCase()));
 const history=currentOlistHistory(status?.history||[]);
 const pendingIds=[...new Set<string>(history.filter((h:any)=>['ready','failed'].includes(h.state)).flatMap((h:any)=>h.productIds))];
 const chosenPending=pendingSelected.filter(id=>pendingIds.includes(id));
 const labels:Record<string,string>={price:'Atualizar preço de venda',simple:'Cadastrar produto individual',group:'Criar modelo com tamanhos e cores',variation:'Adicionar variação ao modelo'};
 return <div className="olistIntegration">
 {progress&&<div className="banner green olistProgress" role="status"><span>{progress.phase}: {progress.done} de {progress.total} produtos. Mantenha esta página aberta.</span><progress value={progress.done} max={progress.total}/><button type="button" className="secondary" onClick={()=>{pauseRef.current=true;}}>Pausar após este item</button></div>}
 <section ref={messageRef} className="panel integrationInfo"><div className="olistHeading"><div><h2>Olist ERP</h2><p>{status?.connected?'Autorização salva. A conferência consulta a conexão antes do envio.':'Conecte o cadastro ao seu Olist para enviar produtos e preços.'}</p></div><span className={'badge '+(status?.connected?'green':'amber')}>{status?.connected?'Autorizado':'Aguardando conexão'}</span></div>
 {error&&<div className="banner error" role="alert">{error}</div>}{notice&&<div className="banner green" role="status">{notice}</div>}
 <p>Selecione → confira os dados → confirme o envio. O estoque permanece no Olist. Produtos existentes recebem apenas o preço de venda; novos cadastros levam nome, SKU e variações. O custo acompanha somente produtos individuais novos.</p>
 {!status?.protected&&<div className="banner amber">Feche o programa e abra novamente pelo atalho para preparar a conexão e atualizar o banco local.</div>}
 {(!status?.configured||settings)&&<form className="olistSetup" onSubmit={e=>{e.preventDefault();run(async()=>{await post({action:'configure',clientId,clientSecret});setClientSecret('');setClientId('');setSettings(false);await load();setNotice('Aplicativo salvo. Agora clique em Autorizar no Olist.');});}}>
 <h3>Configurar aplicativo do cadastro MTN</h3><ol><li>No Olist, abra Configurações → Geral → Aplicativos e crie um aplicativo privado para o cadastro MTN.</li><li>Em Produtos, habilite <strong>Leitura</strong> e <strong>Incluir e editar</strong>.</li><li>Cadastre este endereço de retorno: <code className="olistCallback">{status?.callback||'Carregando…'}</code></li><li>Copie as credenciais do novo aplicativo nos campos abaixo.</li></ol>
 <p>Use um aplicativo próprio para este programa. A conexão de consultas do ChatGPT continua separada.</p>
 <div className="formGrid"><label className="field">Client ID<input required autoComplete="off" value={clientId} onChange={e=>setClientId(e.target.value)} disabled={busy}/></label><label className="field">Client Secret<input required type="password" autoComplete="new-password" value={clientSecret} onChange={e=>setClientSecret(e.target.value)} disabled={busy}/></label></div>
 <button className="primary" disabled={busy||!status?.protected}>Salvar aplicativo</button><small>As credenciais são guardadas criptografadas no servidor deste cadastro. Nunca são devolvidas ao navegador.</small>
 <a href="https://ajuda.olist.com/pt_BR/hubs-e-plataformas-via-api/aplicativos-api-v3-configuracoes-e-utilizacao" target="_blank" rel="noreferrer">Ver instruções do Olist</a></form>}
 {status?.configured&&<div className="olistActions"><button className="primary" disabled={busy} onClick={()=>run(async()=>{const data=await post({action:'connect'});location.assign(data.url);})}>{status.connected?'Renovar autorização':'Autorizar no Olist'}</button><button className="secondary" disabled={busy} onClick={()=>setSettings(!settings)}>Configurar aplicativo</button>{status.connected&&<button className="secondary" disabled={busy} onClick={()=>run(async()=>{await post({action:'disconnect'});setPlans([]);await load();setNotice('Autorização removida deste cadastro.');})}>Desconectar</button>}</div>}
 </section>
 <section className="panel"><div className="panelHeading"><div><h2>Produtos para enviar</h2><p>Selecione um, vários ou todos. A fila respeita as pausas da API; as quantidades locais não são enviadas como estoque.</p></div><button className="primary" disabled={busy||!status?.connected||!selected.length} onClick={()=>run(async()=>{await prepareReview(selected);})}>{busy?'Aguarde…':'Revisar selecionados ('+selected.length+')'}</button></div>
 <div className="filters"><input aria-label="Buscar produtos para enviar" placeholder="Buscar nome, SKU, tamanho ou cor" value={search} onChange={e=>setSearch(e.target.value)}/><button className="secondary" disabled={busy||!filtered.length} onClick={()=>select(filtered.map(r=>r.id))}>Marcar todos os produtos da busca</button><button className="secondary" disabled={busy} onClick={()=>select([])}>Limpar seleção</button></div>
 <div className="tableWrap"><table><thead><tr><th>Enviar</th><th>Produto / SKU</th><th>Tamanho / cor</th><th>Venda</th><th>Vínculo Olist</th></tr></thead><tbody>{filtered.slice(0,100).map(r=><tr key={r.id}><td><input type="checkbox" aria-label={'Selecionar '+r.sku} checked={selected.includes(r.id)} disabled={busy} onChange={e=>select(e.target.checked?[...selected,r.id]:selected.filter(id=>id!==r.id))}/></td><td><strong>{r.name}</strong><br/><code>{r.sku}</code></td><td>{r.size} / {r.color}</td><td>{money(r.price)}</td><td>{status?.links?.find((l:any)=>l.productId===r.id)?.remoteId||'A conferir pelo SKU'}</td></tr>)}</tbody></table></div>{filtered.length>100&&<p className="olistNote">Mostrando 100 itens. Use a busca para localizar os demais.</p>}
 </section>
 {plans.length>0&&<section ref={reviewRef} className="panel integrationInfo" aria-label="Revisão do envio"><h2>Confira antes de enviar: {plans.length} produto(s)</h2>{plans.map(p=><div className="olistPlan" key={p.id}><strong>{labels[p.kind]}</strong>{p.parentSku&&<p>Modelo: {p.parentSku}</p>}{p.rows.map((r:Row)=><p key={r.id}>{r.name} · {r.sku} · {r.size} / {r.color} — {p.kind==='price'?(p.previous===null?'Preço anterior não informado':money(Math.round(p.previous*100)))+' → ':''}{money(r.price)}</p>)}</div>)}<label className="checkLabel"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>Conferi os produtos e os preços acima e quero enviá-los ao Olist.</label><div className="olistActions"><button className="primary" disabled={busy||!confirmed} onClick={()=>run(sendQueue)}>Confirmar e enviar todos ({plans.length})</button><button className="secondary" disabled={busy} onClick={()=>setPlans([])}>Cancelar envio</button></div></section>}
 {!!history.length&&<section className="panel integrationInfo"><div className="olistHeading"><div><h2>Pendentes e últimos envios</h2><p>Uma situação por SKU. Selecione os pendentes para revisar e enviar juntos.</p></div></div>
 {pendingIds.length>0&&<div className="olistActions"><label className="checkLabel"><input type="checkbox" aria-label="Marcar todos os pendentes" disabled={busy} checked={chosenPending.length===pendingIds.length} onChange={e=>{setPendingSelected(e.target.checked?pendingIds:[]);setPlans([]);setConfirmed(false);}}/>Todos os pendentes ({pendingIds.length})</label><button className="primary" disabled={busy||!status.connected||!chosenPending.length} onClick={()=>run(()=>prepareReview(chosenPending))}>Revisar selecionados ({chosenPending.length})</button></div>}
 {history.map((h:any)=><div className="olistHistory" key={h.key}>
 {['ready','failed'].includes(h.state)&&!!h.productIds.length&&<input type="checkbox" aria-label={'Marcar pendente '+h.skus[0]} disabled={busy} checked={chosenPending.includes(h.productIds[0])} onChange={e=>{setPendingSelected(previous=>e.target.checked?[...new Set([...previous,...h.productIds])]:previous.filter(id=>!h.productIds.includes(id)));setPlans([]);setConfirmed(false);}}/>}
 <div style={{flex:1}}><code>{h.skus[0]}</code><p>{h.state==='done'?'Enviado ao Olist':h.state==='ready'?'Aguardando envio':h.state==='failed'?'Envio recusado; revise novamente':'Precisa conferir o resultado no ERP'}</p></div>
 {['ready','failed'].includes(h.state)&&<button className="secondary" disabled={busy||!status.connected||!h.productIds.length} onClick={()=>run(()=>prepareReview(h.productIds))}>Revisar e enviar</button>}
 {['unknown','sending'].includes(h.state)&&<button className="secondary" disabled={busy} onClick={()=>run(async()=>{await post({action:'reconcile',id:h.id});await load();setNotice('Resultado confirmado pela consulta ao ERP.');})}>Reconciliar pelo SKU</button>}
 </div>)}
 {pendingIds.length>0&&<div className="olistActions"><button className="primary" disabled={busy||!status.connected||!chosenPending.length} onClick={()=>run(()=>prepareReview(chosenPending))}>Revisar selecionados ({chosenPending.length})</button></div>}
 </section>}
 <CatalogTransfer/>
 </div>;
}
