/**
 * data/handball.js
 * Dataset local de respaldo para la Liga ASOBAL.
 * Temporadas 2022-2023 y 2023-2024.
 *
 * Contiene clasificación, máximos goleadores, paradas de porteros y una
 * muestra de resultados jornada a jornada.
 */

import { decorateStandings } from './helpers.js';

const STANDINGS_2022_23 = [
  { pos: 1, team: 'FC Barcelona', short: 'BAR', played: 30, won: 29, drawn: 1, lost: 0, goalsFor: 1045, goalsAgainst: 720, points: 59 },
  { pos: 2, team: 'Fraikin BM Granollers', short: 'GRA', played: 30, won: 22, drawn: 3, lost: 5, goalsFor: 913, goalsAgainst: 821, points: 47 },
  { pos: 3, team: 'Bidasoa Irún', short: 'BID', played: 30, won: 21, drawn: 4, lost: 5, goalsFor: 887, goalsAgainst: 815, points: 46 },
  { pos: 4, team: 'BM Benidorm', short: 'BEN', played: 30, won: 20, drawn: 5, lost: 5, goalsFor: 886, goalsAgainst: 820, points: 45 },
  { pos: 5, team: 'Logroño La Rioja', short: 'LOG', played: 30, won: 19, drawn: 4, lost: 7, goalsFor: 892, goalsAgainst: 842, points: 42 },
  { pos: 6, team: 'Ademar León', short: 'ADE', played: 30, won: 18, drawn: 5, lost: 7, goalsFor: 898, goalsAgainst: 852, points: 41 },
  { pos: 7, team: 'BM Cuenca', short: 'CUE', played: 30, won: 17, drawn: 4, lost: 9, goalsFor: 863, goalsAgainst: 836, points: 38 },
  { pos: 8, team: 'Helvetia Anaitasuna', short: 'ANA', played: 30, won: 14, drawn: 6, lost: 10, goalsFor: 846, goalsAgainst: 838, points: 34 },
  { pos: 9, team: 'Bada Huesca', short: 'HUE', played: 30, won: 13, drawn: 5, lost: 12, goalsFor: 842, goalsAgainst: 851, points: 31 },
  { pos: 10, team: 'Frigoríficos Morrazo', short: 'MOR', played: 30, won: 12, drawn: 5, lost: 13, goalsFor: 801, goalsAgainst: 826, points: 29 },
  { pos: 11, team: 'Ángel Ximénez Puente Genil', short: 'PGE', played: 30, won: 11, drawn: 5, lost: 14, goalsFor: 815, goalsAgainst: 843, points: 27 },
  { pos: 12, team: 'Bathco Torrelavega', short: 'TOR', played: 30, won: 10, drawn: 6, lost: 14, goalsFor: 808, goalsAgainst: 842, points: 26 },
  { pos: 13, team: 'Nava', short: 'NAV', played: 30, won: 9, drawn: 5, lost: 16, goalsFor: 793, goalsAgainst: 848, points: 23 },
  { pos: 14, team: 'Atlético Valladolid', short: 'ATV', played: 30, won: 8, drawn: 5, lost: 17, goalsFor: 801, goalsAgainst: 860, points: 21 },
  { pos: 15, team: 'Cangas', short: 'CAN', played: 30, won: 7, drawn: 4, lost: 19, goalsFor: 780, goalsAgainst: 868, points: 18 },
  { pos: 16, team: 'Sinfín', short: 'SIN', played: 30, won: 4, drawn: 3, lost: 23, goalsFor: 762, goalsAgainst: 904, points: 11 }
];

