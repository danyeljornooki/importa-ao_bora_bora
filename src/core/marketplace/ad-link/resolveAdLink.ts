import {
  mercadoLivreAdapter,
  MarketplaceProxyError,
  type MarketplaceAdapter,
} from '../../../adapters/mercado-livre/mercadoLivreAdapter';
import { noopMarketplaceAdRegistryAdapter } from '../../../adapters/marketplace/noopAdRecordLookupAdapter';
import type {
  AdLinkCandidate,
  AdLinkDecision,
  AdLinkInput,
} from '../../../types/adLink.types';
import type { ExistingInventoryItem } from '../../../types/inventory.types';
import type { MarketplaceListing } from '../../../types/marketplace.types';
import type {
  MarketplaceAdRegistryAdapter,
} from '../../../types/marketplaceAd.types';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;

const asString = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value).trim();

const normalize = (value: unknown): string =>
  asString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const unwrapRawItem = (value: unknown): UnknownRecord | null => {
  const record = asRecord(value);
  return asRecord(record?.body) ?? record;
};

const attributeValues = (
  rawItem: unknown,
  attributeIds: string[]
): string[] => {
  const item = unwrapRawItem(rawItem);
  if (!Array.isArray(item?.attributes)) return [];

  const expectedIds = new Set(attributeIds.map((id) => id.toUpperCase()));

  return item.attributes.flatMap((attribute) => {
    const record = asRecord(attribute);
    if (!expectedIds.has(asString(record?.id).toUpperCase())) return [];

    const value = asString(record?.value_name) || asString(record?.value_id);
    return value ? [value] : [];
  });
};

const pieceName = (piece: ExistingInventoryItem): string =>
  asString(
    piece.marketplace_name ??
    piece.name ??
    piece.title ??
    piece.description
  );

const pieceCode = (piece: ExistingInventoryItem): string =>
  asString(piece.code ?? piece.tag_code ?? piece.id_int ?? piece.sku);

const pieceCategory = (piece: ExistingInventoryItem): string =>
  asString(
    piece.mercado_libre_brasil_category_id ??
    piece.part_category_id
  );

const scoreCandidate = (
  piece: ExistingInventoryItem,
  item: MarketplaceListing
): { score: number; scoreDetails: string[] } => {
  let score = 0;
  const scoreDetails: string[] = [];
  const category = normalize(pieceCategory(piece));
  if (category && category === normalize(item.categoryId)) {
    score += 30;
    scoreDetails.push('categoria igual +30');
  }

  const normalizedTitle = normalize(item.title);
  const nameTokens = Array.from(
    new Set(normalize(pieceName(piece)).split(/\s+/).filter(Boolean))
  );
  for (const token of nameTokens) {
    if (!normalizedTitle.includes(token)) continue;
    score += 5;
    scoreDetails.push(`token "${token}" +5`);
  }

  const code = normalize(pieceCode(piece));
  if (code && code === normalize(item.sellerSku)) {
    score += 40;
    scoreDetails.push('seller_sku igual +40');
  }

  const partNumbers = attributeValues(
    item.raw,
    ['OEM', 'PART_NUMBER']
  ).map(normalize);
  if (code && partNumbers.includes(code)) {
    score += 40;
    scoreDetails.push('oem/part_number igual +40');
  }

  const imageScore = Math.min(item.pictures.length, 10);
  if (imageScore > 0) {
    score += imageScore;
    scoreDetails.push(`${imageScore} imagens +${imageScore}`);
  }

  return { score, scoreDetails };
};

const errorDetails = (
  error: unknown
): { status: number | null; message: string } => ({
  status: error instanceof MarketplaceProxyError ? error.status : null,
  message: error instanceof Error ? error.message : String(error),
});

const loadCandidate = async (
  input: AdLinkInput,
  mlbId: string,
  warnings: string[],
  marketplaceAdapter: MarketplaceAdapter
): Promise<AdLinkCandidate> => {
  let item: MarketplaceListing;

  try {
    item = await marketplaceAdapter.loadListing(input.context, mlbId);
  } catch (error) {
    const details = errorDetails(error);
    return {
      mlbId,
      ok: false,
      score: 0,
      scoreDetails: [],
      errorStatus: details.status,
      errorMessage: details.message,
      useCache: details.status === 403 || details.status === 404,
    };
  }

  let description: AdLinkCandidate['description'];
  try {
    description = await marketplaceAdapter.loadListingDescription(
      input.context,
      mlbId
    );
  } catch (error) {
    const details = errorDetails(error);
    warnings.push(
      `Descrição de ${mlbId} não disponível: ${details.message}`
    );
  }

  const scored = scoreCandidate(input.peca, item);
  const itemStatus = asString(item.status) || 'desconhecido';
  if (normalize(itemStatus) !== 'active') {
    warnings.push(`anúncio válido, mas status atual é ${itemStatus}`);
  }

  return {
    mlbId,
    ok: true,
    item,
    rawItem: item.raw,
    description,
    score: scored.score,
    scoreDetails: scored.scoreDetails,
  };
};

