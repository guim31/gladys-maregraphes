// -----------------------------------------------------------------------------
// The tide gauge services of the SHOM (Service hydrographique et océanographique
// de la Marine), the ones data.shom.fr calls for the REFMAR network: keyless,
// no account.
//
//   maregraphie/service/tidegauges                 every tide gauge (~176): id,
//                                                  name, position, state, network
//   maregraphie/observation/json/<id>?sources=1,9&dtStart=…&dtEnd=…
//                                                  the readings of one gauge:
//                                                    source 1  raw sea level, every
//                                                              minute, in m, sent
//                                                              without validation;
//                                                    source 9  surge forecast of the
//                                                              SHOM, every 10 minutes,
//                                                              in m, up to ~3 days ahead.
//
// Times are UTC, written "2026/10/29 12:00:00". An unknown source answers 400,
// an unknown gauge 403 (ids only come from the list), a gauge without data an
// empty list. The tide prediction (source 7) and the
// measured surge (source 8) are not served by this keyless service: the
// integration publishes the forecast surge of the SHOM as it is, and never
// invents a measured surge.
//
// Everything is turned into plain objects here, so the rest of the code never
// reads the API shapes.
// -----------------------------------------------------------------------------

import { getJson } from './http.js';

export const API_URL = 'https://services.data.shom.fr/maregraphie';
export const SITE_URL = 'https://data.shom.fr/donnees/refmar';

/** The public page of a tide gauge on data.shom.fr. */
export const stationPage = (id) => `${SITE_URL}/${encodeURIComponent(id)}`;

export const SOURCES = { HEIGHT: 1, SURGE_FORECAST: 9 };

// Words kept in capitals when a name is put in title case.
const KEEP_UPPER = new Set(['LH', 'RO', 'UHSLC', 'II', 'III']);
const LOWER = new Set(['DE', 'DU', 'DES', 'LA', 'LE', 'LES', 'D', 'L', 'EN', 'SUR', 'A', 'AUX']);

/** "LE_HAVRE" → "Le Havre", "PORT-LA-NOUVELLE" → "Port-la-Nouvelle". */
export function titleCase(text) {
  return String(text ?? '')
    .replace(/_/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word, index) =>
      word
        .split('-')
        .map((part, partIndex) => {
          if (KEEP_UPPER.has(part)) {
            return part;
          }
          if ((index > 0 || partIndex > 0) && LOWER.has(part)) {
            return part.toLowerCase();
          }
          return part.charAt(0) + part.slice(1).toLowerCase();
        })
        .join('-'),
    )
    .join(' ');
}

const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** "2026/10/29 12:00:00" (UTC) → ms, NaN when malformed. */
export function parseTime(text) {
  const match = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(text ?? ''));
  if (!match) {
    return NaN;
  }
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

/** ms → "2026-10-29T12:00:00Z", the form the service takes. */
export const formatQueryTime = (time) => new Date(time).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** A tide gauge of the list, reduced and renamed. */
export function parseStation(raw) {
  return {
    id: String(raw.shom_id),
    name: titleCase(raw.name),
    code: String(raw.name ?? ''),
    latitude: finite(raw.latitude),
    longitude: finite(raw.longitude),
    // OK, ASYNC (late), OLD, KO, PB (problem), HIDDEN.
    state: raw.state ?? null,
    network: raw.reseau ?? null,
  };
}

export class Shom {
  /**
   * @param {object} [options]
   * @param {Function} [options.fetch]
   */
  constructor({ fetch: fetchImpl } = {}) {
    this.fetch = fetchImpl ?? globalThis.fetch;
  }

  /** Every tide gauge but the hidden ones: ~28 kB. */
  async referential() {
    const body = await getJson(this.fetch, `${API_URL}/service/tidegauges`);
    if (!Array.isArray(body)) {
      throw new Error('SHOM: unexpected answer for the tide gauge list');
    }
    return body
      .filter((raw) => raw && raw.shom_id !== undefined && raw.state !== 'HIDDEN')
      .map(parseStation);
  }

  /**
   * The sea levels (source 1) and surge forecasts (source 9) of a gauge between
   * two times, oldest first, values in m.
   * @returns {Promise<{ heights: Array<{t:number,v:number}>, surges: Array<{t:number,v:number}> }>}
   */
  async observations(id, from, to) {
    const url =
      `${API_URL}/observation/json/${encodeURIComponent(id)}` +
      `?sources=${SOURCES.HEIGHT},${SOURCES.SURGE_FORECAST}` +
      `&dtStart=${formatQueryTime(from)}&dtEnd=${formatQueryTime(to)}`;
    const body = await getJson(this.fetch, url);
    if (!body || !Array.isArray(body.data)) {
      throw new Error('SHOM: unexpected answer for the readings');
    }
    const heights = [];
    const surges = [];
    for (const item of body.data) {
      const t = parseTime(item?.timestamp);
      const v = finite(item?.value);
      if (!Number.isFinite(t) || v === null) {
        continue;
      }
      if (item.idsource === SOURCES.HEIGHT) {
        heights.push({ t, v });
      } else if (item.idsource === SOURCES.SURGE_FORECAST) {
        surges.push({ t, v });
      }
    }
    const byTime = (a, b) => a.t - b.t;
    return { heights: heights.sort(byTime), surges: surges.sort(byTime) };
  }
}
