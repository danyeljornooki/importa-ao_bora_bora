# Codebase Map

Este documento classifica as principais areas do projeto para separar codigo oficial, experimento controlado, laboratorio, debug local, legado e candidatos futuros a remocao.

## OFICIAL

Codigo usado no fluxo principal do produto.

- `src/app/importacoes/pecas/`: tela oficial de importacao de pecas. Continua usando Supabase como destino padrao.
- `src/engine/runImport.ts`: dry run/plano oficial. Faz parse, normalize, validate, match, compare e monta plano de execucao.
- `src/engine/executePartImportWithComplements.ts`: commit oficial Supabase com historico, localizacao, anuncios e imagens.
- `src/modules/importer/parseImportFile.ts`: parser oficial.
- `src/core/importer/normalize/` e `src/modules/importer/normalizePart.ts`: normalizacao.
- `src/core/importer/validate/` e `src/modules/importer/validators/`: validacao.
- `src/core/importer/matching/` e `src/modules/importer/matchers/`: matching.
- `src/planners/buildExecutionPlan.ts`: plano de persistencia.
- `src/adapters/supabase/`: adapters oficiais Supabase.
- `src/app/importacoes/historico/`: historico oficial.
- `src/app/revisao/`: review.
- `src/app/inbox/`, quando presente: inbox operacional.
- `src/app/catalogo-preview/` e `src/features/catalog-preview/`: preview read-only de catalogo.

## EXPERIMENTAL_CONTROLADO

Codigo pronto para teste controlado, mas nao e padrao de producao.

- `src/engine/import-targets/types.ts`: contrato comum de target.
- `src/engine/import-targets/selectImportTarget.ts`: selecao de target com fallback Supabase.
- `src/engine/import-targets/officialImportWithTarget.ts`: executor oficial com target opcional.
- `src/engine/import-targets/mongo/mongoImportTarget.ts`: target Mongo.
- `src/engine/import-targets/supabase/supabaseImportTarget.ts`: wrapper minimo Supabase para compatibilidade.
- `src/adapters/mongo/`: suporte Mongo por area.

## LAB

Ferramentas operacionais e de validacao. Podem consultar bancos e Mercado Livre via GET, conforme comando.

- `scripts/imports/mongoReal20Parts.ts`: importacao controlada Mongo.
- `scripts/imports/runOfficialImportWithTarget.ts`: CLI oficial com target.
- `scripts/imports/compareImportTargets.ts`: comparador Supabase x Mongo.
- `scripts/mongo/bootstrapMongo.ts`: bootstrap de schema/indices Mongo.
- `scripts/mongo/cleanupMongoTestRun.ts`: cleanup seguro por `testRunId`.
- `scripts/mongo/seedMongoParteFromJson.ts`: seed da collection `parte`.
- `scripts/mongo/checkMongoParteCoverage.ts`: diagnostico de cobertura de categoria.
- `src/engine/import-targets/compare/`: normalizacao e comparacao de planos/enrichment.

## DEBUG_LOCAL

Nao faz parte do fluxo oficial.

- `src/app/mongo-test/`: tela local/debug para Mongo. Nao deve entrar no menu oficial.
- `src/app/test-import/`: tela tecnica de teste. Deve ficar protegida/escondida por flag quando aplicavel.
- `src/app/dev/`: rotas tecnicas/dev, quando presentes.

## LEGACY

Arquivos mantidos por compatibilidade ou transicao.

- `src/engine/executeImportWithHistory.ts`: executor antigo com historico simples.
- `src/services/importEngine.ts`: wrapper/export de compatibilidade.
- `src/modules/importer/parseExcel.ts`: parser legado enquanto houver dependencia historica.
- `src/adapters/mongo/inventory/mongoInventoryAdapter.ts`: adapter Mongo read-only antigo para API/debug.
- `src/adapters/mongo/inventory/mongoInventoryClientAdapter.ts`: adapter client-side read-only para debug.

## DEPRECATED / CANDIDATOS A REMOCAO FUTURA

Nao remover sem nova validacao.

- `src/modules/importer/parseExcel.ts`, se nenhum fluxo oficial usar.
- Telas tecnicas de teste, se substituidas por scripts/rotas oficiais.
- Wrappers antigos apos consolidar `executeOfficialImportWithTarget`.

