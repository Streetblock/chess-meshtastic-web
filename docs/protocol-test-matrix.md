# Protocol Test Matrix (v1.0 <-> v2.0)

Dieses Dokument beschreibt den minimalen Interop-Testumfang fuer den `feature-protocol-v2-0` Branch.

## Ziel

- Stabiler Spielstart zwischen Legacy (`1.0`) und `2.0`
- `MOVE`/`SYNC` Kommunikation ohne HMAC
- Fallback-Verhalten in gemischten Versionen pruefen

## Matrix

| Local Client | Remote Client | Erwartung Start | Erwartung Zuege/Sync | Ergebnis |
| --- | --- | --- | --- | --- |
| 1.0 | 1.0 | Legacy `H/S/K` | Legacy `M/C` | TBD |
| 2.0 | 2.0 | pv2 `START/ACK` + Legacy-Handshake weiterhin kompatibel | pv2 `MOVE/SYNC` mit Legacy-Fallback | TBD |
| 2.0 | 1.0 | Start ueber Legacy kompatibel | Zuege/Sync ueber Legacy `M/C` (Fallback) | TBD |
| 1.0 | 2.0 | Start ueber Legacy kompatibel | Zuege/Sync ueber Legacy `M/C` | TBD |

## Manueller Smoke-Test Plan (1.0 <-> 2.0)

1. Zwei Knoten verbinden, gleiche Channel-Konfiguration sicherstellen.
2. Spiel von `2.0` gegen `1.0` starten.
3. Pruefen:
- beide Seiten erhalten dieselbe `gameId`
- Farbe wird auf beiden Seiten gesetzt
- Spielstatus wechselt von "Waiting for handshake" zu "to move"
4. Je Seite mindestens 3 gueltige Zuege machen.
5. Pruefen:
- jeder Zug kommt genau einmal beim Gegenueber an
- `moveCount` bleibt auf beiden Seiten konsistent
6. Sync-Fall pruefen:
- auf einer Seite kurz warten bis Sync-Mechanismus anspringt
- Gegenstelle antwortet mit kompatibler Count-Info
7. Neustart eines Spiels im selben Pairing pruefen:
- alte `gameId` wird nicht weiterverwendet
- neuer Start laeuft ohne UI-Reset-Fehler

## Log-Hinweise

- pv2-Logs sollten nur bei `2.0 <-> 2.0` sichtbar sein.
- Bei `1.0 <-> 2.0` duerfen keine harten pv2-Abbrueche auftreten; Legacy muss weiter funktionieren.
