// -----------------------------------------------------------------------------
// The monitor: which tide gauges are followed, their readings, the states
// published to Gladys and the scene triggers. Everything the SDK handlers, the
// action, the scene action and the widget need goes through it (src/app.js
// wires it).
//
// Followed gauges: the "Tide gauges" field and "around my house" of the
// configuration (MAX_STATIONS at most), plus every gauge whose device the user
// created (deleting the device stops following it).
//
// Scheduling: the devices are published with should_poll: false (the core does
// not poll external devices reliably, GladysAssistant/Gladys#3198). The monitor
// runs a cycle at the configured interval: ONE SHOM request per followed gauge,
// for the sea levels since the last one (24 hours the first time, for the
// widget chart) and the surge forecast of the next 25 hours. The gauge list,
// needed to resolve names and to find the gauge nearest to the house, is
// downloaded only when needed and kept a week in memory.
//
// States: `publishChangedStates` sends only what changed, plus a heartbeat every
// 12 hours. A sea level older than an hour is never sent again as if it were
// fresh: the values stop, the "Last reading" feature says since when.
//
// Logs: at info, only the lifecycle (start, gauges followed, a gauge going
// silent or coming back, a threshold crossed). A failure that repeats at every
// cycle is logged once, then at debug until it recovers, with one line at
// recovery. LOG_LEVEL=debug shows every cycle. The coordinates of the house
// are never logged nor sent: the gauge nearest to it is chosen locally.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { HOME_STATIONS, MAX_STATIONS, normalizeName } from './config.js';
import { buildDevice, stationIds, stationIdOf } from './devices.js';
import { distanceKm } from './geo.js';
import { READINGS, STATUS, TREND_NAMES, formatDate, join, render } from './messages.js';
import { Shom } from './shom.js';

const logger = createLogger({ name: 'maregraphes' });

export const WIDGET_KEY = 'tide_gauges';
export const TRIGGERS = {
  SURGE_ABOVE: 'surge_above',
  SURGE_BACK_TO_NORMAL: 'surge_back_to_normal',
  SURGE_FORECAST_ABOVE: 'surge_forecast_above',
  HEIGHT_ABOVE: 'height_above',
};

// Thresholds a scene can wait for (manifest trigger fields), as strings: the
// core filters scene events by equality only.
export const SURGE_THRESHOLDS = ['20', '30', '50', '80', '100'];
export const HEIGHT_THRESHOLDS = [
  '0.5',
  '1',
  '1.5',
  '2',
  '2.5',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
];

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const DEFAULT_TIMINGS = {
  // Without a newer sea level, a value is not published again as a fresh one.
  staleAfterMs: HOUR,
  // The gauge list (names, positions) is downloaded again after a week.
  referentialMaxAgeMs: 7 * DAY,
  // A failed download of the gauge list is tried again after this delay.
  referentialRetryMs: HOUR,
  // The gauge around the house is chosen again once a day.
  homeMaxAgeMs: DAY,
  // A threshold side remembered for longer fires no trigger when it changes (restart).
  memoryMs: 3 * HOUR,
  // Sea levels kept for the widget chart.
  historyMs: DAY,
  // Surge forecast asked ahead of now (the peak covers 24 hours).
  forecastMs: 25 * HOUR,
  heartbeatMs: 12 * HOUR,
  // requestWidgetRefresh is rate-limited to one call every 10 s by the core.
  widgetRefreshMs: 10000,
};

// Sea levels kept at full resolution (every minute) for the trend; older ones
// are thinned to one every 10 minutes for the chart (144 points a day).
const FULL_RESOLUTION_MS = 30 * MINUTE;
const CHART_STEP_MS = 10 * MINUTE;
// Below this change in 15 minutes, the tide is slack: 2 cm.
const SLACK_M = 0.02;
// A value must go this far back below a threshold before crossing it again
// counts: readings wobbling around it fire one event, not one per cycle.
const SURGE_HYSTERESIS_CM = 5;
const HEIGHT_HYSTERESIS_M = 0.05;
// The forecast surge "now" is the last forecast point at most this old.
const SURGE_NOW_MAX_AGE_MS = 30 * MINUTE;
// Gauges asked for a fresh reading when choosing the one around the house.
const HOME_CANDIDATES = 5;

