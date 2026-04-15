# Phases

Kurzübersicht der Phasen mit Deliverables. Details: siehe `docs/architecture/roadmap.md` und `docs/delivery/implementation-plan.md`.

| Phase | Name                                 | Ergebnis (verifizierbar)                                                                                                       |
| ----- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Architektur & Grundgerüst            | Doku + Prisma-Schema + lauffähiges Fastify-Skelett + Service-Stubs                                                             |
| 2     | Pflegemax-MVP                        | Pflegemax als erstes Produkt auf dem OS; Campaign-Flow vollständig (Draft→Approved) über API; Timeline-Endpoint                |
| 3     | Google Ads Connector                 | Täglicher Pull von Performance-Daten mit Idempotenz, SyncRun-Tracking, Fehlerklassifikation                                    |
| 4     | Agent Collaboration + Controlled Sync | Agenten-Token, Policies, Push-Pfad zu Google Ads, Proposals                                                                    |
| 5     | Erweiterbarkeit                      | Meta Ads + zweites Produkt + Experiment-Auswertung + erste Dashboards/Exports                                                  |

## Parallelisierbarkeit

- Phase 2 und 3 können teilweise parallel laufen: Connector-Interfaces sind ab Phase 1 fixiert, ein Team kann gegen Fakes bauen, während das andere den Pflegemax-Flow fertigstellt.
- Phase 4 setzt funktionierende Phasen 2 und 3 voraus.
- Phase 5 setzt Phase 4 voraus (Controlled Sync ist Bedingung für sichere Erweiterung).

## Risiken pro Phase (Highlights)

- **Phase 2:** Status-/Transition-Matrix zu eng oder zu lose modelliert → später schmerzhafte Migrationen.
- **Phase 3:** Google-Ads-API-Rate-Limits und OAuth-Lifecycle unterschätzt.
- **Phase 4:** Push-Idempotenz und Fehlerfolgen zwischen `SyncRun` und externem Zustand.
- **Phase 5:** Zweites Produkt bringt implizite Mandanten-Leaks ans Licht (Queries ohne `workspaceId`).
