# Roadmap

Die Roadmap ist in Phasen organisiert. Jede Phase ist ein *lauffähiger* Zustand mit klarem Nutzen.

## Phase 1 — Architektur & Grundgerüst *(jetzt)*

**Ergebnis:** Doku, Datenmodell, Prisma-Schema, Projekt-Skelett, erste Domain-Typen und Service-Stubs. Nichts produktiv.

Artefakte:

- vollständige Architektur- und Delivery-Doku
- `prisma/schema.prisma` (MVP-Umfang)
- `src/` mit Domain-, Service-, Connector- und API-Skeletten
- `package.json`, `tsconfig.json`, `.env.example`
- lauffähiger Boot (`npm run dev` startet Fastify mit `/health`)

## Phase 2 — Pflegemax-MVP

**Ergebnis:** Pflegemax läuft als erstes Produkt auf dem OS. Kampagnen, Assets, Versionen, Hypothesen, Learnings, Change Events und Produkt-Outcomes sind über die API nutzbar.

- Workspace + Product (Pflegemax) + Brand seedbar
- Campaign/Asset/Version-CRUD über API
- Approval-Flow
- ChangeEvent wird von Services emittiert
- `ProductOutcomeEvent` Ingest-Endpoint
- einfache Timeline-Query für Initiativen
- Seed-Skript + Smoke-Tests

## Phase 3 — Google Ads Connector

**Ergebnis:** Tägliche Performance-Daten aus Google Ads werden verlässlich gezogen und mit `ChannelCampaign`s verknüpft.

- `IntegrationAccount` mit verschlüsseltem Credential-Store
- OAuth-Bootstrap-Skript (Operator-seitig)
- `GoogleAdsConnector.pullPerformance` implementiert (GAQL)
- Mapping `Customer/Campaign/AdGroup` → interne Entitäten
- `daily-performance-pull` Job
- `SyncRun`-Tracking, Fehlerklassifikation, Retry-Policy

## Phase 4 — Agentenfreundliche Nutzung + Controlled Sync

**Ergebnis:** Agenten können verlässlich lesen, draften, reviewen, approven und gezielt synchronisieren. Push-Pfad zu Google Ads ist kontrolliert nutzbar.

- Auth per Service-Token mit Rollen
- Read/Write-Policies (Matrix aus `agent-collaboration.md`)
- `pushCampaign` + `pushAssetVersion` für Google Ads
- `POST /sync-runs` mit Idempotency
- Timeline-Endpoint inkl. Annotations, ChangeEvents, Performance, Outcomes
- Proposal-Fläche (`POST /proposals`)
- RBAC-Grundlage, optional Postgres RLS vorbereiten

## Phase 5 — Erweiterbarkeit

**Ergebnis:** Zweites Produkt und zweiter Kanal (Meta Ads) im Betrieb. Experimentauswertung strukturiert. Dashboards/Exports vorhanden.

- Meta Ads Connector
- Zweites Produkt onboarden (Stresstest Mandantenfähigkeit)
- Experiment-Auswertung inkl. Signifikanz
- Reporting-Views und CSV/JSON-Export
- Erste Automatisierungen (z.B. Auto-Pause bei Anomalie mit menschlicher Approval)

## Meilenstein-Kriterien

| Phase | "Fertig"-Kriterium                                                                               |
| ----- | ------------------------------------------------------------------------------------------------ |
| 1     | `npm run dev` startet, Schema generiert, Doku vollständig, Services typisieren                   |
| 2     | Pflegemax-Workspace seedbar, Campaign durchläuft DRAFT→APPROVED, Timeline zeigt Events           |
| 3     | 7 Tage Performance-Daten in `PerformanceSnapshotDaily`, Reruns idempotent                        |
| 4     | Ein vollständiger Agent-Flow: Draft → Review → Approval → SyncRun → Google Ads                   |
| 5     | Meta Ads liefert, zweites Produkt getrennt auswertbar, ein Experiment voll ausgewertet           |
