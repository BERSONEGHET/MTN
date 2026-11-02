# MTN · Cadastro online de produtos

Implementação em andamento. Este repositório não está publicado.

## Estado atual

- Aplicativo local funcional: produtos, variações, SKUs, planilhas e impressão de etiquetas.
- Olist integrado por aplicativo OAuth próprio, com revisão, fila de envio e reconciliação automática de resultados incertos.
- O primeiro envio real foi confirmado no ERP pelo proprietário. O conector de consultas do ChatGPT continua separado e somente de leitura.
- Preços em centavos; SKU manual e histórico preservados. O saldo de estoque não é enviado pelo cadastro.
- Banco D1 separado por identidade autenticada. A versão hospedada usa a identidade do visitante; nunca fixe `local_seedy` no servidor online.
- Site registrado e privado: `appgprj_6ae755d48c308191af261ebed1d77075`. Reutilize essa identidade.
- A publicação ainda não foi concluída. O envio ao repositório da hospedagem falhou nesta sessão com `getaddrinfo() thread failed to start`. Não existe URL online confirmada.
- Os cadastros e os segredos locais não fazem parte deste repositório.

## Transferência para a hospedagem

Na aba Integrações, **Transferir o cadastro para a versão online** gera um arquivo com produtos, modelos, sequenciais, vínculos Olist e histórico. Após publicar, entre no site com a conta proprietária e importe esse arquivo no banco vazio. A importação é atômica e não substitui cadastros existentes. Chaves, cookies e tokens não são exportados.

Configure uma `OLIST_ENCRYPTION_KEY` exclusiva como segredo do servidor hospedado. Depois adicione o endereço HTTPS de retorno do site ao aplicativo privado no Olist, configure as credenciais na tela online e autorize. A versão local permanece independente.

Consulte [OLIST.md](OLIST.md) para a conexão e o comportamento da fila. `npm test` valida o catálogo, etiquetas, integração e transferência com APIs simuladas; `npm run build` gera o Worker. Os testes não efetuam envios reais.

## Retomada
1. Restaurar o acesso normal de rede para os dois servidores.
2. Na pasta do projeto, executar o instalador Sites documentado, sem recriar o Site.
3. Executar npm test e npm run check:source, depois o build completo do Sites.
4. Aplicar a migração D1 no ambiente de teste e conferir importação XLSX real, salvamento, edição manual de SKU e acesso autenticado no navegador.
5. Usar o fluxo de fonte/publicação do Sites para esse project_id, preservando acesso privado.
6. Testar a versão publicada e só depois importar o cadastro atualizado.
7. Implementar a integração de escrita com Olist mediante configuração de permissões adequada. Sincronizar por IDs estáveis; editar um SKU na tabela não pode criar automaticamente um segundo produto no ERP.

## Testes
npm test executa 47 testes de regras e API com SQLite local e adaptador D1 de teste: preservação de duplicidades antigas, sequência, variações, edição manual, histórico, duplicidades novas, concorrência de edição, reenvio idempotente, autorização e isolamento por usuário.
npm run check:source verifica a sintaxe e as importações locais sem substituir o build completo.

## Dados e importação
A importação acrescenta linhas, mantém os SKUs originais e não corrige os antigos. Repetir o mesmo arquivo é idempotente. Importar um arquivo diferente é uma nova importação e pode acrescentar códigos antigos duplicados; a interface avisa antes de confirmar.
Nunca inclua segredos de integração no navegador, no repositório ou neste arquivo.

## GitHub e acesso em outros computadores
O GitHub pode guardar o código deste projeto. O repositório deve ser privado, pois se trata de uma ferramenta interna da loja.

Guardar o código no GitHub não publica o cadastro nem transfere seus registros locais. O aplicativo usa uma API no servidor, autenticação do Sites e banco Cloudflare D1; portanto, o GitHub Pages sozinho não executa esta versão.

A publicação deve reutilizar o projeto Sites registrado acima, mantendo seu acesso privado. Qualquer hospedagem alternativa exigirá configuração própria do servidor, do banco e da autenticação.

Os dados locais ficam em `.wrangler/state/` e não devem entrar no GitHub. A configuração `.gitignore` já exclui essa pasta, `.sites-runtime/`, arquivos de ambiente, dependências e resultados de testes. Não remova esses bloqueios ao preparar o envio.

