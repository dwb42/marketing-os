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

### `GET /workspaces` · `GET /products?workspaceId=…` · `GET /brands?workspaceId=…`

### `GET /audience-segments?workspaceId=…&productId=…`
Global-Listing aller `AudienceSegment`s im Workspace, optional auf ein Produkt gefiltert.

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

### `GET /initiatives?workspaceId=…&status=…`
Globales Listing.

### `GET /initiatives/:id?workspaceId=…`

### `PATCH /initiatives/:id?workspaceId=…`
```json
{ "title": "…", "goal": "…", "hypothesis": "…|null", "modules": ["…"], "outcomeLadder": ["…"], "learnQuestions": ["…"], "assumptions": ["…"], "risks": ["…"], "successCriteria": "…|null", "startsAt": "2026-…|null", "endsAt": "2026-…|null", "metadata": { … }, "actorId": "act_…", "reason": "…" }
```
Mindestens ein Feld Pflicht. ChangeEvent `initiative.patched` mit before/after.

### `POST /initiatives/:id/archive`
### `POST /initiatives/:id/restore`
```json
{ "workspaceId": "wsp_…", "actorId": "act_…", "reason": "…" }
```
Soft-Archive via `status = ON_HOLD` bzw. restore → `ACTIVE`. Restore verlangt aktuellen Status `ON_HOLD` (sonst `INVALID_STATE`). ChangeEvents: `initiative.archived` / `initiative.restored`.

### `DELETE /initiatives/:id?workspaceId=…&actorId=…&reason=…`
Hard-Delete. Verweigert mit 409 `INVALID_STATE`, wenn noch Campaigns / Clusters / Findings / Hypotheses / Learnings auf die Initiative zeigen — `details.blockers` zeigt die Zählung. ChangeEvent `initiative.deleted` mit `correctsId`.

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

### `PATCH /campaigns/:id?workspaceId=…`
Edit mutable Felder. Nur im Status `DRAFT | IN_REVIEW` erlaubt. Liefert das aktualisierte Campaign-Objekt. Mindestens ein Feld ist Pflicht.
```json
{ "name": "…", "objective": "…", "initiativeId": "ini_…|null", "audienceSegmentId": "aud_…|null", "startsAt": "2026-…|null", "endsAt": "2026-…|null", "actorId": "act_…", "reason": "optional" }
```
`INVALID_STATE` falls Status `APPROVED | SYNCED | PAUSED | ARCHIVED`. Schreibt `campaign.patched` ChangeEvent mit `payload.before` / `payload.after`.

### `DELETE /campaigns/:id?workspaceId=…&actorId=…&reason=…`
Hard-Delete inkl. Cascade (ChannelCampaign → ChannelAdGroup → ChannelAd / ChannelKeyword + alle Performance-Tabellen + CampaignAsset-Links) und Purge der polymorphen Refs (ChangeEvent, Annotation, Approval, SyncRun) auf allen Child-Subject-IDs. Nur im Status `DRAFT | ARCHIVED` erlaubt. Eine `campaign.deleted`-ChangeEvent bleibt als Audit-Spur erhalten; deren ID kommt zurück als `correctsId`.
Response: `{ "ok": true, "deleted": true, "correctsId": "chg_…" }`.

### `POST /campaigns/:id/assets?workspaceId=…`
Verknüpft Asset mit Campaign unter einer Rolle (`ads_rsa`, `landing_page`, …). Nur im Status `DRAFT | IN_REVIEW`. Idempotent — existiert der `(campaignId, assetId, role)`-Link bereits, kommt `{ linked: false }` zurück, sonst `{ linked: true }`.
```json
{ "assetId": "ast_…", "role": "ads_rsa", "actorId": "act_…", "reason": "optional" }
```
Schreibt `campaign_asset.linked` ChangeEvent.

### `GET /campaigns/:id/assets?workspaceId=…`
Listet `CampaignAsset`-Zeilen inkl. `asset` und dessen jüngster `APPROVED`-Version.

### `DELETE /campaigns/:id/assets/:assetId/:role?workspaceId=…&actorId=…&reason=…`
Löst die Verknüpfung. Nur im Status `DRAFT | IN_REVIEW`. Response: `{ ok: true, unlinked: true|false }`. `campaign_asset.unlinked` ChangeEvent.

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

### `GET /assets?workspaceId=…&kind=…&search=…&hasNoVersion=true`
Globales Listing aller Assets im Workspace. `kind` filtert auf einen Asset-Typ, `search` macht ILIKE auf Name+Description, `hasNoVersion=true` listet Assets ohne jede Version. Jedes Ergebnis enthält `_count` (Versionen, Campaign-Links) und die jüngste Version.

### `GET /assets/:id?workspaceId=…`
Einzel-Asset inkl. aller Versionen.

