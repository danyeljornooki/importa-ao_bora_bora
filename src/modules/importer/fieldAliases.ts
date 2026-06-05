export const fieldAliases = {
  code: [
    'code',
    'sku',
    'codigo',
    'código',
    'codigo da peça',
    'código da peça',
    'etiqueta',
    'idpeca',
    'numero produto',
    'numero_produto',
  ] as const,
  location: [
    'location',
    'localizacao',
    'localização',
    'local',
    'posição',
    'posicao',
    'endereco',
  ] as const,
  title: [
    'titulo',
    'título',
    'titulo ml',
    'nome',
    'produto',
    'title',
    'nome da peça',
  ] as const,
  stock_quantity: [
    'stock_quantity',
    'estoque',
    'quantidade',
    'qtd',
    'quantidade em estoque',
    'estoque no deposito',
    'quantidade_disponivel',
    'qtd_disponivel',
  ] as const,
  price: [
    'price',
    'preco',
    'preço',
    'valor',
  ] as const,
  description: [
    'description',
    'descricao',
    'descrição',
  ] as const,
  mlb_ids: [
    'mlb_ids',
    'codigo do anuncio',
    'código do anúncio',
    'codigo mbl',
    'código mbl',
    'mlb',
    'mlb_id',
  ] as const,
  image_urls: [
    'imagem',
    'imagens',
    'image',
    'images',
    'url da imagem',
    'url imagem',
    'url_imagem',
  ] as const,
  id_int: [
    'id_int',
    'id int',
    'idpeca',
    'id',
  ] as const,
} as const;

type AliasMap = typeof fieldAliases;

export type CanonicalField = keyof AliasMap;
export type FieldAliases = {
  readonly [K in CanonicalField]: readonly string[];
};

export const canonicalFieldKeys = Object.keys(fieldAliases) as CanonicalField[];
export const aliasesByField: FieldAliases = fieldAliases;
