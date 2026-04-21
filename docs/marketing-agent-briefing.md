# Marketing OS — Briefing für den Marketing-Agent (Stand 2026-04-21)

> Zweck: Vollständige, verifizierte Bestandsaufnahme, damit der Marketing-Agent
> (`/Users/dw/Projects/care-ai/care-ai-marketing/`) seine `MEMORY.md` /
> `CLAUDE.md` aktualisieren und gegen die VPS-API arbeiten kann. Quellstand:
> Repo-Head `9c99fc2` auf `main`.

## 1. Was Marketing OS ist (und was nicht)

Marketing OS ist das **interne operative Wahrheits- und Kontroll-Backend** für
agentisches Marketing — **nicht** der Marketing-Workspace selbst. Jeder Agent
(Strategist, Copywriter, Analyst, Reviewer, Media-Buyer) arbeitet gegen das OS;
externe Ad-Plattformen (Google Ads, Meta Ads) sind Adapter, nicht Quelle.

Jede Änderung läuft durch `Draft → IN_REVIEW → APPROVED → SYNCED →
PAUSED/ARCHIVED`. Alles ist versioniert, diffable, auditierbar.

Erster Use-Case: **Pflegemax** (pflegeberatung.b42.io) — digitale
Pflegeberatung, Akquise via Google Search DE.

## 2. Tech-Stack / Architektur

- Node.js ≥ 20 / TypeScript strict, ESM
- **Fastify** (HTTP-API), zod-Validierung an allen Systemgrenzen
- **Prisma** + **PostgreSQL 16** als primärer Store
- **pino** logging
- **AES-256-GCM** für Credentials (`MOS_CREDENTIAL_KEY`)
- **BigInt-safe JSON-Serialisierung** (`costMicros` usw. als String)
- Auth: Service-Tokens via `MOS_TOKENS` (Bearer); ohne `MOS_TOKENS` →
  **Open-Dev-Modus** (kein Header nötig, `workspaceId` aus Query/Body)
- Fehlerformat: `{ error: { code, message, details } }` mit
  `NOT_FOUND | CONFLICT | INVALID_INPUT | INVALID_STATE | FORBIDDEN | UNAUTHENTICATED | INTERNAL`
- **Static Admin-UI**: `@fastify/static` serviert `web/out/` unter `/admin/`
  (Next.js 15 Static Export, Basepath `/admin`)
- CORS freigeschaltet für `https://pflegeberatung.b42.io`, `localhost:3099`,
  `localhost:3000`

Code-Layout: `src/api/routes` (HTTP), `src/services` (Business-Logik,
Prisma-Zugriff), `src/connectors` (externe Adapter), `src/domain`
(Status/Policies/Events), `src/jobs` (Cron-ready), `prisma/schema.prisma`
(Datenmodell).

## 3. Wo die Wahrheit liegt — Zugang für den Marketing-Agent

### VPS (Production, die Wahrheit)

- **Base-URL:** `https://marketing-os.b42.io`
- **Admin-UI:** `https://marketing-os.b42.io/admin/` (aktuell noch 404 bis
  VPS-Pull durch DevOps erfolgt — Commit `38a4a1c` liegt bereit)
- **Auth:** aktuell Open-Dev (kein Token notwendig). Sobald `MOS_TOKENS`
  gesetzt wird, muss `Authorization: Bearer <token>` mit.
- **Marketing-Agent arbeitet NICHT lokal** — er soll gegen
  `https://marketing-os.b42.io` sprechen, niemals gegen `localhost:4000` oder
  direkt auf die DB.
- **Write-Pfad:** nur `POST`/`PATCH` über die HTTP-API. Kein direkter
  DB-Zugriff.

### Workspace / Produkt-Kontext für Pflegemax

- `workspaceId` = `wsp_pflegemax_team`
- Welle-1-Kampagne in Prod-DB: `cmp_01KPC0KJWDBXCWJ0J9KW95YA37`, Status
  `APPROVED` (wird `SYNCED`, sobald DevOps das Re-Sync-Skript fährt)
- Google-Ads-Customer `8429711911`, Campaign `23766896581` (PAUSED, User
  aktiviert bewusst), AdGroup `195650681237`
