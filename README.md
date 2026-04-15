# Marketing OS

Interne Kontroll-, Persistenz-, Analyse- und Integrationsschicht für agentisches Marketing.

Das Marketing OS ist **nicht** das Marketing-Workspace selbst. Es ist die Plattform, die ein separates agentisches Marketing-Team nutzt, um:

- Kampagnen, Assets, Versionen und Freigaben persistent und versioniert zu führen
- Performance-Daten aus externen Kanälen (Google Ads, Meta Ads, ...) täglich zu ziehen
- eine nachvollziehbare Zeitachse aus Änderungen, Initiativen, Ergebnissen und Learnings aufzubauen
- kontrollierte Synchronisation in externe Plattformen zu betreiben
- mehrere Produkte / Brands / Ventures sauber nebeneinander zu betreiben (erster Use Case: **Pflegemax**)

## Leitgedanke

> Das Marketing OS ist die interne operative Wahrheitsschicht. Externe Plattformen sind sekundär. Agenten arbeiten bevorzugt gegen das OS, nicht direkt gegen Google/Meta.

## Repo-Struktur

```
marketing-os/
├── README.md
├── docs/
│   ├── architecture/           # Zielbild, System, Datenmodell, Integrationen, Roadmap
│   ├── delivery/               # Implementation Plan, Phasen, offene Fragen
│   └── domain/                 # Tenancy, Campaign Lifecycle, Metrics & Outcomes
├── prisma/
│   └── schema.prisma           # Datenmodell (Postgres)
├── src/
│   ├── config/                 # Env + Konfiguration
│   ├── domain/                 # Domain-Typen, Statusmodelle, Policies
│   ├── services/               # Anwendungsservices (Campaigns, Assets, Approvals, ...)
│   ├── connectors/             # Externe Plattform-Adapter (Google Ads, Meta Ads, ...)
│   ├── api/                    # Interne HTTP-API für Agenten & Operatoren
│   ├── jobs/                   # Scheduled Jobs (Daily Performance Pull, Sync Runs)
│   ├── lib/                    # Logger, Errors, IDs, Time
│   └── index.ts                # Bootstrap
├── scripts/                    # DX / Ops Skripte
├── tests/                      # Test-Scaffold
├── package.json
├── tsconfig.json
└── .env.example
```

## Stack

- **Node.js + TypeScript** (strict)
- **Postgres** als primärer Store
- **Prisma** als ORM (Migrations, Typen, Query-Builder)
- **Fastify** für die interne API (klein, schnell, typefriendly)
- **pino** für strukturiertes Logging
- **zod** für Schema-Validierung an Systemgrenzen
- **node-cron / BullMQ-ready** Job-Abstraktion, startet simpel, erweiterbar

Begründung: siehe `docs/architecture/system-overview.md`.

## Einstieg in die Dokumentation

1. [`docs/architecture/vision.md`](docs/architecture/vision.md) — Warum und Wozu
2. [`docs/architecture/system-overview.md`](docs/architecture/system-overview.md) — Architekturzielbild
3. [`docs/architecture/data-model.md`](docs/architecture/data-model.md) — Entitäten & Relationen
4. [`docs/architecture/agent-collaboration.md`](docs/architecture/agent-collaboration.md) — Wie Agenten mit dem OS arbeiten
5. [`docs/architecture/integrations.md`](docs/architecture/integrations.md) — Connector-Modell
6. [`docs/architecture/operating-model.md`](docs/architecture/operating-model.md) — Draft → Review → Approval → Sync
7. [`docs/architecture/roadmap.md`](docs/architecture/roadmap.md) — Phasenbild
8. [`docs/delivery/implementation-plan.md`](docs/delivery/implementation-plan.md) — Konkreter Bauplan
9. [`docs/delivery/phases.md`](docs/delivery/phases.md) — Phasen 1–5
10. [`docs/delivery/open-questions.md`](docs/delivery/open-questions.md) — Was noch geklärt werden muss
11. [`docs/domain/tenancy-model.md`](docs/domain/tenancy-model.md)
12. [`docs/domain/campaign-lifecycle.md`](docs/domain/campaign-lifecycle.md)
13. [`docs/domain/metrics-and-outcomes.md`](docs/domain/metrics-and-outcomes.md)

## Schnellstart

```bash
./scripts/dev-setup.sh      # Postgres via docker compose, .env, npm install, prisma migrate, seed
npm run dev                 # Server auf http://localhost:4000
curl http://localhost:4000/ # API-Index
```

Ohne Docker: Postgres selbst bereitstellen, `.env` mit `DATABASE_URL` und `MOS_CREDENTIAL_KEY` (`openssl rand -base64 32`) füllen, dann `npx prisma migrate dev && npm run seed:pflegemax && npm run dev`.

## Tests

```bash
npm run typecheck    # tsc --noEmit, strict
npm test             # node:test, 14 Tests (policies, ids, secrets, fake connector, server boot)
```

## Status

**Phase 1 weitgehend fertig, Phase 2 begonnen.**

- Vollständige Architektur- und Delivery-Doku (`docs/`)
- Prisma-Schema für den MVP-Umfang + initiale SQL-Migration (`prisma/migrations/20260415000000_init`)
- Services: Campaign, Asset (inkl. Diff), Approval, Initiative (inkl. Timeline), Experiment, Hypothesis, Learning, Performance, Outcome, SyncRun (idempotent), Annotation, ChangeEvent, Workspace, Proposal
- API: Fastify-Server mit 30+ Endpoints über `workspaces`, `campaigns`, `assets`, `initiatives`, `approvals`, `experiments`, `hypotheses`, `learnings`, `annotations`, `performance`, `outcomes`, `changelog`, `sync-runs`, `proposals`, `/` (Discovery), `/health`
- Auth-Plugin mit Service-Token-Modus und komfortablem Open-Dev-Fallback
- Connector-Interface + Google-Ads-Skeleton + deterministischer Fake-Connector für Dev/Tests
- Jobs: `daily-performance-pull` implementiert gegen das Connector-Interface (wird erst in Phase 3 scharf geschaltet)
- BigInt-sichere JSON-Serialisierung, zentrales DomainError-Mapping, zod-Validierung an allen API-Grenzen
- Seed-Script erzeugt Workspace/Brand/Product/Initiative/Campaign/Assets/Hypothesis/Experiment/Learning/Annotation/Outcome
- Docker-Compose für Postgres, `scripts/dev-setup.sh` bootet eine vollständige Dev-Umgebung

Was in Phase 3+ gebaut werden muss: echte Google-Ads-API-Calls, OAuth-Bootstrap, RBAC/RLS, Meta-Ads. Siehe `docs/architecture/roadmap.md`.
