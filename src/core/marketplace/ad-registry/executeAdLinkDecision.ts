import type { AdLinkDecision } from '../../../types/adLink.types';
import type { ImportExecutionContext } from '../../../types/integration.types';
import type {
  MarketplaceAdPayload,
  MarketplaceAdRegistryAdapter,
} from '../../../types/marketplaceAd.types';
import { buildMarketplaceAdPayload } from './buildMarketplaceAdPayload';

export type ExecuteAdLinkAction =
  | 'inserted'
  | 'updated'
  | 'skipped'
  | 'conflict'
  | 'invalid'
  | 'failed';

export interface ExecuteAdLinkDecisionResult {
  action: ExecuteAdLinkAction;
  adId?: string | null;
  mlbId?: string | null;
  message: string;
  error?: string | null;
}

export interface ExecuteAdLinkDecisionInput {
  decision: AdLinkDecision;
  context: ImportExecutionContext;
  pecaId: string;
  adRegistryAdapter: MarketplaceAdRegistryAdapter;
}

const failed = (
  mlbId: string | null,
  message: string,
  error?: unknown
): ExecuteAdLinkDecisionResult => ({
  action: 'failed',
  adId: null,
  mlbId,
  message,
  error: error instanceof Error ? error.message : error ? String(error) : null,
});

const buildSnapshot = (
  input: ExecuteAdLinkDecisionInput
): MarketplaceAdPayload | null => {
  const candidate = input.decision.chosenCandidate;
  if (!candidate?.ok || !candidate.item) return null;

  return buildMarketplaceAdPayload({
    context: input.context,
    pecaId: input.pecaId,
    listing: candidate.item,
    rawItem: candidate.rawItem,
    description: candidate.description,
  });
};

const updatePatch = (
  snapshot: MarketplaceAdPayload
): Partial<MarketplaceAdPayload> => ({
  lastSeenAt: snapshot.lastSeenAt,
  lastSyncAt: snapshot.lastSyncAt,
  statusMl: snapshot.statusMl,
  price: snapshot.price,
  availableQuantity: snapshot.availableQuantity,
  title: snapshot.title,
  categoryId: snapshot.categoryId,
  permalink: snapshot.permalink,
  sellerSku: snapshot.sellerSku,
  pictures: snapshot.pictures ? [...snapshot.pictures] : [],
  attributes: snapshot.attributes ? [...snapshot.attributes] : [],
  plainText: snapshot.plainText,
  descriptionData: snapshot.descriptionData
    ? { ...snapshot.descriptionData }
    : {},
  rawData: snapshot.rawData ? { ...snapshot.rawData } : {},
});

export async function executeAdLinkDecision(
  input: ExecuteAdLinkDecisionInput
): Promise<ExecuteAdLinkDecisionResult> {
  const mlbId = input.decision.chosenMlbId ?? null;

  if (input.decision.action === 'conflict') {
    return {
      action: 'conflict',
      adId: null,
      mlbId,
      message: 'conflito não executado',
      error: null,
    };
  }

  if (input.decision.action === 'invalid') {
    return {
      action: 'invalid',
      adId: null,
      mlbId,
      message: 'decisão inválida não executada',
      error: null,
    };
  }

  const snapshot = buildSnapshot(input);
  if (!snapshot || !mlbId) {
    return failed(
      mlbId,
      'decisão sem candidato válido para execução'
    );
  }

  if (input.decision.action === 'insert_new_ad') {
    try {
      const inserted = await input.adRegistryAdapter.insertAd(snapshot);
      return {
        action: 'inserted',
        adId: inserted.id,
        mlbId: inserted.mlbId,
        message: 'anúncio inserido no registry',
        error: null,
      };
    } catch (error) {
      return failed(
        mlbId,
        'falha ao inserir anúncio no registry; nenhum update automático foi executado',
        error
      );
    }
  }

  if (input.decision.action === 'link_existing_ad') {
    try {
      const existing = await input.adRegistryAdapter.findExact({
        integrationId: input.context.integrationId,
        mlbId,
        pecaId: input.pecaId,
      });

      if (!existing) {
        return {
          action: 'skipped',
          adId: null,
          mlbId,
          message: 'registro exato não encontrado; update não executado',
          error: null,
        };
      }

      const updated = await input.adRegistryAdapter.updateAd(
        existing.id,
        updatePatch(snapshot)
      );

      return {
        action: 'updated',
        adId: updated.id,
        mlbId: updated.mlbId,
        message: 'snapshot do anúncio atualizado no registry',
        error: null,
      };
    } catch (error) {
      return failed(mlbId, 'falha ao atualizar anúncio no registry', error);
    }
  }

  return {
    action: 'skipped',
    adId: null,
    mlbId,
    message: 'decisão sem ação executável',
    error: null,
  };
}

export default executeAdLinkDecision;