- Budget-Resource `customers/8429711911/campaignBudgets/15505564988` — €30/Tag

## 4. ID-Präfixe (alle prefix-getaggte ULIDs)

| Präfix | Entität |
|--------|---------|
| `wsp_` | Workspace |
| `brd_` | Brand |
| `prd_` | Product |
| `aud_` | AudienceSegment |
| `ini_` | Initiative |
| `hyp_` | Hypothesis |
| `exp_` | Experiment |
| `lrn_` | Learning |
| `clu_` | IntentCluster |
| `fnd_` | Finding |
| `cmp_` | Campaign (intern) |
| `ccp_` | ChannelCampaign (externes Mapping) |
| `cag_` | ChannelAdGroup |
| `cad_` | ChannelAd |
| `ckw_` | ChannelKeyword (inkl. Negatives) |
| `ast_` / `ver_` | Asset / AssetVersion |
| `apr_` | Approval |
| `ann_` | Annotation |
| `syn_` | SyncRun |
| `chg_` | ChangeEvent |
| `agp_` / `kwp_` / `adp_` | Per-Level-Performance-Rows |

Der Marketing-Agent **muss IDs in Freitext-Reasoning verwenden können** — das
ist eine nicht verhandelbare Designpflicht.

## 5. Alle API-Endpunkte (Stand `9a9a4a1` + P2)

Basis: `https://marketing-os.b42.io`. Alle Listen-Endpoints verlangen
`workspaceId=` als Query-Pflichtparameter.

**Was sich seit `9c99fc2` geändert hat**
- **P1 CRUD**: Campaign-Asset-Link (POST/GET/DELETE), `PATCH`/`DELETE /campaigns/:id`, `POST /campaigns/:id/re-sync`, `DELETE /proposals/:id`
- **In-place Google-Ads-Mutationen**: 11 neue Endpoints (Status-Toggles, Keyword add/remove, RSA-Update, Ad create, Budget-Push, Bid-Update) — siehe Abschnitt _Channel-Mutationen_ weiter unten
- **P2 CRUD**: `PATCH`/`DELETE` auf Assets/AssetVersions/Initiatives/Annotations/Proposals, `archive`/`restore` auf Initiatives, globale Listings (`GET /assets`, `GET /brands`, `GET /audience-segments`, `GET /initiatives`), Detail-Reads (`GET /assets/:id`, `GET /initiatives/:id`, `GET /annotations/:id`)
- Jeder neue Write-Endpoint emittiert ChangeEvents mit `actorId` + `payload.before`/`payload.after`; Hard-Deletes hinterlassen eine `*.deleted`-ChangeEvent mit `correctsId`

### Discovery / Health

- `GET /` — JSON-Index aller Endpoint-Gruppen
- `GET /health` — liveness

### Tenancy

- `POST /workspaces`, `GET /workspaces`
- `POST /brands`, `GET /brands?workspaceId=…`
- `POST /products`, `GET /products?workspaceId=…`
- `POST /audience-segments`, `GET /audience-segments?workspaceId=…&productId=…`

### Strategie

- `POST /initiatives`, `GET /initiatives?workspaceId=…&status=…`,
  `GET /initiatives/:id`, `PATCH /initiatives/:id`,
  `POST /initiatives/:id/archive`, `POST /initiatives/:id/restore`,
  `DELETE /initiatives/:id` (nur wenn keine Kinder)
- `GET /initiatives/:id/timeline?workspaceId=…` — kombinierter Stream aus
  ChangeEvents + Annotations + Performance + verknüpften
  Campaigns/Hypotheses/Learnings
- `POST /hypotheses`, `GET /hypotheses?workspaceId=…&initiativeId=…`
- `POST /experiments`, `POST /experiments/:id/start`,
  `POST /experiments/:id/conclude`
- `POST /learnings`, `GET /learnings`

### IntentCluster & Findings (Validation Lifecycle)

- `POST /clusters`, `GET /clusters`, `GET /clusters/:id` (inkl. Findings),
  `PATCH /clusters/:id`
- `POST /clusters/:id/validate` →
  `HYPOTHESIS | WEAK_EVIDENCE | EVIDENCED | REFUTED`
