// -----------------------------------------------------------------------------
// The monitor on the recorded SHOM answers: states published, silence after an
// hour, trend, surge forecast, the gauge around the house, the requests sent,
// the scene triggers and their hysteresis, and the container's own timer.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trendOf } from '../src/monitor.js';
import {
  BREST,
  HOUR,
  LE_CONQUET,
  MINUTE,
  POINTE_A_PITRE,
  START,
  create,
  createApi,
  createWorld,
  cycle,
  discovered,
  featureId,
} from './helpers/world.js';

async function followed(t, ids, config = {}) {
  const world = await createWorld({ config: { stations: ids.join(','), ...config } });
  t.after(() => world.app.stop());
  const devices = [];
  for (const id of ids) {
    devices.push(await create(world, id));
  }
  return { world, devices };
}

/** The last state published for a feature (value or text). */
function last(world, externalId) {
  const found = world.fake.states.filter((s) => s.device_feature_external_id === externalId);
  const state = found.at(-1);
  return state ? (state.text ?? state.state) : undefined;
}

test('a created gauge gets its sea level, trend, surge forecast and last reading', async (t) => {
  const { world, devices } = await followed(t, [BREST]);
  const [device] = devices;
  assert.equal(device.name, 'Brest');
  assert.equal(device.should_poll, false);
  assert.equal(last(world, featureId(device, 'height')), 5.8);
  assert.equal(last(world, featureId(device, 'trend')), 'Monte');
  assert.equal(last(world, featureId(device, 'surge')), -2);
  assert.equal(last(world, featureId(device, 'surge_peak')), -2);
  assert.equal(last(world, featureId(device, 'last_reading')), '29/10 17:08');
});

test('an overseas gauge: Pointe-à-Pitre, in Guadeloupe', async (t) => {
  const { world, devices } = await followed(t, [POINTE_A_PITRE]);
  const [device] = devices;
  assert.equal(device.name, 'Pointe-a-Pitre');
  assert.equal(last(world, featureId(device, 'height')), 0.7);
  assert.equal(last(world, featureId(device, 'surge')), -1);
  assert.equal(last(world, featureId(device, 'surge_peak')), 1);
});

test('a gauge without readings nor forecast: no surge feature, no value invented', async (t) => {
  const world = await createWorld({ config: { stations: 'Le Conquet' } });
  t.after(() => world.app.stop());
  const device = discovered(world, LE_CONQUET);
  assert.deepEqual(
    device.features.map((feature) => feature.external_id.split(':').pop()),
    ['height', 'trend', 'last_reading'],
  );
  await create(world, LE_CONQUET);
  assert.deepEqual(world.fake.states, []);
});

test('silent for more than an hour: the values stop, the last reading says since when', async (t) => {
  const { world, devices } = await followed(t, [BREST]);
  const [device] = devices;
  const heightId = featureId(device, 'height');
  const published = () =>
    world.fake.states.filter((s) => s.device_feature_external_id === heightId).length;
  for (let i = 0; i < 7; i += 1) {
    await cycle(world, 10);
  }
  const silent = published();
  for (let i = 0; i < 3; i += 1) {
    await cycle(world, 10);
  }
  assert.equal(published(), silent, 'no height published once silent');
  assert.equal(
    last(world, featureId(device, 'last_reading')),
    'Pas de nouvelle mesure depuis le 29/10 17:08',
  );
  assert.equal(world.monitor.view(BREST).height, null);
  assert.equal(world.monitor.view(BREST).trend, null);
});

test('the trend: rising, falling, slack, unknown without readings 15 minutes back', () => {
  const series = (slope, minutes = 20) =>
    Array.from({ length: minutes + 1 }, (_, i) => ({ t: START + i * MINUTE, v: 3 + slope * i }));
  assert.equal(trendOf(series(0.01)), 'rising');
  assert.equal(trendOf(series(-0.01)), 'falling');
  assert.equal(trendOf(series(0.0005)), 'slack');
  assert.equal(trendOf(series(0.01, 10)), null);
  assert.equal(trendOf([]), null);
});

test('the requests: 24 hours back the first time, then since the last reading', async (t) => {
  const { world } = await followed(t, [BREST]);
  const asked = () =>
    world.api.requests.filter((url) => url.pathname.endsWith(`/observation/json/${BREST}`));
  const [first] = asked();
  assert.equal(first.searchParams.get('sources'), '1,9');
  assert.equal(Date.parse(first.searchParams.get('dtStart')), START - 24 * HOUR);
  assert.equal(Date.parse(first.searchParams.get('dtEnd')), START + 25 * HOUR);
  world.api.fillHeights(BREST, START + MINUTE, START + 10 * MINUTE, () => 6);
  await cycle(world, 10);
  const second = asked().at(-1);
  // At least the last 15 minutes, for the forecast of now.
  assert.equal(Date.parse(second.searchParams.get('dtStart')), START - 5 * MINUTE);
  // Only the gauge list besides: asked once.
  assert.equal(world.api.requests.filter((url) => url.pathname.endsWith('/tidegauges')).length, 1);
});

