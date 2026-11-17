/**
 * data/football.js
 * Dataset local de respaldo para la Liga EA Sports (Primera División).
 * Temporadas 2022-2023 y 2023-2024.
 *
 * Las cifras de clasificación y goleadores siguen las temporadas reales.
 * Los resultados incluidos son una muestra representativa de jornadas y las
 * métricas de equipo (posesión, tiros, tarjetas) son estimaciones
 * contrastadas para que la demo sea coherente y verificable.
 */

import { buildFootballTeamStats, decorateStandings } from './helpers.js';

const FOOTBALL_STYLES = {
  'FC Barcelona': { possession: 64.8, shots: 17.4, corners: 6.1, yellow: 68, red: 2, xg: 2.05 },
  'Real Madrid': { possession: 58.9, shots: 16.8, corners: 5.8, yellow: 74, red: 4, xg: 1.88 },
  'Atlético Madrid': { possession: 55.1, shots: 14.2, corners: 5.1, yellow: 96, red: 5, xg: 1.55 },
  'Real Sociedad': { possession: 57.8, shots: 14.5, corners: 5.4, yellow: 79, red: 3, xg: 1.46 },
  Villarreal: { possession: 55.6, shots: 14.9, corners: 5.3, yellow: 81, red: 2, xg: 1.52 },
  'Real Betis': { possession: 54.2, shots: 13.8, corners: 5.0, yellow: 88, red: 4, xg: 1.38 },
  Osasuna: { possession: 46.5, shots: 11.2, corners: 4.2, yellow: 92, red: 3, xg: 1.16 },
  'Athletic Club': { possession: 51.3, shots: 13.1, corners: 4.8, yellow: 84, red: 2, xg: 1.34 },
  Mallorca: { possession: 43.8, shots: 11.5, corners: 4.4, yellow: 86, red: 3, xg: 1.12 },
  Girona: { possession: 49.5, shots: 14.0, corners: 5.2, yellow: 76, red: 2, xg: 1.57 },
  'Rayo Vallecano': { possession: 48.7, shots: 12.0, corners: 4.6, yellow: 90, red: 4, xg: 1.21 },
  Sevilla: { possession: 52.6, shots: 13.0, corners: 4.9, yellow: 91, red: 5, xg: 1.29 },
  'Celta Vigo': { possession: 51.4, shots: 12.9, corners: 4.8, yellow: 82, red: 3, xg: 1.27 },
  Valencia: { possession: 48.0, shots: 12.2, corners: 4.5, yellow: 94, red: 4, xg: 1.22 },
  Getafe: { possession: 42.3, shots: 10.4, corners: 3.8, yellow: 104, red: 6, xg: 0.99 },
  Almería: { possession: 44.1, shots: 12.0, corners: 4.3, yellow: 87, red: 3, xg: 1.20 },
  Cádiz: { possession: 43.2, shots: 9.8, corners: 3.7, yellow: 98, red: 5, xg: 0.94 },
  Valladolid: { possession: 46.9, shots: 10.1, corners: 3.9, yellow: 95, red: 5, xg: 0.96 },
  Espanyol: { possession: 48.5, shots: 11.3, corners: 4.2, yellow: 93, red: 4, xg: 1.18 },
  Elche: { possession: 46.0, shots: 9.7, corners: 3.8, yellow: 89, red: 4, xg: 0.91 },
  Alavés: { possession: 44.8, shots: 10.2, corners: 3.9, yellow: 96, red: 4, xg: 0.98 },
  'Las Palmas': { possession: 52.3, shots: 11.8, corners: 4.5, yellow: 78, red: 2, xg: 1.09 },
  Granada: { possession: 43.9, shots: 10.3, corners: 4.0, yellow: 97, red: 5, xg: 1.01 }
};

