# Agent Collaboration

Das Marketing OS wird von einem separaten agentischen Marketing-Workspace genutzt. Dieses Dokument beschreibt, wie Agenten mit dem OS interagieren sollen — welche Flächen es gibt, was sie dürfen, wie Draft/Review/Approval/Sync funktioniert.

## Angenommene Agentenrollen (im Marketing-Workspace)

| Rolle              | Typische Aktionen                                                                      |
| ------------------ | -------------------------------------------------------------------------------------- |
| `strategist`       | Initiativen lesen/vorschlagen, Hypothesen formulieren, Learnings konsolidieren         |
| `copywriter`       | AssetVersions als Draft anlegen, Varianten erzeugen, Diffing                           |
| `analyst`          | Performance + Outcomes lesen, Zeitfenster vergleichen, Annotations schreiben           |
| `reviewer`         | Approvals entscheiden, Kommentare schreiben, Rejections mit Begründung                 |
| `router`           | Tickets/Aufgaben orchestrieren, Agentenwahl, Statusabfragen                            |
| `media-buyer` *    | SyncRuns auslösen (controlled), Budget-/Bietvorschläge machen                          |
| `experiment-mgr` * | Experimente designen, starten, auswerten, Learnings ableiten                           |

\* Phase 4+

## Access Patterns

Agenten greifen ausschließlich über die interne HTTP-API zu (`src/api`), nicht direkt auf die Datenbank.

### Lesen (read-path)

Alle Kernentitäten sind lesbar nach `workspaceId` + optionalen Filtern (Produkt, Kanal, Zeitfenster, Status, Initiative). Wichtige Query-Flächen:

- `GET /campaigns?workspaceId=&productId=&status=&updatedSince=`
- `GET /campaigns/:id` (inkl. eingebetteter ChannelCampaigns, Assets, aktuelle Versionen)
- `GET /assets/:id/versions` (Versionshistorie, diffable)
- `GET /initiatives/:id/timeline` — kombinierter Stream aus ChangeEvents, PerformanceSnapshots, Outcomes, Annotations
- `GET /performance?channelCampaignId=&from=&to=` — aggregierbar
- `GET /outcomes?productId=&type=&from=&to=`
- `GET /experiments/:id` (inkl. Varianten, Hypothesen, Learnings)
- `GET /changelog?subjectType=&subjectId=&from=&to=`
- `GET /search?q=` — strukturierte Suche über Campaigns/Assets/Initiatives (Phase 2)

### Schreiben (write-path)

Schreiboperationen erzeugen **immer** zunächst einen Draft und einen `ChangeEvent`. Kein direktes Mutieren von Live-Zuständen.

- `POST /campaigns` → Status `DRAFT`
- `POST /assets/:id/versions` → neue `AssetVersion`, Status `DRAFT`
- `POST /initiatives` → Status `PROPOSED`
- `POST /hypotheses` / `POST /experiments`
- `POST /learnings`
- `POST /annotations`

### Review / Approval

- `POST /approvals` — `targetType`, `targetId`, `decision`, `comment`
- Gültige Decisions: `APPROVE`, `REJECT`, `REQUEST_CHANGES`
- Beim `APPROVE` wechselt das Ziel in `APPROVED`. Erst dann ist ein `SyncRun` zulässig.
- Reviewer-Agents können eigene Ergebnisse nicht selbst approven (Policy, Phase 2).

### Controlled Sync

- `POST /sync-runs` — `channel`, `targetType`, `targetId`, `idempotencyKey`
- Server verifiziert: Ziel `APPROVED`, Integration vorhanden, kein offener Run für selben Idempotency-Key.
- Sync-Ausführung erfolgt asynchron über den Job-Runner. Agents pollen `GET /sync-runs/:id`.

## Agentenfreundliche Design-Pflichten

Diese Eigenschaften sind **nicht verhandelbar**, weil sie direkt die Agentenarbeit bestimmen:

1. **Sprechende IDs mit Prefix** (`cmp_...`, `ast_...`, `ver_...`) — Agenten müssen IDs in Freitext-Reasoning verwenden können.
2. **Explizite Statusfelder** — keine Interpretation aus Flags. Ein Agent muss `status === "APPROVED"` lesen können.
3. **Stabile, dokumentierte JSON-Shapes** — kein dynamisches Shape-Morphing pro Endpoint. Schemata in `docs/` und in zod.
4. **Konsistente Fehlerobjekte** — `{ error: { code, message, details } }`. Codes maschinenlesbar.
5. **`updatedSince`-Filter** auf allen Listen-Endpoints — damit Agenten inkrementell arbeiten können.
6. **Timeline-Endpoints** — Agenten brauchen eine zeitlich geordnete Sicht *über Entitätsgrenzen hinweg*.
7. **Diffbare Versionen** — `GET /assets/:id/versions/:a/diff/:b` liefert ein strukturiertes Diff.
8. **Annotation-First** — Agenten können alles annotieren, was einen Zeitpunkt hat. Annotations sind First-Class und erscheinen in Timelines.
9. **Proposal-Fläche** — Agenten können Verbesserungsvorschläge zur Plattformstruktur ablegen: `POST /proposals` (Phase 2) → landet als `ChangeEvent` mit `subjectType = "PLATFORM"`.

## Read/Write-Matrix (MVP)

| Entität                 | strategist | copywriter | analyst | reviewer | media-buyer |
| ----------------------- | :--------: | :--------: | :-----: | :------: | :---------: |
| Initiative              |    R/W     |     R      |    R    |    R     |      R      |
| Hypothesis              |    R/W     |    R/W     |   R/W   |    R     |      R      |
| Campaign (draft)        |    R/W     |    R/W     |    R    |    R     |     R/W     |
| Campaign (approved)     |     R      |     R      |    R    |    R     |      R      |
| AssetVersion (draft)    |     R      |    R/W     |    R    |    R     |      R      |
| Approval                |     R      |     R      |    R    |   R/W    |      R      |
| SyncRun                 |     R      |     R      |    R    |    R     |     R/W     |
| Learning                |    R/W     |     R      |   R/W   |    R     |      R      |
| Annotation              |    R/W     |    R/W     |   R/W   |   R/W    |     R/W     |
| PerformanceSnapshot     |     R      |     R      |    R    |    R     |      R      |
| ProductOutcomeEvent     |     R      |     R      |    R    |    R     |      R      |

Durchsetzung erfolgt in Phase 1 rein über API-Policies. Echte RBAC/RLS kommt in Phase 4.

## Authentifizierung

- MVP: statische Service-Tokens pro Agentenrolle, im Header `Authorization: Bearer ...`
- Token sind an `workspaceId` + `actorRole` gebunden
- Jeder Call wird als `Actor` geloggt (Events, Approvals, Annotations)
- Phase 4: OAuth/OIDC für Operatoren, signierte JWTs für Agenten

## Vorschläge der Agenten an die Plattform

Agenten sollen explizit Verbesserungsvorschläge einreichen können — an Datenmodell, Query-Flächen, Reports. Mechanismus:

- `POST /proposals` mit `area: "data_model" | "api" | "reporting" | "workflow"`
- `body: { title, rationale, impact, examples }`
- Landet als `ChangeEvent(subjectType="PLATFORM")` + eigene `Proposal`-Tabelle in Phase 2.
- Review durch menschliches Operator-Team. Entscheidungen als `Approval` auf `subjectType="PROPOSAL"`.

Damit schließt sich der Kreis: Agenten verbessern nicht nur Kampagnen, sondern auch das OS, in dem sie arbeiten.