test('24 hours kept for the chart, every 10 minutes, every minute for the last 30', async (t) => {
  const { world } = await followed(t, [BREST]);
  world.api.fillHeights(BREST, START + MINUTE, START + 30 * HOUR, (time) =>
    Number((4 + 3 * Math.sin(time / (6 * HOUR))).toFixed(4)),
  );
  for (let i = 0; i < 6 * 30; i += 1) {
    await cycle(world, 10);
  }
  const { heights } = world.monitor.data.readings[BREST];
  const now = world.clock.now();
  assert.ok(now - heights[0].t <= 24 * HOUR);
  assert.ok(heights.length <= 144 + 30, `${heights.length} points`);
  const points = world.monitor.chartPoints(BREST);
  assert.ok(points.length >= 140 && points.length <= 146, `${points.length} chart points`);
});

test('around my house: the nearest gauge that sends readings', async (t) => {
  const world = await createWorld({ config: { around_home: '25' } });
  t.after(() => world.app.stop());
  // Le Conquet is closer to nothing here: Brest is the house, Le Conquet sends nothing.
  assert.deepEqual(world.monitor.followed(), [BREST]);
  assert.ok(!discovered(world, LE_CONQUET));
});

test('around my house without a located house: the status says so', async (t) => {
  const world = await createWorld({ config: { around_home: '25' }, houses: [] });
  t.after(() => world.app.stop());
  assert.deepEqual(world.monitor.followed(), []);
  assert.equal(world.fake.connectionStatus.connected, true);
  assert.match(world.fake.connectionStatus.message.fr, /position de votre maison/);
});

test('an unknown gauge and the SHOM down: the status says so, in four languages', async (t) => {
  const world = await createWorld({ config: { stations: 'Nowhere' } });
  t.after(() => world.app.stop());
  assert.match(world.fake.connectionStatus.message.fr, /Marégraphe inconnu : Nowhere/);
  const api = createApi();
  api.down = 'network';
  const down = await createWorld({ config: { stations: BREST }, api });
  t.after(() => down.app.stop());
  assert.equal(down.fake.connectionStatus.connected, false);
  assert.deepEqual(Object.keys(down.fake.connectionStatus.message).sort(), [
    'de',
    'en',
    'es',
    'fr',
  ]);
});

test('a surge wobbling around a threshold fires once, then once back to normal', async (t) => {
  const { world } = await followed(t, [BREST]);
  const base = world.clock.now();
  const levels = [0.32, 0.29, 0.31, 0.28, 0.2];
  for (const level of levels) {
    world.api.setSurges(BREST, base - HOUR, base + 26 * HOUR, () => level);
    await cycle(world, 10);
  }
  const events = world.fake.sceneEvents
    .filter((event) => event.data.threshold === '30')
    .map((event) => [event.key, event.data.surge]);
  assert.deepEqual(events, [
    ['surge_above', 32],
    ['surge_forecast_above', undefined],
    ['surge_back_to_normal', 20],
  ]);
});

test('a storm forecast for tomorrow fires the 24-hour warning only', async (t) => {
  const { world } = await followed(t, [BREST]);
  const now = world.clock.now();
  world.api.setSurges(BREST, now - HOUR, now + 26 * HOUR, (time) =>
    time > now + 12 * HOUR && time < now + 14 * HOUR ? 0.85 : 0.05,
  );
  await cycle(world, 10);
  const keys = world.fake.sceneEvents.map((event) => `${event.key}:${event.data.threshold}`);
  assert.deepEqual(keys.sort(), [
    'surge_forecast_above:20',
    'surge_forecast_above:30',
    'surge_forecast_above:50',
    'surge_forecast_above:80',
  ]);
  const peak = world.fake.sceneEvents[0].data;
  assert.equal(peak.surge_peak, 85);
  assert.equal(peak.station_name, 'Brest');
  // 04:20 UTC, in the time zone of Gladys.
  assert.equal(peak.peak_time, '30/10 05:20');
});

test('the sea level rising through a threshold fires height_above, falling does not', async (t) => {
  const { world } = await followed(t, [BREST]);
  let from = world.clock.now() + MINUTE;
  for (const level of [5.9, 6.05, 5.9]) {
    world.api.fillHeights(BREST, from, from + 9 * MINUTE, () => level);
    from += 10 * MINUTE;
    await cycle(world, 10);
  }
  const events = world.fake.sceneEvents.filter((event) => event.key === 'height_above');
  assert.deepEqual(
    events.map((event) => [event.data.threshold, event.data.height]),
    [['6', 6.05]],
  );
});