const STANDINGS_2022_23 = [
  { pos: 1, team: 'FC Barcelona', short: 'BAR', played: 38, won: 28, drawn: 4, lost: 6, goalsFor: 70, goalsAgainst: 20, points: 88 },
  { pos: 2, team: 'Real Madrid', short: 'RMA', played: 38, won: 24, drawn: 6, lost: 8, goalsFor: 75, goalsAgainst: 36, points: 78 },
  { pos: 3, team: 'Atlético Madrid', short: 'ATM', played: 38, won: 23, drawn: 8, lost: 7, goalsFor: 70, goalsAgainst: 33, points: 77 },
  { pos: 4, team: 'Real Sociedad', short: 'RSO', played: 38, won: 21, drawn: 8, lost: 9, goalsFor: 51, goalsAgainst: 35, points: 71 },
  { pos: 5, team: 'Villarreal', short: 'VIL', played: 38, won: 19, drawn: 7, lost: 12, goalsFor: 59, goalsAgainst: 40, points: 64 },
  { pos: 6, team: 'Real Betis', short: 'BET', played: 38, won: 17, drawn: 9, lost: 12, goalsFor: 46, goalsAgainst: 41, points: 60 },
  { pos: 7, team: 'Osasuna', short: 'OSA', played: 38, won: 15, drawn: 8, lost: 15, goalsFor: 37, goalsAgainst: 42, points: 53 },
  { pos: 8, team: 'Athletic Club', short: 'ATH', played: 38, won: 14, drawn: 9, lost: 15, goalsFor: 47, goalsAgainst: 43, points: 51 },
  { pos: 9, team: 'Mallorca', short: 'MLL', played: 38, won: 14, drawn: 8, lost: 16, goalsFor: 37, goalsAgainst: 43, points: 50 },
  { pos: 10, team: 'Girona', short: 'GIR', played: 38, won: 13, drawn: 10, lost: 15, goalsFor: 58, goalsAgainst: 55, points: 49 },
  { pos: 11, team: 'Rayo Vallecano', short: 'RAY', played: 38, won: 13, drawn: 10, lost: 15, goalsFor: 45, goalsAgainst: 53, points: 49 },
  { pos: 12, team: 'Sevilla', short: 'SEV', played: 38, won: 13, drawn: 10, lost: 15, goalsFor: 47, goalsAgainst: 54, points: 49 },
  { pos: 13, team: 'Celta Vigo', short: 'CEL', played: 38, won: 11, drawn: 10, lost: 17, goalsFor: 43, goalsAgainst: 53, points: 43 },
  { pos: 14, team: 'Valencia', short: 'VAL', played: 38, won: 11, drawn: 9, lost: 18, goalsFor: 42, goalsAgainst: 45, points: 42 },
  { pos: 15, team: 'Getafe', short: 'GET', played: 38, won: 10, drawn: 12, lost: 16, goalsFor: 34, goalsAgainst: 45, points: 42 },
  { pos: 16, team: 'Almería', short: 'ALM', played: 38, won: 11, drawn: 8, lost: 19, goalsFor: 49, goalsAgainst: 62, points: 41 },
  { pos: 17, team: 'Cádiz', short: 'CAD', played: 38, won: 10, drawn: 11, lost: 17, goalsFor: 33, goalsAgainst: 56, points: 41 },
  { pos: 18, team: 'Valladolid', short: 'VLL', played: 38, won: 11, drawn: 7, lost: 20, goalsFor: 33, goalsAgainst: 63, points: 40 },
  { pos: 19, team: 'Espanyol', short: 'ESP', played: 38, won: 8, drawn: 13, lost: 17, goalsFor: 46, goalsAgainst: 58, points: 37 },
  { pos: 20, team: 'Elche', short: 'ELC', played: 38, won: 5, drawn: 10, lost: 23, goalsFor: 30, goalsAgainst: 67, points: 25 }
];

