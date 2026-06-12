# Estado atual da arquitetura

Este documento registra o estado atual dos módulos relacionados à Importação de
Peças v1 e ao domínio de peças.

## Módulos prontos

### Importação de Peças v1

- autenticação e resolução de contexto por `integration_id`;
- leitura de planilha;
- normalização para `PartCanonical`;
- validação da peça;
- matching com inventário existente;
- comparação de campos;
- ImportPlan e ExecutionPlan;
- dry run;
- commit parcial;
- criação e update por patch;
- resultado de persistência por linha;
- escopo de update por `storeId` no fluxo oficial.

### Complementos

- resolução individual de MLB;
- consulta de anúncio sem filtro de status;
- warnings para anúncios não ativos;
- registry `marketplace_ads`;
- inserção e atualização de snapshots;
- detecção de conflito de vínculo;
- ImagePlan com prioridade ML, planilha e nenhuma imagem;
- métricas e relatório de pendências complementares.

### Histórico

- criação e conclusão de `import_runs`;
- persistência de `import_run_items`;
- `partResult`, `adLinkResult` e `imagePlan` no payload;
- resumo de importação, persistência e complementos;
- consulta, filtros e exportação das pendências principais.

### Domínio canônico

- tipos de `CanonicalPart`;
- mapper `PartCanonical -> CanonicalPart`;
- mapper `ExistingInventoryItem -> CanonicalPart`;
- mapper `CanonicalPart -> MongoInventoryShape`;
- página técnica `/dev/canonical-part`;
- documentação do modelo canônico.

## Módulos congelados

Os itens abaixo representam decisões atuais que não devem ser alteradas sem uma
mudança explícita de regra:

- peça como entidade principal;
- anúncios e imagens como complementos;
- MLB inválido não bloqueia peça válida;
- ausência de imagem não bloqueia peça;
- dry run antes do commit;
- commit parcial;
- conflitos e inválidos não são persistidos como peças;
- update de inventário por patch;
- ImagePlan não baixa nem salva imagens;
- importação não cria nem altera anúncios no Mercado Livre;
- operações em massa passam por ExecutionPlan;
- Import Engine ainda utiliza `PartCanonical`, não `CanonicalPart`;
- adapters atuais continuam usando seus contratos próprios.

## Módulos futuros

- migração gradual do Import Engine para `CanonicalPart`;
- mapper oficial `CanonicalPart -> SupabaseInventoryShape`;
- mapper oficial `CanonicalPart -> Symfony`;
- mapper completo de documentos Mongo para `CanonicalPart`;
- persistência e processamento assíncrono de imagens;
- fila de retry para complementos pendentes;
- reconciliação automática do registry de anúncios;
- versionamento formal do schema canônico;
- validação runtime do domínio canônico;
- unidades formais para peso e dimensões;
- testes automatizados de integração e contratos de adapters.

## Riscos conhecidos

### Ausência de transação global

O commit é parcial. Uma falha no histórico ou em etapas posteriores pode ocorrer
depois de peças já terem sido persistidas.

### Histórico separado da escrita da peça

Peças e `import_run_items` não são gravados em uma única transação. Uma falha ao
salvar o histórico pode deixar o run como falho mesmo com alterações aplicadas.

### Compatibilidade entre shapes

Supabase, Mongo, planilha e domínio canônico ainda possuem contratos distintos.
Os mapeadores reduzem a divergência, mas ainda não são usados pelo pipeline
principal.

### Campos legados de marketplace

`id_string`, `primary_anuncio_mlb_id`, `mlb_ids`, integrações embutidas e
`marketplace_ads` coexistem. Regras de precedência precisam permanecer
explícitas durante a migração.

### Complementos síncronos

AdLink é processado durante o commit. Lentidão ou indisponibilidade externa não
impede a peça, mas aumenta o tempo total e pode gerar muitas pendências.

### Métricas derivadas

As métricas de complementos são derivadas do resultado em memória. Mudanças nos
estados permitidos exigem atualização coordenada dos tipos, resumo e UI.

### Tipagem permissiva

Alguns contratos aceitam `unknown`, campos opcionais e shapes legados. O
TypeScript garante a estrutura estática, mas não substitui validação runtime de
JSON externo.

## Próximos passos recomendados

1. Criar testes unitários dos mapeadores de `CanonicalPart`.
2. Criar testes dos cinco cenários principais de importação e complementos.
3. Criar validação runtime versionada para o domínio canônico.
4. Formalizar o mapper Supabase sem trocar imediatamente a persistência.
5. Definir uma fila de retry para AdLink e imagens pendentes.
6. Tornar a gravação do histórico resiliente e idempotente.
7. Definir política de reconciliação entre identificadores MLB legados e
   `marketplace_ads`.
8. Formalizar unidades de dimensões e peso.
9. Planejar migração incremental do Import Engine para `CanonicalPart`.
10. Restringir ferramentas `/dev` no ambiente de produção por configuração de
    deploy ou autorização.
