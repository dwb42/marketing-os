# System Overview

## Schichten

```
┌─────────────────────────────────────────────────────────────┐
│              Agent Collaboration Layer (API)                │
│  Fastify HTTP API · Query-Flächen · Draft/Review/Approve    │
└──────────────────────────────▲──────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────┐
│                    Domain / Control Plane                   │
│  Services: Campaigns · Assets · Versions · Approvals ·      │
│  Initiatives · Experiments · Learnings · ChangeEvents       │
│  Statusmodelle · Policies · Invarianten                     │
└──────────────────────────────▲──────────────────────────────┘
                               │
┌──────────────┬───────────────┴────────────────┬─────────────┐
│   Data /     │        Reporting / Metrics     │ Integration │
│  Persistence │    PerformanceSnapshotDaily    │ / Connector │
│   (Prisma /  │    ProductOutcomeEvent         │   Layer     │
│   Postgres)  │    Timeline Views              │  (Google    │
│              │                                │   Ads, ...) │
└──────────────┴────────────────────────────────┴─────────────┘
                               ▲
                               │
                       Jobs / Scheduler
           (Daily Performance Pull · Sync Runs · Housekeeping)
```

## Schichten im Detail

### A. Domain / Control Plane (`src/domain`, `src/services`)

Die Geschäftslogik des Marketing OS. Keine HTTP-Kenntnis, keine Prisma-Details in den Signaturen. Services orchestrieren Repositories und setzen Invarianten durch:

- **CampaignService** — Campaigns anlegen, Lifecycle-Übergänge, Channel-Mapping
- **AssetService** — Assets + AssetVersions, Diffing, Vergleich
- **ApprovalService** — Review/Approval, Freigabe-Policies
- **InitiativeService** — Initiativen, Verknüpfung zu Changes/Experimenten
- **ExperimentService** — Hypothesen, Varianten, Auswertung
- **LearningService** — strukturierte Learnings, Verknüpfung zu Evidenz
- **ChangeEventService** — zentrales Change-Log, Timeline
- **PerformanceService** — tägliche Snapshots, Aggregation
- **OutcomeService** — Produkt-Outcomes (Pflegemax-spezifisch, generisch modelliert)

### B. Data / Persistence (`prisma/schema.prisma`)

- Postgres + Prisma
- Versionierung über dedizierte `*Version`-Tabellen (AssetVersion, LandingPageVariant)
- Historisierung operativer Änderungen über `ChangeEvent` (append-only)
- Zeitreihen: `PerformanceSnapshotDaily`, `ProductOutcomeEvent`
- Mandantenfähigkeit über `workspaceId` auf jeder Tenant-fähigen Entität + Postgres RLS-ready (Phase 4+)

### C. Integration / Connector Layer (`src/connectors`)

Jeder externe Kanal implementiert ein einheitliches Interface:

```ts
interface ChannelConnector {
  id: "google_ads" | "meta_ads" | ...;
  authenticate(account: IntegrationAccount): Promise<ConnectionHandle>;
  pullPerformance(input: PullPerformanceInput): Promise<PerformancePullResult>;
  pushCampaign?(input: PushCampaignInput): Promise<SyncRunResult>; // optional, Phase 4
  mapToInternal(raw: unknown): NormalizedRecord;
}
```

Kapselt: Auth, API-Kommunikation, Mapping, Retry, Idempotenz, Fehlerklassifikation. Details in [`integrations.md`](integrations.md).

### D. Agent Collaboration Layer (`src/api`)

Fastify-basierte interne API. Nicht öffentlich. Zugriff nur aus dem Marketing-Workspace (Agenten) und von Operatoren. Details in [`agent-collaboration.md`](agent-collaboration.md).

Designprinzipien:

- **Lesbar strukturierte IDs** (`cmp_01HXYZ...`, `ast_...`, `ver_...`) — ULID/KSUID-artig, prefix-getaggt
- **Explizite Statusfelder** statt impliziter Zustände
- **Cursor-basierte Pagination** für Timelines
- **Filterbare Query-Endpoints** über Initiative, Campaign, Channel, Zeitfenster, Status

### E. Reporting / Metrics Layer

Kein separater Dienst — logisch eine Sicht auf die Persistenzschicht:

- `PerformanceSnapshotDaily` (Kanal-Performance)
- `ProductOutcomeEvent` (Produkt-Wirkung)
- `ChangeEvent` (was passierte wann)
- `Annotation` (manuelle/agentische Kommentare auf Zeitpunkte)

Daraus lassen sich Timeline-Views und Before/After-Analysen bauen.

## Jobs / Scheduler (`src/jobs`)

MVP: schlanker In-Process-Scheduler mit `node-cron`. Job-Interface abstrakt gehalten, sodass später ein Queue-Backend (BullMQ/Redis) eingezogen werden kann, ohne Call-Sites zu ändern.

Initiale Jobs:

- `daily-performance-pull` — zieht pro Kanal pro Account die Daten des Vortags
- `sync-run-processor` — verarbeitet anstehende `SyncRun`-Einträge (Phase 4)
- `housekeeping` — abgelaufene Drafts markieren, Integrity-Checks

## Tech-Entscheidungen (kompakt)

| Baustein     | Entscheidung                  | Grund                                                                      |
| ------------ | ----------------------------- | -------------------------------------------------------------------------- |
| Sprache      | TypeScript strict             | Typsicherheit zwischen Domain/API/Connector                                |
| Runtime      | Node.js 20+                   | Stabil, gut supportet                                                      |
| DB           | Postgres                      | Relational, JSONB für Edge-Felder, starke Historie-Story                   |
| ORM          | Prisma                        | Migrations, Typen, DX. Drizzle wäre Alternative — Prisma reicht für MVP.   |
| API          | Fastify                       | Klein, schnell, zod-freundlich. Nest wäre Overkill.                        |
| Validation   | zod                           | Schema-first, teilbar zwischen API und Services                            |
| Logging      | pino                          | Strukturiert, schnell                                                      |
| Scheduler    | node-cron (→ BullMQ)          | MVP einfach, später austauschbar                                           |
| IDs          | ULID mit Prefix               | Sortierbar, agentenfreundlich lesbar                                       |
| Config       | zod-validiertes env-Modul     | Fail-fast beim Boot                                                        |

## Nicht-Ziele des MVP

- Keine Multi-Region-Deployments
- Keine Realtime-Subscriptions
- Keine Agent-Runtime im OS selbst
- Kein eigenes CMS, kein eigenes BI