const STANDINGS_2023_24 = [
  { pos: 1, team: 'Real Madrid', short: 'RMA', played: 38, won: 29, drawn: 8, lost: 1, goalsFor: 87, goalsAgainst: 26, points: 95 },
  { pos: 2, team: 'FC Barcelona', short: 'BAR', played: 38, won: 26, drawn: 7, lost: 5, goalsFor: 79, goalsAgainst: 44, points: 85 },
  { pos: 3, team: 'Girona', short: 'GIR', played: 38, won: 25, drawn: 6, lost: 7, goalsFor: 85, goalsAgainst: 46, points: 81 },
  { pos: 4, team: 'Atlético Madrid', short: 'ATM', played: 38, won: 23, drawn: 4, lost: 11, goalsFor: 70, goalsAgainst: 43, points: 76 },
  { pos: 5, team: 'Athletic Club', short: 'ATH', played: 38, won: 19, drawn: 11, lost: 8, goalsFor: 61, goalsAgainst: 37, points: 68 },
  { pos: 6, team: 'Real Sociedad', short: 'RSO', played: 38, won: 16, drawn: 12, lost: 10, goalsFor: 51, goalsAgainst: 39, points: 60 },
  { pos: 7, team: 'Real Betis', short: 'BET', played: 38, won: 14, drawn: 15, lost: 9, goalsFor: 48, goalsAgainst: 45, points: 57 },
  { pos: 8, team: 'Villarreal', short: 'VIL', played: 38, won: 14, drawn: 11, lost: 13, goalsFor: 65, goalsAgainst: 65, points: 53 },
  { pos: 9, team: 'Valencia', short: 'VAL', played: 38, won: 13, drawn: 10, lost: 15, goalsFor: 44, goalsAgainst: 50, points: 49 },
  { pos: 10, team: 'Alavés', short: 'ALA', played: 38, won: 12, drawn: 10, lost: 16, goalsFor: 36, goalsAgainst: 46, points: 46 },
  { pos: 11, team: 'Osasuna', short: 'OSA', played: 38, won: 12, drawn: 9, lost: 17, goalsFor: 37, goalsAgainst: 54, points: 45 },
  { pos: 12, team: 'Getafe', short: 'GET', played: 38, won: 10, drawn: 13, lost: 15, goalsFor: 42, goalsAgainst: 54, points: 43 },
  { pos: 13, team: 'Sevilla', short: 'SEV', played: 38, won: 10, drawn: 11, lost: 17, goalsFor: 42, goalsAgainst: 54, points: 41 },
  { pos: 14, team: 'Celta Vigo', short: 'CEL', played: 38, won: 10, drawn: 11, lost: 17, goalsFor: 41, goalsAgainst: 53, points: 41 },
  { pos: 15, team: 'Mallorca', short: 'MLL', played: 38, won: 8, drawn: 16, lost: 14, goalsFor: 33, goalsAgainst: 44, points: 40 },
  { pos: 16, team: 'Las Palmas', short: 'LPA', played: 38, won: 10, drawn: 10, lost: 18, goalsFor: 33, goalsAgainst: 47, points: 40 },
  { pos: 17, team: 'Rayo Vallecano', short: 'RAY', played: 38, won: 8, drawn: 14, lost: 16, goalsFor: 29, goalsAgainst: 48, points: 38 },
  { pos: 18, team: 'Cádiz', short: 'CAD', played: 38, won: 6, drawn: 15, lost: 17, goalsFor: 26, goalsAgainst: 55, points: 33 },
  { pos: 19, team: 'Granada', short: 'GRA', played: 38, won: 4, drawn: 9, lost: 25, goalsFor: 38, goalsAgainst: 79, points: 21 },
  { pos: 20, team: 'Almería', short: 'ALM', played: 38, won: 1, drawn: 8, lost: 29, goalsFor: 33, goalsAgainst: 79, points: 11 }
];

const RESULTS_2022_23 = [
  { round: 1, date: '2022-08-12', home: 'Osasuna', away: 'Sevilla', homeScore: 2, awayScore: 1 },
  { round: 1, date: '2022-08-13', home: 'FC Barcelona', away: 'Rayo Vallecano', homeScore: 0, awayScore: 0 },
  { round: 1, date: '2022-08-13', home: 'Real Betis', away: 'Elche', homeScore: 3, awayScore: 0 },
  { round: 1, date: '2022-08-14', home: 'Real Madrid', away: 'Almería', homeScore: 2, awayScore: 1 },
  { round: 1, date: '2022-08-14', home: 'Valencia', away: 'Girona', homeScore: 1, awayScore: 0 },
  { round: 1, date: '2022-08-15', home: 'Athletic Club', away: 'Mallorca', homeScore: 0, awayScore: 0 },
  { round: 6, date: '2022-09-17', home: 'Real Madrid', away: 'Mallorca', homeScore: 4, awayScore: 1 },
  { round: 6, date: '2022-09-17', home: 'FC Barcelona', away: 'Elche', homeScore: 3, awayScore: 0 },
  { round: 6, date: '2022-09-18', home: 'Atlético Madrid', away: 'Real Madrid', homeScore: 1, awayScore: 2 },
  { round: 12, date: '2022-10-29', home: 'Real Madrid', away: 'Sevilla', homeScore: 3, awayScore: 1 },
  { round: 12, date: '2022-10-29', home: 'FC Barcelona', away: 'Almería', homeScore: 2, awayScore: 0 },
  { round: 12, date: '2022-10-30', home: 'Atlético Madrid', away: 'Rayo Vallecano', homeScore: 1, awayScore: 1 },
  { round: 20, date: '2023-02-04', home: 'FC Barcelona', away: 'Getafe', homeScore: 1, awayScore: 0 },
  { round: 20, date: '2023-02-05', home: 'Real Madrid', away: 'Real Sociedad', homeScore: 0, awayScore: 0 },
  { round: 20, date: '2023-02-05', home: 'Atlético Madrid', away: 'Valladolid', homeScore: 3, awayScore: 0 },
  { round: 28, date: '2023-04-08', home: 'FC Barcelona', away: 'Real Madrid', homeScore: 2, awayScore: 1 },
  { round: 28, date: '2023-04-09', home: 'Atlético Madrid', away: 'Real Betis', homeScore: 1, awayScore: 0 },
  { round: 28, date: '2023-04-10', home: 'Girona', away: 'Rayo Vallecano', homeScore: 2, awayScore: 2 },
  { round: 34, date: '2023-05-14', home: 'Real Sociedad', away: 'Girona', homeScore: 2, awayScore: 2 },
  { round: 34, date: '2023-05-14', home: 'Villarreal', away: 'Celta Vigo', homeScore: 3, awayScore: 1 },
  { round: 34, date: '2023-05-14', home: 'Osasuna', away: 'Athletic Club', homeScore: 1, awayScore: 0 },
  { round: 38, date: '2023-06-04', home: 'Celta Vigo', away: 'FC Barcelona', homeScore: 2, awayScore: 1 },
  { round: 38, date: '2023-06-04', home: 'Real Madrid', away: 'Athletic Club', homeScore: 1, awayScore: 1 },
  { round: 38, date: '2023-06-04', home: 'Atlético Madrid', away: 'Villarreal', homeScore: 2, awayScore: 2 },
  { round: 38, date: '2023-06-04', home: 'Valladolid', away: 'Getafe', homeScore: 0, awayScore: 0 },
  { round: 38, date: '2023-06-04', home: 'Espanyol', away: 'Almería', homeScore: 3, awayScore: 3 }
];

