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

## Update Snapshots

Updates Mongo em testes controlados geram snapshot antes da alteracao.

Collection:

```txt
mongo_import_update_snapshots
```

O snapshot salva:

- collection alterada;
- documentId;
- filtro usado;
- estado `before`;
- patch aplicado;
- estado `after`, quando o update termina;
- testRunId;
- runId;
- integrationId;
- storeId;
- fileName;
- status de rollback.

Campos sensiveis sao mascarados:

- `access_token`;
- `refresh_token`;
- `token`;
- `authorization`;
- `password`;
- `client_secret`.

## Rollback

Rollback restaura documentos atualizados a partir dos snapshots.

Comando:

```powershell
npm run mongo:rollback-test -- --testRunId=ID_AQUI
```

Regras:

- exige `testRunId`;
- nao existe rollback global;
- so usa snapshots com `source = "mongo_update_snapshot"`;
- restaura updates;
- nao apaga documentos criados;
- nao limpa `import_runs` ou `import_run_items`.

## Ordem Recomendada

Para desfazer um teste Mongo completo:

```powershell
npm run mongo:rollback-test -- --testRunId=ID_AQUI
npm run mongo:cleanup-test -- --testRunId=ID_AQUI
```

Primeiro rollback restaura updates. Depois cleanup remove documentos criados em teste.

## Limitacao Atual

Rollback depende de snapshots. Updates feitos antes desta sprint nao possuem snapshot e nao podem ser revertidos automaticamente.