export async function resolveAdLink(
  input: AdLinkInput,
  adRegistryAdapter: MarketplaceAdRegistryAdapter =
    noopMarketplaceAdRegistryAdapter,
  marketplaceAdapter: MarketplaceAdapter = mercadoLivreAdapter
): Promise<AdLinkDecision> {
  const pecaId = asString(input.peca.id);
  const mlbIds = [
    ...new Set(
      input.mlbIds
        .map((value) => String(value).trim().toUpperCase())
        .filter(Boolean)
    ),
  ];

  if (mlbIds.length === 0) {
    return {
      action: 'invalid',
      pecaId,
      chosenMlbId: null,
      chosenCandidate: null,
      candidates: [],
      invalidCandidates: [],
      registryRecords: [],
      reason: 'nenhum mlb_id recebido',
      warnings: [],
    };
  }

  const warnings: string[] = [];
  const loadedCandidates = await Promise.all(
    mlbIds.map((mlbId) =>
      loadCandidate(input, mlbId, warnings, marketplaceAdapter)
    )
  );
  const candidates = loadedCandidates
    .filter((candidate) => candidate.ok)
    .sort((left, right) => right.score - left.score);
  const invalidCandidates = loadedCandidates.filter(
    (candidate) => !candidate.ok
  );
  const uniqueWarnings = [...new Set(warnings)];

  if (candidates.length === 0) {
    const forbiddenCandidate = invalidCandidates.find(
      (candidate) => candidate.errorStatus === 403
    );
    const notFoundCandidate = invalidCandidates.find(
      (candidate) => candidate.errorStatus === 404
    );
    const reason = forbiddenCandidate
      ? 'sem acesso ao anúncio pelo token da integração'
      : notFoundCandidate
        ? 'anúncio não encontrado/removido'
        : 'nenhum mlb_id válido encontrado';

    return {
      action: 'invalid',
      pecaId,
      chosenMlbId: null,
      chosenCandidate: null,
      candidates,
      invalidCandidates,
      registryRecords: [],
      reason,
      warnings: uniqueWarnings,
    };
  }

  const chosenCandidate = candidates[0];
  const chosenMlbId = chosenCandidate.mlbId;
  const decisionReason = (fallback: string): string =>
    candidates.length === 1
      ? 'MLB informado na planilha é válido'
      : fallback;
  const records = await adRegistryAdapter.findByMlbId({
    integrationId: input.context.integrationId,
    mlbId: chosenMlbId,
  });
  const relevantRecords = records.filter(
    (record) =>
      record.integrationId === input.context.integrationId &&
      normalize(record.mlbId) === normalize(chosenMlbId)
  );
  const linkedToAnotherPiece = relevantRecords.some(
    (record) => record.pecaId && record.pecaId !== pecaId
  );

  if (linkedToAnotherPiece) {
    return {
      action: 'conflict',
      pecaId,
      chosenMlbId,
      chosenCandidate,
      candidates,
      invalidCandidates,
      registryRecords: relevantRecords,
      reason: decisionReason('anúncio já vinculado a outra peça'),
      warnings: uniqueWarnings,
    };
  }

  const linkedToPiece = relevantRecords.some(
    (record) => record.pecaId === pecaId
  );
  if (linkedToPiece) {
    return {
      action: 'link_existing_ad',
      pecaId,
      chosenMlbId,
      chosenCandidate,
      candidates,
      invalidCandidates,
      registryRecords: relevantRecords,
      reason: decisionReason('anúncio já vinculado à peça'),
      warnings: uniqueWarnings,
    };
  }

  return {
    action: 'insert_new_ad',
    pecaId,
    chosenMlbId,
    chosenCandidate,
    candidates,
    invalidCandidates,
    registryRecords: relevantRecords,
    reason: decisionReason('anúncio ainda não existe no cache/banco'),
    warnings: uniqueWarnings,
  };
}

export default resolveAdLink;
