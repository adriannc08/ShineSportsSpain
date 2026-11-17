/**
 * data/basketball.js
 * Dataset local de respaldo para la Liga ACB.
 * Temporadas 2022-2023 y 2023-2024.
 *
 * Incluye fase regular, líderes estadísticos (puntos, valoración, rebotes y
 * asistencias) y una muestra de resultados por jornada. La estructura replica
 * el contrato normalizado que puede devolver un backend externo.
 */

import { decorateStandings } from './helpers.js';

const STANDINGS_2022_23 = [
  { pos: 1, team: 'Real Madrid', short: 'RMA', played: 34, won: 28, lost: 6, pointsFor: 2890, pointsAgainst: 2650 },
  { pos: 2, team: 'FC Barcelona', short: 'BAR', played: 34, won: 27, lost: 7, pointsFor: 2850, pointsAgainst: 2670 },
  { pos: 3, team: 'Baskonia', short: 'BKN', played: 34, won: 26, lost: 8, pointsFor: 2910, pointsAgainst: 2740 },
  { pos: 4, team: 'Valencia Basket', short: 'VAL', played: 34, won: 25, lost: 9, pointsFor: 2800, pointsAgainst: 2660 },
  { pos: 5, team: 'Gran Canaria', short: 'GCA', played: 34, won: 23, lost: 11, pointsFor: 2740, pointsAgainst: 2650 },
  { pos: 6, team: 'Lenovo Tenerife', short: 'TFE', played: 34, won: 22, lost: 12, pointsFor: 2780, pointsAgainst: 2710 },
  { pos: 7, team: 'Unicaja', short: 'UNI', played: 34, won: 21, lost: 13, pointsFor: 2760, pointsAgainst: 2710 },
  { pos: 8, team: 'Joventut Badalona', short: 'JOV', played: 34, won: 20, lost: 14, pointsFor: 2700, pointsAgainst: 2680 },
  { pos: 9, team: 'UCAM Murcia', short: 'MUR', played: 34, won: 19, lost: 15, pointsFor: 2690, pointsAgainst: 2700 },
  { pos: 10, team: 'Baxi Manresa', short: 'MAN', played: 34, won: 18, lost: 16, pointsFor: 2680, pointsAgainst: 2690 },
  { pos: 11, team: 'Casademont Zaragoza', short: 'ZAR', played: 34, won: 17, lost: 17, pointsFor: 2660, pointsAgainst: 2710 },
  { pos: 12, team: 'Surne Bilbao Basket', short: 'BIL', played: 34, won: 16, lost: 18, pointsFor: 2630, pointsAgainst: 2700 },
  { pos: 13, team: 'Río Breogán', short: 'BRE', played: 34, won: 15, lost: 19, pointsFor: 2580, pointsAgainst: 2690 },
  { pos: 14, team: 'Bàsquet Girona', short: 'GIR', played: 34, won: 14, lost: 20, pointsFor: 2590, pointsAgainst: 2720 },
  { pos: 15, team: 'Monbus Obradoiro', short: 'OBR', played: 34, won: 13, lost: 21, pointsFor: 2570, pointsAgainst: 2720 },
  { pos: 16, team: 'Covirán Granada', short: 'GRA', played: 34, won: 12, lost: 22, pointsFor: 2550, pointsAgainst: 2760 },
  { pos: 17, team: 'Real Betis Baloncesto', short: 'BET', played: 34, won: 10, lost: 24, pointsFor: 2530, pointsAgainst: 2790 },
  { pos: 18, team: 'Fuenlabrada', short: 'FUE', played: 34, won: 8, lost: 26, pointsFor: 2510, pointsAgainst: 2820 }
];