const STANDINGS_2023_24 = [
  { pos: 1, team: 'FC Barcelona', short: 'BAR', played: 30, won: 30, drawn: 0, lost: 0, goalsFor: 1080, goalsAgainst: 745, points: 60 },
  { pos: 2, team: 'Fraikin BM Granollers', short: 'GRA', played: 30, won: 23, drawn: 2, lost: 5, goalsFor: 930, goalsAgainst: 820, points: 48 },
  { pos: 3, team: 'Bidasoa Irún', short: 'BID', played: 30, won: 21, drawn: 3, lost: 6, goalsFor: 905, goalsAgainst: 830, points: 45 },
  { pos: 4, team: 'Logroño La Rioja', short: 'LOG', played: 30, won: 20, drawn: 4, lost: 6, goalsFor: 920, goalsAgainst: 850, points: 44 },
  { pos: 5, team: 'BM Benidorm', short: 'BEN', played: 30, won: 18, drawn: 4, lost: 8, goalsFor: 880, goalsAgainst: 835, points: 40 },
  { pos: 6, team: 'Ademar León', short: 'ADE', played: 30, won: 17, drawn: 4, lost: 9, goalsFor: 890, goalsAgainst: 850, points: 38 },
  { pos: 7, team: 'BM Cuenca', short: 'CUE', played: 30, won: 16, drawn: 5, lost: 9, goalsFor: 870, goalsAgainst: 840, points: 37 },
  { pos: 8, team: 'Helvetia Anaitasuna', short: 'ANA', played: 30, won: 14, drawn: 5, lost: 11, goalsFor: 850, goalsAgainst: 845, points: 33 },
  { pos: 9, team: 'Bada Huesca', short: 'HUE', played: 30, won: 13, drawn: 6, lost: 11, goalsFor: 845, goalsAgainst: 850, points: 32 },
  { pos: 10, team: 'Ángel Ximénez Puente Genil', short: 'PGE', played: 30, won: 12, drawn: 5, lost: 13, goalsFor: 820, goalsAgainst: 840, points: 29 },
  { pos: 11, team: 'Bathco Torrelavega', short: 'TOR', played: 30, won: 11, drawn: 5, lost: 14, goalsFor: 815, goalsAgainst: 845, points: 27 },
  { pos: 12, team: 'Nava', short: 'NAV', played: 30, won: 10, drawn: 5, lost: 15, goalsFor: 800, goalsAgainst: 850, points: 25 },
  { pos: 13, team: 'Atlético Valladolid', short: 'ATV', played: 30, won: 9, drawn: 4, lost: 17, goalsFor: 810, goalsAgainst: 870, points: 22 },
  { pos: 14, team: 'Cangas', short: 'CAN', played: 30, won: 7, drawn: 5, lost: 18, goalsFor: 790, goalsAgainst: 875, points: 19 },
  { pos: 15, team: 'Guadalajara', short: 'GUA', played: 30, won: 5, drawn: 3, lost: 22, goalsFor: 770, goalsAgainst: 900, points: 13 },
  { pos: 16, team: 'Sinfín', short: 'SIN', played: 30, won: 3, drawn: 2, lost: 25, goalsFor: 750, goalsAgainst: 920, points: 8 }
];

const SCORERS_2022_23 = [
  { player: 'Dika Mem', team: 'FC Barcelona', goals: 144, matches: 30, avg: 4.8, penalties: 9 },
  { player: 'Aleix Gómez', team: 'FC Barcelona', goals: 136, matches: 29, avg: 4.7, penalties: 12 },
  { player: 'Gonzalo Pérez Arce', team: 'Bidasoa Irún', goals: 128, matches: 30, avg: 4.3, penalties: 8 },
  { player: 'Antonio García Robledo', team: 'Fraikin BM Granollers', goals: 121, matches: 30, avg: 4.0, penalties: 6 },
  { player: 'Alberto Valiño', team: 'BM Benidorm', goals: 116, matches: 30, avg: 3.9, penalties: 10 },
  { player: 'Ángel Fernández', team: 'Logroño La Rioja', goals: 110, matches: 29, avg: 3.8, penalties: 7 },
  { player: 'Juan Castro', team: 'Ademar León', goals: 106, matches: 30, avg: 3.5, penalties: 5 },
  { player: 'Imanol Garciandia', team: 'FC Barcelona', goals: 102, matches: 28, avg: 3.6, penalties: 2 },
  { player: 'Eduardo Gurbindo', team: 'Bada Huesca', goals: 99, matches: 30, avg: 3.3, penalties: 4 },
  { player: 'David Balaguer', team: 'BM Benidorm', goals: 96, matches: 29, avg: 3.3, penalties: 3 }
];