- `POST /findings`, `GET /findings`, `GET /findings/:id`
- `POST /findings/:id/status` → `OPEN | ADDRESSED | WONT_FIX | ARCHIVED`

### Kampagnen (DRAFT → IN_REVIEW → APPROVED → SYNCED → PAUSED → ARCHIVED)

- `POST /campaigns` (Status `DRAFT`)
- `GET /campaigns?workspaceId=…&productId=…&status=…`
- `GET /campaigns/:id?workspaceId=…` — **inkl.** `channelCampaigns`,
  `campaignAssets` (mit Asset + Versions), `initiative`, `audienceSegment`
- `PATCH /campaigns/:id` — Edit nur in `DRAFT | IN_REVIEW`; before/after im Payload
- `DELETE /campaigns/:id` — nur `DRAFT | ARCHIVED`; Cascade auf ChannelCampaign/AdGroup/Ad/Keyword + Purge der polymorphen Refs
- `POST /campaigns/:id/transition` — `{ to, actorId?, reason? }`
- `POST /campaigns/:id/assets` — `{ assetId, role, actorId?, reason? }`, idempotent, nur `DRAFT | IN_REVIEW`
- `GET /campaigns/:id/assets` — `CampaignAsset` mit jüngster `APPROVED`-Version
- `DELETE /campaigns/:id/assets/:assetId/:role` — löst Verknüpfung, nur `DRAFT | IN_REVIEW`

### Assets (versioniert + diffbar)

- `POST /assets`, `GET /assets?workspaceId=…&kind=…&search=…&hasNoVersion=true`
- `GET /assets/:id?workspaceId=…` — inkl. aller Versionen
- `PATCH /assets/:id` — Edit von name/description (kind immutable)
- `DELETE /assets/:id` — Hard-Delete; 409 wenn an nicht-ARCHIVED-Campaign gelinkt
- `POST /assets/:id/versions` (Status Draft)
- `GET /assets/:id/versions?workspaceId=…`
- `GET /assets/:id/diff?a=ver_…&b=ver_…` — strukturiertes Key-by-Key-Diff
- `POST /assets/versions/:vid/transition` —
  `DRAFT | IN_REVIEW | APPROVED | PUBLISHED | SUPERSEDED`
- `POST /assets/versions/:vid/patch` — in-place Content-Edit, nur `DRAFT`
- `DELETE /assets/versions/:vid` — nur `DRAFT | SUPERSEDED` (APPROVED/PUBLISHED bleiben)

### Approvals

- `POST /approvals` — `{ targetType, targetId,
  decision: APPROVED|REJECTED|CHANGES_REQUESTED|REQUESTED, comment, payload }`

### Annotations

- `POST /annotations`, `GET /annotations` — auf jedes zeit-gebundene Subjekt;
  pinned-Flag, taucht in Timelines auf
- `GET /annotations/:id?workspaceId=…`
- `PATCH /annotations/:id` — `{ body?, pinned?, occurredAt? }`
- `DELETE /annotations/:id` — Hard-Delete; `annotation.deleted`-ChangeEvent
  bewahrt den ursprünglichen Body

### Proposals

- `POST /proposals`, `GET /proposals?workspaceId=…&area=…`
- `PATCH /proposals/:id` — `{ title?, rationale?, impact?, examples? }` (area immutable)
- `DELETE /proposals/:id` — Hard-Delete; `proposal.deleted`-ChangeEvent

### Outcomes (Konversions-/Funnel-Ereignisse vom LP)

- `POST /outcomes` —
  `{ productId, type, occurredAt, sessionRef, attribution: {utm_*} }`
- `GET /outcomes?productId=…&type=…&from=…&to=…`
- `GET /outcomes/funnel?productId=…&from=…&to=…` — aggregiert nach `type`

### Attribution (Chat ↔ cta_click)

- `POST /attribution/match` — matcht WhatsApp-Nachricht gegen letzte
  `cta_click` im 15-min-Fenster, race-safe, schreibt AttributionMatch-Zeile,
  gibt `{ sessionRef, confidence: confirmed|ambiguous|unattributed }`

### Performance (Kampagnen-Ebene)

- `GET /performance?channelCampaignId=ccp_…&from=…&to=…` — tägliche Rows:
  `impressions`, `clicks`, `costMicros` (string), `conversions`,
  `conversionValue`

