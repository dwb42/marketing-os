import type {
  ChannelConnector,
  ConnectionHandle,
  IntegrationAccountRef,
  NormalizedPerformanceRow,
  PerformancePullResult,
  PullPerformanceInput,
} from "../types.js";

// Fake Connector für lokale Entwicklung und Tests. Erzeugt deterministische
// Performance-Zeilen je Tag — reproduzierbar gegen eine gegebene Saat.
// Registrierbar statt echtem Google-Ads-Connector über die Registry.
export class FakeConnector implements ChannelConnector {
  readonly id = "google_ads" as const;

  constructor(private readonly externalCampaignIds: string[] = ["fake-campaign-1"]) {}

  async authenticate(account: IntegrationAccountRef): Promise<ConnectionHandle> {
    return { channel: "google_ads", accountId: account.externalId };
  }

  async pullPerformance(input: PullPerformanceInput): Promise<PerformancePullResult> {
    const rows: NormalizedPerformanceRow[] = [];
    const dayMs = 24 * 3600 * 1000;
    for (
      let t = input.from.getTime();
      t <= input.to.getTime();
      t += dayMs
    ) {
      for (const ext of this.externalCampaignIds) {
        const date = new Date(t);
        const seed = seeded(`${ext}-${date.toISOString().slice(0, 10)}`);
        rows.push({
          externalCampaignId: ext,
          date,
          impressions: Math.floor(500 + seed * 4500),
          clicks: Math.floor(10 + seed * 190),
          costMicros: BigInt(Math.floor((2 + seed * 18) * 1_000_000)),
          conversions: Math.round(seed * 30) / 10,
          conversionValue: Math.round(seed * 100) / 10,
          raw: { source: "fake", seed },
        });
      }
    }
    return { rows, pulledAt: new Date() };
  }
}

// Einfache deterministische 0..1-Zahl aus einem String.
function seeded(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export const fakeConnector = new FakeConnector();
