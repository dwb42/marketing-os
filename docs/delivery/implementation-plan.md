# Implementation Plan

Konkreter Bauplan für die erste Iteration (Phase 1 → Phase 2 Start).

## Prinzipien

- **Schema-First.** Prisma-Schema ist Vertrag mit dem Rest des Systems.
- **Vertical Slices.** Jede Einheit liefert ein Stück, das von API bis DB durchgeht.
- **Kein Mock-Overkill.** Für MVP gibt es echte Prisma-Clients gegen lokale Postgres, nicht auf Wunsch gemockte Repositories.
- **Tests da, wo sie Geld bringen.** Domain-Invarianten, Mapper, Lifecycle-Übergänge. Nicht jede Getter-Methode.

## Arbeitsreihenfolge

### 1. Boot & Schema (Phase 1)

1. `package.json`, `tsconfig.json`, `.env.example`, Fastify-Skeleton
2. `prisma/schema.prisma` mit MVP-Entitäten
3. `src/config/env.ts` (zod-validiert)
4. `src/lib/logger.ts`, `src/lib/ids.ts`, `src/lib/errors.ts`
5. `src/api/server.ts` mit `/health`
6. `npm run dev` lauffähig

### 2. Domain-Typen & Status-Enums

1. `src/domain/ids.ts` — ID-Prefixes und Helper
2. `src/domain/status.ts` — alle Statusmodelle als Union-Types
3. `src/domain/events.ts` — ChangeEvent-Shape
4. `src/domain/policies.ts` — erlaubte Transitions, wer darf was

### 3. Repositories (Prisma)

Dünne Wrapper um PrismaClient, ein File pro Aggregat:

- `src/services/_prisma.ts` — Singleton Client
- `src/services/campaigns/campaign.repo.ts`
- `src/services/assets/asset.repo.ts`
- `src/services/approvals/approval.repo.ts`
- `src/services/events/change-event.repo.ts`
- `src/services/performance/performance.repo.ts`
- `src/services/outcomes/outcome.repo.ts`
- `src/services/initiatives/initiative.repo.ts`

### 4. Domain Services

Enthalten die Logik (Transitions, Invarianten, ChangeEvent-Emission):

- `CampaignService` — `createDraft`, `submitForReview`, `approve`, `reject`, `archive`
- `AssetService` — `createAsset`, `addVersion`, `compareVersions`, `approveVersion`
- `ApprovalService` — `request`, `decide`
- `InitiativeService` — `propose`, `activate`, `done`, `timeline`
- `ExperimentService` — `design`, `start`, `conclude`
- `LearningService` — `create`, `query`
- `ChangeEventService` — `append`, `query`
- `PerformanceService` — `upsertDaily`, `query`
- `OutcomeService` — `ingest`, `query`

Jeder Service nimmt Repositories + `ChangeEventService` im Konstruktor.

### 5. API-Routen (Fastify, zod-validiert)

- `/health`
- `/workspaces`, `/products`, `/brands`
- `/initiatives`, `/initiatives/:id/timeline`
- `/campaigns`, `/campaigns/:id`, `/campaigns/:id/transition`
- `/assets`, `/assets/:id/versions`, `/assets/:id/versions/:vid`
- `/approvals`
- `/performance`, `/outcomes`
- `/changelog`
- `/sync-runs` (Stub bis Phase 3)

Alle Input-/Output-Schemas als zod-Schemas in `src/api/schemas/*.ts`, wiederverwendbar in Services.

### 6. Jobs

- `src/jobs/scheduler.ts` — Abstraktion
- `src/jobs/daily-performance-pull.ts` — Stub, greift Connector-Interface ab Phase 3

### 7. Connector-Interfaces

- `src/connectors/types.ts` — `ChannelConnector`, `ConnectorError`, Input/Output-Typen
- `src/connectors/google-ads/index.ts` — Skeleton-Implementierung, keine echten API-Calls in Phase 1/2
- `src/connectors/registry.ts` — Registry von Connector-ID → Implementierung

### 8. Seed & Smoke

- `scripts/seed-pflegemax.ts` — legt Workspace, Brand, Product, eine Initiative, zwei Campaigns, einige Assets + Versions an
- `scripts/smoke.ts` — spielt einen Campaign-Flow durch (Draft → Review → Approve)

## Definition of Done für Phase 1

- `npm run dev` startet und `/health` antwortet
- `npm run prisma:generate` erzeugt Typen
- `tsc --noEmit` passiert ohne Fehler
- Alle Services importierbar, Shape stimmt
- Doku ist aktuell und referenziert die real existierenden Dateien

## Definition of Done für Phase 2

- `scripts/seed-pflegemax.ts` läuft gegen echte Postgres
- API kann über curl/httpie eine Campaign durchlaufen lassen
- ChangeEvents entstehen pro Transition
- `/initiatives/:id/timeline` liefert kombinierten Stream
- Minimaler Testsatz: Transition-Matrix, Mapper-Tests, ChangeEvent-Emission