### Struktur + Per-Level-Performance (seit Commit `13ca759`)

- `GET /campaigns/:id/structure?workspaceId=…` — vollständige externe Struktur
  je ChannelCampaign: AdGroups → Ads + Keywords + Campaign-Level-Negatives, mit
  Status, CPC-Bid, PolicyApprovalStatus, Headlines/Descriptions/FinalUrls etc.
- `POST /campaigns/:id/structure/sync` — pullt Struktur via GAQL, diff'd gegen
  bestehenden State, emittiert ChangeEvents
  (`channel_ad_group.added / removed / renamed / bid_changed / status_changed`,
  `channel_ad.added / content_changed / policy_changed`,
  `channel_keyword.added / removed / negative_added / match_type_changed / bid_changed`),
  und pullt zugleich Per-Level-Performance (gestern bis heute)
- `GET /channel-ad-groups/:id/performance?workspaceId=…&from=…&to=…`
- `GET /channel-keywords/:id/performance?…`
- `GET /channel-ads/:id/performance?…`
- `GET /campaigns/:id/changelog-tree?workspaceId=…&from=…&to=…` — alle
  ChangeEvents auf Campaign **plus** allen Kind-Entitäten

### Channel-Mutationen (in-place Google-Ads-Edits)

Alle Endpoints hier pushen **einzelne** Änderungen an einer bereits
synchronisierten Google-Ads-Struktur, ohne Campaign-Neuanlage. Rolle
`media-buyer` oder `operator` Pflicht. Jeder Call schreibt einen SyncRun
(`PUSH_CAMPAIGN`) und eine `ChangeEvent` mit `subjectType` auf der
entsprechenden Ebene; die nächste `POST /campaigns/:id/structure/sync`
reconciled etwaige Drift (Policy-Approval etc.).

ChannelCampaign-Ebene:

- `POST /channel-campaigns/:ccId/status` — `{ status: "ENABLED"|"PAUSED" }`
- `POST /channel-campaigns/:ccId/budget` — `{ amountEur }` oder `{ amountMicros }`
- `POST /channel-campaigns/:ccId/negative-keywords` —
  `{ keywords: [{ text, matchType: "EXACT"|"PHRASE"|"BROAD" }] }`
- `POST /channel-campaigns/:ccId/tracking-suffix` — (OS-Conv-Loop, siehe unten)

ChannelAdGroup-Ebene:

- `POST /channel-ad-groups/:agId/status` — ENABLED|PAUSED
- `POST /channel-ad-groups/:agId/bid` — `{ cpcBidMicros: "3000000" }`
- `POST /channel-ad-groups/:agId/keywords` —
  `{ keywords: [{ text, matchType, cpcBidMicros?, negative? }], addHealthPolicyExemption? }`
  (Pflege-Keywords immer mit `addHealthPolicyExemption: true`, sonst REJECTED)
- `POST /channel-ad-groups/:agId/ads` — neue RSA-Ad im existierenden Ad-Group:
  `{ content: { headlines[3-15], descriptions[2-4], finalUrls, path1?, path2? }, paused? }`

ChannelAd-Ebene:

- `POST /channel-ads/:adId/status` — ENABLED|PAUSED
- `PATCH /channel-ads/:adId` — `{ headlines?, descriptions?, path1?, path2?, finalUrls? }`
  (Google Ads verlangt bei Headlines/Descriptions-Update die **vollständige** Liste)

ChannelKeyword-Ebene:

- `POST /channel-keywords/:kwId/status` — ENABLED|PAUSED (positiv oder negativ)
- `DELETE /channel-keywords/:kwId` — hartes Remove auf Google-Ads-Seite;
  lokaler Status wird `REMOVED`, `KeywordPerformanceDaily` bleibt erhalten

**Use-Cases für den v03-Flow ohne Campaign-Recreation:**
1. Neue Headlines pro `PATCH /channel-ads/:adId` pushen.
2. Alte Keywords mit schwacher Performance pausieren
   (`POST /channel-keywords/:kwId/status`).
