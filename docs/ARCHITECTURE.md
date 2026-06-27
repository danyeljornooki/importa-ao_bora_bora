# Architecture

## Visao Geral

O projeto importa pecas automotivas a partir de planilhas, compara com o inventario existente e grava o resultado em um destino de persistencia.

O destino oficial padrao continua sendo Supabase. MongoDB existe como target opcional e controlado, usado somente quando solicitado de forma explicita.

## Fluxo Principal

1. A tela ou script recebe arquivo e `integrationId`.
2. A integracao Mercado Livre resolve `storeId` e token.
3. `runImport` faz dry run:
   - parse;
   - normalize;
   - validate;
   - match;
   - compare;
   - import plan;
   - execution plan.
4. Em write Supabase, `executePartImportWithComplements` persiste a importacao oficial.
5. Em write Mongo controlado, `executeOfficialImportWithTarget` usa `mongoImportTarget`.
6. Historico e itens da execucao sao registrados no destino escolhido.

## Supabase

Supabase e o banco oficial. Chamadas antigas sem target continuam usando Supabase.

Areas principais:

- `inventory_items`;
- `storage_locations`;
- `import_runs`;
- `import_run_items`;
- review/historico/inbox;
- catalogo preview read-only.

## Mongo

Mongo e experimental controlado. Ele nao substitui Supabase.

O target Mongo grava em:

- `inventory_items`;
- `storage_locations`;
- `mercado_livre_brasil_anuncio`;
- `import_runs`;
- `import_run_items`.

Busca referencia em:

- `parte`.

## Mercado Livre

Nos testes e comparadores Mongo, Mercado Livre e usado somente via GET.

Nao chamar:

- publicacao;
- pausa;
- update de preco;
- update de estoque;
- qualquer endpoint de escrita.

## Pastas Importantes

- `src/app/`: telas e rotas Next.
- `src/engine/`: engine de importacao.
- `src/engine/import-targets/`: target Supabase/Mongo e comparadores.
- `src/modules/importer/`: parser, aliases, validadores e utilitarios.
- `src/core/`: regras centrais reutilizaveis.
- `src/adapters/`: persistencia externa.
- `scripts/`: comandos operacionais.
- `docs/`: documentacao operacional.

