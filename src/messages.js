// -----------------------------------------------------------------------------
// Texts sent from the container (feature values, connection status, action
// messages, scene variables), in the four languages of the Gladys interface.
// Entries are strings or functions of one parameter object. German says "du",
// Spanish "usted".
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';

export const TREND_NAMES = {
  en: { rising: 'Rising', falling: 'Falling', slack: 'Slack water' },
  fr: { rising: 'Monte', falling: 'Descend', slack: 'Étale' },
  de: { rising: 'Steigt', falling: 'Fällt', slack: 'Stauwasser' },
  es: { rising: 'Sube', falling: 'Baja', slack: 'Repunte' },
};

// Values of the "Last reading" feature.
export const READINGS = {
  en: { staleSince: ({ date }) => `No new reading since ${date}` },
  fr: { staleSince: ({ date }) => `Pas de nouvelle mesure depuis le ${date}` },
  de: { staleSince: ({ date }) => `Keine neue Messung seit ${date}` },
  es: { staleSince: ({ date }) => `Sin nueva medición desde el ${date}` },
};

// Connection status of the Configuration screen.
export const STATUS = {
  en: {
    initFailed: 'Initialization failed, check the integration logs.',
    down: 'The SHOM service does not answer: the readings will come back with it.',
    unknown: ({ names }) => `Unknown tide gauge: ${names}. Use "Find tide gauges".`,
    homeFailed:
      'Around my house: the nearest tide gauge cannot be chosen yet, tried again at the next refresh.',
    noHouse: 'Around my house: give your house a location in Gladys (Settings, Houses).',
    tooMany: ({ max }) => `Only the first ${max} tide gauges are followed.`,
    none: 'No tide gauge yet: fill in the configuration, or use "Find tide gauges".',
  },
  fr: {
    initFailed: "L'initialisation a échoué, consultez les logs de l'intégration.",
    down: 'Le service du SHOM ne répond pas : les mesures reviendront avec lui.',
    unknown: ({ names }) => `Marégraphe inconnu : ${names}. Utilisez « Chercher des marégraphes ».`,
    homeFailed:
      'Autour de ma maison : le marégraphe le plus proche ne peut pas encore être choisi, nouvel essai à la prochaine mise à jour.',
    noHouse:
      'Autour de ma maison : indiquez la position de votre maison dans Gladys (Paramètres, Maisons).',
    tooMany: ({ max }) => `Seuls les ${max} premiers marégraphes sont suivis.`,
    none: 'Aucun marégraphe : remplissez la configuration, ou utilisez « Chercher des marégraphes ».',
  },
  de: {
    initFailed: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
    down: 'Der Dienst des SHOM antwortet nicht: Die Messwerte kommen mit ihm zurück.',
    unknown: ({ names }) => `Unbekannter Pegel: ${names}. Nutze „Pegel suchen“.`,
    homeFailed:
      'Rund um mein Haus: Der nächste Pegel kann noch nicht gewählt werden, neuer Versuch bei der nächsten Aktualisierung.',
    noHouse: 'Rund um mein Haus: Gib deinem Haus in Gladys einen Standort (Einstellungen, Häuser).',
    tooMany: ({ max }) => `Nur die ersten ${max} Pegel werden verfolgt.`,
    none: 'Noch kein Pegel: Fülle die Konfiguration aus oder nutze „Pegel suchen“.',
  },
  es: {
    initFailed: 'La inicialización ha fallado, consulte los registros de la integración.',
    down: 'El servicio del SHOM no responde: las mediciones volverán con él.',
    unknown: ({ names }) => `Mareógrafo desconocido: ${names}. Use «Buscar mareógrafos».`,
    homeFailed:
      'Alrededor de mi casa: aún no se puede elegir el mareógrafo más cercano, nuevo intento en la próxima actualización.',
    noHouse: 'Alrededor de mi casa: indique la ubicación de su casa en Gladys (Ajustes, Casas).',
    tooMany: ({ max }) => `Solo se siguen los ${max} primeros mareógrafos.`,
    none: 'Aún no hay mareógrafos: rellene la configuración o use «Buscar mareógrafos».',
  },
};