3. Neue Keywords hinzufügen (`POST /channel-ad-groups/:agId/keywords`).
4. Optional: neue Version als parallele RSA-Ad im PAUSED-State vorbereiten
   (`POST /channel-ad-groups/:agId/ads` mit `paused: true`), dann alte Ad
   pausieren, neue Ad enablen — A/B-Rollover ohne Traffic-Loss.

### OS-Conversion-Loop (Commit `9c99fc2`)

- `GET /campaigns/:id/outcome-attribution?workspaceId=…&from=…&to=…` — liefert
  OS-seitige Conversions aus `ProductOutcomeEvent.attribution`, gruppiert nach
  `utm_content` (≙ externalAdGroupId) und `utm_term` (≙ Keyword-Text). Liefert
  `{ utmCampaignValues, byAdGroupExternalId, byKeywordText, unattributedToAdGroup }`.
- `POST /channel-campaigns/:ccId/tracking-suffix` — setzt Final-URL-Suffix auf
  Google-Ads-Ebene (`utm_content={adgroupid}&utm_term={keyword}&gclid={gclid}`),
  damit OS-Attribution pro AdGroup/Keyword funktioniert.

Damit der OS-Conv-Loop geschlossen ist, müssen alle drei Elemente stimmen:

1. Asset-Version mit `targetUrl` inkl. `?utm_campaign=…`
2. Final-URL-Suffix auf der Kampagne gesetzt (via Endpoint oben)
3. LP (pflegeberatung.b42.io) übernimmt `utm_content` + `utm_term` beim POST
   `/outcomes` in `attribution` (**separate LP-Änderung, nicht
   Marketing-OS-Seite**)

### Changelog

- `GET /changelog?workspaceId=…&subjectType=…&subjectId=…` oder im Zeitfenster
  `&from=&to=`

### Sync Runs (Audit der externen Interaktionen)

- `POST /sync-runs` — `{ channel,
  type: PULL_PERFORMANCE|PUSH_CAMPAIGN|PUSH_ASSET_VERSION, targetType, targetId,
  idempotencyKey, input }` → idempotent über `(workspaceId, idempotencyKey)`
- `GET /sync-runs?workspaceId=…&status=…&channel=…`
- `GET /sync-runs/:id?workspaceId=…`

### Controlled Push (Google Ads)

- `POST /campaigns/:id/sync` — pusht APPROVED Campaign zu Google Ads
  (Budget → Campaign PAUSED → Geo DE → AdGroup → RSA → Keywords → Negatives).
  Erfordert Rolle `media-buyer` oder `operator`.
- `POST /campaigns/:id/re-sync` — re-push aus `APPROVED | SYNCED | PAUSED`;
  legt eine **neue** externe Campaign mit Suffix `— resync N` an, alte
  ChannelCampaigns bleiben als Historie. Nur sinnvoll, wenn bewusst eine
  neue Campaign-Instanz gewünscht ist — für einzelne Edits nimm stattdessen
  die Channel-Mutation-Endpoints weiter oben.

### Proposals (Agenten-Verbesserungsvorschläge ans OS)

- `POST /proposals` —
  `{ area: "data_model"|"api"|"reporting"|"workflow", title, rationale, examples }`
- `GET /proposals?workspaceId=…&area=…`
- `PATCH /proposals/:id` — title/rationale/impact/examples (area immutable)
- `DELETE /proposals/:id` — `proposal.deleted`-ChangeEvent mit correctsId

### Search (Cross-Entity)

- `GET /search?workspaceId=…&q=…&initiativeId=…&clusterId=…&status=…&from=…&to=…`
  → `{ campaigns, assets, clusters, findings, learnings }`

## 6. Wie der Marketing-Agent Kampagnen + Assets + Status einsieht

### Schritt 1 — Überblick

```
GET https://marketing-os.b42.io/campaigns?workspaceId=wsp_pflegemax_team
```

Liefert Liste mit `id`, `name`, `objective`, `status`, `productId`,
`initiativeId`, …

### Schritt 2 — Eine Kampagne vollständig

```
GET /campaigns/cmp_01KPC0KJWDBXCWJ0J9KW95YA37?workspaceId=wsp_pflegemax_team
```

Enthält eingebettet:

- `channelCampaigns[]` → `externalId`, `status`, `lastSyncedAt`, verlinkte
  `ChannelConnection`
