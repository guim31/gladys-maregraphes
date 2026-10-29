# Marégraphes (SHOM)

Bringt den **von den Pegeln des SHOM gemessenen Wasserstand** (Service hydrographique et
océanographique de la Marine, Netz REFMAR: rund 170 Pegel an den Küsten Frankreichs, Korsikas und
der Überseegebiete) nach Gladys, dazu die **Windstau-Vorhersage** des SHOM für denselben Pegel.
Ohne Konto, ohne Schlüssel.

> **Rohdaten, kein Warndienst.** Die Wasserstände werden in Echtzeit ohne Prüfung durch den SHOM
> verbreitet; der Windstau ist eine Vorhersage. Daten können verspätet, lückenhaft oder falsch
> sein, und die Integration hängt von deinem Gladys, deinem Internetzugang und einem öffentlichen
> Dienst ab. Bei Sturm gelten die amtlichen Warnungen (Météo-France, Präfektur, 112). Diese
> Integration ist nicht mit dem SHOM verbunden.

Für die **Gezeitenvorhersage** (Hoch- und Niedrigwasser, Koeffizienten) gibt es die Integration
„Marées France“: diese hier zeigt, was das Meer an einem Pegel **tatsächlich** tut.

## Was du bekommst

- **Ein Gerät pro verfolgtem Pegel**: der **gemessene Wasserstand** (in m), die **Tendenz** der
  Gezeiten (steigt, fällt, Stauwasser), die **Windstau-Vorhersage** für jetzt und der **höchste
  vorhergesagte Windstau der nächsten 24 Stunden** (in cm) sowie die Uhrzeit der letzten Messung.
- Ein Pegel, der seit mehr als einer Stunde nichts sendet, wird so angezeigt („Keine neue Messung
  seit…“): Ein alter Wert wird nie als frisch erneut gesendet, und kein Wert wird erfunden.
- Vier **Szenenauslöser**: Die Windstau-Vorhersage steigt über eine Schwelle (20, 30, 50, 80 oder
  100 cm), fällt wieder darunter, der höchste vorhergesagte Windstau der nächsten 24 Stunden
  erreicht eine Schwelle (eine Vorwarnung), und der gemessene Wasserstand steigt über eine Höhe
  deiner Wahl.
- Eine **Szenenaktion**, „Pegel-Zusammenfassung“: ein Satz für eine Nachricht („Brest:
  Wasserstand 5,8 m, steigt, gemessen um 17:08. Windstau-Vorhersage jetzt: −2 cm.“).
- Ein **Dashboard-Widget**: deine Pegel mit Wasserstand, Tendenz und Windstau, oder ein Pegel mit
  seinen Live-Werten, der Kurve der letzten 24 Stunden und dem höchsten kommenden Windstau.
- Ein Button **„Pegel suchen“**, der die Pegel rund um dein Haus, nach Name oder Nummer, mit ihrem
  aktuellen Wasserstand auflistet.

## Voraussetzungen

- Gladys Assistant **5.3.0** oder neuer.
- Internetzugang für Gladys: Die Integration liest `services.data.shom.fr`.
- Für „Rund um mein Haus“: der Standort deines Hauses in Gladys (Einstellungen, Häuser). Die
  Integration fragt bei der Installation danach (Berechtigung „Standort“). Er wird nur im
  Container verwendet, um den nächsten Pegel zu finden: nie an den SHOM gesendet (der nur sieht,
  welche Pegel abgefragt werden), nie gespeichert oder protokolliert.

## Konfiguration

### Einstellungen

| Einstellung                | Was sie bewirkt                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Pegel                      | SHOM-Nummern oder Namen, durch Kommas getrennt: `3, Le Havre, Pointe-à-Pitre`. Eine data.shom.fr-Seite geht auch. |
| Rund um mein Haus          | Verfolgt auch den nächsten Pegel, der Messwerte sendet, im Umkreis von 25, 50 oder 100 km um dein Haus.           |
| Aktualisierungsintervall   | 5, 10 (Standard) oder 15 Minuten. Eine Anfrage pro Pegel.                                                         |
| Sprache der Funktionsnamen | Namen der Funktionen neuer Geräte und Sprache ihrer Texte, der Szenenvariablen und der Zusammenfassung.           |

Speichere, öffne dann den Tab **Entdecken** der Integration und lege die gewünschten Geräte an.
Ein verfolgter Pegel bleibt verfolgt, solange sein Gerät existiert, auch wenn du ihn aus der
Konfiguration entfernst.

