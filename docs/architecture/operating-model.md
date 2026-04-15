# Operating Model

Wie Arbeit durch das Marketing OS fließt: Draft → Review → Approval → Sync → Measurement → Learning.

## Grundregel

> Nichts geht live, ohne dass es intern existiert, versioniert und freigegeben ist. Nichts bleibt unbeobachtet, ohne dass ein Event es dokumentiert.

## Lebenszyklus einer Kampagne

```
     ┌──────┐   edit    ┌──────────┐   submit   ┌───────────┐
     │DRAFT ├──────────▶│IN_REVIEW ├───────────▶│APPROVED   │
     └──┬───┘           └─────┬────┘            └─────┬─────┘
        │  request changes    │                       │
        │◀────────────────────┘                       │
        │                                             │ create SyncRun
        │                                             ▼
        │                                       ┌──────────┐
        │                                       │SYNCED    │
        │                                       └────┬─────┘
        │                                            │ pause / archive
        │                                            ▼
        │                                     ┌──────────────┐
        └────────────────────────────────────▶│PAUSED/ARCHIVED│
                                              └──────────────┘
```

Jeder Übergang erzeugt einen `ChangeEvent` mit Actor, Zeit, optional Begründung.

## Rollen in Transitions

| Transition                        | Wer darf (MVP Policy)                      |
| --------------------------------- | ------------------------------------------ |
| `DRAFT → IN_REVIEW`               | Autor (beliebiger schreibender Agent)      |
| `IN_REVIEW → APPROVED`            | `reviewer` — nicht der Autor selbst        |
| `IN_REVIEW → DRAFT` (req. chng.)  | `reviewer`                                 |
| `APPROVED → SYNCED`               | `media-buyer` oder Operator, via `SyncRun` |
| `SYNCED → PAUSED`                 | `media-buyer`, Operator                    |
| `* → ARCHIVED`                    | Operator                                   |

Durchsetzung: `ApprovalService` und `CampaignService.transition()` — mit Invarianten-Checks.

## Zusammenspiel Assets ↔ Campaigns

- `Asset` ist das logische Artefakt. `AssetVersion` ist der konkrete Inhalt.
- Eine `Campaign` referenziert `Asset`, nicht direkt `AssetVersion`. Die *aktuelle approved* Version ist die, die in einen Sync gehen darf.
- Wenn eine neue `AssetVersion` approved wird, wird die vorherige `SUPERSEDED`. Historie bleibt erhalten.

## Initiative als Klammer

Initiativen sind der Kontext, in dem Arbeit entsteht. Sie verknüpfen:

- Hypothesen ("Wir glauben, dass ... weil ...")
- Campaigns/Assets, die die Hypothese adressieren
- Experimente, die sie testen
- Learnings, die daraus resultieren

Damit beantwortet die Plattform rückblickend: *Welche Initiative hat welche Änderung ausgelöst, welche Wirkung war messbar, was haben wir gelernt.*

## Experimente

MVP-Scope ist minimal:

- `Experiment { hypothesisId, variants[], startedAt, endedAt, status, conclusion }`
- `variants` verweist auf `AssetVersion` oder `LandingPageVariant`
- Auswertung initial als Freitext-Conclusion + strukturierte Kennzahlen-Referenzen
- Statistische Signifikanz-Tooling kommt in Phase 5

## Change Events — was gehört rein

Alles, was rückblickend die Frage "was hat sich am [Datum] geändert?" beantwortet:

- Statuswechsel auf allen versionierten Entitäten
- Neue AssetVersions
- Neue SyncRuns (Start/Ende)
- Neue Approvals/Rejections
- Neue Annotations mit `pinned: true`
- Relevante externe Ereignisse (z.B. Google Ads Policy Change) — manuell via Annotation, später via Webhook

Change Events sind append-only. Korrekturen werden als *neuer* Event mit `corrects: chg_...` eingetragen.

## Annotations — freie Kommentare auf der Zeitachse

Annotations sind die Stelle, an der Kontext landet, der *nicht* aus einem Statuswechsel kommt:

- "Landingpage-Redesign live seit 14:00"
- "Google hat die Budget-Empfehlung geändert"
- "Qualitativer Nutzer-Feedback-Cluster: Pflegegrad-Terminologie verwirrt"

Sie erscheinen in Timeline-Views neben Performance-Kurven und Change Events.

## Learnings — der Output

Ein `Learning` ist eine explizite Aussage, die aus Evidenz abgeleitet wurde:

```ts
Learning {
  statement: string;            // "Ansprache A schlägt B um 18% bei Chat-Start"
  confidence: "LOW" | "MEDIUM" | "HIGH";
  evidence: Reference[];        // Experimente, Performance-Zeitfenster, Outcomes
  initiativeId?: Id;
  hypothesisId?: Id;
  validUntil?: Date;            // optional: Learning verfällt
}
```

Learnings sind first-class und queryable. Ein `strategist`-Agent soll neue Initiativen *auf Basis von Learnings* vorschlagen.

## Messung + Wirkung

Zwei Zeitreihen-Quellen:

1. **PerformanceSnapshotDaily** — was der Kanal meldet (Impressions, Klicks, Kosten, Kanal-Conversions)
2. **ProductOutcomeEvent** — was im Produkt tatsächlich passiert (Chat gestartet, Pflegegrad-PDF erzeugt, ...)

Beide sind über Zeitfenster und Attribution verknüpfbar, aber **nicht verschmolzen**. Die Plattform legt bewusst Wert darauf, externe Kanal-Claims und interne Produkt-Wahrheit getrennt zu halten.

## Freeze-Periods und Change-Control (Phase 4)

Für sensible Phasen (z.B. Compliance-Audit, Kampagnen-Burst) kann ein `Freeze`-Fenster gesetzt werden. In diesem Fenster sind `APPROVED → SYNCED`-Transitions blockiert, es sei denn mit expliziter Freigabe. Noch nicht im MVP.
