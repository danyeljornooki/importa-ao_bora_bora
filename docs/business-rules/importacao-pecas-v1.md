# Importação de Peças v1

Este documento consolida as regras de negócio atuais do módulo Importação de
Peças v1. Ele descreve o comportamento implementado e deve ser tratado como
referência para correções que não pretendam mudar a regra de negócio.

## Princípio central

A peça é a entidade principal da importação.

Anúncios de marketplace e imagens são complementos. Problemas nesses
complementos não devem transformar uma peça válida em uma linha inválida nem
impedir a criação ou atualização da peça.

## Fluxo geral

O fluxo oficial é composto pelas seguintes etapas:

1. informar um `integration_id`;
2. resolver o contexto operacional da integração;
3. selecionar e analisar a planilha;
4. produzir o dry run e o execution plan;
5. revisar ações e pendências;
6. executar o commit parcial;
7. processar AdLink e ImagePlan;
8. salvar o histórico da execução e seus resultados por linha.

## Contexto por integration_id

O usuário informa o `integration_id`. A autenticação da integração resolve um
`ImportExecutionContext` contendo, entre outros dados:

- `integrationId`;
- `storeId`;
- canal;
- nome da integração;
- credenciais e usuário do marketplace, quando disponíveis.

O `storeId` delimita a carga e a escrita de inventário. O `integrationId`
identifica a integração utilizada pelos complementos de marketplace.

## Dry run

O dry run:

- lê e normaliza a planilha;
- valida os dados da peça;
- carrega o inventário atual da loja;
- encontra correspondências;
- compara campos;
- monta o ImportPlan e o ExecutionPlan;
- não grava peças, anúncios ou histórico de commit.

O resultado do dry run é reutilizado pelo commit oficial. A intenção é executar
as mesmas decisões que foram apresentadas para revisão.

## Decisões por linha

Cada linha recebe uma decisão principal:

- `create`: criar uma peça;
- `update`: atualizar uma peça existente;
- `skip`: não há alteração necessária;
- `conflict`: há uma correspondência ambígua ou possível duplicidade;
- `invalid`: há erro real nos dados obrigatórios da peça.

Conflitos e linhas inválidas não impedem que outras linhas sejam executadas.

## Commit parcial

O commit é parcial e executado por linha.

Uma falha de criação ou atualização:

- é registrada no resultado da linha;
- incrementa a métrica de falhas da peça;
- não interrompe automaticamente as demais ações.

Não existe garantia transacional única para toda a planilha. Peças persistidas
antes de uma falha posterior permanecem persistidas.

## Update por patch

Atualizações usam patches construídos somente a partir dos campos identificados
como alterados. O patch atual pode incluir:

- preço e preço de marketplace;
- estoque e status;
- localização;
- título e nome normalizado;
- descrição;
- código;
- `id_int`;
- identificador MLB legado em `id_string`.

O update oficial é escopado pelo ID da peça e pelo `storeId` quando o contexto
está disponível.

## AdLink como complemento

Após o resultado principal da peça, linhas elegíveis com `mlb_ids` tentam
resolver e registrar o anúncio.

O AdLink:

- consulta o item individual por MLB;
- aceita anúncios existentes independentemente do status;
- trata status diferente de `active` como informação ou warning;
- verifica conflitos no registry `marketplace_ads`;
- insere ou atualiza o snapshot do anúncio quando aplicável.

Falhas de acesso, ausência do anúncio, conflito ou falha do registry não alteram
o resultado principal da peça.

## MLB inválido não bloqueia peça

Formato inválido de MLB gera warning da importação. Durante o complemento, o
resultado pode ficar `pending`, `failed`, `conflict` ou `invalid`, conforme o
caso.

Em particular:

- HTTP 403 indica ausência de acesso pelo token da integração;
- HTTP 404 indica anúncio não encontrado ou removido;
- status `paused`, `under_review`, `closed`, `inactive` e similares não
  invalidam um item retornado com sucesso.

## ImagePlan

O plano de imagens é apenas descritivo. Ele não baixa nem persiste imagens.

A prioridade é:

1. imagens do anúncio Mercado Livre;
2. URLs de imagem da planilha;
3. nenhuma imagem.

Os resultados esperados são:

- `used_ml`;
- `used_sheet`;
- `no_image`;
- `failed`, `pending` ou `skipped` quando aplicável.

URLs são deduplicadas pelo planejador.

## Pendências complementares

Pendências da peça e pendências complementares são métricas separadas.

Pendência principal da peça considera:

- `conflict`;
- `invalid`;
- falha de persistência da peça.

`Complement Pending` considera:

- AdLink `pending`;
- AdLink `conflict`;
- AdLink `invalid`;
- ImagePlan `failed`;
- ImagePlan `pending`.

Uma pendência complementar não deve ser apresentada como falha da peça.

## Histórico e import_run_items

Cada commit cria um registro em `import_runs`.

Os resultados por linha são salvos em `import_run_items`. O `payload` do item
inclui:

- `partResult`;
- `adLinkResult`;
- `imagePlan`.

O histórico principal continua usando a ação da peça como ação da linha.
Warnings e erros complementares ficam disponíveis dentro do payload e das
coleções de warnings.

O resumo do run inclui:

- métricas de análise;
- métricas de persistência;
- métricas dos complementos.

## Operações em massa

Operações em massa devem partir de um `ExecutionPlan` explícito.

O plano deve:

- enumerar a ação de cada linha;
- conter payload somente para ações executáveis;
- preservar `targetId` para updates;
- impedir que `conflict` e `invalid` sejam tratados como escrita;
- permitir progresso e relatório por linha.

Não devem ser criados fluxos paralelos que atualizem o inventário diretamente
com base nas linhas brutas da planilha.

## CanonicalPart e ExecutionContext

`CanonicalPart` representa o domínio da peça. Ele não conhece o
`integrationId` operacional usado para executar uma importação.

Vínculos de marketplace dentro da peça podem possuir um identificador de
integração como dado do vínculo, mas o modelo canônico não define qual
integração está ativa para uma operação.

`ImportExecutionContext` conhece o `integrationId`. Ele representa o contexto
da execução atual e contém também `storeId`, canal e credenciais necessárias.

Em resumo:

- `CanonicalPart`: o que a peça é;
- `ImportExecutionContext`: em qual contexto a operação acontece.
