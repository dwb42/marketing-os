# Integrations / Connector Layer

Externe Plattformen sind Adapter, nicht Kern. Dieses Dokument beschreibt das Connector-Modell, beginnend mit Google Ads. Meta Ads folgt in Phase 5, nutzt dasselbe Interface.

## Ziele

1. **Einheitliches Interface** — Services oberhalb des Connectors kennen keine Kanalspezifika.
2. **Idempotenz** — Pulls und Pushes können wiederholt werden, ohne Duplikate oder inkonsistente Zustände zu erzeugen.
3. **Audit-Trail** — jede externe Interaktion hinterlässt einen `SyncRun`-Eintrag plus `ChangeEvent`.
4. **Fehlerklassifikation** — unterscheidbar: `AUTH`, `RATE_LIMIT`, `VALIDATION`, `TRANSIENT`, `PERMANENT`.
5. **Mapping explizit** — internes Modell → Kanalmodell und zurück, in testbaren Mappern.

## ChannelConnector Interface

```ts
export interface ChannelConnector<TRaw = unknown> {
  readonly id: ChannelId;                 // "google_ads" | "meta_ads"

  authenticate(account: IntegrationAccount): Promise<ConnectionHandle>;

  pullPerformance(input: PullPerformanceInput): Promise<PerformancePullResult>;

  // optional / Phase 4
  pushCampaign?(input: PushCampaignInput): Promise<SyncRunResult>;
  pushAssetVersion?(input: PushAssetVersionInput): Promise<SyncRunResult>;

  // Mapping helpers
  mapPerformanceRow(raw: TRaw): NormalizedPerformanceRow;
}
```

Vollständige Typen: [`src/connectors/types.ts`](../../src/connectors/types.ts).

## Daily Performance Pull

Ablauf pro Kanal, pro `ChannelConnection`:

1. Job-Scheduler triggert `daily-performance-pull` (z.B. 04:30 lokal)
2. Für jeden aktiven `ChannelConnection`:
   - `connector.authenticate(account)`
   - `connector.pullPerformance({ from: yesterday, to: yesterday, scope })`
   - Für jede Zeile: Mapping auf interne `ChannelCampaign.id` über vorher gespeicherte `externalId`
   - Upsert in `PerformanceSnapshotDaily` mit `(channelCampaignId, date)` als Unique-Key
3. `SyncRun` Eintrag `type: PULL_PERFORMANCE` mit Input/Output/Counts
4. `ChangeEvent` mit `subjectType: "CHANNEL_CAMPAIGN"` pro tatsächlich geänderter Zeile (nur Delta)

Idempotenz: Upsert über Unique-Key. Bei Wiederholung identisches Ergebnis.

## Controlled Push (Phase 4)

Für Pushes gilt: **das Ziel muss intern `APPROVED` sein.** Sonst lehnt der Service den SyncRun ab.

Ablauf:

1. Agent/Operator ruft `POST /sync-runs` auf
2. Service prüft: Approval vorhanden? Idempotency-Key frei? Integration verbunden?
3. `SyncRun` wird `PENDING` angelegt
4. Worker nimmt ihn auf, setzt `RUNNING`
5. Connector führt `pushCampaign` / `pushAssetVersion` aus, persistiert externe IDs
6. Erfolgspfad: `SUCCEEDED`, `ChangeEvent(subjectType="CHANNEL_CAMPAIGN", summary="synced to google_ads")`
7. Fehlerpfad: Fehlerklasse → Retry-Policy
   - `TRANSIENT` → exponential backoff, max 5 Versuche
   - `RATE_LIMIT` → honor `retryAfter`, neu planen
   - `AUTH` → SyncRun `FAILED`, IntegrationAccount als `needs_reauth` markieren
   - `VALIDATION` / `PERMANENT` → `FAILED`, kein Retry

## Idempotenz

- **Pulls:** Unique-Key `(channelCampaignId, date)` auf `PerformanceSnapshotDaily`. Pulls sind nachlesbar wiederholbar.
- **Pushes:** Client liefert `idempotencyKey`. Server speichert ihn auf `SyncRun`. Zweiter Call mit demselben Key liefert den vorhandenen Run zurück.

## Secret- und Credential-Handling

- Credentials (OAuth-Refresh-Token, API-Keys) liegen in `IntegrationAccount.credentials` (JSONB, **verschlüsselt**)
- Verschlüsselung: AES-256-GCM mit Key aus `MOS_CREDENTIAL_KEY` (env, 32 Byte base64)
- MVP: ein Key pro Deployment. Key-Rotation in Phase 4.
- Klartext-Credentials dürfen niemals in Logs, Events oder API-Responses erscheinen. Fest erzwungen in `src/lib/secrets.ts`.

## Google Ads — Besonderheiten

- API: Google Ads API v17+ (REST oder gRPC; MVP: REST + offizielle Node-Lib)
- Auth: OAuth2, Refresh-Token pro Kunden-Account
- Hierarchie-Mapping:
  - Google `Customer` → `IntegrationAccount`
  - Google `Campaign` → `ChannelCampaign`
  - Google `AdGroup` → `ChannelAdGroup`
  - Google `Ad` / `Asset` → verknüpft mit interner `AssetVersion` via `externalId`
- Reporting-Query: GAQL, Zeitraum `yesterday`, Metriken: `metrics.impressions`, `metrics.clicks`, `metrics.cost_micros`, `metrics.conversions`, plus segmentierte Conversions je Conversion-Action.
- Rate Limits: per `developer_token` und per `customer_id`. Backoff auf Basis Header `Retry-After`.

## Meta Ads — Ausblick (Phase 5)

- Graph API
- Business/Ad Account → `IntegrationAccount`
- Campaign → Ad Set → Ad passt auf dasselbe interne Modell, Mapping analog.

## Fehler → `ConnectorError`

```ts
class ConnectorError extends Error {
  constructor(
    public readonly kind: "AUTH" | "RATE_LIMIT" | "VALIDATION" | "TRANSIENT" | "PERMANENT",
    message: string,
    public readonly cause?: unknown,
    public readonly retryAfterSeconds?: number,
  ) { super(message); }
}
```

Services oberhalb reagieren nur auf `kind`, nicht auf konkrete HTTP-Codes.