const GOALKEEPERS_2022_23 = [
  { player: 'Gonzalo Pérez de Vargas', team: 'FC Barcelona', saves: 318, matches: 30, savePct: 37.4 },
  { player: 'Sergey Hernández', team: 'FC Barcelona', saves: 205, matches: 22, savePct: 34.8 },
  { player: 'Ignacio Biosca', team: 'Fraikin BM Granollers', saves: 286, matches: 30, savePct: 33.7 },
  { player: 'Xoan Ledo', team: 'Bidasoa Irún', saves: 274, matches: 30, savePct: 32.9 },
  { player: 'Leo Maciel', team: 'BM Benidorm', saves: 265, matches: 30, savePct: 32.1 },
  { player: 'Danijel Šarić', team: 'Logroño La Rioja', saves: 251, matches: 29, savePct: 31.6 },
  { player: 'Diego Pérez', team: 'Ademar León', saves: 244, matches: 30, savePct: 30.8 },
  { player: 'Nicolás Bonanno', team: 'Bada Huesca', saves: 232, matches: 29, savePct: 30.2 }
];

const SCORERS_2023_24 = [
  { player: 'Aleix Gómez', team: 'FC Barcelona', goals: 152, matches: 30, avg: 5.1, penalties: 14 },
  { player: 'Dika Mem', team: 'FC Barcelona', goals: 141, matches: 29, avg: 4.9, penalties: 8 },
  { player: 'Gonzalo Pérez Arce', team: 'Bidasoa Irún', goals: 132, matches: 30, avg: 4.4, penalties: 9 },
  { player: 'Antonio García Robledo', team: 'Fraikin BM Granollers', goals: 125, matches: 30, avg: 4.2, penalties: 7 },
  { player: 'Imanol Garciandia', team: 'FC Barcelona', goals: 118, matches: 30, avg: 3.9, penalties: 2 },
  { player: 'Ángel Fernández', team: 'Logroño La Rioja', goals: 112, matches: 29, avg: 3.9, penalties: 6 },
  { player: 'Alberto Valiño', team: 'BM Benidorm', goals: 108, matches: 30, avg: 3.6, penalties: 11 },
  { player: 'Juan Castro', team: 'Ademar León', goals: 104, matches: 29, avg: 3.6, penalties: 5 },
  { player: 'David Balaguer', team: 'BM Benidorm', goals: 100, matches: 30, avg: 3.3, penalties: 3 },
  { player: 'Eduardo Gurbindo', team: 'Bada Huesca', goals: 96, matches: 30, avg: 3.2, penalties: 4 }
];

const GOALKEEPERS_2023_24 = [
  { player: 'Gonzalo Pérez de Vargas', team: 'FC Barcelona', saves: 326, matches: 30, savePct: 38.1 },
  { player: 'Sergey Hernández', team: 'FC Barcelona', saves: 210, matches: 22, savePct: 35.2 },
  { player: 'Ignacio Biosca', team: 'Fraikin BM Granollers', saves: 291, matches: 30, savePct: 34.0 },
  { player: 'Xoan Ledo', team: 'Bidasoa Irún', saves: 280, matches: 30, savePct: 33.4 },
  { player: 'Leo Maciel', team: 'BM Benidorm', saves: 271, matches: 30, savePct: 32.7 },
  { player: 'Danijel Šarić', team: 'Logroño La Rioja', saves: 255, matches: 29, savePct: 31.9 },
  { player: 'Diego Pérez', team: 'Ademar León', saves: 249, matches: 30, savePct: 31.2 },
  { player: 'Nicolás Bonanno', team: 'Bada Huesca', saves: 238, matches: 29, savePct: 30.5 }
];

