# Marégraphes (SHOM) for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com) that brings the
**sea level measured by the tide gauges of the SHOM** (Service hydrographique et océanographique
de la Marine, REFMAR network: about 170 gauges on the coasts of mainland France, Corsica and the
overseas territories) into Gladys, with the **surge forecast** of the SHOM at the same gauge.
Public data, no account, no key.

> **Raw values, not a warning service.** Data can be late, missing or wrong. In a storm, follow
> the official warnings. Not affiliated with the SHOM.

For the tide **predictions** (high and low tides, coefficients), see
[William-De71/gladys-marees-france](https://github.com/William-De71/gladys-marees-france): this
integration gives what the sea actually does at a gauge, measured every minute.

## Features

- **One device per tide gauge**: measured sea level (m), tide trend (rising, falling, slack
  water), surge forecast now and highest surge forecast for the next 24 hours (cm), and the time
  of the last reading. A gauge silent for more than an hour says so ("No new reading since…")
  instead of showing an old value as a fresh one; no value is ever invented.
- **Gauges by SHOM number, by name or around your house** (the nearest gauge that sends readings,
  chosen inside the container from the location of your house in Gladys).
- **"Find tide gauges"** in the Configuration screen: around your house, by name or by number,
  with the distance and the current sea level.
- **Scene triggers**: _Surge forecast above a threshold_ (20, 30, 50, 80, 100 cm), _Surge back
  below a threshold_, _Surge above a threshold within 24 h_ (a warning ahead of time) and _Sea
  level above a threshold_ (0.5 to 12 m), with a hysteresis of 5 cm.
- **Scene action** _Tide gauge summary_: one sentence (sea level, trend, surge forecast) and the
  values as outputs.
- **Dashboard widget**: the followed gauges with sea level, trend and surge, or one gauge with its
  live values, the curve of the last 24 hours (can be hidden) and the highest surge to come.
- Four languages (English, French, German, Spanish).

## Requirements

- Gladys Assistant **5.3.0** or later (widgets, scene triggers and actions, `countries`).
- Internet access from Gladys to `services.data.shom.fr`.
- For "around my house": the location of your house in Gladys. The integration declares
  `location: true`, shown on the install screen.

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-maregraphes` (or install it from the catalog once it is
   listed). The install screen shows the **location** access it asks for.
2. In **Configuration**, press **Find tide gauges**, copy the numbers you want into **Tide
   gauges** (or choose **Around my house**), then save.
3. Open the **Discover** tab and press **Add to Gladys** on the gauges you want.

The user guide is in [`docs/en.md`](docs/en.md) ([français](docs/fr.md), [Deutsch](docs/de.md),
[español](docs/es.md)); Gladys links it from the Configuration screen.

## How it works

```
Integration container ──HTTPS──▶ services.data.shom.fr/maregraphie
      │                            observation/json/<id>?sources=1,9  one request per gauge and refresh
      │                            service/tidegauges                 gauge list, once a week
      │ SDK (WebSocket + host API)
      ▼
Gladys core ── devices, states, scene events, scene action, widget
```

- Source 1 is the raw sea level, every minute, in m; source 9 the surge forecast of the SHOM,
  every 10 minutes, a few days ahead. The tide prediction and the measured surge are not served
  by this keyless service: the integration publishes the forecast surge, and no measured surge.
- Devices are published with `should_poll: false` (the core does not poll external devices
  reliably, GladysAssistant/Gladys#3198): the integration refreshes itself every 5, 10 or 15
  minutes, asking each gauge for the readings since the previous request (24 hours the first
  time) and the forecast of the next 25 hours.
- Only the changes are published, plus a heartbeat every 12 hours. After an hour without a new
  reading the values are no longer sent: Gladys shows their real age.
- `/data/maregraphes.json` keeps the followed gauges, 24 hours of sea levels (one every 10
  minutes, every minute for the last 30), the surge forecast and the side of each threshold (so
  a crossing during a short restart still fires its trigger). Never the house coordinates.

## Limitations

- **Not a warning service.** No guarantee of delay or availability.
- **Not yet tested in a real Gladys installation: feedback welcome.** No hardware involved;
  tested against the live service and recorded answers of the SHOM (29/10/2026: Brest,
  Pointe-à-Pitre, Dunkerque).
- Raw real-time data, not validated by the SHOM. Sea levels are heights above the reference of
  each gauge (in general the chart datum): not depths, not comparable between gauges.
- No tide prediction, no measured surge (see above).
- 10 gauges at most from the configuration (plus the ones whose device you created).

## Development

Node.js 22+, ESM, no build step. The only runtime dependency is
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

```bash
npm install
npm test              # node --test, against the SDK's fake Gladys and recorded SHOM answers
npm run lint
npm run format:check
npx github:GladysAssistant/integration-store --skip-image-check .   # store validator
```

```
index.js              SDK wiring (src/app.js registers the handlers)
src/app.js            handlers → monitor, configuration action, scene action, widget
src/monitor.js        followed gauges, refresh cycles, states, scene triggers
src/shom.js           SHOM client and parsing
src/http.js           GET JSON with timeout and User-Agent
src/search.js         "Find tide gauges" action
src/scenes.js         "Tide gauge summary" scene action
src/devices.js        Gladys device of a gauge (features, names)
src/widgets.js        dashboard widget
src/messages.js       texts sent from the container, four languages
src/geo.js            distances
src/store.js          /data persistence
src/config.js         configuration defaults and normalization
test/fixtures/        recorded SHOM answers (see its README)
```

Versions are bumped by the **Release** workflow (Actions → Release), never by hand.

## Credits

- Data: **SHOM**, REFMAR network, and the organisations that run the gauges. Mention "SHOM /
  REFMAR", DOI [10.17183/REFMAR](https://dx.doi.org/10.17183/REFMAR); data of
  [data.shom.fr](https://data.shom.fr) under the Licence Ouverte / Open Licence (Etalab) 2.0.
- The structure follows [guim31/gladys-pegelonline](https://github.com/guim31/gladys-pegelonline)
  (Apache-2.0), the German river gauges counterpart.
- The cover shows the logo of the SHOM (trademark of the SHOM, from [shom.fr](https://www.shom.fr) and
  [Wikipedia](https://fr.wikipedia.org/wiki/Fichier:SHOM.png)), redrawn larger in its colours, without
  its French tagline.

Not affiliated with the SHOM. The SHOM is the French hydrographic and oceanographic service.

## License

Apache-2.0, see [LICENSE](LICENSE).
