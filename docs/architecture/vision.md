# Vision — Marketing OS

## Problem

Agentisches Marketing produziert viele Artefakte (Copy, Kampagnen, Hypothesen, Varianten, Änderungen) in hoher Frequenz. Ohne eine operative Wahrheitsschicht passiert typischerweise Folgendes:

- Änderungen verschwinden in Plattform-UIs (Google Ads, Meta) ohne Kontext und ohne Historie.
- Hypothesen und Learnings leben in Chats, Dokumenten oder im Kopf einzelner Personen.
- Performance-Daten und inhaltliche Änderungen lassen sich nicht belastbar zueinander in Beziehung setzen.
- Agenten arbeiten jeder für sich, ohne geteilten Zustand.
- Rückblickend ist nicht mehr rekonstruierbar, *warum* etwas besser oder schlechter wurde.

## Zielbild

Das Marketing OS ist **die interne operative Wahrheitsschicht** für Marketing. Alles Relevante entsteht, lebt und wird versioniert im OS — unabhängig davon, wohin es am Ende synchronisiert wird.

Das bedeutet:

1. **Single Source of Truth für Marketing-Artefakte.** Kampagnen, Assets, Versionen, Freigaben, Hypothesen, Learnings, Experimente.
2. **Verlässliche Zeitachse.** Jede Änderung ist ein Event, jede Performance-Zahl ist ein Snapshot. Rückblickend rekonstruierbar.
3. **Agentenfähig.** Agenten lesen, schreiben (als Draft), schlagen vor, reviewen, approven und synchen — über klar definierte Services und Statusmodelle.
4. **Plattform-agnostisch.** Externe Kanäle sind Adapter, nicht Kern. Das interne Modell bleibt auch bei Kanalwechsel stabil.
5. **Mandantenfähig.** Mehrere Produkte/Brands/Ventures laufen sauber getrennt auf derselben Plattform. Pflegemax ist Produkt Nummer 1, nicht das einzige.

## Was das OS *nicht* ist

- **Kein weiteres Ad-Tool.** Es ersetzt Google Ads/Meta Ads nicht, es steuert sie.
- **Keine BI-Plattform.** Es liefert die Daten, die später in BI fließen können.
- **Kein CMS.** Landingpage-Inhalte können referenziert werden, leben aber primär im Content-System des jeweiligen Produkts.
- **Kein Agenten-Runtime.** Die Agenten laufen in einem separaten Marketing-Workspace. Das OS ist deren Backend.

## Erster Anwendungsfall: Pflegemax

Pflegemax ist eine virtuelle digitale Pflegeberatung. Nutzer suchen diffus nach Hilfe ("Pflegegeld", "Pflegegrad beantragen", "Pflegehilfe", "Pflegeversicherung Hilfe") und sind oft überfordert.

**Aktueller Fokus ist nicht Monetarisierung**, sondern:

- Nutzer gewinnen
- Nutzer zum Chat-Start führen
- Nutzer zu konkreten Produkt-Outcomes führen
- daraus lernen und iterieren

Relevante Produkt-Outcomes (siehe `docs/domain/metrics-and-outcomes.md`):

- Chat gestartet
- erste sinnvolle Nachrichten geschrieben
- Pflegewegweiser durchlaufen
- Pflegegrad-Antrag gestartet / PDF erzeugt
- Pflegegrad-Simulation durchlaufen
- Pflegetagebuch gestartet
- Leistungsauswahl durchlaufen

Das OS muss diese Outcomes als First-Class-Zeitreihe kennen, damit Kampagnen-Performance nicht nur an Klicks, sondern an *Produktwirkung* gemessen werden kann.

## Nord-Sterne

- **Rekonstruierbarkeit schlägt Bequemlichkeit.** Lieber ein Event mehr speichern als später raten müssen.
- **Draft-First.** Nichts geht live, ohne dass es intern existiert, versioniert und freigegeben ist.
- **Kleine, klare Entitäten.** Wenige starke Modelle statt vieler halbgarer.
- **Evolutionsfähigkeit vor Vollständigkeit.** MVP klein, Fundament tragfähig.
