# API Reference

Die interne HTTP-API des Marketing OS. Basis-URL lokal: `http://localhost:4000`.

Alle Listen-Endpoints setzen `workspaceId` als Query-Pflichtparameter. Alle IDs sind prefix-getaggt: `wsp_`, `prd_`, `brd_`, `cmp_`, `ast_`, `ver_`, `ini_`, `hyp_`, `exp_`, `lrn_`, `apr_`, `syn_`, `chg_`, `ann_`, `ccp_`.

## Auth

Zwei Modi, abhängig von `MOS_TOKENS`:

- **Open-Dev** (`MOS_TOKENS` nicht gesetzt): kein Header nötig, `workspaceId` muss aus Query/Body lesbar sein. Jeder Request läuft als `operator`.
- **Token-Mode**: `Authorization: Bearer <token>`. Token wird über `MOS_TOKENS` (JSON-Array) konfiguriert und bindet an `workspaceId` + `actorId` + `role`.

## Fehlerformat

```json
{
  "error": {
    "code": "NOT_FOUND | CONFLICT | INVALID_INPUT | INVALID_STATE | FORBIDDEN | UNAUTHENTICATED | INTERNAL",
    "message": "human-readable",
    "details": { "...": "..." }
  }
}
```

## Tenancy

### `POST /workspaces`
```json
{ "slug": "pflegemax-team", "name": "Pflegemax Team", "timezone": "Europe/Berlin" }
```

### `POST /brands`
```json
{ "workspaceId": "wsp_…", "slug": "pflegemax", "name": "Pflegemax" }
```

### `POST /products`
```json
{ "workspaceId": "wsp_…", "brandId": "brd_…", "slug": "pflegemax-core", "name": "Pflegemax — Digitale Pflegeberatung", "description": "…" }
```

### `GET /workspaces` · `GET /products?workspaceId=…`

### `POST /audience-segments`
```json
{ "workspaceId": "wsp_…", "productId": "prd_…", "name": "Angehörige in Überforderung", "facets": { "intents": ["pflegegeld", "pflegegrad beantragen"] } }
```

## Initiativen

### `POST /initiatives`
```json
{
  "workspaceId": "wsp_…",
  "title": "Pflegegrad-Funnel verbessern",
  "goal": "Mehr Nutzer zum Pflegegrad-PDF führen",
  "modules": ["pflegegrad-antrag", "pflegegrad-simulation"],
  "outcomeLadder": ["chat_gestartet", "consent_erteilt", "antrag_gestellt"],
  "hypothesis": "Wenn wir …, dann …",
  "learnQuestions": ["Akzeptieren LP-Besucher den Medienbruch?"],
  "assumptions": ["Hilfesuche-Modifier selektieren konversionsbereitere Nutzer"],
  "risks": ["Google Ads Policies im Pflegekontext"],
  "successCriteria": "Chat-Start >= 5%",
  "metadata": {}
}
```
Alle neuen Felder sind optional.

### `GET /initiatives/:id/timeline?workspaceId=…`
Liefert einen kombinierten Stream aus ChangeEvents, Annotations, Performance und verknüpften Campaigns/Hypotheses/Learnings.

## Campaigns

### `POST /campaigns`
```json
{ "workspaceId": "wsp_…", "productId": "prd_…", "name": "Pflegegrad — Search DE", "objective": "Nutzer zum Chat-Start und Pflegegrad-Antrag führen", "initiativeId": "ini_…", "audienceSegmentId": "aud_…" }
```

### `GET /campaigns?workspaceId=…&productId=…&status=DRAFT`

### `GET /campaigns/:id?workspaceId=…`

### `POST /campaigns/:id/transition?workspaceId=…`
```json
{ "to": "IN_REVIEW", "actorId": "act_…", "reason": "optional" }
```
Erlaubte Transitions siehe `docs/domain/campaign-lifecycle.md`.

## Assets

### `POST /assets`
```json
{ "workspaceId": "wsp_…", "kind": "HEADLINE_SET", "name": "Pflegegrad — Headlines v1" }
```

### `POST /assets/:id/versions`
```json
{ "workspaceId": "wsp_…", "content": { "headlines": ["…", "…"] } }
```

### `GET /assets/:id/versions?workspaceId=…`

### `GET /assets/:id/diff?workspaceId=…&a=ver_…&b=ver_…`
Strukturierter Key-by-Key-Diff zwischen zwei AssetVersions.

