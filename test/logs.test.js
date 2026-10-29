// -----------------------------------------------------------------------------
// What the integration writes to `docker logs`: at info, only the lifecycle (a
// gauge going silent or coming back, a surge threshold crossed, the start),
// never one line per refresh cycle; a failure that repeats at every cycle is
// logged once, plus one line when it is over. Never the house coordinates: the
// configuration holds no secret, the location of the home is the sensitive data.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BREST, HOUSE, MINUTE, captureLogs, create, createWorld, cycle } from './helpers/world.js';

const strip = (line) => line.text.replace(/^\[[^\]]+\] /, '');

async function followed(t, config = {}) {
  const world = await createWorld({ config: { stations: BREST, around_home: '25', ...config } });
  t.after(() => world.app.stop());
  await create(world, BREST);
  return world;
}

/** Ten more minutes of readings at a steady level, then a cycle. */
async function steadyCycle(world, level = 5) {
  const from = world.clock.now() + MINUTE;
  world.api.fillHeights(BREST, from, from + 9 * MINUTE, () => level);
  await cycle(world, 10);
}

test('the start is one info line', async (t) => {
  const lines = captureLogs(t, 'info');
  const world = await createWorld({ config: { stations: BREST } });
  t.after(() => world.app.stop());
  assert.deepEqual(lines.map(strip), [
    '[INFO] [maregraphes] Started: 1 tide gauge(s) followed, refreshed every 10 min',
  ]);
});

test('a normal refresh cycle writes nothing at info, height thresholds included', async (t) => {
  const world = await followed(t);
  const lines = captureLogs(t, 'info');
  for (let i = 0; i < 6; i += 1) {
    await steadyCycle(world, i % 2 === 0 ? 2.9 : 3.1);
  }
  assert.deepEqual(lines, []);
});

test('LOG_LEVEL=debug shows the cycles, never the house coordinates', async (t) => {
  const lines = captureLogs(t, 'debug');
  const world = await followed(t);
  await steadyCycle(world);
  await steadyCycle(world);
  assert.ok(lines.filter((line) => /Refresh cycle: 1 tide gauge/.test(line.text)).length >= 2);
  const all = lines.map((line) => line.text).join('\n');
  assert.doesNotMatch(all, new RegExp(String(HOUSE.latitude).replace('.', '\\.')));
  assert.doesNotMatch(all, new RegExp(String(HOUSE.longitude).replace('.', '\\.')));
});

test('a gauge going silent and coming back is one info line each', async (t) => {
  const world = await followed(t, { around_home: '0' });
  const lines = captureLogs(t, 'info');
  for (let i = 0; i < 8; i += 1) {
    await cycle(world, 10);
  }
  await steadyCycle(world);
  assert.deepEqual(lines.map(strip), [
    '[INFO] [maregraphes] Brest: no new reading for 60 minutes',
    '[INFO] [maregraphes] Brest: readings are back',
  ]);
});

test('the SHOM down at every cycle: one warning, then one line at recovery', async (t) => {
  const world = await followed(t);
  const lines = captureLogs(t, 'info');
  world.api.down = 503;
  for (let i = 0; i < 4; i += 1) {
    await cycle(world, 10);
  }
  assert.deepEqual(
    lines.map((line) => [line.level, strip(line).replace(/^\[\w+\] /, '')]),
    [['warn', '[maregraphes] SHOM unreachable: services.data.shom.fr: HTTP 503']],
  );
  world.api.down = false;
  await steadyCycle(world);
  assert.deepEqual(lines.slice(1).map(strip), [
    '[INFO] [maregraphes] The SHOM service answers again',
  ]);
});

test('states refused at every cycle: one warning, then one line at recovery', async (t) => {
  const world = await followed(t, { around_home: '0' });
  const lines = captureLogs(t, 'info');
  const publish = t.mock.method(world.gladys, 'publishChangedStates', async () => {
    throw new Error('Gladys unreachable');
  });
  for (let i = 0; i < 3; i += 1) {
    await steadyCycle(world, 4 + i);
  }
  assert.ok(publish.mock.callCount() >= 3);
  assert.deepEqual(
    lines.map((line) => [line.level, strip(line).replace(/^\[\w+\] /, '')]),
    [['warn', '[maregraphes] Publishing the states failed: Gladys unreachable']],
  );
  publish.mock.restore();
  await steadyCycle(world);
  assert.match(lines.at(-1).text, /\[INFO\].*Publishing the states works again/);
});

test('an unknown gauge is one warning, not one per cycle', async (t) => {
  const lines = captureLogs(t, 'info');
  const world = await createWorld({ config: { stations: 'Nowhere' } });
  t.after(() => world.app.stop());
  for (let i = 0; i < 6; i += 1) {
    await cycle(world, 10);
  }
  assert.equal(lines.filter((line) => /Unknown tide gauge: Nowhere/.test(line.text)).length, 1);
});
