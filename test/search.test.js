// -----------------------------------------------------------------------------
// The "Find tide gauges" action, on the recorded gauge list.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi, createWorld } from './helpers/world.js';

async function search(t, fields, options = {}) {
  const world = await createWorld(options);
  t.after(() => world.app.stop());
  const ack = await world.fake.action('search_stations', fields);
  assert.equal(ack.success, true, ack.error);
  return { message: ack.data.message, world };
}

test('empty: the gauges around the house, nearest first, with their sea level', async (t) => {
  const { message } = await search(t, { radius: '25' });
  const lines = message.fr.split('\n');
  assert.match(lines[0], /marégraphe\(s\)\. Copiez les numéros dans « Marégraphes »/);
  assert.equal(lines[1], '3 — Brest, 0 km, 5,8 m');
  assert.match(message.fr, /152 — Le Conquet, \d+ km, pas de mesure récente/);
  assert.deepEqual(Object.keys(message).sort(), ['de', 'en', 'es', 'fr']);
});

test('by name, accents, hyphens and case ignored, and by number or page', async (t) => {
  const { message } = await search(t, { query: 'pointe à pitre' });
  assert.match(message.en, /^1 tide gauge\(s\)/);
  assert.match(message.en, /125 — Pointe-a-Pitre, \d[\d,]* km, 0\.7 m/);
  const byNumber = await search(t, { query: 'https://data.shom.fr/donnees/refmar/3' });
  assert.match(byNumber.message.en, /\n3 — Brest/);
  const havre = await search(t, { query: 'havre' });
  assert.match(havre.message.fr, /Le Havre/);
});

test('no house, nothing found, the SHOM down', async (t) => {
  const noHouse = await search(t, {}, { houses: [] });
  assert.match(noHouse.message.fr, /^Votre maison n'a pas de position/);
  const none = await search(t, { query: 'Nowhere' });
  assert.equal(none.message.fr, 'Aucun marégraphe trouvé.');
  const api = createApi();
  api.down = 503;
  const down = await search(t, { query: 'Brest' }, { api });
  assert.match(down.message.es, /^El servicio del SHOM no responde/);
});