const RESULTS_2022_23 = [
  { round: 1, date: '2022-09-03', home: 'FC Barcelona', away: 'Sinfín', homeScore: 38, awayScore: 25 },
  { round: 1, date: '2022-09-03', home: 'Fraikin BM Granollers', away: 'Bada Huesca', homeScore: 30, awayScore: 27 },
  { round: 1, date: '2022-09-03', home: 'Bidasoa Irún', away: 'Ademar León', homeScore: 31, awayScore: 28 },
  { round: 1, date: '2022-09-04', home: 'BM Benidorm', away: 'Nava', homeScore: 29, awayScore: 26 },
  { round: 1, date: '2022-09-04', home: 'Logroño La Rioja', away: 'Ángel Ximénez Puente Genil', homeScore: 32, awayScore: 30 },
  { round: 1, date: '2022-09-04', home: 'BM Cuenca', away: 'Bathco Torrelavega', homeScore: 28, awayScore: 27 },
  { round: 5, date: '2022-10-01', home: 'FC Barcelona', away: 'Fraikin BM Granollers', homeScore: 34, awayScore: 28 },
  { round: 5, date: '2022-10-01', home: 'Bidasoa Irún', away: 'BM Benidorm', homeScore: 30, awayScore: 30 },
  { round: 5, date: '2022-10-02', home: 'Logroño La Rioja', away: 'BM Cuenca', homeScore: 31, awayScore: 27 },
  { round: 12, date: '2022-12-03', home: 'Fraikin BM Granollers', away: 'Bidasoa Irún', homeScore: 29, awayScore: 26 },
  { round: 12, date: '2022-12-03', home: 'BM Benidorm', away: 'Logroño La Rioja', homeScore: 31, awayScore: 29 },
  { round: 12, date: '2022-12-04', home: 'FC Barcelona', away: 'BM Cuenca', homeScore: 36, awayScore: 24 },
  { round: 20, date: '2023-02-25', home: 'FC Barcelona', away: 'BM Benidorm', homeScore: 35, awayScore: 27 },
  { round: 20, date: '2023-02-25', home: 'Bidasoa Irún', away: 'Logroño La Rioja', homeScore: 32, awayScore: 29 },
  { round: 20, date: '2023-02-26', home: 'Fraikin BM Granollers', away: 'Ademar León', homeScore: 33, awayScore: 28 },
  { round: 30, date: '2023-05-27', home: 'FC Barcelona', away: 'Ángel Ximénez Puente Genil', homeScore: 40, awayScore: 26 },
  { round: 30, date: '2023-05-27', home: 'Fraikin BM Granollers', away: 'BM Benidorm', homeScore: 31, awayScore: 28 },
  { round: 30, date: '2023-05-27', home: 'Bidasoa Irún', away: 'BM Cuenca', homeScore: 30, awayScore: 27 },
  { round: 30, date: '2023-05-27', home: 'Logroño La Rioja', away: 'Ademar León', homeScore: 32, awayScore: 29 },
  { round: 30, date: '2023-05-27', home: 'Bada Huesca', away: 'Bathco Torrelavega', homeScore: 29, awayScore: 28 },
  { round: 30, date: '2023-05-27', home: 'Atlético Valladolid', away: 'Sinfín', homeScore: 27, awayScore: 26 }
];