### `PATCH /assets/:id?workspaceId=…`
```json
{ "name": "…", "description": "…|null", "actorId": "act_…", "reason": "…" }
```
Edit von Name / Beschreibung. `kind` bleibt immutable. ChangeEvent `asset.patched`.

### `DELETE /assets/:id?workspaceId=…&actorId=…&reason=…`
Hard-Delete. Verweigert mit 409 `INVALID_STATE`, wenn das Asset an mindestens einer **nicht-ARCHIVED** Campaign hängt — `details.blockingCampaigns` listet die Blocker. Sonst: Cascade entfernt AssetVersions + CampaignAsset-Links. `asset.deleted`-ChangeEvent bleibt als Audit mit `correctsId=assetId`.

### `POST /assets/versions/:vid/patch`
```json
{ "workspaceId": "wsp_…", "content": { … }, "actorId": "act_…", "reason": "micro-edit vor IN_REVIEW" }
```
Überschreibt `content` in-place. Nur im Status **DRAFT** erlaubt. `contentHash` wird neu berechnet. ChangeEvent `asset_version.patched`.

### `DELETE /assets/versions/:vid?workspaceId=…&actorId=…&reason=…`
Hard-Delete einer einzelnen Version. Nur im Status **DRAFT** oder **SUPERSEDED** erlaubt — `APPROVED`/`PUBLISHED` bleiben ewig. ChangeEvent `asset_version.deleted` mit `correctsId`.

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

### `GET /annotations?workspaceId=…&subjectType=…&subjectId=…&pinned=true`
### `GET /annotations/:id?workspaceId=…`
### `PATCH /annotations/:id?workspaceId=…`
```json
{ "body": "…", "pinned": true, "occurredAt": "2026-…", "actorId": "act_…", "reason": "…" }
```
ChangeEvent `annotation.patched`.

### `DELETE /annotations/:id?workspaceId=…&actorId=…&reason=…`
Hard-Delete; bleibt als `annotation.deleted`-ChangeEvent mit `correctsId` + Body-Snapshot stehen.

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

### `PATCH /proposals/:id?workspaceId=…`
```json
{ "title": "…", "rationale": "…", "impact": "…|null", "examples": ["…"], "actorId": "act_…", "reason": "…" }
```
`area` bleibt immutable. ChangeEvent `proposal.patched`.

### `DELETE /proposals/:id?workspaceId=…&actorId=…&reason=…`
Hard-Delete eines Proposal-Eintrags (intern `ChangeEvent subjectType=PLATFORM kind=proposal.submitted`). Sinn: Smoke-Test-Einträge aufräumen. Wird durch eine `proposal.deleted`-ChangeEvent ersetzt, die `correctsId` auf die gelöschte Proposal-ID setzt und `originalSummary`/`originalPayload` im Payload konserviert. Response: `{ ok: true, deleted: true, correctsId: "chg_…" }`.

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

### `POST /campaigns/:id/re-sync`
Pusht dieselbe interne Campaign erneut nach Google Ads. Legt dabei eine **neue** externe Google-Ads-Campaign + eine neue `ChannelCampaign`-Zeile an; alte `ChannelCampaign`-Zeilen bleiben als Historie erhalten. Der externe Name bekommt automatisch den Suffix `— resync N` (N = Anzahl bestehender ChannelCampaigns + 1), damit Google Ads den Namens-Duplikat-Check besteht. Erfordert Rolle `media-buyer` oder `operator`.

Zulässig für Campaign-Status `APPROVED | SYNCED | PAUSED`. Schreibt `channel_campaign.re_synced` + `campaign.re_synced` ChangeEvents.

```json
{ "workspaceId": "wsp_…", "actorId": "act_…", "reason": "v03 content rollout" }
```

Response shape identisch zu `/sync`.

**Bewusst nicht enthalten:** Full-diff-basiertes In-place-Re-Sync (automatischer Abgleich APPROVED-AssetVersion vs. Ist-Zustand in Google Ads). Für granulare Edits ohne Campaign-Neuanlage siehe `## Channel Mutations (in-place Google Ads edits)` weiter unten — einzelne Add/Update/Pause/Remove-Endpoints pro Ebene.

## Channel Mutations (in-place Google Ads edits)

Alle Endpoints in diesem Abschnitt pushen einzelne Änderungen an einer bereits synchronisierten Google-Ads-Struktur. Gemeinsame Eigenschaften:

- Rolle `media-buyer` oder `operator` erforderlich (sonst 403 `FORBIDDEN`).
- Ruft den Google-Ads-Connector direkt auf, spiegelt das Ergebnis sofort in die OS-DB und emittiert einen `ChangeEvent` sowie einen `SyncRun` vom Typ `PUSH_CAMPAIGN`.
- Die nächste `POST /campaigns/:id/structure/sync` reconciled alles was Google Ads zwischendurch noch geändert hat (Policy-Approval, bid adjustments, …).
- Response-Shape grundsätzlich `{ ok: true, syncRunId: "syn_…", … }`.