const STANDINGS_2023_24 = [
  { pos: 1, team: 'Real Madrid', short: 'RMA', played: 34, won: 30, lost: 4, pointsFor: 3010, pointsAgainst: 2720 },
  { pos: 2, team: 'Unicaja', short: 'UNI', played: 34, won: 27, lost: 7, pointsFor: 2910, pointsAgainst: 2700 },
  { pos: 3, team: 'FC Barcelona', short: 'BAR', played: 34, won: 26, lost: 8, pointsFor: 2930, pointsAgainst: 2740 },
  { pos: 4, team: 'Valencia Basket', short: 'VAL', played: 34, won: 24, lost: 10, pointsFor: 2870, pointsAgainst: 2760 },
  { pos: 5, team: 'Gran Canaria', short: 'GCA', played: 34, won: 22, lost: 12, pointsFor: 2780, pointsAgainst: 2720 },
  { pos: 6, team: 'Lenovo Tenerife', short: 'TFE', played: 34, won: 21, lost: 13, pointsFor: 2790, pointsAgainst: 2740 },
  { pos: 7, team: 'Baskonia', short: 'BKN', played: 34, won: 21, lost: 13, pointsFor: 2860, pointsAgainst: 2810 },
  { pos: 8, team: 'Joventut Badalona', short: 'JOV', played: 34, won: 19, lost: 15, pointsFor: 2740, pointsAgainst: 2730 },
  { pos: 9, team: 'UCAM Murcia', short: 'MUR', played: 34, won: 19, lost: 15, pointsFor: 2710, pointsAgainst: 2740 },
  { pos: 10, team: 'Surne Bilbao Basket', short: 'BIL', played: 34, won: 18, lost: 16, pointsFor: 2680, pointsAgainst: 2710 },
  { pos: 11, team: 'Casademont Zaragoza', short: 'ZAR', played: 34, won: 17, lost: 17, pointsFor: 2700, pointsAgainst: 2750 },
  { pos: 12, team: 'Bàsquet Girona', short: 'GIR', played: 34, won: 16, lost: 18, pointsFor: 2650, pointsAgainst: 2730 },
  { pos: 13, team: 'Río Breogán', short: 'BRE', played: 34, won: 15, lost: 19, pointsFor: 2640, pointsAgainst: 2740 },
  { pos: 14, team: 'Baxi Manresa', short: 'MAN', played: 34, won: 14, lost: 20, pointsFor: 2620, pointsAgainst: 2730 },
  { pos: 15, team: 'MoraBanc Andorra', short: 'AND', played: 34, won: 13, lost: 21, pointsFor: 2610, pointsAgainst: 2760 },
  { pos: 16, team: 'Covirán Granada', short: 'GRA', played: 34, won: 11, lost: 23, pointsFor: 2590, pointsAgainst: 2810 },
  { pos: 17, team: 'Monbus Obradoiro', short: 'OBR', played: 34, won: 9, lost: 25, pointsFor: 2550, pointsAgainst: 2840 },
  { pos: 18, team: 'Zunder Palencia', short: 'PAL', played: 34, won: 6, lost: 28, pointsFor: 2490, pointsAgainst: 2870 }
];

const POINTS_2022_23 = [
  { player: 'Markus Howard', team: 'Baskonia', games: 34, avg: 19.5, total: 663 },
  { player: 'Shannon Evans', team: 'Joventut Badalona', games: 32, avg: 17.8, total: 570 },
  { player: 'Jerrick Harding', team: 'Baxi Manresa', games: 30, avg: 16.9, total: 507 },
  { player: 'Giorgi Shermadini', team: 'Lenovo Tenerife', games: 33, avg: 15.8, total: 521 },
  { player: 'Dzanan Musa', team: 'Real Madrid', games: 30, avg: 15.2, total: 456 },
  { player: 'Nicolas Laprovittola', team: 'FC Barcelona', games: 32, avg: 14.6, total: 467 },
  { player: 'Ante Tomic', team: 'Joventut Badalona', games: 32, avg: 14.2, total: 454 },
  { player: 'Dylan Ennis', team: 'Gran Canaria', games: 31, avg: 13.9, total: 431 },
  { player: 'Jaime Fernández', team: 'Lenovo Tenerife', games: 32, avg: 13.1, total: 419 },
  { player: 'Kassius Robertson', team: 'Casademont Zaragoza', games: 30, avg: 12.8, total: 384 }
];

