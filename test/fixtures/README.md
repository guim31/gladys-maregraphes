# Test fixtures

- `gladys-feature-table.json`: the category/type couples, units and poll frequencies the Gladys
  core and front know (extracted from the Gladys code), used by `test/gladys-rules.test.js`.
- `shom/tidegauges-2026-10-29.json`: a real answer of
  `https://services.data.shom.fr/maregraphie/service/tidegauges` (176 gauges, public data),
  recorded on 29/10/2026 and kept as is.
- `shom/observation-<id>.json`: real answers of
  `https://services.data.shom.fr/maregraphie/observation/json/<id>?sources=1,9&dtStart=2026-10-29T10:12:00Z&dtEnd=2026-10-30T16:12:00Z`,
  recorded at 16:12 UTC the same day, kept as is: Brest (3), Pointe-à-Pitre (125, Guadeloupe) and
  Dunkerque (2, marked `KO` in the list but still sending). The sea levels (source 1, every
  minute) end at 16:08 UTC; the surge forecasts (source 9, every 10 minutes) run until the next
  day.

`test/helpers/world.js` serves them as the service would (`sources`, `dtStart` and `dtEnd`
filters; an unknown gauge answers an empty list) and lets the tests add sea levels and replace the
forecast.
