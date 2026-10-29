// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// Select values are strings in the manifest (stored by Gladys as typed); the
// normalized config holds numbers.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Kilometres around the house where the nearest tide gauge is followed; '0' = off.
// French coasts have a gauge every few tens of km, overseas islands far fewer.
export const HOME_RADII = ['0', '25', '50', '100'];

// Minutes between two readings. Gauges send a value every minute, the surge
// forecast moves every 10 minutes: faster would only load the SHOM service.
export const REFRESH_INTERVALS = ['5', '10', '15'];

// Tide gauges followed "around my house": the nearest one that sends readings.
export const HOME_STATIONS = 1;

// Upper bound of the gauges taken from the configuration: one request per
// gauge and per cycle stays modest for a public service.
export const MAX_STATIONS = 10;

export const DEFAULT_CONFIG = {
  stations: '',
  around_home: '0',
  refresh_interval: '10',
  language: 'fr',
};

// SHOM tide gauge id: digits only, e.g. 3 for Brest.
const ID = /^\d{1,6}$/;
// The data.shom.fr page of a gauge: …/donnees/refmar/3
const ID_IN_URL = /\/refmar\/(\d{1,6})\b/i;

/**
 * What one token of the "Tide gauges" field designates: a SHOM id or a name.
 * Names may hold spaces ("Le Havre"): tokens are only separated by commas,
 * semicolons and line breaks.
 */
export function parseToken(token) {
  const text = String(token ?? '').trim();
  const inUrl = ID_IN_URL.exec(text);
  if (inUrl) {
    return { kind: 'id', value: inUrl[1], text };
  }
  if (ID.test(text)) {
    return { kind: 'id', value: String(Number(text)), text };
  }
  return { kind: 'name', value: text, text };
}

/** The tokens of the "Tide gauges" field, duplicates removed. */
export function parseStations(text) {
  const seen = new Set();
  const tokens = [];
  for (const raw of String(text ?? '').split(/[,;\n]+/)) {
    if (!raw.trim()) {
      continue;
    }
    const token = parseToken(raw);
    const key = `${token.kind}:${normalizeName(token.value)}`;
    if (!seen.has(key)) {
      seen.add(key);
      tokens.push(token);
    }
  }
  return tokens;
}

/**
 * A name reduced for comparison: case, accents, underscores, hyphens and
 * punctuation ignored, so "Le Havre", "LE_HAVRE" and "le-havre" match.
 */
export function normalizeName(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const pick = (value, allowed, fallback) =>
  allowed.includes(String(value)) ? Number(value) : Number(fallback);

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    stations: parseStations(source.stations),
    homeRadiusKm: pick(source.around_home, HOME_RADII, DEFAULT_CONFIG.around_home),
    refreshMinutes: pick(
      source.refresh_interval,
      REFRESH_INTERVALS,
      DEFAULT_CONFIG.refresh_interval,
    ),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