Antes de passar a usar uma versão hospedada:
1. Baixe a planilha Excel pelo cadastro local, guardando uma cópia de segurança.
2. Configure e valide o servidor, a autenticação e o banco hospedado.
3. Importe uma única vez a planilha atual no ambiente hospedado e confira produtos, SKUs, quantidades, custos e preços.
4. Confirme o acesso à mesma conta em outro computador antes de adotar a versão hospedada para os novos cadastros.

A planilha exporta os dados dos produtos; não equivale a um backup completo do banco, pois não inclui o histórico de alterações nem os identificadores internos.

## Etiquetas no cadastro local
O menu Etiquetas usa os produtos já cadastrados e gera Code 128 a partir do SKU integral, sem modificar os registros. Inclui nome, SKU e preço de venda escolhido, com opção de ocultar preço. Há formatos 50 × 30 mm e 33 × 21 mm, dimensões personalizadas, até quatro colunas e quantidade de cópias por produto. A impressão abre o diálogo do navegador, que também permite salvar PDF. São permitidas até 500 etiquetas por impressão.

Configure na impressora o tamanho correspondente à largura total da bobina e à altura da etiqueta. Use escala 100%, margens zero, sem cabeçalhos/rodapés. O avanço da bobina e a calibração do espaço entre etiquetas dependem do driver e da impressora. Faça uma impressão e uma leitura de teste antes de imprimir o lote completo.

O Code 128 usa JsBarcode v3.12.1 incorporado no projeto, sob licença MIT (vendor/JSBARCODE-LICENSE.txt), sem depender de CDN.

A tela de etiquetas permite marcar todos os produtos de todas as páginas, mantendo as quantidades de cópias já preenchidas. O espaço horizontal entre colunas e o espaço vertical entre linhas são configuráveis em milímetros. O tamanho de avanço vertical é a altura da etiqueta mais o espaçamento vertical; o diálogo de impressão informa a medida total para configurar a impressora.

O editor de etiquetas permite regular separadamente as fontes do nome, SKU e preço (4 a 30 pt) e os espaços entre nome/código de barras, código/SKU e SKU/preço (-10 a 10 mm). As preferências são salvas neste navegador e compartilhadas pela prévia e pela impressão. O programa bloqueia a impressão quando a altura disponível não comporta o texto e pelo menos 3 mm de código de barras. Restaurar fontes e espaços repõe os valores iniciais sem alterar os produtos nem as medidas da etiqueta.

A edição de fontes e espaços internos altera primeiro a prévia. O botão Aplicar a todas as etiquetas confirma e salva o estilo para todas as cópias dos produtos selecionados. A impressão fica desabilitada enquanto houver ajustes da prévia ainda não aplicados.

Espaços internos negativos deslocam os itens seguintes para cima, mantendo a altura do código de barras em relação ao espaçamento zero. A prévia e a impressão usam o mesmo posicionamento.

## Impressão compatível e diagnóstico
A impressão como imagem está ativada por padrão. O programa desenha cada etiqueta em PNG local a 300 dpi, respeitando o SKU, o preço e o layout aplicado. As imagens são impressas por um documento isolado, após carregamento, sem depender dos SVGs ou das regras de ocultação da tela principal. Há também download PNG da primeira etiqueta selecionada. Não há conexão direta com OpenLabel+ nem envio direto de comandos à impressora; a impressão continua pelo driver selecionado no navegador.

Para investigar papel em branco quando a prévia está correta, imprimir inicialmente apenas uma etiqueta, selecionar o driver da impressora real e conferir o mesmo tamanho de papel, escala 100% e margens zero. A impressão física na Tomate MDK-022 depende de teste no equipamento do usuário. O usuário confirmou que a mesma bobina imprime normalmente pelo OpenLabel+; isso direcionou a mudança para o caminho de impressão do programa, sem alterar o cadastro ou as configurações da impressora.

## PDF de tamanho físico e correção da resolução PNG
O botão Baixar PDF de teste gera uma página de 50 × 30 mm com apenas a primeira etiqueta selecionada, uma coluna e avanço extra zero. O PDF completo respeita as dimensões e as colunas configuradas. As imagens são incorporadas sem perdas em preto e branco, com MediaBox/CropBox em pontos e preferência PrintScaling None. A validação local com pypdf confirmou dimensões, páginas, orientação e os pixels das imagens. A preferência do PDF é uma indicação ao leitor, não uma substituição das configurações do driver.

