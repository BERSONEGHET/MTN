# Verificações do cadastro MTN

Verificação local em 01/11/2026:

- `node scripts/check-source.mjs`: sintaxe e importações verificadas.
- `node --test tests/catalog.test.mjs`: 20 testes aprovados.
- O build Vinext completo passou após a implementação de seleção de vários tamanhos e do menu recolhível. As alterações posteriores de posição do botão foram verificadas pelo compilador de sintaxe.

A suíte verifica tabelas de tamanhos e gêneros, valores monetários, preservação dos códigos antigos, sequência mínima 0380, variações com o mesmo início, SKU manual, histórico, duplicidade, concorrência de edição, idempotência, isolamento por usuário e origem, quantidades por tamanho e reversão de gravações de lote em caso de falha.

O build e os testes locais não comprovam a publicação, o funcionamento do banco hospedado nem a integração de escrita com Olist/Nuvemshop. O sistema ainda precisa de validação do ambiente hospedado e migração dos dados locais antes do uso em outros computadores.
