// -----------------------------------------------------------------------------
// The `summary` scene action: one sentence in the language of the
// configuration, and the values as outputs.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BREST, HOUR, LE_CONQUET, create, createWorld, cycle } from './helpers/world.js';

async function run(world, station) {
  const ack = await world.fake.sceneAction('summary', { station });
  assert.equal(ack.success, true, ack.error);
  return ack.data.outputs;
}

test('a gauge with a reading and a surge to come', async (t) => {
  const world = await createWorld({ config: { stations: BREST } });
  t.after(() => world.app.stop());
  const device = await create(world, BREST);
  assert.deepEqual(await run(world, device.external_id), {
    summary:
      "Brest : hauteur d'eau 5,8 m, monte, mesurée à 17:08. Surcote prévue maintenant : −2 cm.",
    height: 5.8,
    surge: -2,
    surge_peak: -2,
  });
  const now = world.clock.now();
  world.api.setSurges(BREST, now - HOUR, now + 26 * HOUR, (time) =>
    time > now + 3 * HOUR ? 0.45 : 0.1,
  );
  world.api.fillHeights(BREST, now + 60000, now + 600000, () => 6.2);
  await cycle(world, 10);
  const outputs = await run(world, device.external_id);
  assert.match(
    outputs.summary,
    /Surcote prévue maintenant : \+10 cm\. Jusqu'à \+45 cm attendus à 20:\d0\.$/,
  );
  assert.equal(outputs.surge_peak, 45);
});

test('in English, a silent gauge, a gauge waiting, an unknown one', async (t) => {
  const world = await createWorld({
    config: { stations: `${BREST},${LE_CONQUET}`, language: 'en' },
  });
  t.after(() => world.app.stop());
  const brest = await create(world, BREST);
  const conquet = await create(world, LE_CONQUET);
  assert.equal((await run(world, conquet.external_id)).summary, 'Le Conquet: no reading yet.');
  for (let i = 0; i < 7; i += 1) {
    await cycle(world, 10);
  }
  const silent = await run(world, brest.external_id);
  assert.match(silent.summary, /^Brest: no new reading since 29\/10, 17:08\. Surge forecast now/);
  assert.equal(silent.height, null);
  const unknown = await run(world, 'maregraphes:tide-gauge:999');
  assert.equal(unknown.summary, 'This tide gauge is not followed by the integration.');
});