### Deine Pegel finden

Klicke in der Konfiguration auf **„Pegel suchen“**. Lass das Feld leer, um die Pegel rund um dein
Haus aufzulisten (50 km oder die gewählte Entfernung), oder gib ein:

- einen Namen: `Brest`, `saint malo`, `Pointe à Pitre` (Groß- und Kleinschreibung, Akzente,
  Bindestriche und Unterstriche werden ignoriert);
- einen Teil eines Namens: `havre`;
- eine SHOM-Nummer: `3`.

Jede Zeile nennt die Nummer, den Namen, die Entfernung zu deinem Haus und den aktuellen
Wasserstand oder „keine aktuelle Messung“. Kopiere die Nummern in „Pegel“ und speichere.

## Geräte

| Funktion                   | Typ in Gladys          | Wert                                                                                                     |
| -------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| Gemessener Wasserstand     | Flüssigkeitstiefe (m)  | Die letzte Messung des Pegels, auf den Zentimeter, wie der SHOM sie verbreitet.                          |
| Gezeitentendenz            | Text                   | Steigt, Fällt oder Stauwasser, aus den letzten 15 bis 20 Minuten Messungen.                              |
| Windstau-Vorhersage (SHOM) | Flüssigkeitstiefe (cm) | Der Windstau, den der SHOM für jetzt vorhersagt: positiv über der vorhergesagten Tide, negativ darunter. |
| Höchster Windstau in 24 h  | Flüssigkeitstiefe (cm) | Der höchste vorhergesagte Windstau zwischen jetzt und in 24 Stunden.                                     |
| Letzte Messung             | Text                   | Uhrzeit der letzten Messung oder „Keine neue Messung seit…“.                                             |

Die beiden Windstau-Funktionen gibt es nur, wenn der SHOM den Windstau des Pegels vorhersagt. Der
**Wasserstand ist keine Tiefe**: Es ist die Höhe des Wassers über dem Bezugsniveau des Pegels
(meist das Seekartennull, die Null der Gezeitentafeln); er lässt sich mit den Höhen der
Gezeitentafel desselben Hafens vergleichen, nicht mit einem anderen Pegel. Die Geräteparameter
enthalten die SHOM-Nummer und das Netz (REFMAR, RONIM).

Wasserstand und Windstau sind numerische Funktionen: Gladys-Szenen können sie bereits mit jedem
Wert deiner Wahl vergleichen.

## Dashboard-Widget

Füge das Widget **Pegel** einem Dashboard hinzu.

- **Ohne Einstellung**: eine Zeile pro verfolgtem Pegel (höchstens 10) mit Wasserstand, Tendenz
  und Windstau-Vorhersage, gefärbt nach dem Windstau: grün unter 20 cm, orange ab 20 cm, rot ab
  50 cm, grau ohne aktuelle Messung. Eine Überschrift nennt die Pegel mit 20 cm oder mehr
  vorhergesagtem Windstau in den nächsten 24 Stunden.
- **Mit gewähltem Pegel**: sein Wasserstand und Windstau live, die Kurve des gemessenen
  Wasserstands der letzten 24 Stunden (eine Einstellung blendet sie aus), die Tendenz, der höchste
  vorhergesagte Windstau mit Uhrzeit, die letzte Messung und ein Link zu seiner data.shom.fr-Seite.

## Szenenauslöser

| Auslöser                                | Filter                          | Variablen                                                       |
| --------------------------------------- | ------------------------------- | --------------------------------------------------------------- |
| Windstau-Vorhersage über einer Schwelle | Pegel, Schwelle (20 bis 100 cm) | Name des Pegels, Schwelle, Windstau jetzt (cm), Wasserstand (m) |
| Windstau wieder unter einer Schwelle    | Pegel, Schwelle                 | Name des Pegels, Schwelle, Windstau jetzt (cm), Wasserstand (m) |
| Windstau über einer Schwelle in 24 h    | Pegel, Schwelle                 | Name des Pegels, Schwelle, höchster Windstau (cm), Zeitpunkt    |
| Wasserstand über einer Schwelle         | Pegel, Höhe (0,5 bis 12 m)      | Name des Pegels, Schwelle, Wasserstand (m)                      |

Ein Wert muss 5 cm unter eine Schwelle zurückgehen, bevor ein neues Überschreiten zählt: Ein
Windstau oder Wasserstand, der um eine Schwelle pendelt, löst einmal aus. Auslöser feuern nur für
ein angelegtes Gerät, mit frischen Daten, und nicht nach einem Neustart von mehr als 3 Stunden.