const RESULTS_2023_24 = [
  { round: 1, date: '2023-08-11', home: 'Almería', away: 'Rayo Vallecano', homeScore: 0, awayScore: 2 },
  { round: 1, date: '2023-08-12', home: 'Athletic Club', away: 'Real Madrid', homeScore: 0, awayScore: 2 },
  { round: 1, date: '2023-08-13', home: 'FC Barcelona', away: 'Cádiz', homeScore: 2, awayScore: 0 },
  { round: 1, date: '2023-08-14', home: 'Atlético Madrid', away: 'Granada', homeScore: 3, awayScore: 1 },
  { round: 1, date: '2023-08-14', home: 'Girona', away: 'Real Sociedad', homeScore: 1, awayScore: 1 },
  { round: 1, date: '2023-08-15', home: 'Real Betis', away: 'Villarreal', homeScore: 1, awayScore: 2 },
  { round: 10, date: '2023-10-28', home: 'FC Barcelona', away: 'Real Madrid', homeScore: 1, awayScore: 2 },
  { round: 10, date: '2023-10-28', home: 'Girona', away: 'Celta Vigo', homeScore: 3, awayScore: 2 },
  { round: 10, date: '2023-10-29', home: 'Atlético Madrid', away: 'Alavés', homeScore: 2, awayScore: 1 },
  { round: 20, date: '2024-01-21', home: 'Girona', away: 'Atlético Madrid', homeScore: 4, awayScore: 3 },
  { round: 20, date: '2024-01-21', home: 'Real Madrid', away: 'Almería', homeScore: 3, awayScore: 2 },
  { round: 20, date: '2024-01-21', home: 'FC Barcelona', away: 'Las Palmas', homeScore: 2, awayScore: 1 },
  { round: 28, date: '2024-03-10', home: 'Real Madrid', away: 'Girona', homeScore: 4, awayScore: 0 },
  { round: 28, date: '2024-03-10', home: 'FC Barcelona', away: 'Athletic Club', homeScore: 0, awayScore: 0 },
  { round: 28, date: '2024-03-10', home: 'Atlético Madrid', away: 'Real Betis', homeScore: 2, awayScore: 1 },
  { round: 33, date: '2024-04-28', home: 'FC Barcelona', away: 'Valencia', homeScore: 4, awayScore: 2 },
  { round: 33, date: '2024-04-28', home: 'Girona', away: 'Cádiz', homeScore: 4, awayScore: 1 },
  { round: 33, date: '2024-04-28', home: 'Real Madrid', away: 'Real Sociedad', homeScore: 1, awayScore: 0 },
  { round: 38, date: '2024-05-25', home: 'Real Madrid', away: 'Real Betis', homeScore: 0, awayScore: 0 },
  { round: 38, date: '2024-05-25', home: 'FC Barcelona', away: 'Sevilla', homeScore: 2, awayScore: 1 },
  { round: 38, date: '2024-05-25', home: 'Girona', away: 'Granada', homeScore: 7, awayScore: 0 },
  { round: 38, date: '2024-05-25', home: 'Atlético Madrid', away: 'Osasuna', homeScore: 2, awayScore: 0 },
  { round: 38, date: '2024-05-25', home: 'Athletic Club', away: 'Rayo Vallecano', homeScore: 1, awayScore: 0 }
];

