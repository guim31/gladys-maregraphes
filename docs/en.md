# Marégraphes (SHOM)

Brings the **sea level measured by the tide gauges of the SHOM** (Service hydrographique et
océanographique de la Marine, REFMAR network: about 170 gauges on the coasts of mainland France,
Corsica and the overseas territories) into Gladys, with the **surge forecast** of the SHOM at the
same gauge. No account, no key.

> **Raw values, not a warning service.** The sea levels are sent in real time without validation
> by the SHOM; the surge is a forecast. Data can be late, missing or wrong, and the integration
> depends on your Gladys, your Internet access and a public service. In a storm, follow the
> official warnings (Météo-France "vagues-submersion" vigilance, your prefecture, 112). This
> integration is not affiliated with the SHOM.

For the **tide predictions** (high and low tides, coefficients), see the "Marées France"
integration: this one gives what the sea **actually** does at a gauge.

## What you get

- **One device per tide gauge** you follow: the **measured sea level** (in m), the **trend** of
  the tide (rising, falling, slack water), the **surge forecast** for now and the **highest surge
  forecast for the next 24 hours** (in cm), and the time of the last reading.
- A gauge that stops sending for more than an hour is shown as such ("No new reading since…"):
  an old value is never sent again as if it were fresh, and no value is invented.
- Four **scene triggers**: the surge forecast rises above a threshold (20, 30, 50, 80 or 100 cm),
  falls back below it, the highest surge forecast for 24 hours reaches a threshold (a warning
  ahead of time), and the measured sea level rises above a height of your choice.