const VALUATION_2022_23 = [
  { player: 'Ante Tomic', team: 'Joventut Badalona', games: 32, avg: 21.4, total: 685 },
  { player: 'Giorgi Shermadini', team: 'Lenovo Tenerife', games: 33, avg: 20.6, total: 680 },
  { player: 'Dzanan Musa', team: 'Real Madrid', games: 30, avg: 18.9, total: 567 },
  { player: 'Markus Howard', team: 'Baskonia', games: 34, avg: 18.4, total: 626 },
  { player: 'Vincent Poirier', team: 'Real Madrid', games: 31, avg: 17.2, total: 533 },
  { player: 'Walter Tavares', team: 'Real Madrid', games: 30, avg: 16.8, total: 504 },
  { player: 'Nicolas Laprovittola', team: 'FC Barcelona', games: 32, avg: 16.5, total: 528 },
  { player: 'Dylan Ennis', team: 'Gran Canaria', games: 31, avg: 15.9, total: 493 }
];

const REBOUNDS_2022_23 = [
  { player: 'Ante Tomic', team: 'Joventut Badalona', games: 32, avg: 8.6, total: 275 },
  { player: 'Giorgi Shermadini', team: 'Lenovo Tenerife', games: 33, avg: 7.4, total: 244 },
  { player: 'Walter Tavares', team: 'Real Madrid', games: 30, avg: 7.1, total: 213 },
  { player: 'Vincent Poirier', team: 'Real Madrid', games: 31, avg: 6.8, total: 211 },
  { player: 'Simon Birgander', team: 'Joventut Badalona', games: 30, avg: 6.4, total: 192 },
  { player: 'Chima Moneke', team: 'Baskonia', games: 31, avg: 6.2, total: 192 },
  { player: 'Edy Tavares', team: 'Real Madrid', games: 29, avg: 6.0, total: 174 }
];

const ASSISTS_2022_23 = [
  { player: 'Marcelinho Huertas', team: 'Lenovo Tenerife', games: 32, avg: 6.7, total: 214 },
  { player: 'Facundo Campazzo', team: 'Real Madrid', games: 28, avg: 6.1, total: 171 },
  { player: 'Nicolas Laprovittola', team: 'FC Barcelona', games: 32, avg: 5.8, total: 186 },
  { player: 'Shannon Evans', team: 'Joventut Badalona', games: 32, avg: 5.2, total: 166 },
  { player: 'Dani Pérez', team: 'FC Barcelona', games: 30, avg: 4.9, total: 147 },
  { player: 'Dylan Ennis', team: 'Gran Canaria', games: 31, avg: 4.6, total: 143 }
];

const RESULTS_2022_23 = [
  { round: 1, date: '2022-09-29', home: 'Real Madrid', away: 'Gran Canaria', homeScore: 91, awayScore: 74 },
  { round: 1, date: '2022-09-30', home: 'FC Barcelona', away: 'Joventut Badalona', homeScore: 88, awayScore: 79 },
  { round: 1, date: '2022-10-01', home: 'Baskonia', away: 'Valencia Basket', homeScore: 95, awayScore: 87 },
  { round: 1, date: '2022-10-01', home: 'Lenovo Tenerife', away: 'Unicaja', homeScore: 82, awayScore: 77 },
  { round: 8, date: '2022-11-19', home: 'Real Madrid', away: 'FC Barcelona', homeScore: 86, awayScore: 75 },
  { round: 8, date: '2022-11-20', home: 'Baskonia', away: 'Lenovo Tenerife', homeScore: 90, awayScore: 84 },
  { round: 8, date: '2022-11-20', home: 'Valencia Basket', away: 'Casademont Zaragoza', homeScore: 88, awayScore: 76 },
  { round: 17, date: '2023-01-22', home: 'FC Barcelona', away: 'Baskonia', homeScore: 92, awayScore: 85 },
  { round: 17, date: '2023-01-22', home: 'Real Madrid', away: 'Valencia Basket', homeScore: 89, awayScore: 77 },
  { round: 17, date: '2023-01-23', home: 'Unicaja', away: 'Joventut Badalona', homeScore: 86, awayScore: 82 },
  { round: 25, date: '2023-03-19', home: 'Baskonia', away: 'Real Madrid', homeScore: 94, awayScore: 86 },
  { round: 25, date: '2023-03-19', home: 'Valencia Basket', away: 'FC Barcelona', homeScore: 89, awayScore: 82 },
  { round: 25, date: '2023-03-20', home: 'Lenovo Tenerife', away: 'UCAM Murcia', homeScore: 85, awayScore: 76 },
  { round: 34, date: '2023-05-21', home: 'Real Madrid', away: 'Lenovo Tenerife', homeScore: 90, awayScore: 81 },
  { round: 34, date: '2023-05-21', home: 'FC Barcelona', away: 'Valencia Basket', homeScore: 95, awayScore: 88 },
  { round: 34, date: '2023-05-21', home: 'Baskonia', away: 'Unicaja', homeScore: 92, awayScore: 80 }
];

