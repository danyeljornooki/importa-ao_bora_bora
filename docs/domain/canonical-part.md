# CanonicalPart

## Validacao runtime e shapes de persistencia

`validateCanonicalPart` verifica invariantes minimas do dominio sem substituir
o `validatePart` da Import Engine atual.

A validacao exige:

- `identity.storeId`;
- `identity.title`;
- preco numerico maior ou igual a zero;
- estoque inteiro maior ou igual a zero;
- pelo menos um identificador entre `idInt`, `idString`, `code` ou
  `marketplaceId`;
- URLs de imagem com protocolo HTTP ou HTTPS;
- `marketplace` e `marketplaceId` em cada vinculo;
- status calculado ou informado.

Ausencia de imagens, ausencia de vinculos de marketplace e ausencia de
`integrationId` em um vinculo sao warnings, nao erros da peca.

`toSupabaseInventoryShape` converte o dominio para o shape atualmente esperado
por `inventory_items`. O mapper cobre identidade, valores comerciais,
localizacao, descricao, categorias, veiculo, dimensoes, imagens e integracoes.
Imagens sao convertidas para objetos:

```ts
{
  url,
  thumbnail_url,
  source,
  ordem
}
```

`toMongoInventoryShape` continua representando o shape historico do inventario
Mongo. Nenhum dos dois mappers esta conectado a persistencia nesta etapa.

`CanonicalPart` descreve o significado da peca. `SupabaseInventoryShape` e
`MongoInventoryShape` descrevem formatos de armazenamento. O dominio nao
conhece tabelas, clientes de banco ou contratos de Supabase, Mongo e Symfony.

Quando um vinculo possui `integrationId`, ele e usado na chave de integracoes.
Quando nao possui, o fallback e `${marketplace}:${marketplaceId}`, sem inventar
um identificador operacional.

A pagina `/dev/canonical-part` apresenta o resultado da validacao, os dois
shapes e a comparacao dos principais campos. Ela trabalha somente em memoria e
nao altera o fluxo oficial.

`CanonicalPart` é o modelo de domínio oficial de uma peça na DriveParts. Ele
representa a peça sem depender do formato da planilha, das tabelas do Supabase,
dos documentos do Mongo, de contratos do Symfony ou de respostas de
marketplaces.

O modelo existe para fornecer uma linguagem comum entre importação, catálogo,
estoque, integrações e futuras migrações. Nesta etapa ele é apenas uma camada de
tipos e mapeadores auxiliares. O Import Engine e os adapters ainda não dependem
dele.

## Princípio central

A peça é o centro do domínio. Anúncios de marketplace e imagens são
complementos. A ausência ou falha de um complemento não elimina a identidade,
os dados comerciais ou a organização da peça.

## Campos obrigatórios

Uma `CanonicalPart` sempre contém:

- `identity`, incluindo `storeId` e `title`;
- `commercial`, incluindo estoque, preço e status;
- `organization`;
- `content`;
- listas `marketplace` e `images`, mesmo quando vazias;
- `metadata`.

Veículo, categoria e dimensões são grupos opcionais e podem ser `null`.

## Campos opcionais

Identificadores legados, código, SKU, localização, descrição, preço de
marketplace, atributos de catálogo, datas e dados brutos são opcionais. Essa
flexibilidade permite representar registros incompletos sem misturar ausência
de complemento com invalidade da peça.

## 1. Identidade

`PartIdentity` reúne a identidade estável e os identificadores usados pelos
sistemas atuais:

- ID interno do registro;
- loja;
- `idInt` e `idString`;
- código, SKU e tag;
- título e nome de marketplace.

`storeId` e `title` são obrigatórios. Mapeadores podem usar código ou nome de
marketplace como fallback de título quando a origem não possuir um título
explícito.

## 2. Comercial

`PartCommercial` contém:

- quantidade em estoque;
- preço principal;
- preço de marketplace;
- status;
- indicação de preço padrão.

O status pode preservar valores legados, mas os mapeadores calculam
`DISPONIVEL` ou `SEM_ESTOQUE` quando a origem não informa um valor.

## 3. Organização

`PartOrganization` contém a localização física da peça e marcadores
organizacionais. `locationId` representa o identificador da localização e
`locationName` sua descrição legível.

## 4. Conteúdo

`PartContent` contém descrição e atributos de catálogo. Esses campos enriquecem
a peça, mas não definem sua identidade.

## 5. Marketplace

Cada `PartMarketplaceLink` representa um vínculo com um canal externo, como
Mercado Livre ou Shopee. O vínculo pode conter integração, ID externo, status,
permalink, título, preço, estoque e resposta bruta.

Anúncios são complementos. Um anúncio pausado, inexistente ou inacessível não
deve invalidar a peça.

## 6. Imagens

Cada `PartImage` possui URL, origem e ordem opcional. As origens conhecidas são:

- `mercado_livre`;
- `sheet`;
- `upload`;
- `system`.

Imagens também são complementos. Uma peça canônica pode ter `images: []`.

## 7. Veículo

`PartVehicle` agrupa marca, modelo, ano e tipo do veículo associado. O grupo é
opcional porque nem todas as origens fornecem essas informações.

## 8. Categoria

`PartCategory` agrupa a categoria interna e IDs de categoria específicos de
marketplaces. IDs externos não substituem a categoria interna.

## 9. Pesos e medidas

`PartDimensions` representa altura, comprimento, largura e peso do pacote.
Todos os campos são opcionais e não possuem unidade implícita no domínio atual;
a unidade deverá ser formalizada antes de uso operacional.

## 10. Metadata

`PartMetadata` registra a origem, linha da planilha, datas e conteúdo bruto.
Metadata auxilia auditoria e rastreabilidade, mas não deve ser usada como fonte
principal para regras comerciais.

## Relação com a planilha

`fromPartCanonical` converte o modelo normalizado atual da planilha para
`CanonicalPart`. URLs da planilha viram imagens com origem `sheet`, e `mlb_ids`
viram vínculos de Mercado Livre.

A planilha continua sendo normalizada por `PartCanonical`; essa etapa não altera
o normalizador existente.

## Relação com Supabase

`fromExistingInventoryItem` converte o formato atualmente carregado de
`inventory_items`. O mapeador aceita campos adicionais presentes em registros
mais completos, sem exigir mudanças no adapter.

O modelo canônico não representa o schema físico do Supabase e não deve ser
persistido diretamente sem um mapper de saída específico.

## Relação com Mongo

`toMongoInventoryShape` produz um objeto semelhante ao formato histórico do
inventário principal. Ele existe para documentação, testes e evolução futura.
Ainda não é usado pela persistência.

## Relação com Symfony

O Symfony poderá consumir ou produzir `CanonicalPart` por meio de mapeadores
próprios. O domínio não pressupõe endpoints, entidades ou nomes de campos do
Symfony.

## Relação com Marketplace

Marketplaces são representados por `PartMarketplaceLink`. Dados específicos do
canal ficam no vínculo ou em `raw`, evitando espalhar contratos externos pelos
dados centrais da peça.

O array de vínculos pode estar vazio. A peça continua válida e utilizável sem
anúncio.