### `POST /assets/versions/:vid/transition`
```json
{ "workspaceId": "wsp_…", "to": "APPROVED" }
```

## Approvals

### `POST /approvals`
```json
{ "workspaceId": "wsp_…", "targetType": "CAMPAIGN", "targetId": "cmp_…", "decision": "APPROVED", "comment": "lgtm" }
```

## Experimente · Hypothesen · Learnings

### `POST /hypotheses` / `GET /hypotheses?workspaceId=…&initiativeId=…`
```json
{ "workspaceId": "wsp_…", "statement": "Ansprache A schlägt B bei Pflegegrad", "initiativeId": "ini_…" }
```

### `POST /experiments`
```json
{ "workspaceId": "wsp_…", "title": "Copy-Test A vs B", "hypothesisId": "hyp_…" }
```

### `POST /experiments/:id/start`
### `POST /experiments/:id/conclude`
```json
{ "workspaceId": "wsp_…", "conclusion": "Variant A wins by 18% on chat_started" }
```

### `POST /learnings`
```json
{
  "workspaceId": "wsp_…",
  "statement": "Variant A gewinnt deutlich bei Chat-Start",
  "confidence": "HIGH",
  "evidence": [
    { "type": "EXPERIMENT", "ref": "exp_…" },
    { "type": "OUTCOME_WINDOW", "ref": "chat_started:2026-04-01..2026-04-14" }
  ],
  "initiativeId": "ini_…",
  "hypothesisId": "hyp_…",
  "experimentId": "exp_…"
}
```

## Annotations

### `POST /annotations`
```json
{ "workspaceId": "wsp_…", "subjectType": "CAMPAIGN", "subjectId": "cmp_…", "body": "Variant A live seit 14:00", "occurredAt": "2026-04-15T14:00:00Z", "pinned": true }
```

## Outcomes

### `POST /outcomes`
```json
{ "productId": "prd_…", "type": "chat_started", "occurredAt": "2026-04-15T12:34:00Z", "sessionRef": "s_abc", "attribution": { "utm_source": "google", "utm_campaign": "pflegegrad" } }
```

### `GET /outcomes?productId=…&type=chat_started&from=…&to=…`

## Attribution

### `POST /attribution/match`

Matcht eine eingehende Chat-Nachricht gegen die letzten `cta_click`-Outcomes
des Products und gibt die `sessionRef` (alias `pm_cid`) zurück, falls
identifizierbar — ohne dass die `pm_cid` im WhatsApp-Text mitlaufen muss.

```json
{
  "productId": "prd_…",
  "messageHash": "sha256 der Nachricht",
  "senderHash": "sha256 der Sender-ID",
  "occurredAt": "2026-04-17T18:00:10Z"
}
```

Response:
```json
{ "sessionRef": "pmc_abc123", "confidence": "confirmed" }
```

- `confidence = "confirmed"` — genau 1 unmatched `cta_click` im Fenster
  `[occurredAt − 15 min, occurredAt + 30 s]`.
- `confidence = "ambiguous"` — ≥2 unmatched Clicks; nächstliegender gewinnt,
  die übrigen bleiben für spätere Messages claimbar.
- `confidence = "unattributed"` — kein Click im Fenster.

Jeder Aufruf schreibt eine `AttributionMatch`-Zeile — auch Misses —
abfragbar über die View `attribution_rate`:
```sql
SELECT product_id, day, confidence, n
FROM attribution_rate
ORDER BY day DESC, n DESC;
```

Der claim ist race-safe via CAS: `UPDATE … WHERE matchedAt IS NULL`. Ein
Event kann maximal einer Message zugeordnet werden.

## Performance

### `GET /performance?channelCampaignId=ccp_…&from=…&to=…`
`costMicros` wird als String serialisiert (BigInt-safe).

## Changelog

### `GET /changelog?workspaceId=…&subjectType=CAMPAIGN&subjectId=cmp_…`
oder im Zeitfenster: `GET /changelog?workspaceId=…&from=2026-04-01&to=2026-04-15`.

## Sync Runs

### `POST /sync-runs`
```json
{ "workspaceId": "wsp_…", "channel": "GOOGLE_ADS", "type": "PULL_PERFORMANCE", "targetType": "CHANNEL_CONNECTION", "targetId": "cnc_…", "idempotencyKey": "pull:cnc_…:2026-04-14", "input": { "date": "2026-04-14" } }
```
Antwort: `{ "id": "syn_…", "reused": false }`. Idempotent über `(workspaceId, idempotencyKey)`.