### `POST /channel-campaigns/:ccId/status`
```json
{ "workspaceId": "wsp_…", "status": "PAUSED", "actorId": "act_…", "reason": "rollout pausiert" }
```
`status ∈ { "ENABLED", "PAUSED" }`. Setzt die externe Campaign + lokale ChannelCampaign (`SYNCED | PAUSED`). ChangeEvent: `channel_campaign.status_pushed`.

### `POST /channel-campaigns/:ccId/budget`
```json
{ "workspaceId": "wsp_…", "amountEur": 30, "actorId": "act_…" }
```
oder `{ "amountMicros": "30000000" }`. Ändert `amount_micros` auf dem bestehenden Campaign-Budget-Resource (keine Neuanlage). ChangeEvent: `channel_campaign.budget_updated`.

### `POST /channel-campaigns/:ccId/negative-keywords`
```json
{ "workspaceId": "wsp_…", "keywords": [{ "text": "kostenlos", "matchType": "BROAD" }], "actorId": "act_…" }
```
Legt campaign-level Negative-Keywords an und spiegelt jede in `ChannelKeyword` (scope=CAMPAIGN). ChangeEvent pro Keyword: `channel_keyword.negative_added`.

### `POST /channel-ad-groups/:agId/status`
Analog zu `channel-campaigns/:ccId/status`, für Ad Groups. ChangeEvent: `channel_ad_group.status_pushed`.

### `POST /channel-ad-groups/:agId/bid`
```json
{ "workspaceId": "wsp_…", "cpcBidMicros": "2500000", "actorId": "act_…" }
```
Update des Default-CPC-Gebots. ChangeEvent: `channel_ad_group.bid_pushed`.

### `POST /channel-ad-groups/:agId/keywords`
```json
{
  "workspaceId": "wsp_…",
  "keywords": [
    { "text": "pflegegeld antrag hilfe", "matchType": "PHRASE" },
    { "text": "pflegegrad 2 beantragen", "matchType": "EXACT", "cpcBidMicros": "3000000" }
  ],
  "addHealthPolicyExemption": true,
  "actorId": "act_…"
}
```
Positive oder negative (mit `"negative": true`) Keywords zur Ad Group. `addHealthPolicyExemption: true` hängt den `HEALTH_IN_PERSONALIZED_ADS` Exemption-Key an (Pflicht in Pflege-Vertical, sonst REJECTED). ChangeEvent pro Keyword: `channel_keyword.added` / `channel_keyword.negative_added`.

### `POST /channel-ad-groups/:agId/ads`
```json
{
  "workspaceId": "wsp_…",
  "content": {
    "headlines": ["…", "…", "…"],
    "descriptions": ["…", "…"],
    "finalUrls": ["https://pflegeberatung.b42.io/?utm_…"],
    "path1": "pflegegeld",
    "path2": "hilfe"
  },
  "paused": true,
  "actorId": "act_…"
}
```
Erstellt eine neue RSA-Ad in der bestehenden Ad Group. Min 3 Headlines (max 15, je ≤30 Zeichen), min 2 Descriptions (max 4, je ≤90 Zeichen). `paused: true` startet sie im PAUSED-State — nützlich zum Vorbereiten eines v03-Ads, bevor das v02-Ad pausiert wird. ChangeEvent: `channel_ad.added`.

### `POST /channel-ads/:adId/status`
Pause/Enable einer einzelnen RSA-Ad. ChangeEvent: `channel_ad.status_pushed`.

### `PATCH /channel-ads/:adId`
```json
{
  "workspaceId": "wsp_…",
  "headlines": [{ "text": "…" }, …],
  "descriptions": [{ "text": "…" }, …],
  "path1": "pflegegeld",
  "finalUrls": ["https://…"]
}
```
Update-Mask wird automatisch aus den gesetzten Feldern gebaut. Google Ads verlangt, dass bei Änderung der Headlines ODER Descriptions jeweils **alle** Einträge mitgesendet werden. ChangeEvent: `channel_ad.content_pushed` mit before/after-Snapshot.

### `POST /channel-keywords/:kwId/status`
Pause/Enable eines einzelnen Keywords (positiv oder negativ). ChangeEvent: `channel_keyword.status_pushed`.

### `DELETE /channel-keywords/:kwId?workspaceId=…&actorId=…&reason=…`
Hard-Remove auf Google-Ads-Seite (`remove` op). Lokal wird der `ChannelKeyword`-Status auf `REMOVED` gesetzt, nicht hart gelöscht — damit bleibt `KeywordPerformanceDaily` erhalten. ChangeEvent: `channel_keyword.removed` / `channel_keyword.negative_removed`.

## Health & Discovery

- `GET /` — API-Index (Gruppierung aller Routen)
- `GET /health` — liveness
