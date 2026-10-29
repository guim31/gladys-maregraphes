// -----------------------------------------------------------------------------
// The `tide_gauges` dashboard widget: the content fits the core vocabulary and
// budget (validateWidgetContent, empty array = rendered as sent), every bound
// feature exists on a published device, and the colours follow the surge.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WIDGET_COLORS, validateWidgetContent } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from '../src/config.js';
import { WIDGET_KEY } from '../src/monitor.js';
import { stationValue } from '../src/widgets.js';
import {
  BREST,
  DUNKERQUE,
  HOUR,
  LE_CONQUET,
  POINTE_A_PITRE,
  create,
  createWorld,
  cycle,
} from './helpers/world.js';

async function worldWith(t, ids) {
  const world = await createWorld({ config: { stations: ids.join(',') } });
  t.after(() => world.app.stop());
  const devices = [];
  for (const id of ids) {
    devices.push(await create(world, id));
  }
  return { world, devices };
}

async function content(world, settings = {}, language = 'fr') {
  const ack = await world.fake.widgetGet(WIDGET_KEY, { settings, language, units: 'metric' });
  assert.equal(ack.success, true, ack.error);
  return ack.data.content;
}

const features = (devices) =>
  new Set(devices.flatMap((device) => device.features.map((feature) => feature.external_id)));

const ALL = [BREST, POINTE_A_PITRE, DUNKERQUE, LE_CONQUET];

test('the overview: one valid status line per gauge, in every language', async (t) => {
  const { world } = await worldWith(t, ALL);
  for (const language of LANGUAGES) {
    const widget = await content(world, {}, language);
    assert.deepEqual(validateWidgetContent(widget), [], language);
    const status = widget.components.find((c) => c.type === 'status');
    assert.equal(status.items.length, 4);
  }
  const status = (await content(world)).components.find((c) => c.type === 'status');
  assert.deepEqual(status.items[0], {
    label: 'Brest',
    value: '5,8 m, monte, −2 cm',
    color: WIDGET_COLORS.SUCCESS,
    icon: 'trending-up',
  });
  assert.equal(status.items[3].value, 'En attente');
});

test('a gauge with a strong surge forecast is named in a heading, in danger', async (t) => {
  const { world } = await worldWith(t, [BREST]);
  const now = world.clock.now();
  world.api.setSurges(BREST, now - HOUR, now + 26 * HOUR, () => 0.6);
  world.api.fillHeights(BREST, now - 60000, now + 10 * 60000, () => 6);
  await cycle(world, 10);
  const widget = await content(world);
  assert.deepEqual(validateWidgetContent(widget), []);
  assert.equal(widget.components[0].text, 'Surcote prévue : Brest');
  const status = widget.components.find((c) => c.type === 'status');
  assert.equal(status.items[0].color, WIDGET_COLORS.DANGER);
});

test('a chosen gauge: tiles bound to its features, the 24-hour curve, its details', async (t) => {
  const { world, devices } = await worldWith(t, [BREST, LE_CONQUET]);
  for (const language of LANGUAGES) {
    const widget = await content(world, { station: devices[0].external_id }, language);
    assert.deepEqual(validateWidgetContent(widget), [], language);
    const bound = widget.components.filter((c) => c.device_feature).map((c) => c.device_feature);
    assert.equal(bound.length, 2);
    for (const id of bound) {
      assert.ok(features(devices).has(id), `${id} is a published feature`);
    }
    const chart = widget.components.find((c) => c.type === 'chart');
    assert.ok(chart.series[0].points.length > 30);
  }
  const hidden = await content(world, { station: devices[0].external_id, show_chart: false });
  assert.equal(
    hidden.components.find((c) => c.type === 'chart'),
    undefined,
  );
  const conquet = await content(world, { station: devices[1].external_id });
  assert.deepEqual(validateWidgetContent(conquet), []);
  assert.equal(conquet.components.filter((c) => c.type === 'value').length, 1);
});

test('a gauge no longer followed, and no gauge at all', async (t) => {
  const { world } = await worldWith(t, [BREST]);
  const gone = await content(world, { station: 'maregraphes:tide-gauge:999' });
  assert.equal(gone.components[0].text, "Ce marégraphe n'est plus suivi.");
  const empty = await createWorld();
  t.after(() => empty.app.stop());
  const widget = await content(empty, {}, 'de');
  assert.match(widget.components[0].text, /^Noch kein Pegel/);
});

test('the status value fits 40 characters and says when a gauge is silent', () => {
  const view = {
    height: null,
    lastReadingAt: Date.parse('2026-10-29T16:08:00Z'),
    trend: null,
    surge: null,
  };
  assert.equal(stationValue(view, 'fr'), 'Muet depuis le 29/10 17:08');
  const long = { ...view, height: 13.45, trend: 'falling', surge: -105 };
  assert.ok(stationValue(long, 'es').length <= 40);
});