// Messages of the "Find tide gauges" action.
export const SEARCH = {
  en: {
    noHouse:
      'Your house has no location in Gladys: type a tide gauge name (Brest, Le Havre…) or its SHOM number.',
    none: 'No tide gauge found.',
    found: ({ count, total }) =>
      `${total > count ? `${count} of ${total}` : count} tide gauge(s). Copy the numbers into "Tide gauges", then save:`,
    unavailable: 'The SHOM service does not answer, try again in a few minutes.',
    noRecent: 'no recent reading',
  },
  fr: {
    noHouse:
      "Votre maison n'a pas de position dans Gladys : tapez un nom de marégraphe (Brest, Le Havre…) ou son numéro SHOM.",
    none: 'Aucun marégraphe trouvé.',
    found: ({ count, total }) =>
      `${total > count ? `${count} sur ${total}` : count} marégraphe(s). Copiez les numéros dans « Marégraphes », puis enregistrez :`,
    unavailable: 'Le service du SHOM ne répond pas, réessayez dans quelques minutes.',
    noRecent: 'pas de mesure récente',
  },
  de: {
    noHouse:
      'Dein Haus hat in Gladys keinen Standort: Gib einen Pegelnamen (Brest, Le Havre…) oder seine SHOM-Nummer ein.',
    none: 'Kein Pegel gefunden.',
    found: ({ count, total }) =>
      `${total > count ? `${count} von ${total}` : count} Pegel. Kopiere die Nummern in „Pegel“ und speichere:`,
    unavailable: 'Der Dienst des SHOM antwortet nicht, versuche es in ein paar Minuten erneut.',
    noRecent: 'keine aktuelle Messung',
  },
  es: {
    noHouse:
      'Su casa no tiene ubicación en Gladys: escriba el nombre de un mareógrafo (Brest, Le Havre…) o su número SHOM.',
    none: 'No se ha encontrado ningún mareógrafo.',
    found: ({ count, total }) =>
      `${total > count ? `${count} de ${total}` : count} mareógrafo(s). Copie los números en «Mareógrafos» y guarde:`,
    unavailable: 'El servicio del SHOM no responde, inténtelo de nuevo en unos minutos.',
    noRecent: 'sin medición reciente',
  },
};

// The sentence of the `summary` scene action.
export const SUMMARY = {
  en: {
    unknown: 'This tide gauge is not followed by the integration.',
    waiting: ({ name }) => `${name}: no reading yet.`,
    silent: ({ name, date }) => `${name}: no new reading since ${date}.`,
    height: ({ name, height, trend, time }) =>
      `${name}: sea level ${height}${trend}, measured at ${time}.`,
    surge: ({ surge }) => ` Surge forecast now: ${surge}.`,
    peak: ({ peak, time }) => ` Up to ${peak} expected at ${time}.`,
  },
  fr: {
    unknown: "Ce marégraphe n'est pas suivi par l'intégration.",
    waiting: ({ name }) => `${name} : pas encore de mesure.`,
    silent: ({ name, date }) => `${name} : pas de nouvelle mesure depuis le ${date}.`,
    height: ({ name, height, trend, time }) =>
      `${name} : hauteur d'eau ${height}${trend}, mesurée à ${time}.`,
    surge: ({ surge }) => ` Surcote prévue maintenant : ${surge}.`,
    peak: ({ peak, time }) => ` Jusqu'à ${peak} attendus à ${time}.`,
  },
  de: {
    unknown: 'Dieser Pegel wird von der Integration nicht verfolgt.',
    waiting: ({ name }) => `${name}: noch keine Messung.`,
    silent: ({ name, date }) => `${name}: keine neue Messung seit ${date}.`,
    height: ({ name, height, trend, time }) =>
      `${name}: Wasserstand ${height}${trend}, gemessen um ${time}.`,
    surge: ({ surge }) => ` Windstau-Vorhersage jetzt: ${surge}.`,
    peak: ({ peak, time }) => ` Bis zu ${peak} um ${time} erwartet.`,
  },
  es: {
    unknown: 'La integración no sigue este mareógrafo.',
    waiting: ({ name }) => `${name}: aún no hay medición.`,
    silent: ({ name, date }) => `${name}: sin nueva medición desde el ${date}.`,
    height: ({ name, height, trend, time }) =>
      `${name}: nivel del mar ${height}${trend}, medido a las ${time}.`,
    surge: ({ surge }) => ` Sobreelevación prevista ahora: ${surge}.`,
    peak: ({ peak, time }) => ` Hasta ${peak} previstos a las ${time}.`,
  },
};

/** One entry of a message table, in every language: `{ en, fr, de, es }`. */
export function render(table, key, params = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => {
      const entry = table[language][key];
      return [language, typeof entry === 'function' ? entry(params) : entry];
    }),
  );
}

/** Several multi-language texts joined, language by language. */
export function join(...messages) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      messages
        .filter(Boolean)
        .map((message) => message[language])
        .join(' '),
    ]),
  );
}

const locale = (language) => (language === 'en' ? 'en-GB' : language);

/** A date in the user's time zone (TZ, set by the Gladys supervisor), e.g. "29/10 17:05". */
export function formatDate(time, language) {
  return new Intl.DateTimeFormat(locale(language), {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

/** A time of day in the user's time zone, e.g. "17:05". */
export function formatTime(time, language) {
  return new Intl.DateTimeFormat(locale(language), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

/** A number in the user's language, e.g. "1,34" in French. */
export function formatNumber(value, language, digits = 2) {
  return new Intl.NumberFormat(locale(language), {
    maximumFractionDigits: digits,
  }).format(value);
}

/** A sea level, e.g. "1,34 m". */
export const formatHeight = (value, language) => `${formatNumber(value, language)} m`;

/** A surge with its sign, e.g. "+12 cm" or "−5 cm". */
export function formatSurge(cm, language) {
  const rounded = Math.round(cm);
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(rounded), language, 0)} cm`;
}
