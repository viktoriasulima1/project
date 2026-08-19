# FarmOS Agricultural Localization Glossary

Date: 2026-07-23. Authoritative label translations for agronomic terms. Values
in code stay canonical English tokens; this table governs the **labels** only.
Names such as **Ctgb**, **BRP**, **BBCH** and product registration numbers are
never translated. Terms marked ⚠ need native/agronomic review (see backlog).

| Concept (en-GB) | nl-NL | pl-PL | de-DE |
| --- | --- | --- | --- |
| Field | Perceel | Pole | Schlag |
| Parcel | Perceel | Działka | Parzelle |
| Crop | Gewas | Uprawa | Kultur |
| Crop protection | Gewasbescherming | Ochrona roślin | Pflanzenschutz |
| Spraying | Spuiten | Oprysk | Spritzen |
| Spray window | Spuitvenster | Okno oprysku | Spritzfenster ⚠ |
| Dose | Dosering | Dawka | Aufwandmenge |
| Water volume | Watervolume | Ilość wody | Wassermenge |
| Active ingredient | Werkzame stof | Substancja czynna | Wirkstoff |
| Growth stage | Groeistadium | Faza rozwojowa | Wachstumsstadium |
| BBCH | BBCH | BBCH | BBCH |
| Scouting | Scouten / Gewasinspectie ⚠ | Lustracja | Monitoring |
| Observation | Waarneming | Obserwacja | Beobachtung |
| Symptom | Symptoom | Objaw | Symptom |
| Suspected issue | Vermoedelijk probleem | Podejrzewany problem | Vermuteter Befund |
| Confirmed issue | Bevestigd probleem | Potwierdzony problem | Bestätigter Befund |
| Work order | Werkorder | Zlecenie | Arbeitsauftrag |
| Stock | Voorraad | Stan magazynowy | Bestand |
| Harvest | Oogst | Zbiór | Ernte |
| Yield | Opbrengst | Plon | Ertrag |
| Cost per hectare | Kosten per hectare | Koszt na hektar | Kosten pro Hektar |
| Gross margin | Brutomarge | Marża brutto | Rohertrag ⚠ |
| Compliance | Compliance | Zgodność | Compliance |
| Operator certificate | Spuitlicentie ⚠ | Certyfikat operatora ⚠ | Sachkundenachweis ⚠ |
| Machine | Machine | Maszyna | Maschine |
| Nozzle | Spuitdop | Dysza | Düse |
| Drift reduction | Driftreductie | Redukcja znoszenia | Abdriftminderung |
| Ctgb | Ctgb | Ctgb | Ctgb |
| BRP | BRP | BRP | BRP |

## Rules

- Canonical domain values (`good`, `spray`, `resolved`, …) are language-independent
  and never appear in this table as *values* — only their display labels vary.
- Legal/compliance terms (operator certificate, gross margin, spray window) must
  be confirmed by a native + domain reviewer before beta — flagged ⚠.
- Do not machine-translate registration numbers, Ctgb/BRP/BBCH identifiers, or
  audit-event names.
