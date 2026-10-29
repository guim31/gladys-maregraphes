// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake SHOM serving the
// recorded answers of test/fixtures (filtered by dates the way the real
// service filters), a manual clock, a temporary /data, and the integration
// wired on top through registerHandlers. Nothing touches the network.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { parseTime } from '../../src/shom.js';
import { Store } from '../../src/store.js';

process.env.LOG_LEVEL ??= 'silent';
process.env.TZ = 'Europe/Paris';

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));

// The recorded sea levels end at 16:08 UTC on 29/10/2026: the clock starts at 16:10.
export const START = Date.parse('2026-10-29T16:10:00Z');
export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;

// A house in Brest (public coordinates of the harbour).
export const HOUSE = {
  id: 'house-1',
  name: 'Maison',
  selector: 'maison',
  latitude: 48.3825,
  longitude: -4.495,
};

// Recorded gauges: Brest, Pointe-à-Pitre (Guadeloupe) and Dunkerque (state KO
// in the list, but still sending readings).
export const BREST = '3';
export const POINTE_A_PITRE = '125';
export const DUNKERQUE = '2';
// In the list, without recorded readings: answers an empty list.
export const LE_CONQUET = String(
  fixture('shom/tidegauges-2026-10-29.json').find((s) => s.name === 'LE_CONQUET')?.shom_id,
);

const iso = (time) =>
  new Date(time)
    .toISOString()
    .replace(/\.\d{3}Z$/, '')
    .replace(/-/g, '/')
    .replace('T', ' ');

/** Fake SHOM. `api.down`: 'network' (connection refused), a status (503) or false. */
export function createApi() {
  const list = structuredClone(fixture('shom/tidegauges-2026-10-29.json'));
  const series = {};
  for (const id of [BREST, POINTE_A_PITRE, DUNKERQUE]) {
    series[id] = structuredClone(fixture(`shom/observation-${id}.json`).data);
  }

  const api = {
    list,
    series,
    down: false,
    requests: [],

    /** A new sea level of a gauge (m). */
    addHeight(id, time, value) {
      (series[id] ??= []).push({ idstation: Number(id), idsource: 1, value, timestamp: iso(time) });
    },

    /** Sea levels every minute from `from` to `to` (included), from a function of the time. */
    fillHeights(id, from, to, valueAt) {
      for (let time = from; time <= to; time += MINUTE) {
        api.addHeight(id, time, valueAt(time));
      }
    },

    /** Replace the surge forecast of a gauge (m), every 10 minutes from `from` to `to`. */
    setSurges(id, from, to, valueAt) {
      series[id] = (series[id] ?? []).filter((item) => item.idsource !== 9);
      for (let time = from; time <= to; time += 10 * MINUTE) {
        series[id].push({
          idstation: Number(id),
          idsource: 9,
          value: valueAt(time),
          timestamp: iso(time),
        });
      }
    },

    answer(url) {
      if (url.pathname.endsWith('/maregraphie/service/tidegauges')) {
        return list;
      }
      const match = /\/maregraphie\/observation\/json\/(\d+)$/.exec(url.pathname);
      if (!match) {
        return null;
      }
      const sources = (url.searchParams.get('sources') ?? '').split(',').map(Number);
      const from = Date.parse(url.searchParams.get('dtStart'));
      const to = Date.parse(url.searchParams.get('dtEnd'));
      const data = (series[match[1]] ?? []).filter((item) => {
        const t = parseTime(item.timestamp);
        return sources.includes(item.idsource) && t >= from && t <= to;
      });
      return { data };
    },

    async fetch(input) {
      const url = new URL(input);
      api.requests.push(url);
      if (api.down === 'network') {
        throw new TypeError('fetch failed');
      }
      if (api.down) {
        return { status: api.down, text: async () => 'Service Unavailable' };
      }
      const body = api.answer(url);
      if (body === null) {
        return { status: 404, text: async () => 'Page is missing' };
      }
      return { status: 200, text: async () => JSON.stringify(body) };
    },
  };
  return api;
}

/** A manual clock. */
export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {Array} [options.houses] houses of Gladys
 * @param {object} [options.api] from createApi
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers] true: the monitor's own timer runs (mock it)
 */
export async function createWorld({
  config = {},
  devices = [],
  houses = [HOUSE],
  api = createApi(),
  connect = true,
  timers = false,
  clock = createClock(),
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-maregraphes-')),
} = {}) {
  const gladys = createFakeGladys({ config, devices, houses });
  const store = new Store(dataDir);
  const app = registerHandlers(gladys, {
    store,
    fetch: api.fetch,
    timers,
    now: clock.now,
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
    await app.monitor.running;
  }
  return { gladys, fake: gladys.fake, app, monitor: app.monitor, api, clock, store, dataDir };
}

/** The device published for a gauge id, from the last discovery list. */
export const discovered = (world, id) =>
  world.fake.discoveredDevices.find((device) =>
    device.params.some((p) => p.name === 'SHOM_ID' && p.value === id),
  );

/** Create the device of a gauge in Gladys, as the user would. */
export async function create(world, id) {
  const device = discovered(world, id);
  if (!device) {
    throw new Error(`${id} is not in the discovered devices`);
  }
  await world.fake.deviceCreated(device);
  return device;
}

/** External id of one feature of a device. */
export const featureId = (device, key) =>
  device.features.find((feature) => feature.external_id.endsWith(`:${key}`))?.external_id;

/** Run one refresh cycle, `minutes` later. */
export async function cycle(world, minutes = 10) {
  world.clock.advance(minutes * MINUTE);
  await world.monitor.runCycle();
}

/**
 * Capture the integration's log lines at `level` and above (LOG_LEVEL is read
 * at every call). Returns the lines as `{ level, text }`.
 */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
