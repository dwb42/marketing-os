# Open Questions & Assumptions

Stand: Phase 1. Diese Liste soll vor Phase 2/3 auf Grün gebracht werden.

## Annahmen (mit denen aktuell gebaut wird)

1. **Postgres** ist verfügbar (lokal via Docker, produktiv als Managed Service).
2. **Ein Workspace pro Venture** reicht im MVP. Sub-Workspaces / Projects innerhalb eines Workspaces sind nicht nötig.
3. **Ein Brand pro Product** im MVP (1:1). Die Modellierung erlaubt später 1:n.
4. **Agenten laufen außerhalb** des OS (separates Claude-Code-Workspace). Das OS ruft *keine* Agenten auf.
5. **Keine PII** in `ProductOutcomeEvent`. Nur aggregierte/pseudonymisierte Ereignisse.
6. **Attribution** ist initial bewusst simpel: Zeitfenster-basiert, keine Multi-Touch-Modelle.
7. **Google Ads API v17** als Zielversion. Node-Client offiziell oder `google-ads-api`.
8. **Ein Deployment, eine Region.** Multi-Region ist out of scope.
9. **Server-Zeit in UTC.** Pro Workspace gibt es eine `timezone` für Anzeigelogik.

## Offene Fragen

### Produkt & Modell
- **Pflegemax-Outcomes:** Welche genauen Event-Typen und Properties? Erste Liste: siehe `metrics-and-outcomes.md`. Braucht Bestätigung.
- **Landingpages bei Pflegemax:** Wo leben die Inhalte? Headless CMS? Eigene App? Das entscheidet, ob `LandingPageVariant` Content hält oder nur referenziert.
- **Attribution:** Wie wird ein `ProductOutcomeEvent` einer `Campaign` zugerechnet? UTM? First-Touch? Letzter Klick? MVP-Vorschlag: UTM-basiert, `attribution` als JSONB speichert Raw-Kontext.
- **Budgets:** Gehören Budgets in den MVP-Scope oder erst Phase 4? Aktuell: nicht im MVP.
- **Experimente-Statistik:** Soll das OS selbst Signifikanz rechnen oder nur Rohdaten liefern? Vorschlag: erst Phase 5.

### Integration
- **Google Ads Konten:** Gibt es bereits ein verknüpfbares MCC? Developer Token beantragt?
- **Meta Ads:** Existiert ein Business Manager + App für OAuth?
- **Conversion-Tracking:** Läuft Conversion-Meldung an Google bereits über einen bestehenden Kanal (GTM, GA4, Server-side)? Das entscheidet, ob `PerformanceSnapshotDaily.conversions` verlässlich ist.

### Agenten
- **Authentifizierung:** Service-Tokens ausreichend, oder braucht es signierte JWTs von Tag 1? Vorschlag: Service-Tokens MVP, JWT in Phase 4.
- **Agent-Identitäten:** Ein Token pro Rolle oder pro Agent-Instanz? Vorschlag: pro Rolle im MVP, pro Instanz in Phase 4.
- **Proposal-Review:** Wer reviewed Agenten-Vorschläge zur Plattformstruktur? Vorschlag: menschliches Operator-Team.

### Ops
- **Deployment-Ziel:** Fly.io / Render / eigener Server? Beeinflusst Secret-Handling und Job-Runner-Wahl.
- **Backups:** PITR Anforderung? Vorschlag: Managed Postgres mit Daily + PITR 7d ab Phase 3.
- **Secrets:** Wo liegen `MOS_CREDENTIAL_KEY` und API-Keys? 1Password + Env-Injection? Doppler?

### Sicherheit & Compliance
- **Datenklassen:** Sind Inhalte (Ad Copy) oder Outcomes als personenbezogen einzustufen? Wenn nein, erleichtert das Phase 3 erheblich.
- **Zugriffs-Audit:** Muss jeder API-Call auditierbar sein? Vorschlag: Ja, via strukturiertem Access-Log ab Phase 2.

## Entscheidungspunkte

| ID   | Entscheidung                                                  | Nötig vor |
| ---- | ------------------------------------------------------------- | --------- |
| D-01 | Attribution-Modell (UTM vs. andere)                           | Phase 2   |
| D-02 | Landingpage-Content-Quelle                                    | Phase 2   |
| D-03 | Google Ads MCC + Developer Token                              | Phase 3   |
| D-04 | Deployment-Ziel                                               | Phase 2   |
| D-05 | Agent-Token-Modell (per Rolle vs. per Instanz)                | Phase 4   |
| D-06 | RBAC / RLS Tiefe im MVP                                       | Phase 4   |
