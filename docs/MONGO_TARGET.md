# Mongo Target

## Status

MongoDB e um target opcional e experimental controlado.

Supabase continua sendo o destino oficial padrao.

## Database de Teste

Database usado nas validacoes:

```txt
driveparts_test
```

## Collections

- `inventory_items`;
- `storage_locations`;
- `mercado_livre_brasil_anuncio`;
- `import_runs`;
- `import_run_items`;
- `parte`.

## Scripts

- `npm run import:mongo:test`;
- `npm run import:official`;
- `npm run import:compare-targets`;
- `npm run mongo:bootstrap`;
- `npm run mongo:cleanup-test`;
- `npm run mongo:seed:parte`;
- `npm run mongo:check:parte`.

## Quality Gate

Write Mongo pode ser bloqueado quando:

- arquivo sem linhas;
- integrationId ausente/invalido;
- storeId nao resolvido;
- conexao Mongo falha;
- cobertura da `parte` e zero e existem categorias pendentes;
- `allowCategoryPending` nao foi informado.

Mensagem esperada para cobertura zero:

```txt
Write bloqueado: collection parte sem cobertura suficiente.
```

## category_pending

`category_pending` indica que a categoria Mercado Livre foi detectada, mas a referencia nao foi encontrada em `parte`.

Pode ser permitido somente com decisao explicita:

```bash
--allow-category-pending
```

## Cleanup

Cleanup seguro remove documentos criados com:

- `metadata.source` permitido;
- `metadata.testRunId`;
- `metadata.testCreated = true`.

Ele nao reverte updates feitos em documentos preexistentes.

## Limitacao Atual

Quando uma importacao atualiza documentos existentes no Mongo, o cleanup nao restaura o estado anterior.

Proximo passo futuro: rollback por snapshot antes/depois para updates.

