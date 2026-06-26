# Mongo Bootstrap V1 - Schema real do n8n

Este documento registra o alvo inicial do MongoDB Atlas para o laboratorio paralelo do DriveParts.
Ele nao muda a importacao oficial, os adapters Supabase, o Location Resolver, Review, Inbox,
Historico, Catalogo Preview, Marketplace ou parser oficial.

## Ordem de uso do fluxo n8n

1. `parte`: consulta de categoria/peca base, principalmente por `MLB_categoria_id`.
2. `storage_locations`: consulta/criacao logica de localizacao por `store_id`, `name` e `status`.
3. `inventory_items`: busca e cadastro da peca da loja.
4. `mercado_livre_brasil_anuncio`: busca de anuncio por integracao e MLB.

As collections operacionais do novo sistema sao `import_runs` e `import_run_items`.

## Decisao oficial sobre anuncios

No Mongo, a collection alvo e `mercado_livre_brasil_anuncio`.
O nome `marketplace_ads` pode continuar existindo no Supabase ate uma migracao futura, mas nao deve
ser usado como nome principal no Mongo.

## Diferencas de ID

Mongo usa `_id`.
Supabase usa `id`.
O dominio interno usa `id`.
Adapters futuros devem converter `_id` para `id` na leitura e `id` para `_id` apenas quando for
necessario enderecar documentos do Mongo.

## Collections e indices

### parte

Campos criticos: `_id`, `idInt`, `nome`, `MLB_categoria_id`, `nome_abreviado`, `posicao`,
`altura`, `largura`, `comprimento`, `peso`, `foto`, `catalogo_attributes`, `shopee_attributes`,
`shopee_category_id`, `shopee_brand_id`, `vehicle_type`, `compatibilities_restrictions`,
`images`, `image_count`, `search_name_ngrams`.

Indices:

- `{ MLB_categoria_id: 1 }`
- `{ nome: 1 }`
- `{ idInt: 1 }`
- `{ nome_abreviado: 1 }`

### storage_locations

Campos criticos: `_id`, `id`, `store_id`, `name`, `abbreviation`, `description`, `status`,
`created_by`, `created_at`, `updated_at`, `stock_capacity`, `volume_total`, `quantity_pieces`,
`volume_used`, `quantity_max_pieces`, `vehicle_brand_ids`, `part_category_ids`,
`search_name_ngrams`, `location_path_names`, `location_path_slugs`, `location_path_key`,
`location_path_prefixes`, `location_path_text`, `location_path_depth`,
`location_path_character_count`, `storage_location_type_id`, `storage_location_type_name`,
`path`, `path_ids`, `path_text`, `path_items`, `level`, `rule_overrides`,
`combined_quantity_pieces`, `combined_volume_used`, `inferred_quantity_pieces`,
`inferred_volume_used`.

Indices:

- `{ store_id: 1, name: 1, status: 1 }`
- `{ store_id: 1, location_path_key: 1 }`
- `{ store_id: 1, path_text: 1 }`
- `{ store_id: 1, location_path_text: 1 }`
- `{ store_id: 1, status: 1 }`

### inventory_items

Campos criticos: `_id`, `id`, `store_id`, `id_int`, `id_string`, `code`, `tag_code`,
`identifier_search_keys`, `marketplace_name`, `marketplace_name_normalized`,
`vehicle_brand_name`, `vehicle_model_name`, `vehicle_year`, `stock_quantity`, `price`,
`marketplace_price`, `use_default_price`, `deleted`, `deleted_at`, `status`,
`part_category_id`, `part_category_name`, `mercado_libre_brasil_category_id`,
`catalog_attributes`, `shopee_attributes`, `compatibilities_restrictions`,
`shopee_category_id`, `shopee_brand_id`, `vehicle_type`, `storage_location_id`,
`storage_location_name`, `storage_location_source`, `integrations`, `images`, `image_ids`,
`image_count`, `main_image_id`, `package_height`, `package_length`, `package_width`,
`package_weight`, `description`, `description_template`, `created_at`, `updated_at`.

Indices:

- `{ store_id: 1, id_int: 1 }`
- `{ store_id: 1, id_string: 1 }`
- `{ store_id: 1, code: 1 }`
- `{ store_id: 1, tag_code: 1 }`
- `{ store_id: 1, identifier_search_keys: 1 }`
- `{ store_id: 1, status: 1 }`
- `{ store_id: 1, deleted: 1 }`
- `{ store_id: 1, storage_location_id: 1 }`
- `{ store_id: 1, part_category_id: 1 }`
- `{ store_id: 1, mercado_libre_brasil_category_id: 1 }`
- `{ store_id: 1, marketplace_name_normalized: 1 }`
- `{ store_id: 1, primary_anuncio_mlb_id: 1 }`

### mercado_livre_brasil_anuncio

Campos criticos: `_id`, `integration_id`, `peca_id`, `loja_id`, `mlb_id`, `data`,
`data.id`, `data.title`, `data.category_id`, `data.price`, `data.available_quantity`,
`data.status`, `data.permalink`, `data.pictures`, `data.attributes`, `data.thumbnail`,
`data.date_created`, `data.last_updated`.

O n8n procura por `mlb_id` ou `data.id`. O adapter Mongo futuro deve gravar ambos sempre que possivel:
`mlb_id = data.id`.

Indices:

- `{ integration_id: 1, mlb_id: 1 }`
- `{ integration_id: 1, "data.id": 1 }`
- `{ loja_id: 1, peca_id: 1 }`
- `{ loja_id: 1, integration_id: 1 }`
- `{ loja_id: 1, "data.status": 1 }`
- `{ loja_id: 1, "data.last_updated": -1 }`
- `{ peca_id: 1 }`

### import_runs

Indices:

- `{ store_id: 1, created_at: -1 }`
- `{ status: 1, created_at: -1 }`
- `{ file_name: 1 }`
- `{ created_at: -1 }`

### import_run_items

Indices:

- `{ run_id: 1, row: 1 }`
- `{ run_id: 1, status: 1 }`
- `{ run_id: 1, type: 1 }`
- `{ store_id: 1, created_at: -1 }`
- `{ peca_id: 1 }`
- `{ mlb_id: 1 }`