const mean = (points) => points.reduce((sum, point) => sum + point.v, 0) / points.length;

/**
 * Rising, falling or slack, from sea levels oldest first (`{ t, v }`): the
 * mean of the last 5 minutes against the mean 15 to 20 minutes earlier (the
 * readings are noisy to a few mm). Null without enough readings.
 */
export function trendOf(heights) {
  const latest = heights.at(-1);
  if (!latest) {
    return null;
  }
  const recent = heights.filter((point) => latest.t - point.t <= 5 * MINUTE);
  const earlier = heights.filter(
    (point) => latest.t - point.t >= 15 * MINUTE && latest.t - point.t <= 20 * MINUTE,
  );
  if (earlier.length === 0) {
    return null;
  }
  const change = mean(recent) - mean(earlier);
  if (change >= SLACK_M) {
    return 'rising';
  }
  return change <= -SLACK_M ? 'falling' : 'slack';
}

export class Monitor {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK fake)
   * @param {object} options.store see src/store.js
   * @param {Function} [options.fetch] fetch, for the SHOM
   * @param {boolean} [options.timers] false: no background timer (tests drive the cycles)
   * @param {Function} [options.now] clock in ms
   * @param {object} [options.timings] overrides of DEFAULT_TIMINGS
   */
  constructor({ gladys, store, fetch: fetchImpl, timers = true, now, timings }) {
    this.gladys = gladys;
    this.store = store;
    this.api = new Shom({ fetch: fetchImpl });
    this.timers = timers;
    this.now = now ?? (() => Date.now());
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.config = null;
    this.data = emptyData();
    // The gauge list, in memory only: { stations, fetchedAt }.
    this.referential = null;
    this.referentialFailedAt = -Infinity;
    // Gauges of the configuration, in order (field, then house).
    this.configured = [];
    this.problems = { unknown: [], noHouse: false, tooMany: false };
    this.resolved = false;
    this.lastCycleAt = -Infinity;
    this.statusMessage = undefined;
    this.cycleTimer = null;
    this.running = null;
    this.lastRefreshAt = -Infinity;
    this.refreshTimer = null;
    this.rerun = null;
    this.stopped = false;
    // Keys of the failures already logged, so a repeated one is not logged again.
    this.failing = new Set();
  }

  /** Log a failure once (warn or error), then at debug until `recovered(key)`. */
  failed(key, level, message, err) {
    const details = err ? [message, err] : [message];
    if (this.failing.has(key)) {
      logger.debug(...details);
      return;
    }
    this.failing.add(key);
    logger[level](...details);
  }

  /** One line when a failure logged by `failed(key)` is over. */
  recovered(key, message) {
    if (this.failing.delete(key)) {
      logger.info(message);
    }
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    this.config = config;
    const saved = await this.store.load();
    if (saved?.version === 1) {
      this.data = { ...emptyData(), ...saved };
    }
    // Scheduled first: a failure below must not leave the integration without cycles.
    this.schedule();
    await this.runCycle();
    await this.publishDiscovered();
    logger.info(
      `Started: ${this.followed().length} tide gauge(s) followed, refreshed every ${config.refreshMinutes} min`,
    );
  }

  /** Reconnection: Gladys may have restarted, publish everything again. */
  async resync(config) {
    this.config = config;
    if (!this.cycleTimer) {
      this.schedule();
    }
    await this.publishDiscovered();
    this.statusMessage = undefined;
    await this.updateConnectionStatus();
    this.gladys.forgetPublishedStates?.();
    await this.publishStates(this.created());
    this.requestRefresh();
  }

  async reconfigure(config) {
    const before = this.followed().join(',');
    this.config = config;
    this.data.home = null;
    this.resolved = false;
    // A cycle already running reads the old configuration: run another one after it.
    await this.runCycle({ again: true });
    await this.publishDiscovered();
    const after = this.followed();
    if (after.join(',') !== before) {
      logger.info(`Configuration saved: ${after.length} tide gauge(s) followed`);
    }
    this.schedule();
    this.requestRefresh();
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.cycleTimer);
    clearTimeout(this.refreshTimer);
    this.cycleTimer = null;
    await this.running?.catch(() => {});
    await this.store.flush();
  }

  schedule() {
    if (!this.timers || this.stopped) {
      return;
    }
    clearInterval(this.cycleTimer);
    this.cycleTimer = setInterval(() => this.runCycle(), this.config.refreshMinutes * MINUTE);
    this.cycleTimer.unref?.();
  }

  save() {
    return this.store.save(this.data);
  }

  // --- Which gauges ------------------------------------------------------------

  /** Gauge ids whose device exists in Gladys. */
  created() {
    return [
      ...new Set(
        (this.gladys.devices ?? [])
          .map((device) => stationIdOf(this.gladys, device.external_id))
          .filter(Boolean),
      ),
    ];
  }

  /** The device of a gauge in Gladys, or undefined. */
  deviceOf(id) {
    const externalId = stationIds(this.gladys, id).device;
    return (this.gladys.devices ?? []).find((device) => device.external_id === externalId);
  }

  isCreated(id) {
    return Boolean(this.deviceOf(id));
  }

  /** Every followed gauge: the configured ones, then the created ones. */
  followed() {
    return [...new Set([...this.configured, ...this.created()])];
  }

  /** What the integration knows of a gauge, a created device filling the gaps. */
  station(id) {
    const known = this.data.stations[id];
    if (known) {
      return known;
    }
    const device = this.deviceOf(id);
    if (!device) {
      return null;
    }
    const param = (name) => device.params?.find((p) => p.name === name)?.value;
    return {
      id,
      name: device.name ?? id,
      network: param('NETWORK') ?? null,
      latitude: null,
      longitude: null,
      surge: (device.features ?? []).some((f) => f.external_id.endsWith(':surge')),
    };
  }

  /** The name shown for a gauge: the one given in Gladys, else the SHOM one. */
  displayName(id) {
    return this.deviceOf(id)?.name ?? this.station(id)?.name ?? id;
  }

  /** The gauge list, downloaded when missing or a week old; null when unavailable. */
  async stationList() {
    const now = this.now();
    const fresh =
      this.referential && now - this.referential.fetchedAt < this.timings.referentialMaxAgeMs;
    if (fresh || now - this.referentialFailedAt < this.timings.referentialRetryMs) {
      return this.referential?.stations ?? null;
    }
    try {
      const stations = await this.api.referential();
      this.referential = { stations, fetchedAt: now };
      this.recovered('referential', 'SHOM tide gauge list downloaded again');
      logger.debug(`Tide gauge list: ${stations.length} gauges`);
    } catch (err) {
      this.referentialFailedAt = now;
      this.failed('referential', 'warn', `Cannot download the tide gauge list: ${err.message}`);
    }
    return this.referential?.stations ?? null;
  }

  /** The gauge a token of the configuration designates, from the list. */
  static find(stations, token) {
    if (token.kind === 'id') {
      return stations.find((station) => station.id === token.value) ?? null;
    }
    const wanted = normalizeName(token.value);
    return (
      stations.find((station) =>
        [station.code, station.name].some((name) => normalizeName(name) === wanted),
      ) ?? null
    );
  }

  /**
   * Resolve the configuration into gauge ids, with the gauge list. Without it,
   * the gauges found before are kept.
   */
  async resolve() {
    const problems = { unknown: [], noHouse: false, tooMany: false };
    const ids = [];
    const add = (station) => {
      if (!ids.includes(station.id)) {
        ids.push(station.id);
      }
      const known = this.data.stations[station.id];
      this.data.stations[station.id] = { ...station, surge: known?.surge ?? false };
    };
    const needList = this.config.homeRadiusKm > 0 || this.config.stations.length > 0;
    const stations = needList ? await this.stationList() : null;
    let complete = !needList || stations !== null;
    if (stations) {
      for (const token of this.config.stations) {
        const station = Monitor.find(stations, token);
        if (station) {
          add(station);
        } else {
          problems.unknown.push(token.text);
        }
      }
    }
    if (this.config.homeRadiusKm > 0 && stations) {
      try {
        const home = await this.homeStations(stations);
        if (home === null) {
          problems.noHouse = true;
        } else {
          home.map((id) => stations.find((station) => station.id === id)).forEach(add);
        }
        this.recovered('home', 'Tide gauge around the house chosen again');
      } catch (err) {
        complete = false;
        this.failed(
          'home',
          'warn',
          `Cannot choose the tide gauge around the house yet: ${err.message}`,
        );
      }
    }
    if (ids.length > MAX_STATIONS) {
      problems.tooMany = true;
      ids.length = MAX_STATIONS;
    }
    // A failed resolution keeps the gauges found before it.
    this.configured = complete ? ids : [...new Set([...this.configured, ...ids])];
    this.problems = complete
      ? problems
      : { ...problems, unknown: [...new Set([...this.problems.unknown, ...problems.unknown])] };
    this.resolved = complete;
    for (const name of problems.unknown) {
      this.failed(`unknown:${name}`, 'warn', `Unknown tide gauge: ${name}`);
    }
  }

  /**
   * The first house of Gladys that has a location, or null. A failure to read
   * the houses throws with `strict` (the gauge is chosen again later), and
   * resolves null otherwise (the search then asks for a location).
   */
  async house({ strict = false } = {}) {
    try {
      const houses = await this.gladys.getHouses();
      return (
        houses.find(
          (house) => Number.isFinite(house.latitude) && Number.isFinite(house.longitude),
        ) ?? null
      );
    } catch (err) {
      if (strict) {
        throw new Error(`cannot read the houses of Gladys: ${err.message}`, { cause: err });
      }
      this.failed('houses', 'warn', `Cannot read the houses of Gladys: ${err.message}`);
      return null;
    }
  }

  /** Gauges of the list around a point, nearest first, with their distance. */
  static around(stations, origin, radiusKm) {
    return stations
      .filter((station) => station.latitude !== null && station.longitude !== null)
      .map((station) => ({
        station,
        km: distanceKm(origin.latitude, origin.longitude, station.latitude, station.longitude),
      }))
      .filter(({ km }) => km <= radiusKm)
      .sort((a, b) => a.km - b.km);
  }

  /**
   * The nearest gauge around the house that sent a sea level lately
   * (HOME_STATIONS at most), chosen again once a day; null without a located
   * house.
   */
  async homeStations(stations) {
    const radius = this.config.homeRadiusKm;
    const cached = this.data.home;
    if (
      cached &&
      cached.radiusKm === radius &&
      this.now() - cached.at < this.timings.homeMaxAgeMs
    ) {
      return cached.ids;
    }
    const house = await this.house({ strict: true });
    if (!house) {
      return null;
    }
    const candidates = Monitor.around(stations, house, radius).slice(0, HOME_CANDIDATES);
    const ids = [];
    for (const { station } of candidates) {
      if (ids.length >= HOME_STATIONS) {
        break;
      }
      const now = this.now();
      const { heights } = await this.api.observations(station.id, now - HOUR, now);
      if (this.isFresh(heights.at(-1)?.t)) {
        ids.push(station.id);
      }
    }
    // The house coordinates are not stored: only the radius and the gauges.
    this.data.home = { radiusKm: radius, ids, at: this.now() };
    return ids;
  }

  // --- Discovery and connection status -----------------------------------------

  discoveredDevices() {
    return this.followed()
      .map((id) => this.station(id))
      .filter(Boolean)
      .map((station) => buildDevice(this.gladys, station, this.config.language));
  }

  async publishDiscovered() {
    await this.gladys.publishDiscoveredDevices(this.discoveredDevices());
  }

  async updateConnectionStatus() {
    const { unknown, noHouse, tooMany } = this.problems;
    const parts = [];
    // A failed weekly download of the list is harmless while the old list serves.
    if (this.failing.has('readings') || (this.failing.has('referential') && !this.referential)) {
      parts.push(render(STATUS, 'down'));
    }
    if (this.failing.has('home')) {
      parts.push(render(STATUS, 'homeFailed'));
    }
    if (unknown.length > 0) {
      parts.push(render(STATUS, 'unknown', { names: unknown.join(', ') }));
    }
    if (noHouse) {
      parts.push(render(STATUS, 'noHouse'));
    }
    if (tooMany) {
      parts.push(render(STATUS, 'tooMany', { max: MAX_STATIONS }));
    }
    if (this.resolved && this.followed().length === 0 && unknown.length === 0 && !noHouse) {
      parts.push(render(STATUS, 'none'));
    }
    const message = parts.length > 0 ? join(...parts) : undefined;
    const connected = !this.failing.has('readings') && this.resolved;
    const key = JSON.stringify([connected, message]);
    if (key === this.statusMessage) {
      return;
    }
    this.statusMessage = key;
    await this.gladys.setConnectionStatus(connected, message).catch(() => {});
  }

  // --- Gladys events -----------------------------------------------------------

  async onDeviceCreated(device) {
    const id = stationIdOf(this.gladys, device.external_id);
    if (!id) {
      return;
    }
    if (!this.data.readings[id]) {
      await this.runCycle({ again: true });
    }
    // The SDK forgot the states of the device: everything is published again.
    await this.publishStates([id]);
    this.requestRefresh();
  }

  async onDeviceDeleted() {
    // A gauge only followed through its device is no longer followed.
    await this.publishDiscovered();
    this.requestRefresh();
  }

  /** onPoll fallback: should_poll is false, but a Gladys polling anyway gets an answer. */
  async poll(device) {
    const id = stationIdOf(this.gladys, device.external_id);
    if (!id) {
      return;
    }
    // Read again only if the last cycle is older than half the interval.
    if (this.now() - this.lastCycleAt >= (this.config.refreshMinutes * MINUTE) / 2) {
      await this.runCycle();
    } else {
      await this.publishStates([id]);
    }
  }

  // --- Cycles ------------------------------------------------------------------

  /** Run a cycle; `again`: if one is running, run a new one once it is over. */
  runCycle({ again = false } = {}) {
    if (this.stopped) {
      return this.running;
    }
    if (this.running) {
      if (again) {
        this.rerun ??= this.running.then(() => {
          this.rerun = null;
          return this.runCycle();
        });
        return this.rerun;
      }
      return this.running;
    }
    this.running = this.cycle()
      .then(() => this.recovered('cycle', 'Refresh cycles work again'))
      .catch((err) => this.failed('cycle', 'error', 'Refresh cycle failed', err))
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }

  async cycle() {
    this.lastCycleAt = this.now();
    const before = this.discoveredKey();
    // Cheap when the gauge list is fresh: it is downloaded once a week.
    await this.resolve();
    const ids = this.followed();
    const changed = await this.refreshReadings(ids);
    this.forget(ids);
    if (this.discoveredKey() !== before) {
      await this.publishDiscovered();
    }
    await this.publishStates(this.created());
    await this.updateConnectionStatus();
    await this.save();
    logger.debug(`Refresh cycle: ${ids.length} tide gauge(s)`);
    if (changed) {
      this.requestRefresh();
    }
  }

  discoveredKey() {
    return JSON.stringify(this.discoveredDevices());
  }

  /** Drop what is kept of the gauges no longer followed (the house one changes). */
  forget(followed) {
    for (const table of [this.data.stations, this.data.readings, this.data.memory]) {
      for (const id of Object.keys(table)) {
        if (!followed.includes(id)) {
          delete table[id];
        }
      }
    }
  }

  readingOf(id) {
    this.data.readings[id] ??= { heights: [], surges: [] };
    return this.data.readings[id];
  }

  isFresh(time) {
    return typeof time === 'number' && this.now() - time <= this.timings.staleAfterMs;
  }

  /** Read every followed gauge; resolves true when something shown changed. */
  async refreshReadings(ids) {
    let changed = false;
    let failures = 0;
    let lastError = null;
    for (const id of ids) {
      try {
        changed = (await this.refreshStation(id)) || changed;
      } catch (err) {
        failures += 1;
        lastError = err;
      }
      changed = this.noteSilence(id) || changed;
    }
    // The service is "down" when no gauge could be read; one failing gauge
    // among others is only logged.
    if (ids.length > 0 && failures === ids.length) {
      this.failed('readings', 'warn', `SHOM unreachable: ${lastError.message}`);
    } else {
      this.recovered('readings', 'The SHOM service answers again');
      if (failures > 0) {
        this.failed('partial', 'warn', `Some tide gauges cannot be read: ${lastError.message}`);
      } else {
        this.recovered('partial', 'Every tide gauge can be read again');
      }
    }
    return changed;
  }

  /** Read one gauge and fold its readings; resolves true when something shown changed. */
  async refreshStation(id) {
    const now = this.now();
    const reading = this.readingOf(id);
    const before = JSON.stringify(this.view(id));
    const last = reading.heights.at(-1)?.t;
    // Since the last sea level (24 hours the first time), and at least the last
    // 15 minutes so that the forecast for now is in the answer.
    const from = Math.max(
      now - this.timings.historyMs,
      Math.min(last ?? -Infinity, now - 15 * MINUTE),
    );
    const { heights, surges } = await this.api.observations(
      id,
      from,
      now + this.timings.forecastMs,
    );
    const newHeights = heights.filter((point) => point.t > (last ?? -Infinity) && point.t <= now);
    reading.heights = thin([...reading.heights, ...newHeights], now, this.timings.historyMs);
    if (surges.length > 0) {
      reading.surges = surges;
      const station = this.data.stations[id];
      if (station && !station.surge) {
        station.surge = true;
      }
    } else {
      reading.surges = reading.surges.filter((point) => point.t >= now - HOUR);
    }
    if (newHeights.length > 0 || surges.length > 0) {
      await this.thresholdEvents(id);
    }
    return JSON.stringify(this.view(id)) !== before;
  }

  /** One info line when a gauge goes silent, one when it comes back. */
  noteSilence(id) {
    const reading = this.readingOf(id);
    const silent = !this.isFresh(reading.heights.at(-1)?.t);
    if (silent === reading.silent) {
      return false;
    }
    const wasKnown = reading.silent !== undefined;
    reading.silent = silent;
    const name = this.displayName(id);
    if (!wasKnown) {
      logger.debug(`${name}: ${silent ? 'no recent reading' : 'readings are fresh'}`);
    } else if (silent) {
      logger.info(`${name}: no new reading for ${this.timings.staleAfterMs / MINUTE} minutes`);
    } else {
      logger.info(`${name}: readings are back`);
    }
    return true;
  }

  // --- Current values ------------------------------------------------------------

  /** What is known now of a gauge: fresh values only, null otherwise. */
  current(id) {
    const now = this.now();
    const reading = this.data.readings[id] ?? { heights: [], surges: [] };
    const latest = reading.heights.at(-1) ?? null;
    const fresh = this.isFresh(latest?.t);
    const past = reading.surges.filter((point) => point.t <= now);
    const nowPoint = past.at(-1);
    const surge =
      nowPoint && now - nowPoint.t <= SURGE_NOW_MAX_AGE_MS ? Math.round(nowPoint.v * 100) : null;
    const ahead = reading.surges.filter((point) => point.t > now && point.t <= now + DAY);
    let peak = null;
    if (surge !== null && ahead.length > 0) {
      const top = [nowPoint, ...ahead].reduce((best, point) => (point.v > best.v ? point : best));
      peak = { cm: Math.round(top.v * 100), t: top.t };
    }
    return {
      // Readings come to the tenth of a millimetre: shown to the centimetre.
      height: fresh ? Math.round(latest.v * 100) / 100 : null,
      trend: fresh ? trendOf(reading.heights) : null,
      surge,
      peak,
      lastReadingAt: latest?.t ?? null,
      fresh,
    };
  }

  // --- Scene triggers ------------------------------------------------------------

  /**
   * Compare the current values with the side of every threshold remembered.
   * A memory older than `memoryMs` (a long restart) is renewed without firing.
   */
  async thresholdEvents(id) {
    const memory = (this.data.memory[id] ??= {});
    const now = this.now();
    const value = this.current(id);
    const events = [];
    const track = (group, measure, thresholds, hysteresis, onRise, onFall) => {
      if (measure === null) {
        return;
      }
      const sides = (memory[group] ??= {});
      for (const threshold of thresholds) {
        const limit = Number(threshold);
        const previous = sides[threshold];
        let side;
        if (!previous || now - previous.at > this.timings.memoryMs) {
          side = measure >= limit ? 'above' : 'below';
        } else if (previous.side === 'below' && measure >= limit) {
          side = 'above';
          if (onRise) {
            events.push([onRise, threshold]);
          }
        } else if (previous.side === 'above' && measure <= limit - hysteresis) {
          side = 'below';
          if (onFall) {
            events.push([onFall, threshold]);
          }
        } else {
          side = previous.side;
        }
        sides[threshold] = { side, at: now };
      }
    };
    track(
      'surge',
      value.surge,
      SURGE_THRESHOLDS,
      SURGE_HYSTERESIS_CM,
      TRIGGERS.SURGE_ABOVE,
      TRIGGERS.SURGE_BACK_TO_NORMAL,
    );
    track(
      'peak',
      value.peak?.cm ?? null,
      SURGE_THRESHOLDS,
      SURGE_HYSTERESIS_CM,
      TRIGGERS.SURGE_FORECAST_ABOVE,
    );
    track('height', value.height, HEIGHT_THRESHOLDS, HEIGHT_HYSTERESIS_M, TRIGGERS.HEIGHT_ABOVE);

    if (events.length === 0 || !this.isCreated(id)) {
      return;
    }
    const name = this.displayName(id);
    for (const [key, threshold] of events) {
      // The tide crosses the height thresholds twice a day: debug only.
      const level = key === TRIGGERS.HEIGHT_ABOVE ? 'debug' : 'info';
      logger[level](`${name}: ${key} (${threshold})`);
      await this.gladys
        .publishSceneEvent(key, this.eventData(key, id, threshold, value))
        .catch((err) => logger.warn(`${key} event refused: ${err.message}`));
    }
  }

  eventData(key, id, threshold, value) {
    const base = {
      station: stationIds(this.gladys, id).device,
      station_name: this.displayName(id),
      threshold,
    };
    if (key === TRIGGERS.HEIGHT_ABOVE) {
      return { ...base, height: value.height };
    }
    if (key === TRIGGERS.SURGE_FORECAST_ABOVE) {
      return {
        ...base,
        surge_peak: value.peak.cm,
        peak_time: formatDate(value.peak.t, this.config.language),
      };
    }
    return { ...base, surge: value.surge, height: value.height };
  }

  // --- States ------------------------------------------------------------------

  /** The states of the given gauges whose device exists. */
  statesOf(ids) {
    const states = [];
    const language = this.config.language;
    for (const id of ids) {
      const station = this.station(id);
      if (!station || !this.isCreated(id)) {
        continue;
      }
      const featureIds = stationIds(this.gladys, id);
      const value = this.current(id);
      const push = (key, state) =>
        states.push({ device_feature_external_id: featureIds[key], state });
      const text = (key, content) =>
        states.push({ device_feature_external_id: featureIds[key], text: content });
      if (value.height !== null) {
        push('height', value.height);
      }
      if (value.trend) {
        text('trend', TREND_NAMES[language][value.trend]);
      }
      if (station.surge && value.surge !== null) {
        push('surge', value.surge);
      }
      if (station.surge && value.peak) {
        push('surge_peak', value.peak.cm);
      }
      if (value.lastReadingAt !== null) {
        const date = formatDate(value.lastReadingAt, language);
        text('last_reading', value.fresh ? date : READINGS[language].staleSince({ date }));
      }
    }
    return states;
  }

  async publishStates(ids) {
    const states = this.statesOf(ids);
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.recovered('publish', 'Publishing the states works again');
    } catch (err) {
      // Sent again at the next cycle (the SDK forgets what Gladys refused).
      this.failed('publish', 'warn', `Publishing the states failed: ${err.message}`);
    }
  }

  // --- Widget -------------------------------------------------------------------

  requestRefresh() {
    if (this.stopped) {
      return;
    }
    const now = this.now();
    const wait = this.lastRefreshAt + this.timings.widgetRefreshMs - now;
    if (wait <= 0) {
      this.lastRefreshAt = now;
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    } else if (this.timers && !this.refreshTimer) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        this.requestRefresh();
      }, wait);
      this.refreshTimer.unref?.();
    }
  }

  /** What the widget and the scene action show of one gauge. */
  view(id) {
    const station = this.station(id);
    return {
      id,
      name: this.displayName(id),
      surgeForecast: Boolean(station?.surge),
      ...this.current(id),
    };
  }

  /** The sea levels of the last 24 hours, every 10 minutes, for the chart. */
  chartPoints(id) {
    const since = this.now() - this.timings.historyMs;
    const heights = (this.data.readings[id]?.heights ?? []).filter((point) => point.t >= since);
    return heights.filter(
      (point, index) => point.t % CHART_STEP_MS === 0 || index === heights.length - 1,
    );
  }

  /** The time of the newest reading shown, for the attribution. */
  updatedAt(ids) {
    const times = ids
      .map((id) => this.data.readings[id]?.heights.at(-1)?.t)
      .filter((t) => typeof t === 'number');
    return times.length > 0 ? Math.max(...times) : null;
  }

  // --- Search -------------------------------------------------------------------

  /** Gauges matching the words (name; accents, case and underscores ignored). */
  static matches(station, words) {
    const haystack = normalizeName(`${station.code} ${station.name}`);
    return words.every((word) => haystack.includes(normalizeName(word)));
  }
}

/**
 * Sea levels oldest first, at most `keepMs` old: every minute for the last 30
 * minutes (trend), one every 10 minutes before (chart). The last one is always
 * kept: it dates the last reading of a silent gauge.
 */
function thin(heights, now, keepMs) {
  return heights.filter(
    (point, index) =>
      index === heights.length - 1 ||
      (now - point.t <= keepMs &&
        (now - point.t <= FULL_RESOLUTION_MS || point.t % CHART_STEP_MS === 0)),
  );
}

function emptyData() {
  return {
    version: 1,
    stations: {},
    home: null,
    readings: {},
    memory: {},
  };
}
