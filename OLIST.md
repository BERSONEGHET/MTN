# Integração do cadastro MTN com Olist ERP

A aba **Integrações** configura um aplicativo OAuth próprio do cadastro. Não utiliza as credenciais nem altera o plugin de consultas do ChatGPT.

## Conectar neste computador

1. Feche a janela do servidor e abra **Abrir_Cadastro_MTN.cmd** novamente. O inicializador aplica as migrações locais e prepara a chave de criptografia, sem alterar produtos existentes.
2. Abra **Integrações**. A tela mostra o endereço exato de retorno, normalmente `http://127.0.0.1:5173/api/olist/callback`.
3. No Olist, vá a **Configurações → Geral → Aplicativos**, crie um aplicativo privado e cadastre esse endereço. Ative em Produtos **Leitura** e **Incluir e editar**.
4. Preencha Client ID e Client Secret nos campos do programa, salve e clique em **Autorizar no Olist**. Não envie essas credenciais pelo chat.
5. Selecione um, vários ou todos os produtos ou pendentes e clique em **Revisar selecionados**. Confira o conjunto, marque a confirmação e clique em **Confirmar e enviar todos**. A fila processa cada item em sequência, mostra o progresso e pode ser pausada após o item atual.

O cadastro precisa de um plano Olist com acesso à API e à Gestão de Aplicativos. A autorização pode precisar ser renovada após um período sem uso, conforme a validade dos tokens do Olist.

## Comportamento

- O programa consulta todas as páginas do filtro de SKU, compara o código exato e bloqueia resultados ambíguos. Consulta incompleta nunca é interpretada como produto inexistente.
- Produto existente: guarda o ID do Olist e atualiza apenas o preço de venda, preservando o valor promocional. Nome, impostos, imagens, custo e estoque existentes permanecem no ERP.
- SKU padrão MTN inexistente: cria modelo usando o início do SKU, com as cores e tamanhos selecionados. Se o modelo já existir, confere seu nome e tipo antes de acrescentar variações.
- SKU manual sem início reconhecível: a revisão informa que será cadastrado um produto individual, com nome, cor, tamanho, custo e venda.
- Não envia saldo de estoque, não exclui produtos no ERP e não modifica as configurações da Nuvemshop.
- No envio individual, cada revisão vence em dez minutos. A fila refaz a conferência de cada item imediatamente antes do envio e exige os mesmos dados e operação aprovados. Mudança local ou de preço remoto interrompe o conjunto para nova revisão. Um modelo criado por item anterior da fila é aproveitado pelas próximas variações. O mesmo envio confirmado não é repetido.
- Quando um envio fica sem resposta, o programa tenta confirmar automaticamente por consulta ao ERP, sem repetir a gravação. Se confirmar SKU, preço e os dados da variação, a fila continua. Pendências já existentes também recebem uma tentativa automática ao abrir a tela. Se não houver confirmação, o reenvio permanece bloqueado e o botão **Reconciliar pelo SKU** continua disponível. Se o resultado não puder ser confirmado, é necessário conferir manualmente no ERP; não existe repetição automática de criação.
- A tela mostra a situação mais recente de cada SKU. Pendências com resultado desconhecido precisam de reconciliação e não entram na opção Todos os pendentes para reenvio.
- A desconexão remove os tokens locais. Para revogar o aplicativo, use também as configurações do Olist.

## Proteção e operação

Client Secret e tokens ficam criptografados em D1 com AES-256-GCM e identificação do proprietário. A chave `OLIST_ENCRYPTION_KEY` é um segredo exclusivo do servidor, gerado em `.dev.vars` pelo inicializador local. Não apague nem publique esse arquivo. Preserve a chave junto ao backup privado do banco para manter a conexão utilizável. Nunca coloque a chave em código, variáveis públicas, GitHub ou na interface.

Na hospedagem, configure uma chave aleatória de 32 bytes em base64 como segredo do servidor, aplique as migrações D1 e cadastre o endereço HTTPS de retorno. A configuração local não publica nem ativa a integração hospedada. O servidor local deve permanecer restrito a `127.0.0.1`.

As chamadas são serializadas por proprietário e limitadas a uma a cada 2,1 segundos; HTTP 429 interrompe a operação e registra uma pausa. Outros aplicativos também consomem o limite compartilhado da conta.

## Validação

`node --test tests/catalog.test.mjs tests/olist.test.mjs`

Os testes usam banco em memória e uma API simulada. Não cadastram produtos reais. A conexão e o primeiro envio real ainda dependem da autorização do aplicativo pelo proprietário no Olist.

Referências oficiais: [OAuth](https://api-docs.erp.olist.com/documentacao/comecando/autenticacao), [Produtos](https://api-docs.erp.olist.com/api-reference/produtos/criar-produto), [Configurar aplicativo](https://ajuda.olist.com/pt_BR/hubs-e-plataformas-via-api/aplicativos-api-v3-configuracoes-e-utilizacao).
