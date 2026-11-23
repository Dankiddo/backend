import type {
  AnalyticsReader,
  DeliveryFunnelCounts,
  DriverTierCounts,
  GmvByToken,
} from '../../domain/index.js';

export function createFakeAnalyticsReader(): AnalyticsReader & {
  setGmv(gmv: GmvByToken[]): void;
  setFunnelCounts(counts: DeliveryFunnelCounts): void;
  setTierCounts(counts: DriverTierCounts): void;
  lastGmvFilterCalledWith(): { from?: Date; to?: Date } | undefined;
} {
  let gmv: GmvByToken[] = [];
  let lastGmvFilter: { from?: Date; to?: Date } | undefined;
  let funnelCounts: DeliveryFunnelCounts = {
    totalDeliveries: 0,
    deliveredCount: 0,
    disputedCount: 0,
  };
  let tierCounts: DriverTierCounts = { bronze: 0, silver: 0, gold: 0 };

  return {
    setGmv(value) {
      gmv = value;
    },
    setFunnelCounts(value) {
      funnelCounts = value;
    },
    setTierCounts(value) {
      tierCounts = value;
    },
    async getGmvByToken(filter) {
      lastGmvFilter = filter;
      return gmv;
    },
    lastGmvFilterCalledWith() {
      return lastGmvFilter;
    },
    async getDeliveryFunnelCounts() {
      return funnelCounts;
    },
    async getDriverTierCounts() {
      return tierCounts;
    },
  };
}