## Szenenaktion

**Pegel-Zusammenfassung** (Feld: der Pegel) liefert einen Satz in der Sprache der Konfiguration,
für eine Nachricht oder eine Sprachansage, und die Werte für die nächsten Aktionen: die
Zusammenfassung, den Wasserstand (m), die Windstau-Vorhersage jetzt und den höchsten Windstau in
24 Stunden (cm).

## Szenenbeispiele

- **Sturmwarnung**: „Windstau über einer Schwelle in 24 h“, dein Pegel, 50 cm → Nachricht senden:
  „{{station_name}}: Windstau von {{surge_peak}} cm erwartet am {{peak_time}}“.
- **Überfluteter Kai**: „Wasserstand über einer Schwelle“, Saint-Malo, 12 m → die Familie
  benachrichtigen und das Garagentor schließen.
- **Morgenbericht**: jeden Tag um 7:00 „Pegel-Zusammenfassung“ deines Hafens → die
  Zusammenfassung senden.
- **Entwarnung**: „Windstau wieder unter einer Schwelle“, 30 cm → „Der Windstau ist vorbei“.

## Datenquellen, Lizenz und Kontingente

- Daten: **SHOM**, Netz REFMAR (Réseaux de référence des observations marégraphiques), und die
  Betreiber der Pegel (Häfen, Gebietskörperschaften, Météo-France…). Nennung: „SHOM / REFMAR“, DOI
  [10.17183/REFMAR](https://dx.doi.org/10.17183/REFMAR). Die Daten von data.shom.fr stehen unter
  der Licence Ouverte (Etalab) 2.0; das Widget nennt die Quelle.
- Die Wasserstände sind **Echtzeit-Rohdaten** („Quelle 1“ des SHOM, jede Minute), ungeprüft
  verbreitet: Diese Werte können Fehler enthalten, die später in den validierten Reihen korrigiert
  werden, die die Integration nicht nutzt.
- Der Windstau ist die **Vorhersage** des SHOM („Quelle 9“, alle 10 Minuten, einige Tage im
  Voraus). Der gemessene Windstau (Wasserstand minus Gezeitenvorhersage) braucht die Vorhersage,
  die dieser schlüssellose Dienst nicht liefert: Die Integration berechnet ihn nicht.
- Kein Konto, kein Schlüssel, kein dokumentiertes Kontingent. Die Integration bleibt sparsam:
  **eine Anfrage pro Pegel und Aktualisierung** (standardmäßig 10 Minuten), für die Messungen seit
  der vorigen und die Vorhersage der nächsten 25 Stunden; die Pegelliste (etwa 30 kB) einmal pro
  Woche.

## Fehlerbehebung

- **„Unbekannter Pegel“**: Prüfe die Schreibweise oder nutze „Pegel suchen“ und kopiere die
  Nummer.
- **„Der Dienst des SHOM antwortet nicht“**: Der Dienst oder dein Internetzugang ist ausgefallen;
  die Werte kommen von selbst zurück.
- **„Rund um mein Haus“ fügt nichts hinzu**: Gib deinem Haus einen Standort (Einstellungen,
  Häuser) oder wähle eine größere Entfernung. Nur ein Pegel mit einer Messung in der letzten
  Stunde wird gewählt.
- **Keine Windstau-Funktion**: Der SHOM sagt den Windstau dieses Pegels nicht vorher.
- **„Keine neue Messung seit…“**: Der Pegel ist ausgefallen oder verspätet (die SHOM-Liste führt
  viele als „verspätet“ oder „außer Betrieb“); die Werte kommen von selbst zurück.
- Protokolle: in Gladys die Protokolle der Integration; `LOG_LEVEL=debug` zeigt jeden Zyklus.

## Grenzen

- Gegen den echten Dienst und aufgezeichnete Antworten getestet, aber noch nicht in einer echten
  Gladys-Installation: Rückmeldungen sind willkommen.
- Keine Gezeitenvorhersage und kein gemessener Windstau: Die Integration veröffentlicht den
  gemessenen Wasserstand und die Windstau-Vorhersage des SHOM.
- Höchstens 10 Pegel aus der Konfiguration (plus die, deren Gerät du angelegt hast).
- Die Funktionsnamen werden beim Anlegen des Geräts festgelegt: Eine spätere Sprachänderung
  betrifft nur die danach gesendeten Texte.
