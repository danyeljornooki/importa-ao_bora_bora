# Scripts

## import:official

Comando:

```powershell
npm run import:official -- --file "C:\Users\danye\Downloads\concordia_20.csv" --integrationId 6a2810f1acd28068260ec6c8 --target mongo --dryRun
```

O que faz: executa a importacao pela camada oficial com target.

Grava: apenas com `--write`.

Banco afetado: Supabase quando `--target supabase --write`; Mongo quando `--target mongo --write`.

Mercado Livre: pode chamar GET. Nao deve chamar escrita.

Quando usar: validar o fluxo oficial com target explicito.

## import:mongo:test

Comando:

```powershell
npm run import:mongo:test -- --file "C:\Users\danye\Downloads\concordia_20.csv" --integrationId 6a2810f1acd28068260ec6c8 --dryRun
```

O que faz: roda importacao Mongo controlada de laboratorio.

Grava: somente com `--write`.

Banco afetado: Mongo.

Mercado Livre: GET para anuncios.

Quando usar: teste operacional Mongo sem passar pela tela oficial.

## import:compare-targets

Comando:

```powershell
npm run import:compare-targets -- --file "C:\Users\danye\Downloads\concordia_20.csv" --integrationId 6a2810f1acd28068260ec6c8 --include-enrichment --skip-ml-fetch
```

O que faz: compara plano Supabase x Mongo.

Grava: nao.

Banco afetado: nenhum write.

Mercado Livre: GET quando `--include-enrichment` e sem `--skip-ml-fetch`.

Quando usar: validar equivalencia entre targets.

## mongo:bootstrap

Comando:

```powershell
npm run mongo:bootstrap
```

O que faz: cria/valida estrutura e indices Mongo.

Grava: sim, schema/indices.

Banco afetado: Mongo configurado por env.

Mercado Livre: nao.

Quando usar: preparar ambiente Mongo.

## mongo:cleanup-test

Comando:

```powershell
npm run mongo:cleanup-test -- --testRunId=official-import-mongo-EXEMPLO
```

O que faz: remove documentos de teste marcados pelo `testRunId`.

Grava: sim, delete seguro.

Banco afetado: Mongo.

Mercado Livre: nao.

Quando usar: limpar dados criados por testes controlados.

Aviso: se existirem snapshots de update nao revertidos para o `testRunId`, o cleanup mostra um alerta recomendando rollback antes. Ele nao executa rollback automaticamente.

## mongo:rollback-test

Comando:

```powershell
npm run mongo:rollback-test -- --testRunId=official-import-mongo-EXEMPLO
```

O que faz: restaura documentos Mongo atualizados em teste usando snapshots salvos antes do update.

Grava: sim, restaura documentos e marca snapshots como `rolled_back = true`.

Banco afetado: Mongo.

Mercado Livre: nao.

Quando usar: antes do cleanup, quando um write Mongo atualizou documentos existentes.

## mongo:seed:parte

Comando:

```powershell
npm run mongo:seed:parte -- --file "C:\caminho\parte.json"
```

O que faz: popula/upserta referencias na collection `parte`.

Grava: sim.

Banco afetado: Mongo.

Mercado Livre: nao.

Quando usar: preparar cobertura de categoria.

## mongo:check:parte

Comando:

```powershell
npm run mongo:check:parte -- --file "C:\Users\danye\Downloads\concordia_20.csv"
```

O que faz: mede cobertura da collection `parte` para uma planilha.

Grava: nao.

Banco afetado: leitura Mongo.

Mercado Livre: nao.

Quando usar: decidir se write Mongo pode seguir sem `category_pending`.

## test

Comando:

```powershell
npm test
```

O que faz: roda testes automatizados.

Grava: nao deve gravar em bancos reais.

## TypeScript

Comando:

```powershell
npx tsc --noEmit --project tsconfig.json --pretty false
```

O que faz: valida tipos.

Grava: nao deve gerar artefatos versionados.