const SCORERS_2022_23 = [
  { player: 'Robert Lewandowski', team: 'FC Barcelona', goals: 23, assists: 6, penalties: 3, matches: 34 },
  { player: 'Karim Benzema', team: 'Real Madrid', goals: 19, assists: 3, penalties: 4, matches: 24 },
  { player: 'Joselu Mato', team: 'Espanyol', goals: 16, assists: 2, penalties: 3, matches: 34 },
  { player: 'Antoine Griezmann', team: 'Atlético Madrid', goals: 15, assists: 8, penalties: 0, matches: 38 },
  { player: 'Vedat Muriqi', team: 'Mallorca', goals: 15, assists: 3, penalties: 5, matches: 35 },
  { player: 'Enes Ünal', team: 'Getafe', goals: 14, assists: 1, penalties: 3, matches: 35 },
  { player: 'Borja Iglesias', team: 'Real Betis', goals: 13, assists: 4, penalties: 2, matches: 32 },
  { player: 'Iago Aspas', team: 'Celta Vigo', goals: 12, assists: 5, penalties: 2, matches: 33 },
  { player: 'Alexander Sørloth', team: 'Real Sociedad', goals: 12, assists: 3, penalties: 0, matches: 34 },
  { player: 'Vinícius Júnior', team: 'Real Madrid', goals: 10, assists: 9, penalties: 0, matches: 33 }
];

const SCORERS_2023_24 = [
  { player: 'Artem Dovbyk', team: 'Girona', goals: 24, assists: 8, penalties: 5, matches: 36 },
  { player: 'Alexander Sørloth', team: 'Villarreal', goals: 23, assists: 6, penalties: 0, matches: 34 },
  { player: 'Jude Bellingham', team: 'Real Madrid', goals: 19, assists: 6, penalties: 1, matches: 28 },
  { player: 'Robert Lewandowski', team: 'FC Barcelona', goals: 19, assists: 9, penalties: 2, matches: 35 },
  { player: 'Ante Budimir', team: 'Osasuna', goals: 17, assists: 2, penalties: 5, matches: 35 },
  { player: 'Antoine Griezmann', team: 'Atlético Madrid', goals: 16, assists: 6, penalties: 0, matches: 33 },
  { player: 'Vinícius Júnior', team: 'Real Madrid', goals: 15, assists: 6, penalties: 1, matches: 26 },
  { player: 'Álvaro Morata', team: 'Atlético Madrid', goals: 14, assists: 3, penalties: 0, matches: 32 },
  { player: 'Hugo Duro', team: 'Valencia', goals: 13, assists: 2, penalties: 0, matches: 34 },
  { player: 'Rodrygo Goes', team: 'Real Madrid', goals: 10, assists: 5, penalties: 0, matches: 34 }
];

const buildFootballSeason = ({ season, standings, results, scorers, description, champion }) => {
  const decorated = decorateStandings(standings);
  return {
    meta: {
      sport: 'futbol',
      sportLabel: 'Fútbol',
      league: 'Liga EA Sports',
      season,
      country: 'España',
      provider: 'Base local IberiaStats',
      source: 'local',
      fallbackReason: null,
      updatedAt: '2024-06-30T20:00:00.000Z',
      description,
      champion,
      hasExternalProvider: true
    },
    standings: decorated,
    results,
    scorers,
    teamStats: buildFootballTeamStats(decorated, FOOTBALL_STYLES)
  };
};

export const FOOTBALL_DATA = {
  '2022-2023': buildFootballSeason({
    season: '2022-2023',
    standings: STANDINGS_2022_23,
    results: RESULTS_2022_23,
    scorers: SCORERS_2022_23,
    champion: 'FC Barcelona',
    description:
      'El FC Barcelona de Xavi se proclamó campeón con 88 puntos, diez más que el Real Madrid. Lewandowski firmó 23 goles y el equipo azulgrana encajó solo 20 tantos.'
  }),
  '2023-2024': buildFootballSeason({
    season: '2023-2024',
    standings: STANDINGS_2023_24,
    results: RESULTS_2023_24,
    scorers: SCORERS_2023_24,
    champion: 'Real Madrid',
    description:
      'El Real Madrid dominó con 95 puntos y una sola derrota. El Girona firmó la gran sorpresa de la temporada y Dovbyk se llevó el Pichichi con 24 goles.'
  })
};
