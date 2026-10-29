// -----------------------------------------------------------------------------
// Scene action (manifest `scene_actions`, Gladys 5.1+): `summary`, one sentence
// on a tide gauge (sea level, trend, time of the reading, surge forecast) for a
// notification or a voice message, plus its values as outputs for the next
// actions of the scene. Read-only: it never asks the SHOM, it reads what the
// last cycle brought. Language: the `language` of the configuration (a scene
// action does not receive the user's).
// -----------------------------------------------------------------------------

import { stationIdOf } from './devices.js';
import {
  SUMMARY,
  TREND_NAMES,
  formatDate,
  formatHeight,
  formatSurge,
  formatTime,
} from './messages.js';

export const SCENE_ACTION_KEY = 'summary';

/** The sentence and the outputs of the `summary` scene action. */
export function summarize(monitor, fields = {}) {
  const language = monitor.config?.language ?? 'fr';
  const texts = SUMMARY[language];
  const id = stationIdOf(monitor.gladys, fields.station);
  if (!id || !monitor.followed().includes(id)) {
    return { summary: texts.unknown, height: null, surge: null, surge_peak: null };
  }
  const view = monitor.view(id);
  const name = view.name;
  let summary;
  if (view.lastReadingAt === null) {
    summary = texts.waiting({ name });
  } else if (view.height === null) {
    summary = texts.silent({ name, date: formatDate(view.lastReadingAt, language) });
  } else {
    summary = texts.height({
      name,
      height: formatHeight(view.height, language),
      trend: view.trend ? `, ${TREND_NAMES[language][view.trend].toLowerCase()}` : '',
      time: formatTime(view.lastReadingAt, language),
    });
  }
  if (view.surge !== null) {
    summary += texts.surge({ surge: formatSurge(view.surge, language) });
    // The peak only says something when the surge is still to rise.
    if (view.peak && view.peak.cm > view.surge) {
      summary += texts.peak({
        peak: formatSurge(view.peak.cm, language),
        time: formatTime(view.peak.t, language),
      });
    }
  }
  return {
    summary,
    height: view.height,
    surge: view.surge,
    surge_peak: view.peak?.cm ?? null,
  };
}

export const SCENE_ACTIONS = {
  [SCENE_ACTION_KEY]: (monitor, fields) => summarize(monitor, fields),
};