O arquivo PNG baixado agora recebe metadados pHYs correspondentes a 300 dpi. Antes disso, o canvas de 300 dpi exportava PNG com metadados padrão do navegador de 96 dpi, permitindo ampliação quando aberto por outro programa. Leitores de imagens ainda podem escolher ajustar ao papel, portanto o PDF é a opção principal para manter medidas físicas.

Para a bobina confirmada de 50 × 30 mm: configurar no leitor e no driver o mesmo papel, imprimir em tamanho real/100%, uma página por folha, sem pôster/mosaico e conferir a orientação. A foto enviada pelo usuário mostrou ampliação, corte e rotação do texto. Não foi possível consultar a configuração do driver pela sessão, e a correção ainda requer teste físico de uma etiqueta.

Referências consultadas: documentação MDN de HTMLCanvasElement.toDataURL (96 dpi); Microsoft Support Imprimir no Microsoft Edge (papel e escala); Adobe Acrobat Ajustar o tamanho da página para impressão (tamanho real); tutorial Como Configurar o Tamanho de Impressão Etiqueta, ligado à central oficial de suporte Tomate: https://youtu.be/9jpB3misxVA.

Dimensões negativas do código de barras são ajustes em relação à referência automática: altura −1 reduz 1 mm da altura automática; largura −10 usa 90% da largura disponível. Largura 0 ou 100 usa toda a largura. A prévia e os arquivos PNG/PDF usam dimensões resultantes positivas; a impressão permanece bloqueada se as barras resultarem em menos de 3 mm de altura. A configuração confirmada pelo usuário para o driver MDK-022 foi deslocamento Vertical 4 mm, papel 50 × 30 mm e modo Direct.

## Editor interativo de espaço da etiqueta
Os controles de barras exibem o tamanho efetivo: aumentar o número ou mover o controle deslizante aumenta a altura até o limite físico disponível. Alterações redistribuem margens e espaços, preservando as fontes. Quando o espaço está preenchido, aumentar a margem superior consome primeiro a inferior, e vice-versa. A altura é limitada sem cortar o conteúdo.

O nome passa a reservar uma linha por padrão, com seleção de até três linhas. Esticar até perto do nome elimina o espaço extra depois do nome e faz as barras ocuparem a altura restante. A prévia tem limites visuais opcionais; essas guias não entram no PNG, PDF ou impressão. Todos os ajustes continuam sendo confirmados por Aplicar a todas as etiquetas, e arquivos já baixados devem ser gerados novamente.

## Limite do nome no cadastro e na etiqueta 50 × 30
O cadastro aceita até 160 caracteres no nome e mostra um contador. Excedentes são recusados pelo formulário e pela API, incluindo importação, sem truncamento silencioso. Nomes existentes não são reescritos.

O modelo de etiqueta solicitado em 02/11/2026 mantém o nome em uma linha, centralizado na largura visível das barras, preservando as zonas silenciosas do código. A prévia, o PNG e o PDF compartilham a mesma medida. O formulário de produto e a seleção de etiquetas avisam quando o texto não cabe com a fonte aplicada; quando há espaço, mostram uma estimativa de quantas letras adicionais cabem. A estimativa usa a largura média das maiúsculas, enquanto o aviso de excesso mede o nome real em Arial com a fonte configurada.

Configuração de impressão confirmada pelo usuário em 01/11: papel MTN 50x30 REAL, dimensões internas 50 × 30 mm, Paisagem, Tamanho real/100%, Direct. Os perfis Custom (100 × 150 mm) e etiqueta 50x30 (100 × 100 mm) não correspondem a essa bobina. A seleção correta no Edge eliminou o salto de etiquetas segundo confirmação do usuário.

## Exclusão pelo cadastro
O rodapé da edição inclui Excluir ao lado de Cancelar e Salvar. A confirmação identifica nome, SKU, cor, tamanho e quantidade e remove somente aquela linha. As outras variações, os modelos e o contador de sequências são preservados. A API verifica proprietário, origem e versão atual antes de excluir. Nenhum registro real foi excluído durante a implementação; os testes usam banco em memória. Excluir não envia alterações ao Olist/Nuvemshop. Uma importação posterior pode acrescentar novamente a linha excluída, pois a importação do arquivo é uma ação explícita e o sistema não mantém marca de exclusão.
