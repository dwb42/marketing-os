# Metrics & Outcomes

Zwei strikt getrennte Zeitreihen:

1. **Kanal-Performance** — was der Kanal meldet
2. **Produkt-Outcomes** — was im Produkt tatsächlich passiert

## Kanal-Performance → `PerformanceSnapshotDaily`

Eine Zeile pro `(channelCampaignId, date)`. Kern-Metriken als typisierte Spalten, zusätzliche als `raw JSONB`.

| Feld                 | Typ       | Bedeutung                                        |
| -------------------- | --------- | ------------------------------------------------ |
| `channelCampaignId`  | FK        | interner Kanal-Campaign-Handle                   |
| `date`               | date      | Berichtsdatum (Kanal-Zeitzone, ursprungstreu)    |
| `impressions`        | int       |                                                  |
| `clicks`             | int       |                                                  |
| `costMicros`         | bigint    | Kosten in micro-units (Google-kompatibel)        |
| `conversions`        | numeric   | Kanal-gemeldete Conversions                      |
| `conversionValue`    | numeric   | Kanal-gemeldeter Conversion-Wert                 |
| `raw`                | jsonb     | vollständige Rohzeile des Kanals                 |
| `pulledAt`           | timestamp | Zeit des Pulls                                   |
| `syncRunId`          | FK        | SyncRun, in dem dieser Snapshot entstand         |

Unique: `(channelCampaignId, date)`. Pulls sind idempotent.

## Produkt-Outcomes → `ProductOutcomeEvent`

Feingranular, event-basiert. Eine Zeile pro tatsächlichem Ereignis.

| Feld          | Typ       | Bedeutung                                                           |
| ------------- | --------- | ------------------------------------------------------------------- |
| `id`          | `out_...` | ULID                                                                |
| `productId`   | FK        | Produkt (z.B. Pflegemax)                                            |
| `type`        | enum      | siehe unten                                                         |
| `occurredAt`  | timestamp | tatsächlicher Zeitpunkt im Produkt                                  |
| `sessionRef`  | string    | pseudonyme Session-ID (kein PII)                                    |
| `attribution` | jsonb     | UTM/Referrer/Landing-Kontext zum Zeitpunkt des Ereignisses          |
| `payload`     | jsonb     | event-typische Zusatzfelder                                         |
| `ingestedAt`  | timestamp | Zeit des Schreibens ins OS                                          |

### Pflegemax-Outcome-Typen (initial)

```
chat_started
chat_first_meaningful_message
pflegewegweiser_completed
pflegegrad_application_started
pflegegrad_application_pdf_generated
pflegegrad_simulation_completed
pflegetagebuch_started
leistungsauswahl_completed
```

Diese Typen sind das *initiale* Vokabular. Sie sollen bewusst klein gehalten und im `type`-Feld als Freitext-Enum in der DB (Check-Constraint) geführt werden, damit Erweiterungen ohne Schemaänderung möglich sind.

### Generizität

Andere Produkte werden andere Outcome-Typen haben. Das Schema ist produktübergreifend; die `type`-Werte sind produkt-spezifisch. Eine Tabelle `ProductOutcomeTypeDefinition` (Phase 2) hält pro `(productId, type)` die erlaubten Werte und deren Schema (JSON-Schema).

## Verknüpfung Performance ↔ Outcomes

Bewusst **nicht** via Foreign-Key, sondern via:

- Zeitfenster-Queries (`outcomes zwischen t1 und t2, gefiltert nach attribution.utm_campaign == channelCampaign.externalId`)
- Initiative als Klammer (`alle Outcomes im Zeitraum einer Initiative, gruppiert nach Attribution`)
- Annotations und Timeline-Views

Das spiegelt die Realität: Kanal-Conversions sind Claims, Produkt-Outcomes sind Wahrheit. Beide nebeneinander zu zeigen ist wertvoller als sie zu verschmelzen.

## KPI-Leitplanken für Pflegemax (initial)

- **Primär:** `chat_started` pro Tag, segmentiert nach Kampagnen-Attribution
- **Sekundär:** `pflegegrad_application_pdf_generated`, `pflegegrad_simulation_completed`
- **Tertiär:** Kanal-Metriken (Impressions, Clicks, Cost) als Effizienz-Indikator
- **Kontext:** Annotations für Release-Events, Copy-Änderungen, externe Einflüsse

## Aggregationen

MVP: on-the-fly via SQL. Keine Materialized Views, kein Warehouse. Wenn Latenz zum Problem wird (Phase 5), kommen Daily-Rollups pro `(productId, date, outcomeType, attributionKey)`.
