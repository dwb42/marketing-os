# Data Model

Das interne Modell ist *wichtiger* als die Modelle der externen Plattformen. Externe Strukturen werden darauf gemappt, nicht umgekehrt.

## Kernprinzipien

1. **Workspace = Mandant.** Jede operative Entität hat `workspaceId`.
2. **Product ≠ Brand ≠ Workspace.** Ein Workspace kann mehrere Produkte führen, ein Produkt gehört zu genau einer Brand, eine Brand lebt in genau einem Workspace (MVP).
3. **Draft-first Lifecycle.** `DRAFT → IN_REVIEW → APPROVED → SYNCED → ARCHIVED` (Details: `docs/domain/campaign-lifecycle.md`).
4. **Versionierung explizit.** Veränderliche inhaltliche Artefakte (Assets, Landingpages) haben eigene Version-Tabellen. Vergleiche laufen über Versionen.
5. **Append-only History.** `ChangeEvent` wird nicht mutiert, nur ergänzt.
6. **Zeitreihen getrennt.** Performance- und Outcome-Daten leben in eigenen Tabellen mit `(entity, date)`-Indizes.
7. **ULID-Prefix-IDs.** `wsp_`, `prd_`, `brd_`, `cmp_`, `ast_`, `ver_`, `exp_`, `lrn_`, `chg_`, `prf_`, `out_`, `apr_`, `syn_`, `aud_`, `ini_`, `hyp_`, `ann_`, `ica_`, `cnc_`, `act_`.

## Entitäten (MVP-Umfang)

### Tenancy & Stammdaten
- **Workspace** — oberste Trennlinie. Name, Slug, Timezone, CreatedAt.
- **Product** — operativer Fokus (z.B. Pflegemax). Verknüpft zu Workspace + Brand.
- **Brand** — Markenauftritt. Gehört zu Workspace.
- **AudienceSegment** — definierte Zielgruppe eines Produkts. Freitext-Beschreibung + strukturierte Facetten (JSONB).
- **Actor** — Wer hat gehandelt. `type: HUMAN | AGENT | SYSTEM`, `handle`, optional `agentRole` (`strategist`, `copywriter`, ...).

### Strategie & Initiativen
- **Initiative** — übergeordnetes Vorhaben ("Pflegegrad-Funnel verbessern"). Hält Ziel, Hypothese, Status, Zeitfenster.
- **Hypothesis** — testbare Annahme. Gehört zu 0..n Initiativen und 0..n Experimenten.
- **Experiment** — strukturierter Test mit Varianten und Auswertung.
- **Learning** — strukturiertes Ergebnis. Verweist auf Evidence (Performance, Outcomes, Experimente).

### Kampagnen & Assets
- **Campaign** — interne Kampagne, kanal-agnostisch. Ziel, Zielgruppe, Zeitraum, Owner, Status.
- **ChannelCampaign** — Projektion einer Campaign in einen Kanal (Google Ads, Meta). Hält externe ID nach Sync.
- **ChannelAdGroup** — Untergruppe innerhalb einer ChannelCampaign (entspricht Ad Group / Ad Set).
- **Asset** — logisches Marketing-Artefakt (Headline-Set, Bild, Textblock, Video, Landingpage-Referenz).
- **AssetVersion** — konkrete Fassung eines Assets. Inhalt, Hash, Autor, Approval-Status.
- **LandingPageVariant** — Variante einer Landingpage (URL oder Content-Ref), mit Hypothese/Experiment-Bezug.

### Lifecycle & Sync
- **Approval** — Review-/Approval-Entscheidung auf einem Zielobjekt (AssetVersion, ChannelCampaign, ...).
- **SyncRun** — konkreter Sync-Vorgang zu einem externen Kanal. Input, Output, Status, Fehler, Idempotency-Key.
- **ChangeEvent** — append-only Event-Log. Subject (type, id), actor, summary, payload (JSONB), at.

### Messung & Learnings
- **PerformanceSnapshotDaily** — tägliche Kennzahlen je (channelCampaignId, date). Impressions, Clicks, Cost, Conversions, plus Rohmetriken als JSONB.
- **ProductOutcomeEvent** — Produkt-Wirkungs-Event (z.B. `chat_started`, `pflegegrad_antrag_started`). Pro Event: productId, type, occurredAt, attribution (JSONB).
- **Annotation** — Kommentar an einem Zeitpunkt/Objekt. Frei oder strukturiert (z.B. "Release v12 live"). Nutzbar in Timelines.

### Integration
- **IntegrationAccount** — Verbindung zu einem externen Plattform-Konto (Google Ads Customer ID, Meta Business Account). Hält verschlüsselte Credentials / OAuth-Refs.
- **ChannelConnection** — Verknüpfung `Workspace × IntegrationAccount × Produkt-Scope`. Bestimmt, wer was pullen/pushen darf.

## Beziehungen (verdichtet)

```
Workspace 1─n Brand 1─n Product
Workspace 1─n Initiative 1─n Campaign 1─n ChannelCampaign 1─n ChannelAdGroup
Workspace 1─n Asset 1─n AssetVersion
Campaign n─m Asset              (via CampaignAsset)
Initiative 1─n Hypothesis 1─n Experiment
Experiment 1─n Learning
Any Entity 1─n ChangeEvent       (polymorph via subjectType/subjectId)
ChannelCampaign 1─n PerformanceSnapshotDaily
Product 1─n ProductOutcomeEvent
Workspace 1─n IntegrationAccount 1─n ChannelConnection
Any Entity 1─n Annotation        (polymorph)
Any Entity 1─n Approval          (polymorph)
```

## Statusmodelle (Kurzform)

| Entität         | Status                                                                  |
| --------------- | ----------------------------------------------------------------------- |
| Campaign        | `DRAFT → IN_REVIEW → APPROVED → SYNCED → PAUSED → ARCHIVED`             |
| AssetVersion    | `DRAFT → IN_REVIEW → APPROVED → PUBLISHED → SUPERSEDED`                 |
| Experiment      | `DESIGN → RUNNING → ANALYZING → CONCLUDED → ABORTED`                    |
| Initiative      | `PROPOSED → ACTIVE → ON_HOLD → DONE → CANCELLED`                        |
| SyncRun         | `PENDING → RUNNING → SUCCEEDED → FAILED → PARTIAL`                      |
| Approval        | `REQUESTED → APPROVED → REJECTED → CHANGES_REQUESTED`                   |

Vollständig in `docs/domain/campaign-lifecycle.md`.

## MVP vs. Später

**MVP (Phase 1–2)**: Workspace, Product, Brand, Initiative, Campaign, ChannelCampaign, Asset, AssetVersion, ChangeEvent, PerformanceSnapshotDaily, ProductOutcomeEvent, Annotation, Approval, SyncRun, IntegrationAccount, ChannelConnection, Actor, Hypothesis, Experiment, Learning, AudienceSegment.

**Später**: LandingPageVariant-Auswertung, Budget-Modelle, Attribution-Modelle, Feature-Flags, Multi-Variant-Tests mit statistischer Auswertung, Rollen/Policies, RLS, Audit-Export.

## Entwurf → `prisma/schema.prisma`

Der konkrete Prisma-Entwurf liegt in [`prisma/schema.prisma`](../../prisma/schema.prisma). Er deckt den MVP-Umfang oben ab.
