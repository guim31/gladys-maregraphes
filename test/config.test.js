// -----------------------------------------------------------------------------
// The configuration: tokens of the "Tide gauges" field, name comparison, defaults.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig, normalizeName, parseStations } from '../src/config.js';

test('gauge tokens: SHOM numbers, page addresses and names with spaces', () => {
  const tokens = parseStations(
    '3, Le Havre; 0125\nhttps://data.shom.fr/donnees/refmar/2/download, POINTE-A-PITRE, 3, ,',
  );
  assert.deepEqual(
    tokens.map(({ kind, value }) => [kind, value]),
    [
      ['id', '3'],
      ['name', 'Le Havre'],
      ['id', '125'],
      ['id', '2'],
      ['name', 'POINTE-A-PITRE'],
    ],
  );
});

test('names compare without case, accents, hyphens nor underscores', () => {
  assert.equal(normalizeName('Pointe-à-Pitre'), normalizeName('POINTE-A-PITRE'));
  assert.equal(normalizeName('LE_HAVRE'), 'le havre');
  assert.equal(normalizeName('Saint  Malo'), normalizeName('SAINT-MALO'));
});

test('defaults, and unknown values fall back to them', () => {
  assert.deepEqual(normalizeConfig({}), {
    stations: [],
    homeRadiusKm: 0,
    refreshMinutes: 10,
    language: DEFAULT_CONFIG.language,
  });
  const config = normalizeConfig({ around_home: '7', refresh_interval: '1', language: 'it' });
  assert.deepEqual([config.homeRadiusKm, config.refreshMinutes, config.language], [0, 10, 'fr']);
  assert.equal(normalizeConfig({ around_home: '50', refresh_interval: '5' }).refreshMinutes, 5);
  assert.deepEqual(normalizeConfig(null).stations, []);
});