- `campaignAssets[]` → `asset` (Kind, Name) + aktuelle Versionen mit `content`
  + `status` (`DRAFT|IN_REVIEW|APPROVED|PUBLISHED|SUPERSEDED`) + `contentHash`
- `initiative`, `audienceSegment`

### Schritt 3 — Vollständige externe Struktur (Ad Groups, Ads, Keywords)

```
GET /campaigns/cmp_…/structure?workspaceId=wsp_…
```

Baum: ChannelCampaigns → AdGroups (mit Status, CPC-Bid, `lastSyncedAt`) → Ads
(Headlines, Descriptions, FinalUrls, `policyApprovalStatus`) + Keywords (Text,
MatchType, Negative-Flag, Status) + Campaign-Level Negatives.

### Schritt 4 — Asset-Versionierung / Diff

```
GET /assets/ast_…/versions?workspaceId=…
GET /assets/ast_…/diff?workspaceId=…&a=ver_X&b=ver_Y
```

### Schritt 5 — Was hat sich wann geändert

```
GET /campaigns/cmp_…/changelog-tree?workspaceId=…&from=…&to=…
```

Liefert ChangeEvents auf allen Ebenen (Campaign, ChannelCampaign, AdGroup, Ad,
Keyword) inkl. `payload` mit Before/After — ideal für "Was wurde seit letztem
Review geändert?".

## 7. Wie der Marketing-Agent Performance-Werte einsieht

### Kampagnen-Ebene (tägliche Aggregate, `PerformanceSnapshotDaily`)

```
GET /performance?channelCampaignId=ccp_…&from=2026-04-01&to=2026-04-21
```

Felder: `impressions`, `clicks`, `costMicros` (string!), `conversions`,
`conversionValue`, `raw` (kanal-spezifischer Dump), `pulledAt`, `syncRunId`.

### Ad-Group-, Keyword-, Ad-Ebene (seit `13ca759`)

```
GET /channel-ad-groups/cag_…/performance?workspaceId=…&from=…&to=…
GET /channel-keywords/ckw_…/performance?workspaceId=…&from=…&to=…
GET /channel-ads/cad_…/performance?workspaceId=…&from=…&to=…
```

### OS-seitige Conversions (Outcome-Events vom LP)

```
GET /outcomes/funnel?productId=prd_…&from=…&to=…
GET /outcomes?productId=prd_…&type=chat_started&from=…&to=…
```

### Google-Conv vs. OS-Conv gegenüberstellen

```
GET /campaigns/cmp_…/outcome-attribution?workspaceId=…&from=…&to=…
```

Gibt zurück, welche Outcomes auf welche AdGroup (`byAdGroupExternalId`) und
welches Keyword (`byKeywordText`) zurückgeführt werden können — plus
`unattributedToAdGroup`-Zähler, um Diagnose-Banner anzuzeigen (z.B.
"utm_content fehlt").

### Pull auslösen

Daily-Cron ist **noch nicht scharfgeschaltet** (Job `dailyPerformancePull`
registriert, aber nicht zeitgetriggert). Manuell auslösen:

- Performance-Pull einer Kampagne: `POST /campaigns/:id/structure/sync` (pullt
  auch Struktur + Per-Level-Performance)
- Purer Performance-Pull: `POST /sync-runs` mit `type: PULL_PERFORMANCE` und
  `targetType: CHANNEL_CONNECTION`

## 8. Workflow-Muster für den Agenten

**Read-first, dann Draft, dann Review, dann Approve, dann Sync** — direktes
Mutieren von Live-Zuständen ist nicht möglich.

1. Kontext sammeln: `GET /initiatives/:id/timeline`, `GET /campaigns?…`,
   `GET /campaigns/:id/changelog-tree`
2. Hypothese formulieren: `POST /hypotheses`
3. Asset-Variante erstellen: `POST /assets/:id/versions` (Status DRAFT)
4. Version in Review heben:
   `POST /assets/versions/:vid/transition {to: "IN_REVIEW"}`
5. Approval: `POST /approvals` (Reviewer-Rolle erforderlich)
6. Campaign-Transition: `POST /campaigns/:id/transition {to: "APPROVED"}`
7. Sync: `POST /campaigns/:id/sync` (Rolle `media-buyer` oder `operator`)
8. Lernen: `POST /annotations` für Zeitpunkte, `POST /learnings` mit
   Evidence-Liste