const POINTS_2023_24 = [
  { player: 'Markus Howard', team: 'Baskonia', games: 33, avg: 19.8, total: 653 },
  { player: 'Trae Bell-Haynes', team: 'Casademont Zaragoza', games: 32, avg: 16.9, total: 541 },
  { player: 'Dylan Ennis', team: 'UCAM Murcia', games: 31, avg: 16.3, total: 505 },
  { player: 'Giorgi Shermadini', team: 'Lenovo Tenerife', games: 32, avg: 15.5, total: 496 },
  { player: 'Nicolas Laprovittola', team: 'FC Barcelona', games: 30, avg: 14.8, total: 444 },
  { player: 'Dzanan Musa', team: 'Real Madrid', games: 30, avg: 14.4, total: 432 },
  { player: 'Facundo Campazzo', team: 'Real Madrid', games: 31, avg: 13.9, total: 431 },
  { player: 'Edy Tavares', team: 'Real Madrid', games: 30, avg: 12.8, total: 384 },
  { player: 'Kendrick Perry', team: 'Unicaja', games: 31, avg: 12.4, total: 384 },
  { player: 'Tyson Carter', team: 'Surne Bilbao Basket', games: 32, avg: 12.1, total: 387 }
];

const VALUATION_2023_24 = [
  { player: 'Edy Tavares', team: 'Real Madrid', games: 30, avg: 20.6, total: 618 },
  { player: 'Ante Tomic', team: 'Joventut Badalona', games: 31, avg: 19.8, total: 614 },
  { player: 'Giorgi Shermadini', team: 'Lenovo Tenerife', games: 32, avg: 18.9, total: 605 },
  { player: 'Facundo Campazzo', team: 'Real Madrid', games: 31, avg: 18.2, total: 564 },
  { player: 'Dzanan Musa', team: 'Real Madrid', games: 30, avg: 17.5, total: 525 },
  { player: 'Markus Howard', team: 'Baskonia', games: 33, avg: 17.1, total: 564 },
  { player: 'Kendrick Perry', team: 'Unicaja', games: 31, avg: 15.8, total: 490 }
];

const REBOUNDS_2023_24 = [
  { player: 'Ante Tomic', team: 'Joventut Badalona', games: 31, avg: 8.1, total: 251 },
  { player: 'Edy Tavares', team: 'Real Madrid', games: 30, avg: 7.9, total: 237 },
  { player: 'Giorgi Shermadini', team: 'Lenovo Tenerife', games: 32, avg: 7.2, total: 230 },
  { player: 'Chima Moneke', team: 'Baskonia', games: 31, avg: 6.8, total: 211 },
  { player: 'Simon Birgander', team: 'UCAM Murcia', games: 30, avg: 6.3, total: 189 },
  { player: 'Yankuba Sima', team: 'Unicaja', games: 31, avg: 5.9, total: 183 }
];

const ASSISTS_2023_24 = [
  { player: 'Facundo Campazzo', team: 'Real Madrid', games: 31, avg: 6.9, total: 214 },
  { player: 'Marcelinho Huertas', team: 'Lenovo Tenerife', games: 32, avg: 6.4, total: 205 },
  { player: 'Nicolas Laprovittola', team: 'FC Barcelona', games: 30, avg: 5.7, total: 171 },
  { player: 'Trae Bell-Haynes', team: 'Casademont Zaragoza', games: 32, avg: 5.4, total: 173 },
  { player: 'Dani Pérez', team: 'FC Barcelona', games: 30, avg: 5.0, total: 150 },
  { player: 'Kendrick Perry', team: 'Unicaja', games: 31, avg: 4.7, total: 146 }
];

