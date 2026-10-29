// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `tide_gauges`.
//
// Without setting, one status line per followed gauge (10 at most): the sea
// level and its trend, and the surge forecast when there is one, coloured by
// the surge (closed palette of the widgets: 50 cm and more danger, 20 cm and
// more warning, else success; neutral without a recent reading). A heading
// names the gauges with a surge of 20 cm or more forecast within 24 hours.
//
// With a gauge chosen in the settings: its live sea level and surge forecast
// tiles (bound to the device features), the curve of the measured sea level
// over 24 hours (can be hidden), then the trend, the highest surge forecast
// for 24 hours and the last reading.
//
// Both end with the source and its date and a link to data.shom.fr.
// Budget: 2 texts, 2 tiles, 1 chart, 1 status, 1 button.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { stationIds, stationIdOf } from './devices.js';
import { TREND_NAMES, formatDate, formatHeight, formatSurge, formatTime } from './messages.js';
import { WIDGET_KEY } from './monitor.js';
import { SITE_URL, stationPage } from './shom.js';

export const MAX_STATUS_ITEMS = 10;
export const TTL_SECONDS = 300;
const MAX_STATUS_TEXT = 40;
// Surges coloured warning, then danger (cm).
const SURGE_WARNING_CM = 20;
const SURGE_DANGER_CM = 50;

