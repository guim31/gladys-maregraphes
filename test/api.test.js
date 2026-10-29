// -----------------------------------------------------------------------------
// The SHOM client and the HTTP helper, on the recorded answers.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, USER_AGENT, getJson } from '../src/http.js';
import { Shom, parseStation, parseTime, stationPage, titleCase } from '../src/shom.js';
import { BREST, POINTE_A_PITRE, createApi, fixture } from './helpers/world.js';

const raw = (id) => fixture('shom/tidegauges-2026-10-29.json').find((s) => s.shom_id === id);

test('a gauge of the list: id, name in title case, position, state, network', () => {
  assert.deepEqual(parseStation(raw(BREST)), {
    id: '3',
    name: 'Brest',
    code: 'BREST',
    latitude: 48.38290024,
    longitude: -4.49503994,
    state: 'OK',
    network: 'RONIM',
  });
  assert.equal(parseStation(raw(POINTE_A_PITRE)).name, 'Pointe-a-Pitre');
});

test('names: underscores, hyphens, articles, acronyms', () => {
  assert.equal(titleCase('LE_HAVRE'), 'Le Havre');
  assert.equal(titleCase('PORT-LA-NOUVELLE'), 'Port-la-Nouvelle');
  assert.equal(titleCase('ANTIFER_HAROPA_LH'), 'Antifer Haropa LH');
  assert.equal(titleCase('ILE_D_AIX'), 'Ile d Aix');
});

test('times are UTC, written with slashes', () => {
  assert.equal(parseTime('2026/10/29 16:08:00'), Date.parse('2026-10-29T16:08:00Z'));
  assert.ok(Number.isNaN(parseTime('2026-10-29T16:08:00Z')));
  assert.equal(stationPage('3'), 'https://data.shom.fr/donnees/refmar/3');
});

test('the list leaves the hidden gauges out; readings split by source, oldest first', async () => {
  const api = createApi();
  const shom = new Shom({ fetch: api.fetch });
  const list = await shom.referential();
  assert.ok(list.length > 150);
  assert.ok(list.every((station) => station.state !== 'HIDDEN'));
  const { heights, surges } = await shom.observations(
    BREST,
    Date.parse('2026-10-29T16:00:00Z'),
    Date.parse('2026-10-29T18:00:00Z'),
  );
  assert.equal(heights.length, 9);
  assert.deepEqual(heights.at(-1), { t: Date.parse('2026-10-29T16:08:00Z'), v: 5.7999 });
  assert.equal(surges.length, 13);
  assert.ok(surges.every((point, i) => i === 0 || point.t > surges[i - 1].t));
  const url = api.requests.at(-1);
  assert.equal(
    url.href,
    'https://services.data.shom.fr/maregraphie/observation/json/3?sources=1,9&dtStart=2026-10-29T16:00:00Z&dtEnd=2026-10-29T18:00:00Z',
  );
});

test('an unexpected answer and HTTP errors are explicit, the User-Agent names the project', async () => {
  let headers;
  const fetchImpl = async (url, options) => {
    headers = options.headers;
    return { status: 200, text: async () => '{"message":"x"}' };
  };
  await assert.rejects(new Shom({ fetch: fetchImpl }).observations('3', 0, 1), /unexpected answer/);
  assert.equal(headers['User-Agent'], USER_AGENT);
  assert.match(USER_AGENT, /gladys-maregraphes/);
  const failing = async () => ({ status: 400, text: async () => 'Incorrect source parameter' });
  await assert.rejects(getJson(failing, 'https://services.data.shom.fr/x'), (err) => {
    assert.ok(err instanceof HttpError);
    assert.equal(err.status, 400);
    return true;
  });
});
