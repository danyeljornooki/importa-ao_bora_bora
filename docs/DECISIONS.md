# Decisions

## Supabase continua padrao

Chamadas antigas e tela oficial continuam usando Supabase como destino padrao.

## Mongo exige target explicito

Mongo so deve ser usado quando `target=mongo` for informado explicitamente.

## Dry run nunca grava

Dry run pode consultar dados, mas nao deve criar/atualizar:

- pecas;
- localizacoes;
- anuncios;
- import_runs;
- import_run_items.

## Mercado Livre sem escrita nos testes

Fluxos Mongo, laboratorio e comparador podem fazer GET no Mercado Livre.

Nao podem chamar endpoints de escrita.

## Mongo Lab visual nao e oficial

Telas de debug Mongo nao entram na navegacao oficial e nao devem ser tratadas como produto.

## category_pending bloqueia write em caso de cobertura zero

Se Mongo nao tem cobertura em `parte`, write deve bloquear, exceto com decisao explicita:

```txt
allowCategoryPending = true
```

## Cleanup remove creates, nao reverte updates

Cleanup por `testRunId` remove documentos criados em teste.

Ele nao restaura documentos preexistentes atualizados.

## Proximo passo futuro

Criar rollback por snapshot para updates Mongo controlados.

