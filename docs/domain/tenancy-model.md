# Tenancy Model

## Entitäts-Hierarchie

```
Workspace              (Venture / Organisation)
  └── Brand            (Markenauftritt)
        └── Product    (operativer Fokus, z.B. Pflegemax)
              └── AudienceSegment, Initiative, Campaign, Asset, ...
```

- **Workspace** ist die oberste Trennlinie. Alles Mandanten-behaftete trägt `workspaceId`.
- **Brand** lebt in einem Workspace. Eine Brand kann mehrere Produkte tragen.
- **Product** gehört zu genau einer Brand und einem Workspace. Kampagnen, Assets, Outcomes hängen an `productId`.
- **AudienceSegment** gehört zu einem Product.

## Warum diese Trennung

- **Mehrere Ventures** teilen sich dieselbe Plattform, ohne dass Daten, Kampagnen oder Learnings vermischt werden.
- **Mehrere Produkte pro Brand** (später) erlauben z.B. "Pflegemax-Hauptprodukt" + "Pflegemax-Rechner" unter derselben Marke.
- **Mehrere Brands pro Workspace** erlauben eine Organisation, die mehrere Marken betreibt.

## Durchsetzung

### Phase 1–3 (MVP)

- Jede Tabelle mit Mandanten-Bezug hat `workspaceId NOT NULL`
- Alle Queries gehen über Services, die `workspaceId` als Pflichtparameter führen
- Repositories haben kein `findAll()` ohne `workspaceId`
- Review-Regel: *jeder* Query ohne `workspaceId` in einem Mandanten-Scope ist ein Bug

### Phase 4+

- Postgres Row-Level-Security pro Workspace aktivieren
- Datenbank-User kriegt `SET app.workspace_id` pro Session/Request
- Damit ist der Mandanten-Schutz auch bei Service-Bugs hart durchgesetzt

## Cross-Workspace-Operationen

Es gibt genau zwei erlaubte Fälle, die über Workspaces hinweg lesen dürfen:

1. **Operator/Admin-Endpoints** (menschlich, nicht Agenten)
2. **Plattform-interne Jobs** (z.B. Housekeeping), die explizit über alle Workspaces iterieren

Alles andere ist verboten.

## Was explizit *kein* Mandant ist

- `Actor` (Agenten und Operatoren sind global bekannt)
- `IntegrationAccount` ist *pro Workspace* — also mandatorisch getrennt, auch wenn dieselben Credentials theoretisch in zwei Workspaces nutzbar wären

## Seed-Regeln für Pflegemax

```
Workspace: wsp_pflegemax_team       (Slug: "pflegemax-team")
Brand:     brd_pflegemax             (Name: "Pflegemax")
Product:   prd_pflegemax_core        (Name: "Pflegemax — Digitale Pflegeberatung")
```

Später kann ein zweites Produkt (z.B. `prd_pflegemax_b2b`) oder eine zweite Brand hinzukommen — die Plattform muss das ohne Schemaänderung tragen.
