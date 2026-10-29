# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- First version: the sea level measured by the SHOM tide gauges (REFMAR network, mainland France,
  Corsica and overseas), the tide trend, the surge forecast of the SHOM now and its highest value
  within 24 hours, and the time of the last reading, one device per gauge.
- Gauges by SHOM number, by name or around the house, and a "Find tide gauges" action.
- Scene triggers: surge forecast above a threshold, back below it, above a threshold within 24
  hours, and sea level above a threshold.
- Scene action "Tide gauge summary": one sentence and the values as outputs.
- Dashboard widget: the followed gauges, or one gauge with its 24-hour curve.
- English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-maregraphes/commits/main