const RESULTS_2023_24 = [
  { round: 1, date: '2023-09-02', home: 'FC Barcelona', away: 'Sinfín', homeScore: 39, awayScore: 24 },
  { round: 1, date: '2023-09-02', home: 'Fraikin BM Granollers', away: 'Bidasoa Irún', homeScore: 31, awayScore: 28 },
  { round: 1, date: '2023-09-02', home: 'BM Benidorm', away: 'Logroño La Rioja', homeScore: 30, awayScore: 27 },
  { round: 1, date: '2023-09-03', home: 'Ademar León', away: 'BM Cuenca', homeScore: 29, awayScore: 26 },
  { round: 1, date: '2023-09-03', home: 'Bada Huesca', away: 'Nava', homeScore: 28, awayScore: 27 },
  { round: 1, date: '2023-09-03', home: 'Ángel Ximénez Puente Genil', away: 'Guadalajara', homeScore: 30, awayScore: 28 },
  { round: 6, date: '2023-10-07', home: 'FC Barcelona', away: 'Fraikin BM Granollers', homeScore: 34, awayScore: 29 },
  { round: 6, date: '2023-10-07', home: 'Bidasoa Irún', away: 'BM Benidorm', homeScore: 31, awayScore: 29 },
  { round: 6, date: '2023-10-08', home: 'Logroño La Rioja', away: 'Ademar León', homeScore: 30, awayScore: 28 },
  { round: 14, date: '2023-12-09', home: 'Bidasoa Irún', away: 'Fraikin BM Granollers', homeScore: 28, awayScore: 28 },
  { round: 14, date: '2023-12-09', home: 'FC Barcelona', away: 'Logroño La Rioja', homeScore: 37, awayScore: 25 },
  { round: 14, date: '2023-12-10', home: 'BM Benidorm', away: 'BM Cuenca', homeScore: 30, awayScore: 27 },
  { round: 22, date: '2024-02-24', home: 'FC Barcelona', away: 'BM Benidorm', homeScore: 36, awayScore: 28 },
  { round: 22, date: '2024-02-24', home: 'Bidasoa Irún', away: 'Logroño La Rioja', homeScore: 31, awayScore: 29 },
  { round: 22, date: '2024-02-25', home: 'Fraikin BM Granollers', away: 'Ademar León', homeScore: 32, awayScore: 27 },
  { round: 30, date: '2024-05-25', home: 'FC Barcelona', away: 'Fraikin BM Granollers', homeScore: 38, awayScore: 27 },
  { round: 30, date: '2024-05-25', home: 'Bidasoa Irún', away: 'BM Benidorm', homeScore: 32, awayScore: 30 },
  { round: 30, date: '2024-05-25', home: 'Logroño La Rioja', away: 'BM Cuenca', homeScore: 31, awayScore: 28 },
  { round: 30, date: '2024-05-25', home: 'Ademar León', away: 'Bada Huesca', homeScore: 30, awayScore: 27 },
  { round: 30, date: '2024-05-25', home: 'Nava', away: 'Cangas', homeScore: 28, awayScore: 27 },
  { round: 30, date: '2024-05-25', home: 'Sinfín', away: 'Guadalajara', homeScore: 26, awayScore: 30 }
];

const buildHandballSeason = ({
  season,
  standings,
  scorers,
  goalkeepers,
  results,
  description,
  champion
}) => ({
  meta: {
    sport: 'balonmano',
    sportLabel: 'Balonmano',
    league: 'Liga ASOBAL',
    season,
    country: 'España',
    provider: 'Base local IberiaStats · ASOBAL',
    source: 'local',
    fallbackReason: null,
    updatedAt: '2024-06-30T20:00:00.000Z',
    description,
    champion,
    hasExternalProvider: false
  },
  standings: decorateStandings(standings),
  scorers,
  goalkeepers,
  results
});

export const HANDBALL_DATA = {
  '2022-2023': buildHandballSeason({
    season: '2022-2023',
    standings: STANDINGS_2022_23,
    scorers: SCORERS_2022_23,
    goalkeepers: GOALKEEPERS_2022_23,
    results: RESULTS_2022_23,
    champion: 'FC Barcelona',
    description:
      'El FC Barcelona prolongó su hegemonía con una temporada casi perfecta: 29 victorias y un empate en 30 jornadas. Dika Mem fue el máximo goleador con 144 tantos.'
  }),
  '2023-2024': buildHandballSeason({
    season: '2023-2024',
    standings: STANDINGS_2023_24,
    scorers: SCORERS_2023_24,
    goalkeepers: GOALKEEPERS_2023_24,
    results: RESULTS_2023_24,
    champion: 'FC Barcelona',
    description:
      'El FC Barcelona completó un pleno histórico de 30 victorias y levantó un nuevo título de la Liga ASOBAL. Aleix Gómez lideró la tabla de goleadores con 152 goles.'
  })
};
