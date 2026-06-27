# Import Flow

## 1. Parse

O arquivo e lido por `parseImportFile`.

Formatos suportados dependem do parser oficial atual. O parser entrega linhas cruas e nome da aba/arquivo.

## 2. Normalize

As linhas cruas passam por normalizacao para `PartCanonical`.

Campos importantes:

- `code`;
- `id_int`;
- `id_string`;
- `title`;
- `price`;
- `stock_quantity`;
- `location`;
- `mlb_ids`;
- `image_urls`.

## 3. Validate

Cada peca normalizada e validada.

Linhas invalidas entram no relatorio como `invalid` e nao devem ser gravadas.

## 4. Match

O matching compara a peca da planilha com inventario existente.

Resultado possivel:

- `create`;
- `update`;
- `skip`;
- `conflict`;
- `invalid`.

## 5. Plan

O import plan resume a decisao por linha.

O execution plan transforma a decisao em payload de persistencia.

## 6. Target

Targets disponiveis:

- `supabase`;
- `mongo`.

Sem target explicito, o fallback e Supabase.

## 7. Dry Run

Dry run nao grava documentos.

Ele pode consultar:

- inventario do target;
- referencias;
- Mercado Livre via GET, quando aplicavel.

## 8. Write

Write Supabase usa o fluxo oficial existente.

Write Mongo usa `mongoImportTarget` e exige target explicito.

## 9. import_runs

Registra a execucao da importacao.

Campos principais:

- `target`;
- `mode`;
- `storeId`;
- `integrationId`;
- contagens;
- status;
- metadata.

## 10. import_run_items

Registra cada linha processada.

Campos principais:

- `row`;
- `action`;
- `code`;
- `id_int`;
- `id_string`;
- `mlb_id`;
- `peca_id`;
- warnings;
- errors;
- raw;
- normalized.

## Warnings

Warnings importantes:

- `category_pending`;
- `location_pending`;
- `ad_no_access`;
- `ad_not_found`;
- `image_pending`;
- `no_image`;
- `possible_duplicate`;
- `conflict`.