const RESULTS_2023_24 = [
  { round: 1, date: '2023-09-28', home: 'Real Madrid', away: 'Baskonia', homeScore: 94, awayScore: 80 },
  { round: 1, date: '2023-09-29', home: 'FC Barcelona', away: 'Valencia Basket', homeScore: 89, awayScore: 83 },
  { round: 1, date: '2023-09-30', home: 'Unicaja', away: 'Lenovo Tenerife', homeScore: 86, awayScore: 79 },
  { round: 1, date: '2023-09-30', home: 'Gran Canaria', away: 'Joventut Badalona', homeScore: 85, awayScore: 80 },
  { round: 8, date: '2023-11-18', home: 'Unicaja', away: 'Real Madrid', homeScore: 90, awayScore: 84 },
  { round: 8, date: '2023-11-19', home: 'FC Barcelona', away: 'Gran Canaria', homeScore: 92, awayScore: 78 },
  { round: 8, date: '2023-11-19', home: 'Valencia Basket', away: 'Baskonia', homeScore: 87, awayScore: 82 },
  { round: 17, date: '2024-01-21', home: 'Real Madrid', away: 'FC Barcelona', homeScore: 97, awayScore: 84 },
  { round: 17, date: '2024-01-21', home: 'Unicaja', away: 'Valencia Basket', homeScore: 88, awayScore: 79 },
  { round: 17, date: '2024-01-22', home: 'Baskonia', away: 'Lenovo Tenerife', homeScore: 93, awayScore: 87 },
  { round: 25, date: '2024-03-17', home: 'FC Barcelona', away: 'Unicaja', homeScore: 94, awayScore: 86 },
  { round: 25, date: '2024-03-17', home: 'Valencia Basket', away: 'Real Madrid', homeScore: 90, awayScore: 84 },
  { round: 25, date: '2024-03-18', home: 'Lenovo Tenerife', away: 'Gran Canaria', homeScore: 86, awayScore: 78 },
  { round: 34, date: '2024-05-19', home: 'Real Madrid', away: 'Unicaja', homeScore: 92, awayScore: 85 },
  { round: 34, date: '2024-05-19', home: 'FC Barcelona', away: 'Baskonia', homeScore: 97, awayScore: 87 },
  { round: 34, date: '2024-05-19', home: 'Valencia Basket', away: 'Gran Canaria', homeScore: 91, awayScore: 82 }
];

const buildBasketballSeason = ({
  season,
  standings,
  points,
  valuation,
  rebounds,
  assists,
  results,
  description,
  champion
}) => ({
  meta: {
    sport: 'baloncesto',
    sportLabel: 'Baloncesto',
    league: 'Liga ACB',
    season,
    country: 'España',
    provider: 'Base local IberiaStats · ACB',
    source: 'local',
    fallbackReason: null,
    updatedAt: '2024-06-30T20:00:00.000Z',
    description,
    champion,
    hasExternalProvider: false
  },
  standings: decorateStandings(standings),
  leaders: { points, valuation, rebounds, assists },
  scorers: points.map((entry) => ({
    player: entry.player,
    team: entry.team,
    goals: entry.avg,
    matches: entry.games,
    total: entry.total
  })),
  results
});

export const BASKETBALL_DATA = {
  '2022-2023': buildBasketballSeason({
    season: '2022-2023',
    standings: STANDINGS_2022_23,
    points: POINTS_2022_23,
    valuation: VALUATION_2022_23,
    rebounds: REBOUNDS_2022_23,
    assists: ASSISTS_2022_23,
    results: RESULTS_2022_23,
    champion: 'Barça',
    description:
      'El Barça conquistó el título tras barrer al Real Madrid en la final. Markus Howard fue el máximo anotador con 19,5 puntos por partido.'
  }),
  '2023-2024': buildBasketballSeason({
    season: '2023-2024',
    standings: STANDINGS_2023_24,
    points: POINTS_2023_24,
    valuation: VALUATION_2023_24,
    rebounds: REBOUNDS_2023_24,
    assists: ASSISTS_2023_24,
    results: RESULTS_2023_24,
    champion: 'Real Madrid',
    description:
      'El Real Madrid firmó una fase regular casi perfecta (30-4) y Unicaja cuajó la mejor temporada de su historia reciente. Edy Tavares lideró la valoración ACB.'
  })
};
