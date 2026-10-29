// -----------------------------------------------------------------------------
// The "Find tide gauges" configuration action: lists gauges with their SHOM
// number, distance from the house and current sea level, so the user can copy
// their numbers into the configuration.
//
// What can be typed:
//   - nothing: the gauges around the house (its location in Gladys);
//   - a SHOM number (3) or a data.shom.fr page address;
//   - words: matched against the gauge names ("Brest", "Saint-Malo", "Havre"),
//     accents, case, hyphens and underscores ignored. The matches are listed
//     nearest to the house first, else by name.
//
// The search is made on the gauge list (downloaded once a week): the house
// coordinates never leave Gladys and the container. The current sea level is
// asked only for the listed gauges (10 at most).
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { parseToken } from './config.js';
import { distanceKm } from './geo.js';
import { SEARCH, formatHeight, formatNumber, render } from './messages.js';
import { Monitor } from './monitor.js';

const logger = createLogger({ name: 'maregraphes-search' });

export const SEARCH_RADII = ['25', '50', '100', '200'];
const DEFAULT_RADIUS_KM = 50;
const MAX_RESULTS = 10;
const HOUR = 60 * 60 * 1000;

/** Distance from the house to a gauge in km, null when one has no location. */
const distanceTo = (house, station) =>
  house && station.latitude !== null && station.longitude !== null
    ? distanceKm(house.latitude, house.longitude, station.latitude, station.longitude)
    : null;

/** The gauges of a query with their distance, nearest first, else by name. */
async function candidates(monitor, text, radiusKm, stations) {
  const house = await monitor.house();
  const query = text.trim();
  if (!query) {
    return house ? { list: Monitor.around(stations, house, radiusKm) } : { error: 'noHouse' };
  }
  const token = parseToken(query);
  const found =
    token.kind === 'id'
      ? stations.filter((station) => station.id === token.value)
      : stations.filter((station) => Monitor.matches(station, query.split(/\s+/).filter(Boolean)));
  const list = found.map((station) => ({ station, km: distanceTo(house, station) }));
  list.sort((a, b) =>
    a.km !== null && b.km !== null ? a.km - b.km : a.station.name.localeCompare(b.station.name),
  );
  return { list };
}

/** The last sea level of a gauge within the hour, or null (never throws). */
async function lastHeight(monitor, id) {
  try {
    const now = monitor.now();
    const { heights } = await monitor.api.observations(id, now - HOUR, now);
    const last = heights.at(-1);
    return last && monitor.isFresh(last.t) ? last.v : null;
  } catch {
    return null;
  }
}

/**
 * Handler of the `search_stations` action.
 * @param {Monitor} monitor
 * @param {{ query?: string, radius?: string }} fields
 */
export async function searchStations(monitor, fields = {}) {
  const radiusKm = SEARCH_RADII.includes(String(fields.radius))
    ? Number(fields.radius)
    : DEFAULT_RADIUS_KM;
  try {
    const stations = await monitor.stationList();
    if (!stations) {
      return render(SEARCH, 'unavailable');
    }
    const found = await candidates(monitor, String(fields.query ?? ''), radiusKm, stations);
    if (found.error) {
      return render(SEARCH, found.error);
    }
    const total = found.list.length;
    const listed = found.list.slice(0, MAX_RESULTS);
    logger.info(`Tide gauge search: ${total} gauge(s) found`);
    if (listed.length === 0) {
      return render(SEARCH, 'none');
    }
    // One after the other: a public service, asked politely.
    const heights = [];
    for (const { station } of listed) {
      heights.push(await lastHeight(monitor, station.id));
    }
    return Object.fromEntries(
      Object.keys(SEARCH).map((language) => {
        const texts = SEARCH[language];
        const lines = listed.map(({ station, km }, index) => {
          const parts = [`${station.id} — ${station.name}`];
          if (km !== null) {
            parts.push(`${formatNumber(km, language, 0)} km`);
          }
          parts.push(
            heights[index] === null ? texts.noRecent : formatHeight(heights[index], language),
          );
          return parts.join(', ');
        });
        return [language, `${texts.found({ count: listed.length, total })}\n${lines.join('\n')}`];
      }),
    );
  } catch (err) {
    logger.warn(`Tide gauge search failed: ${err.message}`);
    return render(SEARCH, 'unavailable');
  }
}
