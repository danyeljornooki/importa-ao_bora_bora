import type {
  MarketplaceAdRegistryAdapter,
} from '../../types/marketplaceAd.types';

const readOnlyError = (): never => {
  throw new Error('O noop marketplace ad registry não suporta escrita.');
};

export const noopMarketplaceAdRegistryAdapter: MarketplaceAdRegistryAdapter = {
  async findByMlbId() {
    return [];
  },
  async findExact() {
    return null;
  },
  async insertAd() {
    return readOnlyError();
  },
  async updateAd() {
    return readOnlyError();
  },
  async markDuplicates() {
    readOnlyError();
  },
};

export const noopAdRecordLookupAdapter = noopMarketplaceAdRegistryAdapter;

export default noopMarketplaceAdRegistryAdapter;