- A **scene action**, "Tide gauge summary": one sentence to send in a message ("Brest: sea level
  5.8 m, rising, measured at 17:08. Surge forecast now: −2 cm.").
- A **dashboard widget**: your gauges with their sea level, trend and surge, or one gauge with its
  live values, the curve of the last 24 hours and the highest surge to come.
- A **"Find tide gauges"** button that lists the gauges around your house, by name or by number,
  with their current sea level.

## Requirements

- Gladys Assistant **5.3.0** or later.
- Internet access from Gladys: the integration reads `services.data.shom.fr`.
- For "around my house": the location of your house in Gladys (Settings, Houses). The integration
  asks for it at installation (the "location" permission). It is only used inside the container
  to find the nearest gauge: never sent to the SHOM (which only sees which gauges are asked for),
  never stored nor logged.

## Configuration

### Settings

| Setting                       | What it does                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Tide gauges                   | SHOM numbers or names, separated by commas: `3, Le Havre, Pointe-à-Pitre`. A data.shom.fr page also works. |
| Around my house               | Also follows the nearest gauge that sends readings, within 25, 50 or 100 km of your house.                 |
| Refresh interval              | 5, 10 (default) or 15 minutes. One request per gauge.                                                      |
| Language of the feature names | Names of the features of new devices, and language of their texts, of the scene variables and the summary. |

Save, then open the **Discover** tab of the integration and create the devices you want. A
followed gauge stays followed as long as its device exists, even if you remove it from the
configuration.

### Finding your tide gauges

Click **"Find tide gauges"** in the configuration. Leave the field empty to list the gauges around
your house (50 km, or the distance chosen), or type:

- a name: `Brest`, `saint malo`, `Pointe à Pitre` (case, accents, hyphens and underscores are
  ignored);
- part of a name: `havre`;
- a SHOM number: `3`.

Each line gives the number, the name, the distance from your house and the current sea level, or
"no recent reading". Copy the numbers into "Tide gauges", then save.

## Devices

| Feature               | Type in Gladys    | Value                                                                                    |
| --------------------- | ----------------- | ---------------------------------------------------------------------------------------- |
| Measured sea level    | Liquid depth (m)  | The last reading of the gauge, to the centimetre, as the SHOM serves it.                 |
| Tide trend            | Text              | Rising, Falling or Slack water, from the last 15 to 20 minutes of readings.              |
| Surge forecast (SHOM) | Liquid depth (cm) | The surge the SHOM forecasts for now: positive above the predicted tide, negative below. |
| Highest surge in 24 h | Liquid depth (cm) | The highest surge forecast between now and 24 hours from now.                            |
| Last reading          | Text              | Time of the last reading, or "No new reading since…".                                    |

The two surge features only exist when the SHOM forecasts the surge of the gauge (if the forecast appears after you created the device, "Update" it in the Discover tab). A silent gauge shows "Unknown" as trend. The **sea level
is not a depth**: it is the height of the water above the reference of the gauge (in general the
chart datum, the zero of the tide tables), so it compares with the heights of the tide tables of
the same harbour, not with another gauge. The device parameters hold the SHOM number and the
network (REFMAR, RONIM).

The sea level and the surges are numeric features: Gladys scenes can already compare them with
any value of your own.

## Dashboard widget

Add the **Tide gauges** widget to a dashboard.

- **Without setting**: one line per followed gauge (10 at most) with its sea level, trend and
  surge forecast, coloured by the surge: green below 20 cm, orange from 20 cm, red from 50 cm, grey
  without a recent reading. A heading names the gauges with 20 cm or more forecast within 24 hours.
- **With a gauge chosen**: its live sea level and surge, the curve of the measured sea level over
  the last 24 hours (a setting hides it), the trend, the highest surge forecast with its time, the
  last reading and a link to its data.shom.fr page.

## Scene triggers

| Trigger                             | Filters                              | Variables                                            |
| ----------------------------------- | ------------------------------------ | ---------------------------------------------------- |
| Surge forecast above a threshold    | Tide gauge, threshold (20 to 100 cm) | Gauge name, threshold, surge now (cm), sea level (m) |
| Surge back below a threshold        | Tide gauge, threshold                | Gauge name, threshold, surge now (cm), sea level (m) |
| Surge above a threshold within 24 h | Tide gauge, threshold                | Gauge name, threshold, highest surge (cm), its time  |
| Sea level above a threshold         | Tide gauge, height (0.5 to 12 m)     | Gauge name, threshold, sea level (m)                 |

A value must go 5 cm back below a threshold before crossing it again counts: a surge or a level
wobbling around a threshold fires once. Triggers only fire for a device you created (the surge triggers follow the SHOM forecast, even when the gauge stops measuring), and not after a restart longer than 3 hours.

## Scene action

**Tide gauge summary** (field: the tide gauge) gives a sentence in the language of the
configuration, for a message or a voice announcement, and the values for the next actions: the
summary, the sea level (m), the surge forecast now and the highest surge within 24 hours (cm).

## Scene examples

- **Storm warning**: "Surge above a threshold within 24 h", your gauge, 50 cm → send a message:
  "{{station_name}}: surge of {{surge_peak}} cm expected at {{peak_time}}".
- **Quay flooding**: "Sea level above a threshold", Saint-Malo, 12 m → notify the family and close
  the garage door.
- **Morning report**: every day at 7:00, "Tide gauge summary" of your harbour → send the summary.
- **All clear**: "Surge back below a threshold", 30 cm → "The surge is over".

## Data sources, licence and quotas

- Data: **SHOM**, REFMAR network (Réseaux de référence des observations marégraphiques), and the
  organisations that run the gauges (harbours, local authorities, Météo-France…). Mention: "SHOM /
  REFMAR", DOI [10.17183/REFMAR](https://dx.doi.org/10.17183/REFMAR). The data of data.shom.fr is
  published under the Licence Ouverte / Open Licence (Etalab) 2.0; the widget names the source.
- The sea levels are **raw real-time data** ("source 1" of the SHOM, every minute), published
  without validation: they can contain wrong values, and are corrected later in the validated
  series the integration does not use.
- The surge is the **forecast** of the SHOM ("source 9", every 10 minutes, a few days ahead). The
  measured surge (sea level minus the tide prediction) needs the prediction, which this keyless
  service does not serve: the integration does not compute it.
- No account, no key, no documented quota. The integration stays light: **one request per gauge
  and per refresh** (10 minutes by default), for the readings since the previous one and the
  forecast of the next 25 hours; the gauge list (about 30 kB) once a week.

## Troubleshooting

- **"Unknown tide gauge"**: check the spelling or use "Find tide gauges", then copy the number.
- **"The SHOM service does not answer"**: the service or your Internet access is down; the values
  come back by themselves.
- **"Around my house" adds nothing**: give your house a location (Settings, Houses), or choose a
  larger distance. Only a gauge that sent a reading within the hour is chosen.
- **No surge feature**: the SHOM does not forecast the surge of this gauge.
- **"No new reading since…"**: the gauge is down or late (the SHOM list marks many of them "late"
  or "out of order"); the values come back by themselves.
- Logs: in Gladys, the integration logs; set `LOG_LEVEL=debug` for every cycle.

## Limits

- Tested against the live service and against recorded answers, but not yet in a real Gladys
  installation: feedback welcome.
- No tide prediction and no measured surge: the integration publishes the measured sea level and
  the surge forecast of the SHOM.
- 10 gauges at most from the configuration (plus the ones whose device you created).
- The feature names are frozen when the device is created: changing the language later only
  changes the texts sent afterwards.
