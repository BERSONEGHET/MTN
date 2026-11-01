# MTN · Cadastro online de produtos

Implementação em andamento. Este repositório não está publicado.

## Estado em 01/11/2026
- Site privado registrado: appgprj_6ae755d48c308191af261ebed1d77075. Reutilize essa identidade; não crie outro Site.
- Novo SKU: três letras do produto + F/M/U + sequência de quatro dígitos + tamanho de dois dígitos + cor de dois dígitos.
- Combinações do mesmo produto novo compartilham sequência.
- SKU manual disponível ao criar ou editar; não é sobrescrito pelo cálculo. Mudanças ficam em histórico.
- Importação XLSX/CSV preserva SKUs e divergências dos cadastros antigos; nenhuma correção automática.
- Gêneros F/Feminino, M/Masculino e U/Unissex.
- Tamanhos PP/P/M/G/GG/G1-XG/Único/XGG e 12/14/16/18/20/34/36/38/40/42/44/46/48/50/52/54/56.
- Sugestão de preço = custo × 2,5; preço escolhido é independente.
- Custos, lucro unitário e lucro total calculados em centavos.
- Persistência D1 com dados separados por identidade autenticada.
- Os cadastros reais da prévia ficam no banco local e não são incluídos no repositório. A migração para uma versão hospedada deve usar a planilha atualizada.
- Nenhuma alteração enviada ao Olist ou Nuvemshop.

## Limitações atuais
A preparação executada pelo usuário no Windows concluiu a instalação de 682 pacotes, a verificação de código, os 12 testes e o build completo. O registro local confirmou OK_INSTALACAO_TESTES_BUILD em 01/11/2026. O executor do aplicativo continua com CODEX_SANDBOX_NETWORK_DISABLED=1 e ENOTFOUND para git.chatgpt-team.site; nenhuma versão foi publicada. A interface ainda não foi validada no navegador.
O build completo do Vinext passou no Windows normal. Isso não comprova funcionamento da interface nem do D1 hospedado.

A integração Olist–Nuvemshop existente foi apenas consultada. A conexão do ChatGPT com o Olist é somente leitura. Este código NÃO implementa envio ou sincronização contínua da tabela para o ERP.

## Retomada
1. Restaurar o acesso normal de rede para os dois servidores.
2. Na pasta do projeto, executar o instalador Sites documentado, sem recriar o Site.
3. Executar npm test e npm run check:source, depois o build completo do Sites.
4. Aplicar a migração D1 no ambiente de teste e conferir importação XLSX real, salvamento, edição manual de SKU e acesso autenticado no navegador.
5. Usar o fluxo de fonte/publicação do Sites para esse project_id, preservando acesso privado.
6. Testar a versão publicada e só depois importar o cadastro atualizado.
7. Implementar a integração de escrita com Olist mediante configuração de permissões adequada. Sincronizar por IDs estáveis; editar um SKU na tabela não pode criar automaticamente um segundo produto no ERP.

## Testes
npm test executa 20 testes de regras e API com SQLite local e adaptador D1 de teste: preservação de duplicidades antigas, sequência, variações, edição manual, histórico, duplicidades novas, concorrência de edição, reenvio idempotente, autorização e isolamento por usuário.
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