test('no trigger for a gauge without device, nor after a long restart', async (t) => {
  const world = await createWorld({ config: { stations: BREST } });
  t.after(() => world.app.stop());
  const now = world.clock.now();
  world.api.setSurges(BREST, now - HOUR, now + 26 * HOUR, () => 0.6);
  await cycle(world, 10);
  assert.deepEqual(world.fake.sceneEvents, []);

  const { world: other } = await followed(t, [BREST]);
  other.clock.advance(4 * HOUR);
  const later = other.clock.now();
  other.api.setSurges(BREST, later - HOUR, later + 26 * HOUR, () => 0.6);
  other.api.fillHeights(BREST, later - 5 * MINUTE, later, () => 3);
  await other.monitor.runCycle();
  assert.deepEqual(other.fake.sceneEvents, []);
});

test('the readings survive a restart of the container', async (t) => {
  const { world } = await followed(t, [BREST]);
  await world.app.stop();
  const again = await createWorld({
    config: { stations: BREST },
    devices: [discovered(world, BREST)],
    dataDir: world.dataDir,
  });
  t.after(() => again.app.stop());
  assert.equal(again.monitor.view(BREST).height, 5.8);
});

test('the container refreshes on its own timer, without onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const world = await createWorld({ config: { stations: BREST }, timers: true });
  t.after(() => world.app.stop());
  await create(world, BREST);
  const poll = t.mock.method(world.monitor, 'poll');
  const before = world.api.requests.length;
  world.clock.advance(10 * MINUTE);
  t.mock.timers.tick(10 * MINUTE);
  await world.monitor.running;
  assert.ok(world.api.requests.length > before, 'a cycle ran');
  assert.equal(poll.mock.callCount(), 0);
});

// --- Review of 29/10 ------------------------------------------------------------

test('a device created before the forecast was known gets no surge state', async (t) => {
  const api = createApi();
  api.setSurges(BREST, 0, 0, () => 0);
  const world = await createWorld({ config: { stations: BREST }, api });
  t.after(() => world.app.stop());
  const device = await create(world, BREST);
  assert.equal(featureId(device, 'surge'), undefined);
  const now = world.clock.now();
  api.setSurges(BREST, now - HOUR, now + 26 * HOUR, () => 0.1);
  await cycle(world, 10);
  assert.equal(discovered(world, BREST).features.length, 5, 'offered as an update');
  assert.ok(!world.fake.states.some((s) => s.device_feature_external_id.endsWith(':surge')));
  assert.equal(world.monitor.view(BREST).surgeForecast, false);
});

test('a silent gauge shows an unknown trend, not the last one', async (t) => {
  const { world, devices } = await followed(t, [BREST]);
  for (let i = 0; i < 7; i += 1) {
    await cycle(world, 10);
  }
  assert.equal(last(world, featureId(devices[0], 'trend')), 'Inconnue');
});

test('no gauge sending around the house: chosen again after 30 minutes, not a day', async (t) => {
  const api = createApi();
  const brest = api.series[BREST];
  api.series[BREST] = [];
  const world = await createWorld({ config: { around_home: '25' }, api });
  t.after(() => world.app.stop());
  assert.deepEqual(world.monitor.followed(), []);
  api.series[BREST] = brest;
  api.fillHeights(BREST, START, START + 40 * MINUTE, () => 5);
  for (let i = 0; i < 4; i += 1) {
    await cycle(world, 10);
  }
  assert.deepEqual(world.monitor.followed(), [BREST]);
});

test('the gauge list is asked again 10 minutes after a failure', async (t) => {
  const api = createApi();
  api.down = 503;
  const world = await createWorld({ config: { stations: BREST }, api });
  t.after(() => world.app.stop());
  assert.deepEqual(world.monitor.followed(), []);
  api.down = false;
  await cycle(world, 10);
  assert.deepEqual(world.monitor.followed(), [BREST]);
});

test('gauges reporting at odd minutes keep one point per 10 minutes for the chart', async (t) => {
  const { world } = await followed(t, [BREST]);
  const from = START + 3 * MINUTE;
  for (let time = from; time <= START + 6 * HOUR; time += 6 * MINUTE) {
    world.api.addHeight(BREST, time, 4);
  }
  for (let i = 0; i < 36; i += 1) {
    await cycle(world, 10);
  }
  const points = world.monitor.chartPoints(BREST);
  assert.ok(points.length >= 30, `${points.length} chart points`);
});

test('a forecast that stops forgets the surge sides: its return fires nothing', async (t) => {
  const { world } = await followed(t, [BREST]);
  let now = world.clock.now();
  // The last forecast received runs out 20 minutes later.
  world.api.setSurges(BREST, now - HOUR, now + 20 * MINUTE, () => 0.6);
  await cycle(world, 10);
  const fired = world.fake.sceneEvents.length;
  world.api.setSurges(BREST, 0, 0, () => 0);
  for (let i = 0; i < 5; i += 1) {
    await cycle(world, 10);
  }
  assert.equal(world.monitor.view(BREST).surge, null);
  now = world.clock.now();
  world.api.setSurges(BREST, now - HOUR, now + 26 * HOUR, () => 0.6);
  await cycle(world, 10);
  assert.equal(world.fake.sceneEvents.length, fired);
});
