/**
 * data/helpers.js
 * Utilidades puras compartidas por los datasets locales.
 * No dependen del DOM ni de Node, por lo que pueden usarse tanto en el
 * navegador como en el backend.
 */

export const round = (value, digits = 1) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Number(number.toFixed(digits));
};

/**
 * Genera una racha de cinco resultados (W/D/L) de forma determinista a partir
 * del balance de la temporada. Se usa para completar tablas locales y APIs que
 * no devuelven el campo "form".
 */
export const makeForm = (won, drawn, lost, seed = 1) => {
  const bag = [
    ...Array(Math.max(0, won)).fill('W'),
    ...Array(Math.max(0, drawn)).fill('D'),
    ...Array(Math.max(0, lost)).fill('L')
  ];
  if (!bag.length) return [];

  const pool = [...bag];
  const form = [];
  for (let index = 0; index < Math.min(5, bag.length); index += 1) {
    const position = (seed * 7 + index * 13) % pool.length;
    form.push(pool.splice(position, 1)[0]);
  }
  return form;
};

export const makeStreak = (form = []) => {
  if (!form.length) return '—';
  const last = form[form.length - 1];
  let count = 0;
  for (let index = form.length - 1; index >= 0; index -= 1) {
    if (form[index] === last) count += 1;
    else break;
  }
  const symbol = last === 'W' ? 'V' : last === 'D' ? 'E' : 'D';
  return `${symbol}${count}`;
};

/**
 * Normaliza una fila de clasificación y calcula campos derivados:
 * partidos jugados, diferencia, porcentaje de victorias, forma y racha.
 */
export const decorateStandings = (rows) =>
  rows.map((row, index) => {
    const drawn = row.drawn ?? 0;
    const played = row.played ?? row.won + drawn + row.lost;
    const goalsFor = row.goalsFor ?? row.pointsFor ?? 0;
    const goalsAgainst = row.goalsAgainst ?? row.pointsAgainst ?? 0;
    const form = row.form ?? makeForm(row.won, drawn, row.lost, index + 2);
    const position = row.position ?? row.pos ?? index + 1;

    return {
      ...row,
      pos: position,
      position,
      played,
      drawn,
      diff: row.diff ?? goalsFor - goalsAgainst,
      winPct: row.winPct ?? (played ? round(row.won / played, 3) : 0),
      form,
      streak: row.streak ?? makeStreak(form)
    };
  });

/**
 * Construye la tabla de estadísticas de equipo de fútbol a partir de la
 * clasificación y de un mapa de estilos por equipo (posesión, tiros, xG...).
 */
export const buildFootballTeamStats = (standings, styles) =>
  standings.map((row) => {
    const style =
      styles[row.team] ?? {
        possession: 48,
        shots: 11.5,
        corners: 4.4,
        yellow: 88,
        red: 3,
        xg: 1.2
      };

    return {
      team: row.team,
      short: row.short,
      possession: style.possession,
      shots: style.shots,
      shotsOnTarget: round(style.shots * 0.36, 1),
      corners: style.corners,
      yellowCards: style.yellow,
      redCards: style.red,
      xg: style.xg,
      cleanSheets: Math.max(3, Math.min(23, Math.round(23 - row.goalsAgainst / 4))),
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst
    };
  });
