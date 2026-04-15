import type { ChannelConnector, ChannelId } from "./types.js";
import { googleAdsConnector } from "./google-ads/index.js";

const REGISTRY: Record<ChannelId, ChannelConnector> = {
  google_ads: googleAdsConnector,
  // meta_ads kommt in Phase 5
  meta_ads: {
    id: "meta_ads",
    async authenticate() {
      throw new Error("Meta Ads connector not implemented yet (Phase 5)");
    },
    async pullPerformance() {
      throw new Error("Meta Ads connector not implemented yet (Phase 5)");
    },
  },
};

export function getConnector(channel: ChannelId): ChannelConnector {
  return REGISTRY[channel];
}