export const TEXT = {
  empty: {
    en: 'No tide gauge yet: fill in the configuration of the Tide gauges (SHOM) integration, then create the devices in the Discover tab.',
    fr: "Aucun marégraphe pour l'instant : remplissez la configuration de l'intégration Marégraphes (SHOM), puis créez les appareils dans l'onglet Découverte.",
    de: 'Noch kein Pegel: Fülle die Konfiguration der Integration Marégraphes (SHOM) aus und lege dann die Geräte im Tab „Entdecken“ an.',
    es: 'Aún no hay mareógrafos: rellene la configuración de la integración Marégraphes (SHOM) y, después, cree los dispositivos en la pestaña Descubrir.',
  },
  gone: {
    en: 'This tide gauge is no longer followed.',
    fr: "Ce marégraphe n'est plus suivi.",
    de: 'Dieser Pegel wird nicht mehr verfolgt.',
    es: 'Este mareógrafo ya no se sigue.',
  },
  alert: {
    en: 'Surge forecast: ',
    fr: 'Surcote prévue : ',
    de: 'Windstau erwartet: ',
    es: 'Sobreelevación prevista: ',
  },
  height: { en: 'Sea level', fr: "Hauteur d'eau", de: 'Wasserstand', es: 'Nivel del mar' },
  surge: { en: 'Surge', fr: 'Surcote', de: 'Windstau', es: 'Sobreelevación' },
  chart: {
    en: 'Measured, 24 h',
    fr: 'Mesurée, 24 h',
    de: 'Gemessen, 24 h',
    es: 'Medido, 24 h',
  },
  series: { en: 'Sea level', fr: "Hauteur d'eau", de: 'Wasserstand', es: 'Nivel del mar' },
  trend: { en: 'Tide', fr: 'Marée', de: 'Gezeiten', es: 'Marea' },
  peak: {
    en: 'Highest surge, 24 h',
    fr: 'Surcote max., 24 h',
    de: 'Höchster Windstau, 24 h',
    es: 'Sobreelevación máx., 24 h',
  },
  peakAt: { en: ' at ', fr: ' à ', de: ' um ', es: ' a las ' },
  lastReading: {
    en: 'Last reading',
    fr: 'Dernière mesure',
    de: 'Letzte Messung',
    es: 'Última medición',
  },
  silent: {
    en: 'Silent since ',
    fr: 'Muet depuis le ',
    de: 'Still seit ',
    es: 'Sin datos desde ',
  },
  waiting: { en: 'Waiting', fr: 'En attente', de: 'Wartet', es: 'En espera' },
  unknown: { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' },
  source: {
    en: 'Source: SHOM, REFMAR',
    fr: 'Source : SHOM, REFMAR',
    de: 'Quelle: SHOM, REFMAR',
    es: 'Fuente: SHOM, REFMAR',
  },
  site: { en: 'data.shom.fr', fr: 'data.shom.fr', de: 'data.shom.fr', es: 'data.shom.fr' },
};

const t = (text, language) => text[language] ?? text.en;
const clip = (text, max = MAX_STATUS_TEXT) =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

const TREND_ICONS = { rising: 'trending-up', falling: 'trending-down', slack: 'minus' };

/** Colour of a surge (cm), neutral when unknown. */
function surgeColor(cm) {
  if (cm === null || cm === undefined) {
    return WIDGET_COLORS.NEUTRAL;
  }
  if (cm >= SURGE_DANGER_CM) {
    return WIDGET_COLORS.DANGER;
  }
  return cm >= SURGE_WARNING_CM ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS;
}

/** The status value of a gauge, e.g. "1,34 m, monte, +5 cm" (40 characters at most). */
export function stationValue(view, language) {
  if (view.lastReadingAt === null) {
    return t(TEXT.waiting, language);
  }
  if (view.height === null) {
    return clip(`${t(TEXT.silent, language)}${formatDate(view.lastReadingAt, language)}`);
  }
  const parts = [formatHeight(view.height, language)];
  if (view.trend) {
    parts.push(TREND_NAMES[language][view.trend].toLowerCase());
  }
  if (view.surge !== null) {
    parts.push(formatSurge(view.surge, language));
  }
  return clip(parts.join(', '));
}

function footer(monitor, ids, language, link) {
  const updated = monitor.updatedAt(ids);
  const source = t(TEXT.source, language);
  return [
    {
      type: 'text',
      variant: 'caption',
      text: updated === null ? source : `${source} · ${formatDate(updated, language)}`,
    },
    { type: 'button', label: t(TEXT.site, language), icon: 'external-link', link: { url: link } },
  ];
}

function overview(monitor, ids, language) {
  const views = ids.slice(0, MAX_STATUS_ITEMS).map((id) => monitor.view(id));
  const components = [];
  const high = views.filter((view) => (view.peak?.cm ?? -Infinity) >= SURGE_WARNING_CM);
  if (high.length > 0) {
    components.push({
      type: 'text',
      variant: 'heading',
      text: clip(`${t(TEXT.alert, language)}${high.map((view) => view.name).join(', ')}`),
    });
  }
  components.push({
    type: 'status',
    items: views.map((view) => ({
      label: clip(view.name),
      value: stationValue(view, language),
      color: view.height === null ? WIDGET_COLORS.NEUTRAL : surgeColor(view.surge),
      icon: view.trend ? TREND_ICONS[view.trend] : 'clock',
    })),
  });
  return [...components, ...footer(monitor, ids, language, SITE_URL)];
}

function detail(monitor, id, language, { showChart }) {
  const view = monitor.view(id);
  const ids = stationIds(monitor.gladys, id);
  const components = [
    { type: 'value', label: t(TEXT.height, language), device_feature: ids.height },
  ];
  if (view.surgeForecast) {
    components.push({ type: 'value', label: t(TEXT.surge, language), device_feature: ids.surge });
  }
  const points = monitor.chartPoints(id);
  if (showChart && points.length >= 2) {
    components.push({
      type: 'chart',
      title: t(TEXT.chart, language),
      unit: 'm',
      chart_type: 'line',
      series: [
        {
          name: t(TEXT.series, language),
          points: points.map((point) => ({ t: new Date(point.t).toISOString(), v: point.v })),
        },
      ],
    });
  }
  const items = [
    {
      label: t(TEXT.trend, language),
      value: view.trend ? TREND_NAMES[language][view.trend] : t(TEXT.unknown, language),
      icon: view.trend ? TREND_ICONS[view.trend] : 'minus',
      color: WIDGET_COLORS.NEUTRAL,
    },
  ];
  if (view.surgeForecast) {
    items.push({
      label: t(TEXT.peak, language),
      value: view.peak
        ? clip(
            `${formatSurge(view.peak.cm, language)}${t(TEXT.peakAt, language)}${formatTime(view.peak.t, language)}`,
          )
        : t(TEXT.unknown, language),
      color: surgeColor(view.peak?.cm),
      icon: 'wind',
    });
  }
  items.push({
    label: t(TEXT.lastReading, language),
    value:
      view.lastReadingAt === null
        ? t(TEXT.waiting, language)
        : formatDate(view.lastReadingAt, language),
    color: view.fresh ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.WARNING,
    icon: 'clock',
  });
  components.push({ type: 'status', items });
  return [...components, ...footer(monitor, [id], language, stationPage(id))];
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    async get(monitor, { settings, language = 'en' }) {
      const lang = TREND_NAMES[language] ? language : 'en';
      const created = monitor.created();
      const chosen = typeof settings?.station === 'string' ? settings.station : null;
      if (chosen) {
        const id = stationIdOf(monitor.gladys, chosen);
        const components =
          id && created.includes(id)
            ? detail(monitor, id, lang, { showChart: settings?.show_chart !== false })
            : [{ type: 'text', variant: 'body', text: t(TEXT.gone, lang) }];
        return { ttl_seconds: TTL_SECONDS, components };
      }
      if (created.length === 0) {
        return {
          ttl_seconds: TTL_SECONDS,
          components: [{ type: 'text', variant: 'body', text: t(TEXT.empty, lang) }],
        };
      }
      return { ttl_seconds: TTL_SECONDS, components: overview(monitor, created, lang) };
    },
  },
};
