import type { Collection, Document, Filter, UpdateFilter } from 'mongodb';

export const PARTE_SEED_SOURCE = 'mongo_reference_seed';

export interface ParteSeedValidation {
  valid: boolean;
  errors: string[];
  hasMlbCategoryId: boolean;
}

export interface ParteSeedReport {
  file: string;
  read: number;
  valid: number;
  inserted: number;
  updated: number;
  ignored: number;
  withoutMlbCategoryId: number;
  errors: Array<{ index: number; errors: string[] }>;
}

export const parseParteJson = (content: string): Document[] => {
  const parsed = JSON.parse(content);
  if (Array.isArray(parsed)) {
    return parsed.filter((item): item is Document => item && typeof item === 'object' && !Array.isArray(item));
  }

  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.documents)) {
    return parsed.documents.filter((item: unknown): item is Document =>
      item && typeof item === 'object' && !Array.isArray(item)
    );
  }

  throw new Error('JSON de parte invalido: esperado array ou objeto com documents[].');
};

const hasValue = (value: unknown): boolean =>
  value !== null && value !== undefined && String(value).trim() !== '';

export const validateParteDocument = (doc: Document): ParteSeedValidation => {
  const errors: string[] = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    errors.push('documento invalido');
  }

  if (!hasValue(doc.MLB_categoria_id) && !hasValue(doc._id)) {
    errors.push('MLB_categoria_id ou _id obrigatorio para upsert');
  }

  return {
    valid: errors.length === 0,
    errors,
    hasMlbCategoryId: hasValue(doc.MLB_categoria_id),
  };
};

export const buildParteUpsertFilter = (doc: Document): Filter<Document> => {
  if (hasValue(doc.MLB_categoria_id)) {
    return { MLB_categoria_id: doc.MLB_categoria_id };
  }
  return { _id: doc._id };
};

export const buildParteSeedUpdate = (
  doc: Document,
  seededAt: Date
): UpdateFilter<Document> => ({
  $set: {
    ...doc,
    'metadata.seeded_by': PARTE_SEED_SOURCE,
    'metadata.seeded_at': seededAt,
  },
});

export const seedParteDocuments = async (
  collection: Pick<Collection<Document>, 'updateOne'>,
  docs: Document[],
  options: {
    file: string;
    seededAt?: Date;
  }
): Promise<ParteSeedReport> => {
  const report: ParteSeedReport = {
    file: options.file,
    read: docs.length,
    valid: 0,
    inserted: 0,
    updated: 0,
    ignored: 0,
    withoutMlbCategoryId: 0,
    errors: [],
  };
  const seededAt = options.seededAt ?? new Date();

  for (const [index, doc] of docs.entries()) {
    const validation = validateParteDocument(doc);
    if (!validation.hasMlbCategoryId) report.withoutMlbCategoryId += 1;

    if (!validation.valid) {
      report.ignored += 1;
      report.errors.push({ index, errors: validation.errors });
      continue;
    }

    report.valid += 1;
    const result = await collection.updateOne(
      buildParteUpsertFilter(doc),
      buildParteSeedUpdate(doc, seededAt),
      { upsert: true }
    );

    if (result.upsertedCount && result.upsertedCount > 0) {
      report.inserted += result.upsertedCount;
    } else if (result.matchedCount && result.matchedCount > 0) {
      report.updated += 1;
    }
  }

  return report;
};
