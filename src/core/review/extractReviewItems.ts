import type {
  ImportRun,
  ImportRunItem,
} from '../../types/importHistory.types';
import type {
  ReviewItem,
  ReviewItemSeverity,
  ReviewItemType,
  ReviewSummary,
} from '../../types/review.types';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;

const asText = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value).trim();

const optionalText = (value: unknown): string | null => {
  const text = asText(value);
  return text || null;
};

const includesAny = (value: unknown, terms: string[]): boolean => {
  const normalized = asText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return terms.some((term) => normalized.includes(term));
};

const firstMlbId = (
  payload: UnknownRecord | null,
  adLinkResult: UnknownRecord | null
): string | null => {
  const direct = optionalText(
    adLinkResult?.mlbId ??
    adLinkResult?.chosenMlbId ??
    payload?.id_string
  );
  if (direct) return direct;

  const values = payload?.mlb_ids;
  if (!Array.isArray(values)) return null;
  return values.map(optionalText).find(Boolean) ?? null;
};

const createReviewItem = (
  item: ImportRunItem,
  type: ReviewItemType,
  severity: ReviewItemSeverity,
  title: string,
  message: string,
  suffix: string = type
): ReviewItem => {
  const payload = asRecord(item.payload);
  const partResult = asRecord(payload?.partResult);
  const adLinkResult = asRecord(payload?.adLinkResult);

  return {
    id: `${item.id || `${item.runId}-${item.row}`}:${suffix}`,
    runId: item.runId,
    row: item.row,
    type,
    status: 'pending',
    severity,
    title,
    message,
    code: optionalText(payload?.code),
    idInt: payload?.id_int as number | string | null | undefined,
    mlbId: firstMlbId(payload, adLinkResult),
    pecaId: optionalText(partResult?.pecaId),
    targetId: item.targetId,
    payload: item.payload,
    rawItem: item,
    createdAt: item.createdAt,
  };
};

const importantWarning = (warning: string): boolean =>
  warning.trim() !== '';

const warningAlreadyRepresented = (
  warning: string,
  representedTypes: Set<ReviewItemType>
): boolean =>
  representedTypes.has('location_pending') &&
    includesAny(warning, ['location_pending', 'localizacao pendente', 'localização pendente']) ||
  representedTypes.has('possible_duplicate') &&
    includesAny(warning, ['duplicad', 'conflito']) ||
  representedTypes.has('no_image') &&
    includesAny(warning, ['sem imagem', 'no_image']) ||
  (
    representedTypes.has('ad_pending') ||
    representedTypes.has('ad_no_access') ||
    representedTypes.has('ad_not_found') ||
    representedTypes.has('ad_conflict')
  ) && includesAny(warning, ['anuncio', 'mlb', '403', '404', 'sem acesso']);

const summarize = (items: ReviewItem[]): ReviewSummary => {
  const byType: Record<string, number> = {};
  for (const item of items) {
    byType[item.type] = (byType[item.type] ?? 0) + 1;
  }

  return {
    total: items.length,
    pending: items.filter((item) => item.status === 'pending').length,
    warnings: items.filter((item) => item.severity === 'warning').length,
    errors: items.filter((item) => item.severity === 'error').length,
    byType,
  };
};

export const extractReviewItems = (input: {
  run: ImportRun;
  items: ImportRunItem[];
}): {
  summary: ReviewSummary;
  items: ReviewItem[];
} => {
  const reviewItems: ReviewItem[] = [];

  for (const item of input.items) {
    const payload = asRecord(item.payload);
    const adLinkResult = asRecord(payload?.adLinkResult);
    const imagePlan = asRecord(payload?.imagePlan);
    const representedTypes = new Set<ReviewItemType>();

    if (
      item.action === 'conflict' ||
      includesAny(item.reason, ['possivel peca duplicada'])
    ) {
      reviewItems.push(createReviewItem(
        item,
        'possible_duplicate',
        'warning',
        'Possível peça duplicada',
        'Possível peça duplicada. Revise antes de cadastrar novamente.'
      ));
      representedTypes.add('possible_duplicate');
    }

    if (item.action === 'invalid') {
      reviewItems.push(createReviewItem(
        item,
        'invalid_row',
        'error',
        'Linha inválida',
        item.reason || 'A linha possui dados inválidos e não foi importada.'
      ));
      representedTypes.add('invalid_row');
    }

    if (item.executionStatus === 'failed') {
      reviewItems.push(createReviewItem(
        item,
        'failed_row',
        'error',
        'Falha na execução',
        item.executionError || 'Falha ao executar a linha.'
      ));
      representedTypes.add('failed_row');
    }

    const adAction = asText(adLinkResult?.action).toLowerCase();
    if (['pending', 'failed', 'invalid', 'conflict'].includes(adAction)) {
      const reason = optionalText(adLinkResult?.reason);
      const error = optionalText(adLinkResult?.error);
      const technicalMessage = [reason, error].filter(Boolean).join(' ');
      let type: ReviewItemType = 'ad_pending';
      let title = 'Anúncio pendente';
      let message = reason || error || 'O vínculo do anúncio ficou pendente.';

      if (
        includesAny(technicalMessage, ['sem acesso', 'http 403', '403'])
      ) {
        type = 'ad_no_access';
        title = 'Anúncio sem acesso';
        message = 'Conta atual não tem acesso a este anúncio.';
      } else if (
        includesAny(technicalMessage, ['nao encontrado', 'removido', 'http 404', '404'])
      ) {
        type = 'ad_not_found';
        title = 'Anúncio não encontrado';
        message = 'Anúncio não encontrado ou removido.';
      } else if (adAction === 'conflict') {
        type = 'ad_conflict';
        title = 'Conflito de anúncio';
        message = 'Anúncio já vinculado a outra peça.';
      }

      reviewItems.push(createReviewItem(
        item,
        type,
        'warning',
        title,
        message
      ));
      representedTypes.add(type);
    }

    if (
      asText(imagePlan?.action) === 'no_image' ||
      asText(imagePlan?.source) === 'none'
    ) {
      reviewItems.push(createReviewItem(
        item,
        'no_image',
        'info',
        'Peça sem imagem',
        'Peça foi importada sem imagem.'
      ));
      representedTypes.add('no_image');
    }

    const warnings = Array.isArray(item.warnings)
      ? item.warnings.map(asText).filter(importantWarning)
      : [];
    warnings.forEach((warning, index) => {
      if (includesAny(warning, ['location_pending', 'localizacao pendente', 'localização pendente'])) {
        reviewItems.push(createReviewItem(
          item,
          'location_pending',
          'warning',
          'Localização pendente',
          'Verificar cadastro da localização e vincular manualmente se necessário.',
          'location_pending'
        ));
        representedTypes.add('location_pending');
        return;
      }

      if (warningAlreadyRepresented(warning, representedTypes)) return;
      reviewItems.push(createReviewItem(
        item,
        'warning',
        'warning',
        'Atenção necessária',
        warning,
        `warning-${index}`
      ));
    });
  }

  return {
    summary: summarize(reviewItems),
    items: reviewItems,
  };
};

export const summarizeReviewItems = summarize;

export default extractReviewItems;
