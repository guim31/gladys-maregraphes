// -----------------------------------------------------------------------------
// One Gladys device per SHOM tide gauge.
//
// Features (couples checked against the Gladys front, see
// test/gladys-rules.test.js):
//   - height        level-sensor/liquid-depth, m: the sea level measured by the
//                   gauge (raw real-time data, above the chart datum of the
//                   gauge as the SHOM serves it);
//   - trend         text/text: rising, falling or slack water, from the last
//                   15 minutes of readings;
//   - surge         level-sensor/liquid-depth, cm: the surge forecast of the
//                   SHOM for now (positive: the sea stands above the tide
//                   prediction, negative: below), when the SHOM forecasts it for
//                   the gauge;
//   - surge_peak    level-sensor/liquid-depth, cm: the highest surge forecast for
//                   the next 24 hours, same condition;
//   - last_reading  text/text: the time of the last measurement, or "no new
//                   reading since…" once the gauge is silent.
//
// Published with should_poll: false: the refresh runs in the container
// (src/monitor.js). The platform id is the SHOM id of the gauge (3 for Brest),
// stable for the life of the gauge.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';

export const DEVICE_TYPE = 'tide-gauge';
export const FEATURE_KEYS = {
  HEIGHT: 'height',
  TREND: 'trend',
  SURGE: 'surge',
  SURGE_PEAK: 'surge_peak',
  LAST_READING: 'last_reading',
};

// Display bounds (history chart, gauge). The largest tidal range of France is
// about 14 m (Granville); a few gauges measure above another datum. Surges
// beyond ±3 m are unheard of on French coasts. A signed value needs symmetric
// bounds.
export const HEIGHT_BOUNDS = [-10, 20];
export const SURGE_BOUND_CM = 300;

// Feature names, frozen at creation in Gladys (language of the configuration).
export const NAMES = {
  en: {
    height: 'Measured sea level',
    trend: 'Tide trend',
    surge: 'Surge forecast (SHOM)',
    surge_peak: 'Highest surge in 24 h',
    last_reading: 'Last reading',
  },
  fr: {
    height: "Hauteur d'eau mesurée",
    trend: 'Tendance de la marée',
    surge: 'Surcote prévue (SHOM)',
    surge_peak: 'Surcote max. sur 24 h',
    last_reading: 'Dernière mesure',
  },
  de: {
    height: 'Gemessener Wasserstand',
    trend: 'Gezeitentendenz',
    surge: 'Windstau-Vorhersage (SHOM)',
    surge_peak: 'Höchster Windstau in 24 h',
    last_reading: 'Letzte Messung',
  },
  es: {
    height: 'Nivel del mar medido',
    trend: 'Tendencia de la marea',
    surge: 'Sobreelevación prevista (SHOM)',
    surge_peak: 'Sobreelevación máx. en 24 h',
    last_reading: 'Última medición',
  },
};

/** External ids of a gauge device and of its features. */
export function stationIds(gladys, id) {
  const ids = gladys.externalIds(DEVICE_TYPE, id);
  return {
    device: ids.device,
    ...Object.fromEntries(Object.values(FEATURE_KEYS).map((key) => [key, ids.feature(key)])),
  };
}

/** The gauge id of a device or feature external id (null if not ours). */
export function stationIdOf(gladys, externalId) {
  const prefix = gladys.externalIds(DEVICE_TYPE, '').device;
  if (typeof externalId !== 'string' || !externalId.startsWith(prefix)) {
    return null;
  }
  return externalId.slice(prefix.length).split(':')[0] || null;
}

const sensor = (name, externalId, category, type, extra) => ({
  name,
  external_id: externalId,
  category,
  type,
  read_only: true,
  has_feedback: false,
  ...extra,
});

/**
 * The discovery payload of a gauge.
 * @param {object} gladys
 * @param {object} station see src/shom.js parseStation, plus `surge`: whether
 *   the SHOM forecasts the surge of this gauge
 * @param {string} language language of the feature names
 */
export function buildDevice(gladys, station, language = 'fr') {
  const ids = stationIds(gladys, station.id);
  const names = NAMES[language] ?? NAMES.fr;
  const C = DEVICE_FEATURE_CATEGORIES;
  const depth = TYPES.LEVEL_SENSOR.LIQUID_DEPTH;
  const text = (name, id) =>
    sensor(name, id, C.TEXT, TYPES.TEXT.TEXT, { keep_history: false, min: 0, max: 0 });
  const features = [
    sensor(names.height, ids.height, C.LEVEL_SENSOR, depth, {
      unit: DEVICE_FEATURE_UNITS.M,
      keep_history: true,
      min: HEIGHT_BOUNDS[0],
      max: HEIGHT_BOUNDS[1],
    }),
    text(names.trend, ids.trend),
  ];
  if (station.surge) {
    for (const key of ['surge', 'surge_peak']) {
      features.push(
        sensor(names[key], ids[key], C.LEVEL_SENSOR, depth, {
          unit: DEVICE_FEATURE_UNITS.CM,
          keep_history: true,
          min: -SURGE_BOUND_CM,
          max: SURGE_BOUND_CM,
        }),
      );
    }
  }
  features.push(text(names.last_reading, ids.last_reading));
  const params = [{ name: 'SHOM_ID', value: station.id }];
  if (station.network) {
    params.push({ name: 'NETWORK', value: station.network });
  }
  return {
    name: station.name,
    external_id: ids.device,
    model: station.network ? `SHOM · ${station.network}` : 'SHOM',
    should_poll: false,
    params,
    features,
  };
}