Agent darf eigene Artefakte nicht selbst approven (Policy in
`src/domain/policies.ts`; Reviewer-Rolle kann autor-gleiche Rolle nicht
approven außer `operator`).

## 9. Attribution-Konvention (hart verdrahtet)

- `utm_campaign` → mapped per `targetUrl` der Asset-Versions auf interne
  Campaign
- `utm_content` ≙ externalAdGroupId (ValueTrack `{adgroupid}`)
- `utm_term` ≙ Keyword-Text (ValueTrack `{keyword}`)
- `gclid` → optional für spätere Google-Cross-Ref

Die LP muss diese Query-Params beim POST `/outcomes` in `attribution`
durchreichen — sonst bleibt `byAdGroupExternalId` / `byKeywordText` immer leer.

## 10. Google-Ads-Besonderheiten (Health-Vertikale)

- API-Version: **v23** (nicht v18 — explizit gebumped)
- Campaign-Create MUSS enthalten:
  `containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING"`
- Keyword-Create MUSS `exemptPolicyViolationKeys` mit
  `policyName: "HEALTH_IN_PERSONALIZED_ADS"` enthalten
- Geo: nur `positiveGeoTargetType: "PRESENCE"`, Deutschland-Konstante `2276`
- Budget-Updates: NIEMALS neue BudgetResource anlegen — immer
  `GoogleAdsConnector.updateCampaignBudget()` (FieldMask `amount_micros`)

## 11. Welle-1 Go-Live Status (konkret, heute)

Noch offen, bevor der Marketing-Agent echte Performance sieht:

1. DevOps muss `GOOGLE_ADS_*` Env-Vars im VPS-Container setzen
2. DevOps muss `docker exec marketing-os npm run resync:welle1` ausführen
   (keine Args)
3. DevOps muss VPS-Container pullen + neustarten, damit `/admin/` erreichbar
   wird
4. User aktiviert dann bewusst PAUSED → ENABLED in Google-Ads-UI

Verifikation (für den Agenten nutzbar):

```
curl -s "https://marketing-os.b42.io/campaigns/cmp_01KPC0KJWDBXCWJ0J9KW95YA37?workspaceId=wsp_pflegemax_team"
# → status=SYNCED, channelCampaigns=[{externalId:"23766896581", status:"SYNCED"}]

curl -s "https://marketing-os.b42.io/sync-runs?workspaceId=wsp_pflegemax_team"
# → letzter SyncRun type=PULL_PERFORMANCE, status=SUCCEEDED
```

## 12. Was Marketing OS heute NICHT kann

- Meta-Ads-Connector (Interface da, keine Implementierung)
- Per-Endpoint-RBAC durchgezogen (nur `canActorSync` auf `/campaigns/:id/sync`)
- Postgres-RLS (Mandant-Separation ist Service-Layer-only)
- Real-time-Subscriptions / Webhooks
- Statistische Experiment-Auswertung (Conclusion nur Freitext)
- Edit-Push von Keywords / Ad-Copy / Bids (Edits passieren weiter in
  Google-Ads-UI, OS pickt sie beim nächsten Structure-Sync auf)
- Daily-Performance-Cron scharf geschaltet (Job existiert, Scheduler ruft ihn
  noch nicht)

## 13. Externe Referenzen für den Agenten

- GitHub: https://github.com/dwb42/marketing-os (branch `main`, Head `9c99fc2`)
- VPS-API: https://marketing-os.b42.io
- Admin-UI (nach VPS-Pull): https://marketing-os.b42.io/admin/
- LP: https://pflegeberatung.b42.io/
- API-Doku im Repo: `docs/api.md`
- Architektur-Doku: `docs/architecture/*.md` (besonders
  `agent-collaboration.md`)

---

**Empfehlung für `MEMORY.md` des Marketing-Agents:** Die Abschnitte 3, 5, 6, 7,
8, 9, 12, 13 als Pflicht-Recall aufnehmen. Der Rest ist bei Bedarf aus dem OS
selbst (`GET /`) abrufbar — der Discovery-Endpoint listet alle Route-Gruppen.
