/**
 * Campos extras do caminho de escrita no Mongo de produção (Drive Parts).
 *
 * Cobre duas demandas (planejadas em comparacao_dados/PLANO_LOCALIZACAO_E_DEMANDAS.md):
 *   1. Rastreio de importação: marca a peça como importada pela nossa rotina + quando.
 *   2. Imagens pendentes SEM FTP: no import só guardamos os LINKS + um flag "pendente";
 *      um robô separado depois varre as peças pendentes, baixa e preenche `images`.
 *
 * Lógica PURA e composável — não toca em banco nem adapter. O timestamp é injetado pelo
 * chamador (`new Date().toISOString()` em produção; string fixa nos testes) para manter
 * o build determinístico/testável.
 */

export const DEFAULT_IMPORT_SOURCE = 'planilha';

export interface ImportTrackingInput {
  /** Origem do import. Default: 'planilha'. */
  source?: string | null;
  /** Momento do import em ISO 8601. Gerado no commit (clock injetável). Obrigatório. */
  importedAt: string;
  /** Liga a peça ao lote/rodada de importação. Opcional. */
  jobId?: string | null;
}

export interface ImportTrackingFields {
  import_source: string;
  imported_at: string;
  import_job_id?: string;
}

export interface PendingImagesInput {
  /** URLs cruas vindas da planilha/ML. Valores vazios/duplicados são descartados. */
  imageUrls?: Array<string | null | undefined> | null;
  /** Momento em que as pendências foram registradas, em ISO. Opcional. */
  pendingAt?: string | null;
  /** Origem das imagens pendentes ('planilha' | 'ml'). Opcional. */
  source?: string | null;
}

export interface PendingImagesFields {
  /** Sempre vazio no import — o robô preenche depois ao baixar. */
  images: never[];
  image_count: 0;
  pending_image_urls: string[];
  images_pending: boolean;
  images_pending_count: number;
  images_pending_at?: string;
  images_pending_source?: string;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

const cleanUrls = (
  urls: Array<string | null | undefined> | null | undefined
): string[] => {
  if (!Array.isArray(urls)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of urls) {
    if (!isNonEmptyString(raw)) continue;
    const url = raw.trim();
    if (seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }
  return result;
};

/** Demanda 1 — campos de rastreio de import (aplicados SÓ no CREATE). */
export const buildImportTrackingFields = (
  input: ImportTrackingInput
): ImportTrackingFields => {
  if (!isNonEmptyString(input?.importedAt)) {
    throw new Error('importedAt (ISO) obrigatorio para buildImportTrackingFields');
  }

  const fields: ImportTrackingFields = {
    import_source: isNonEmptyString(input.source)
      ? input.source.trim()
      : DEFAULT_IMPORT_SOURCE,
    imported_at: input.importedAt,
  };

  if (isNonEmptyString(input.jobId)) {
    fields.import_job_id = input.jobId.trim();
  }

  return fields;
};

/**
 * Demanda 2 — campos de imagens pendentes (sem FTP).
 * `images` fica vazio no import; o robô move pending → images ao baixar.
 */
export const buildPendingImagesFields = (
  input: PendingImagesInput = {}
): PendingImagesFields => {
  const urls = cleanUrls(input.imageUrls);

  const fields: PendingImagesFields = {
    images: [],
    image_count: 0,
    pending_image_urls: urls,
    images_pending: urls.length > 0,
    images_pending_count: urls.length,
  };

  if (urls.length > 0) {
    if (isNonEmptyString(input.pendingAt)) {
      fields.images_pending_at = input.pendingAt;
    }
    if (isNonEmptyString(input.source)) {
      fields.images_pending_source = input.source.trim();
    }
  }

  return fields;
};

export type MongoImportExtras = ImportTrackingFields & PendingImagesFields;

export interface MongoImportExtrasInput {
  tracking: ImportTrackingInput;
  images?: PendingImagesInput;
}

/** Conveniência: junta os campos das duas demandas para um CREATE no shape Mongo. */
export const buildMongoImportExtras = (
  input: MongoImportExtrasInput
): MongoImportExtras => ({
  ...buildImportTrackingFields(input.tracking),
  ...buildPendingImagesFields(input.images ?? {}),
});

export default buildMongoImportExtras;
