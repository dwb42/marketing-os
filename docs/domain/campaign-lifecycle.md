# Campaign Lifecycle

## Zustände

| Status       | Bedeutung                                                                  |
| ------------ | -------------------------------------------------------------------------- |
| `DRAFT`      | Intern erstellt, editierbar, nicht review-pflichtig                        |
| `IN_REVIEW`  | Zur Freigabe eingereicht, nicht mehr frei editierbar                       |
| `APPROVED`   | Freigegeben, sync-fähig, aber noch nicht in externem Kanal                 |
| `SYNCED`     | Erfolgreich an externen Kanal übergeben, externe IDs vorhanden             |
| `PAUSED`     | Extern pausiert (ausgelöst über Operator/media-buyer)                      |
| `ARCHIVED`   | Nicht mehr operativ, bleibt für Historie erhalten                          |

## Übergänge

| Von          | Nach         | Wer                         | Voraussetzung                             |
| ------------ | ------------ | --------------------------- | ----------------------------------------- |
| `DRAFT`      | `IN_REVIEW`  | Autor                       | Pflichtfelder befüllt                     |
| `IN_REVIEW`  | `APPROVED`   | Reviewer ≠ Autor            | Positive `Approval`-Decision              |
| `IN_REVIEW`  | `DRAFT`      | Reviewer                    | `REQUEST_CHANGES` oder `REJECT`           |
| `APPROVED`   | `SYNCED`     | media-buyer / Operator      | Erfolgreicher `SyncRun`                   |
| `SYNCED`     | `PAUSED`     | media-buyer / Operator      | Manueller Trigger oder Auto-Policy        |
| `PAUSED`     | `SYNCED`     | media-buyer / Operator      | Resume-SyncRun                            |
| `*`          | `ARCHIVED`   | Operator                    | Manuell                                   |

Jeder Übergang:
1. prüft Invarianten (Pflichtfelder, Rollen, Vorbedingungen),
2. schreibt einen `ChangeEvent` mit `before/after`-Status und `actor`,
3. emittiert eine domain-interne Notification (Phase 4+ für Webhooks / Agent-Pings).

## Pflichtfelder

### Beim Übergang `DRAFT → IN_REVIEW`

- `name`
- `productId`
- `audienceSegmentId`
- `initiativeId` (optional, aber empfohlen)
- mindestens eine `ChannelCampaign`
- jede verknüpfte `ChannelCampaign` hat mindestens eine `AssetVersion` in `APPROVED` oder `IN_REVIEW`

### Beim Übergang `APPROVED → SYNCED`

- `channelConnectionId` auf jeder `ChannelCampaign`
- Zielkanal ist verbunden (nicht `needs_reauth`)
- Keine offenen SyncRuns mit identischem `idempotencyKey`

## Invariants

1. Eine `Campaign` darf nicht `APPROVED` sein, wenn eine verknüpfte `AssetVersion` noch `DRAFT` ist.
2. Ein `Autor` eines Drafts ist nicht gleichzeitig sein eigener `Reviewer`.
3. Ein `SyncRun` existiert nur für `APPROVED` oder `SYNCED` (für Resume/Update) Campaigns.
4. `ARCHIVED` ist terminal in alle Richtungen, außer expliziter Operator-Override (mit Audit-Eintrag).

## AssetVersion-Lifecycle (parallel)

```
DRAFT → IN_REVIEW → APPROVED → PUBLISHED → SUPERSEDED
```

- `PUBLISHED` = mindestens eine `ChannelCampaign` nutzt diese Version aktiv
- `SUPERSEDED` = eine neuere Version desselben Assets wurde approved

## Beispiel-Flow (Pflegemax)

1. `strategist` legt Initiative *"Pflegegrad-Funnel verbessern"* an
2. `copywriter` legt Campaign *"Pflegegrad — Search DE"* als `DRAFT` an, verknüpft 2 Assets (Headline-Set, Beschreibungen), jeweils als `AssetVersion DRAFT`
3. `copywriter` submittet → `IN_REVIEW`
4. `reviewer` prüft, approved beide `AssetVersion`s und die Campaign → `APPROVED`
5. `media-buyer` löst `SyncRun` aus → `SYNCED`
6. `daily-performance-pull` zieht ab dem Folgetag Performance
7. `analyst` annotiert "Start der Variante A", beobachtet Outcomes
8. `strategist` formuliert `Learning`, verknüpft Evidenz, ggf. neue Initiative