### `GET /sync-runs?workspaceId=…&status=PENDING&channel=GOOGLE_ADS`
### `GET /sync-runs/:id?workspaceId=…`

## Proposals (Plattform-Verbesserungsvorschläge von Agenten)

### `POST /proposals`
```json
{ "workspaceId": "wsp_…", "area": "data_model", "title": "Add cross-channel attribution link", "rationale": "Wir können heute UTM-campaigns nicht eindeutig auf ChannelCampaigns mappen.", "examples": ["…"] }
```

### `GET /proposals?workspaceId=…&area=data_model`

## IntentCluster

### `POST /clusters`
```json
{ "workspaceId": "wsp_…", "productId": "prd_…", "name": "hilfesuchende-pflegegeld", "modulPrimary": "cross-modul", "initiativeId": "ini_…", "modulSecondary": ["pflegegrad-antrag"], "outcome": "chat_gestartet", "lebenslage": "…", "suchbegriffe": ["Pflegegeld Antrag Hilfe"], "naechsteAktion": "…" }
```

### `GET /clusters?workspaceId=…&productId=…&status=DRAFT&validation=HYPOTHESIS&initiativeId=…`

### `GET /clusters/:id?workspaceId=…`
Inkl. verknüpfter Findings.

### `PATCH /clusters/:id?workspaceId=…`
```json
{ "lebenslage": "aktualisiert", "suchbegriffe": ["neu1", "neu2"], "actorId": "act_…" }
```

### `POST /clusters/:id/validate?workspaceId=…`
```json
{ "validation": "WEAK_EVIDENCE", "actorId": "act_…" }
```
Erlaubte Werte: `HYPOTHESIS`, `WEAK_EVIDENCE`, `EVIDENCED`, `REFUTED`.

## Finding

### `POST /findings`
```json
{ "workspaceId": "wsp_…", "beobachtung": "Nutzer brechen nach LP ab", "interpretation": "Medienbruch zu groß", "empfehlung": "Trust-Element hinzufügen", "initiativeId": "ini_…", "clusterId": "clu_…", "modulBetroffen": "landing-page", "konfidenz": "MEDIUM", "empfehlungAn": "copywriter" }
```

### `GET /findings?workspaceId=…&initiativeId=…&clusterId=…&status=OPEN`

### `GET /findings/:id?workspaceId=…`

### `POST /findings/:id/status?workspaceId=…`
```json
{ "status": "ADDRESSED", "actorId": "act_…" }
```
Erlaubte Werte: `OPEN`, `ADDRESSED`, `WONT_FIX`, `ARCHIVED`.

## Outcome-Funnel

### `GET /outcomes/funnel?productId=…&from=…&to=…`
Aggregiert Outcomes nach Typ.
```json
{ "funnel": [{ "type": "chat_started", "count": 42 }, { "type": "consent_erteilt", "count": 18 }] }
```

## Suche

### `GET /search?workspaceId=…&q=Pflegegeld&initiativeId=…&clusterId=…&status=…&from=…&to=…`
Cross-Entity-Suche über Campaigns, Assets, Clusters, Findings und Learnings. Alle Filter optional.
```json
{ "campaigns": [...], "assets": [...], "clusters": [...], "findings": [...], "learnings": [...] }
```

## Campaign Sync (Google Ads Push)

### `POST /campaigns/:id/sync`
Pusht eine APPROVED Campaign inkl. Assets zu Google Ads. Erstellt Campaign, Ad Group, RSA, Keywords und Geo-Targeting.
Erfordert Rolle `media-buyer` oder `operator`.
```json
{ "workspaceId": "wsp_…", "actorId": "act_…" }
```
Response:
```json
{ "ok": true, "syncRunId": "syn_…", "channelCampaignId": "ccp_…", "externalIds": { "campaignId": "12345", "adGroupId": "67890", "adId": "11111" } }
```
Voraussetzungen:
- Campaign Status = `APPROVED`
- ChannelConnection für GOOGLE_ADS existiert im Workspace
- Assets mit APPROVED Versions verknüpft (Headlines, Descriptions, Keywords, Target URL)
- Google Ads Env-Vars konfiguriert

## Health & Discovery

- `GET /` — API-Index (Gruppierung aller Routen)
- `GET /health` — liveness
