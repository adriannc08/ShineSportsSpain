import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOOTBALL_DATA } from '../data/football.js';
import { BASKETBALL_DATA } from '../data/basketball.js';
import { HANDBALL_DATA } from '../data/handball.js';
import { decorateStandings } from '../data/helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HISTORY_DIR = path.join(ROOT, 'data', 'history');
const FOOTBALL_START = 1993;
const FOOTBALL_END = 2025;
const ACB_START = 48;
const ACB_END = 90;
const ACB_API_BASE = 'https://api2.acb.com';
const ACB_API_KEY = '0dd94928-6f57-4c08-a3bd-b1b2f092976e';
const ACB_CHAMPIONS = {
  '1983-1984': 'Real Madrid',
  '1984-1985': 'Real Madrid',
  '1985-1986': 'Real Madrid',
  '1986-1987': 'FC Barcelona',
  '1987-1988': 'FC Barcelona',
  '1988-1989': 'FC Barcelona',
  '1989-1990': 'FC Barcelona',
  '1990-1991': 'FC Barcelona',
  '1991-1992': 'Joventut Badalona',
  '1992-1993': 'Real Madrid Teka'
};
const ASOBAL_SEASONS = ['2020-2021', '2021-2022', '2022-2023', '2023-2024', '2024-2025', '2025-2026'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchText = async (url, tries = 6) => {
  let lastError = null;

  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
        },
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < tries) await sleep(1200 * attempt);
    }
  }

  throw lastError ?? new Error(`No se pudo descargar ${url}`);
};

const fetchJson = async (url, tries = 6) => {
  let lastError = null;

  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-APIKEY': ACB_API_KEY
        },
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < tries) await sleep(1200 * attempt);
    }
  }

  throw lastError ?? new Error(`No se pudo descargar ${url}`);
};

const decodeEntities = (value) =>
  String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&uuml;/gi, 'ü')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Ntilde;/g, 'Ñ')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/\s+/g, ' ')
    .trim();

const STOP_WORDS = new Set([
  'fc', 'real', 'club', 'cb', 'bm', 'de', 'del', 'la', 'el', 'los', 'las',
  'baloncesto', 'basket', 'balonmano', 'basquet', 'bàsquet', 'sad', 'union', 'unión',
  'atletico', 'atlético', 'at', 'ud', 'sd', 'cd', 'rc', 'ca', 'cf'
]);

const makeShort = (name) => {
  const clean = String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const significant = clean.filter((word) => !STOP_WORDS.has(word.toLowerCase()));
  const source = significant.length ? significant : clean;
  const code = source.map((word) => word[0]).join('').toUpperCase();
  return code.length >= 2 ? code.slice(0, 3) : String(name).slice(0, 3).toUpperCase();
};

const FOOTBALL_TEAMS = {
  Alaves: ['Deportivo Alavés', 'ALA'],
  Albacete: ['Albacete Balompié', 'ALB'],
  Almeria: ['UD Almería', 'ALM'],
  'Ath Bilbao': ['Athletic Club', 'ATH'],
  'Ath Madrid': ['Atlético de Madrid', 'ATM'],
  Barcelona: ['FC Barcelona', 'BAR'],
  Betis: ['Real Betis', 'BET'],
  Cadiz: ['Cádiz CF', 'CAD'],
  Celta: ['Celta de Vigo', 'CEL'],
  Compostela: ['SD Compostela', 'COM'],
  Cordoba: ['Córdoba CF', 'COR'],
  Eibar: ['SD Eibar', 'EIB'],
  Elche: ['Elche CF', 'ELC'],
  Espanol: ['Espanyol', 'ESP'],
  Extremadura: ['CF Extremadura', 'EXT'],
  Getafe: ['Getafe CF', 'GET'],
  Gimnastic: ['Gimnàstic de Tarragona', 'GIM'],
  Girona: ['Girona FC', 'GIR'],
  Granada: ['Granada CF', 'GRA'],
  Hercules: ['Hércules CF', 'HER'],
  Huesca: ['SD Huesca', 'HUE'],
  'La Coruna': ['Deportivo de La Coruña', 'DEP'],
  'Las Palmas': ['UD Las Palmas', 'LPA'],
  Leganes: ['CD Leganés', 'LEG'],
  Lerida: ['UE Lleida', 'LLE'],
  Levante: ['Levante UD', 'LEV'],
  Logrones: ['CD Logroñés', 'LOG'],
  Malaga: ['Málaga CF', 'MAL'],
  Mallorca: ['RCD Mallorca', 'MLL'],
  Merida: ['CP Mérida', 'MER'],
  Murcia: ['Real Murcia', 'MUR'],
  Numancia: ['CD Numancia', 'NUM'],
  Osasuna: ['CA Osasuna', 'OSA'],
  Oviedo: ['Real Oviedo', 'OVI'],
  'Real Madrid': ['Real Madrid', 'RMA'],
  Recreativo: ['Recreativo de Huelva', 'REC'],
  Salamanca: ['UD Salamanca', 'SAL'],
  Santander: ['Racing de Santander', 'RAC'],
  Sevilla: ['Sevilla FC', 'SEV'],
  Sociedad: ['Real Sociedad', 'RSO'],
  'Sp Gijon': ['Sporting de Gijón', 'SPG'],
  Tenerife: ['CD Tenerife', 'TEN'],
  Valencia: ['Valencia CF', 'VAL'],
  Valladolid: ['Real Valladolid', 'VLL'],
  Vallecano: ['Rayo Vallecano', 'RAY'],
  Villareal: ['Villarreal CF', 'VIL'],
  Villarreal: ['Villarreal CF', 'VIL'],
  Xerez: ['Xerez CD', 'XER'],
  Zaragoza: ['Real Zaragoza', 'ZAR']
};

const mapFootballTeam = (name) => FOOTBALL_TEAMS[name] ?? [decodeEntities(name), makeShort(name)];

const parseCsvLine = (line) => {
  const cells = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === ',' && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  cells.push(current);
  return cells;
};

const parseFootballDate = (value) => {
  const parts = String(value ?? '').split('/');
  if (parts.length !== 3) return '';

  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const rawYear = Number(parts[2]);
  if (!day || !month || !rawYear) return '';

  const year = rawYear < 100 ? (rawYear >= 70 ? 1900 + rawYear : 2000 + rawYear) : rawYear;
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
};

const computeStandings = (matches, sport, shortMap = {}) => {
  const table = new Map();

  const ensure = (team) => {
    if (!table.has(team)) {
      table.set(team, {
        team,
        short: shortMap[team] ?? makeShort(team),
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
        form: []
      });
    }
    return table.get(team);
  };

  for (const match of matches) {
    const home = ensure(match.home);
    const away = ensure(match.away);
    const homeScore = Number(match.homeScore);
    const awayScore = Number(match.awayScore);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += homeScore;
    home.goalsAgainst += awayScore;
    away.goalsFor += awayScore;
    away.goalsAgainst += homeScore;

    if (homeScore > awayScore) {
      home.won += 1;
      away.lost += 1;
      home.form.push('W');
      away.form.push('L');
    } else if (homeScore < awayScore) {
      away.won += 1;
      home.lost += 1;
      away.form.push('W');
      home.form.push('L');
    } else if (sport !== 'baloncesto') {
      home.drawn += 1;
      away.drawn += 1;
      home.form.push('D');
      away.form.push('D');
    }
  }

  const rows = [...table.values()].map((row) => {
    const played = row.won + row.drawn + row.lost;
    const points = sport === 'futbol' ? row.won * 3 + row.drawn : sport === 'balonmano' ? row.won * 2 + row.drawn : row.won;

    return {
      ...row,
      played,
      points,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      pointsFor: row.goalsFor,
      pointsAgainst: row.goalsAgainst,
      diff: row.goalsFor - row.goalsAgainst,
      form: row.form.slice(-5)
    };
  });

  rows.sort((a, b) => {
    if (sport === 'baloncesto') {
      if (b.won !== a.won) return b.won - a.won;
      if (b.diff !== a.diff) return b.diff - a.diff;
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      return a.team.localeCompare(b.team, 'es');
    }

    if (b.points !== a.points) return b.points - a.points;
    if (b.diff !== a.diff) return b.diff - a.diff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.team.localeCompare(b.team, 'es');
  });

  return rows.map((row, index) => ({ pos: index + 1, ...row }));
};

const buildDataset = ({
  sport,
  sportLabel,
  league,
  season,
  provider,
  description,
  results,
  standings,
  regularRounds,
  totalRounds,
  champion,
  standingsSource = 'Calculada desde resultados',
  scorers = [],
  leaders = {},
  goalkeepers = [],
  teamStats = []
}) => ({
  meta: {
    sport,
    sportLabel,
    league,
    season,
    country: 'España',
    provider,
    source: 'archive',
    fallbackReason: null,
    fetchedAt: new Date().toISOString(),
    description,
    champion: champion ?? standings[0]?.team ?? null,
    standingsSource,
    hasExternalProvider: false,
    resultCount: results.length,
    teamCount: standings.length,
    regularRounds,
    totalRounds
  },
  standings: decorateStandings(standings),
  results,
  scorers,
  leaders,
  goalkeepers,
  teamStats
});

const inferRegularPrefix = (matches) => {
  const counts = new Map();
  for (const match of matches) {
    counts.set(match.round, (counts.get(match.round) ?? 0) + 1);
  }
  const maxMatches = Math.max(0, ...counts.values());
  let regularRounds = 0;
  for (const round of [...counts.keys()].sort((a, b) => a - b)) {
    if ((counts.get(round) ?? 0) < maxMatches) break;
    regularRounds = round;
  }
  return {
    regularRounds,
    regularMatches: matches.filter((match) => match.round <= regularRounds)
  };
};

const buildFormMap = (matches) => {
  const forms = new Map();
  const ensure = (team) => {
    if (!forms.has(team)) forms.set(team, []);
    return forms.get(team);
  };

  for (const match of matches) {
    const home = ensure(match.home);
    const away = ensure(match.away);
    if (match.homeScore > match.awayScore) {
      home.push('W');
      away.push('L');
    } else if (match.homeScore < match.awayScore) {
      home.push('L');
      away.push('W');
    } else {
      home.push('D');
      away.push('D');
    }
  }

  return Object.fromEntries([...forms].map(([team, form]) => [team, form.slice(-5)]));
};

const lastWinner = (matches) => {
  const last = [...matches].sort((a, b) => a.date.localeCompare(b.date) || a.round - b.round).at(-1);
  if (!last || last.homeScore === last.awayScore) return null;
  return last.homeScore > last.awayScore ? last.home : last.away;
};

const fetchAcbStandings = async (editionId) => {
  const url = `${ACB_API_BASE}/api/seasondata/Competition/standings?competitionId=1&editionId=${editionId}`;
  let data = await fetchJson(url);

  if (!data.standings?.length) {
    const rounds = [...(data.availableFilters?.rounds ?? [])].reverse();
    for (const round of rounds) {
      await sleep(120);
      data = await fetchJson(`${url}&roundId=${round.id}`);
      if (data.standings?.length) break;
    }
  }

  if (!data.standings?.length) return null;

  const teams = new Map((data.teams ?? []).map((team) => [team.id, team]));
  const rows = [...data.standings]
    .sort((a, b) => a.position - b.position)
    .map((row) => {
      const team = teams.get(row.teamId);
      const name = decodeEntities(team?.fullName || team?.shortName || `Equipo ${row.teamId}`);
      return {
        pos: row.position,
        position: row.position,
        team: name,
        short: team?.abbreviatedName || makeShort(name),
        played: row.matchesPlayed,
        won: row.wins,
        drawn: 0,
        lost: row.loses,
        pointsFor: row.pointsFor,
        pointsAgainst: row.pointsAgainst,
        goalsFor: row.pointsFor,
        goalsAgainst: row.pointsAgainst,
        points: row.wins,
        diff: row.plusMinus ?? row.pointsFor - row.pointsAgainst,
        winPct: row.winPercentage == null ? undefined : row.winPercentage / 100,
        logo: team?.logo ?? null,
        color: team?.primaryColorHex ?? null,
        form: []
      };
    });

  return {
    rows,
    regularRounds: data.totalRounds || null
  };
};

const parseFootballSeason = async (startYear) => {
  const code = `${String(startYear).slice(2)}${String(startYear + 1).slice(2)}`;
  const season = `${startYear}-${startYear + 1}`;
  const csv = await fetchText(`https://www.football-data.co.uk/mmz4281/${code}/SP1.csv`);
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const column = Object.fromEntries(header.map((name, index) => [name, index]));
  const matches = [];

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const homeGoals = cells[column.FTHG];
    const awayGoals = cells[column.FTAG];
    if (homeGoals === '' || awayGoals === '' || homeGoals == null || awayGoals == null) continue;

    const homeSource = cells[column.HomeTeam];
    const awaySource = cells[column.AwayTeam];
    if (!homeSource || !awaySource) continue;

    matches.push({
      date: parseFootballDate(cells[column.Date]),
      home: mapFootballTeam(homeSource)[0],
      away: mapFootballTeam(awaySource)[0],
      homeScore: Number(homeGoals),
      awayScore: Number(awayGoals)
    });
  }

  const teamCount = new Set(matches.flatMap((match) => [match.home, match.away])).size;
  const matchesPerRound = Math.max(1, Math.round(teamCount / 2));
  const sorted = matches.sort((a, b) => a.date.localeCompare(b.date) || a.home.localeCompare(b.home, 'es'));
  const results = sorted.map((match, index) => ({
    round: Math.floor(index / matchesPerRound) + 1,
    date: match.date,
    home: match.home,
    away: match.away,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    stage: 'regular'
  }));

  const shortMap = Object.fromEntries(
    Object.values(FOOTBALL_TEAMS).map(([name, short]) => [name, short])
  );

  const standings = computeStandings(results, 'futbol', shortMap);
  const regularRounds = Math.max(0, ...results.map((result) => result.round));
  const local = FOOTBALL_DATA[season];

  return buildDataset({
    sport: 'futbol',
    sportLabel: 'Fútbol',
    league: 'Liga EA Sports',
    season,
    provider: 'football-data.co.uk',
    description: local?.meta?.description ?? `Resultados completos de la Primera División española ${season}, con las 38 jornadas y la clasificación calculada a partir de todos los partidos.`,
    results,
    standings,
    regularRounds,
    totalRounds: regularRounds,
    scorers: local?.scorers ?? [],
    teamStats: local?.teamStats ?? []
  });
};

const fetchAcbMatches = async (editionId) => {
  const base = `${ACB_API_BASE}/api/seasondata/Competition/matches?competitionId=1&editionId=${editionId}`;
  const overview = await fetchJson(base);
  const rounds = overview.availableFilters?.rounds ?? [];
  const phases = new Map((overview.availableFilters?.phases ?? []).map((phase) => [phase.id, phase.description]));
  const teams = new Map();
  const rawMatches = [];
  let cursor = 0;

  const worker = async () => {
    while (cursor < rounds.length) {
      const round = rounds[cursor];
      cursor += 1;
      const payload = await fetchJson(`${base}&roundId=${round.id}`);

      for (const team of payload.teams ?? []) teams.set(team.id, team);
      for (const match of payload.matches ?? []) rawMatches.push({ round, match });

      await sleep(60);
    }
  };

  await Promise.all(Array.from({ length: 4 }, worker));

  const results = [];
  const seen = new Set();

  for (const { round, match } of rawMatches) {
    if (seen.has(match.id)) continue;
    if (match.matchStatus !== 'FINALIZED') continue;
    if (match.homeScore == null || match.awayScore == null) continue;

    const homeScore = Number(match.homeScore);
    const awayScore = Number(match.awayScore);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore) || homeScore + awayScore < 60) {
      continue;
    }

    const homeTeam = teams.get(match.homeTeamId) ?? match.serieData?.homeTeam;
    const awayTeam = teams.get(match.awayTeamId) ?? match.serieData?.awayTeam;
    if (!homeTeam || !awayTeam) continue;

    seen.add(match.id);
    const phaseId = match.serieData?.phaseId ?? null;
    results.push({
      id: Number(match.id),
      round: Number(round.roundNumber),
      date: match.startDateTime ? String(match.startDateTime).slice(0, 10) : '',
      home: decodeEntities(homeTeam.fullName || homeTeam.shortName),
      away: decodeEntities(awayTeam.fullName || awayTeam.shortName),
      homeScore,
      awayScore,
      stage: 'regular',
      phase: phaseId ? phases.get(phaseId) ?? null : null
    });
  }

  results.sort((a, b) => a.date.localeCompare(b.date) || a.round - b.round || a.home.localeCompare(b.home, 'es'));

  return { results, teams: [...teams.values()] };
};

const parseAcbSeason = async (editionId) => {
  const { results, teams } = await fetchAcbMatches(editionId);
  const inferred = inferRegularPrefix(results);
  const official = editionId >= 58 ? await fetchAcbStandings(editionId).catch(() => null) : null;
  const regularRounds = official?.regularRounds ?? inferred.regularRounds;

  for (const result of results) {
    result.stage = result.round <= regularRounds ? 'regular' : 'playoff';
    if (result.stage === 'regular') result.phase = 'Fase regular';
    else result.phase = result.phase ?? 'Fase final';
  }

  const shortMap = Object.fromEntries(
    teams.map((team) => {
      const name = decodeEntities(team.fullName || team.shortName);
      return [name, team.abbreviatedName || makeShort(name)];
    })
  );

  const teamMeta = new Map(
    teams.map((team) => {
      const name = decodeEntities(team.fullName || team.shortName);
      return [name, { logo: team.logo ?? null, color: team.primaryColorHex ?? null }];
    })
  );
  const formMap = buildFormMap(inferred.regularMatches);
  const standings = (official
    ? official.rows.map((row) => ({ ...row, form: formMap[row.team] ?? [] }))
    : computeStandings(inferred.regularMatches, 'baloncesto', shortMap)
  ).map((row) => ({
    ...row,
    logo: row.logo ?? teamMeta.get(row.team)?.logo ?? null,
    color: row.color ?? teamMeta.get(row.team)?.color ?? null
  }));
  const totalRounds = Math.max(0, ...results.map((result) => result.round));
  const startYear = editionId + 1935;
  const season = `${startYear}-${startYear + 1}`;
  const local = BASKETBALL_DATA[season];

  return buildDataset({
    sport: 'baloncesto',
    sportLabel: 'Baloncesto',
    league: 'Liga ACB',
    season,
    provider: 'ACB.com',
    description: local?.meta?.description ?? `Resultados completos de la Liga ACB ${season}: fase regular y playoffs, con la clasificación oficial de la fase regular.`,
    results,
    standings,
    regularRounds,
    totalRounds,
    champion: ACB_CHAMPIONS[season] ?? lastWinner(results) ?? local?.meta?.champion,
    standingsSource: official ? 'ACB.com API (clasificación oficial)' : 'Calculada desde resultados (fase regular)',
    leaders: local?.leaders ?? {},
    scorers: local?.scorers ?? []
  });
};

const parseAsobalPage = (html, round) => {
  const matches = [];
  const starts = [...html.matchAll(/<li class="list-resultado">/g)].map((match) => match.index);

  starts.forEach((start, index) => {
    const block = html.slice(start, starts[index + 1] ?? html.length);
    const homeMatch = block.match(/class="equipo-local"[\s\S]*?<span itemprop="name" class="nombre-equipo">([\s\S]*?)<\/span>/);
    const awayMatch = block.match(/class="equipo-visitante"[\s\S]*?<span itemprop="name" class="nombre-equipo">([\s\S]*?)<\/span>/);
    const scoreMatch = block.match(/<span class="resultado">\s*(\d+)\s*-\s*(\d+)/);
    const dateMatch = block.match(/<time itemprop="startDate" content="([^"]+)"/);
    if (!homeMatch || !awayMatch || !scoreMatch) return;

    matches.push({
      round,
      date: dateMatch ? dateMatch[1].slice(0, 10) : '',
      home: decodeEntities(homeMatch[1]),
      away: decodeEntities(awayMatch[1]),
      homeScore: Number(scoreMatch[1]),
      awayScore: Number(scoreMatch[2]),
      stage: 'regular'
    });
  });

  return matches;
};

const parseAsobalSeason = async (season) => {
  const [startYear, endYear] = season.split('-');
  const slug = `${startYear}_${endYear}`;
  const baseUrl = `https://as.com/resultados/balonmano/asobal/${slug}/jornada/regular_a_`;
  const firstHtml = await fetchText(`${baseUrl}1/`);
  const jornadaNumbers = new Set([1]);

  for (const match of firstHtml.matchAll(/\/jornada\/regular_a_(\d+)\//g)) {
    jornadaNumbers.add(Number(match[1]));
  }

  const maxJornada = Math.max(1, ...jornadaNumbers);
  const pages = new Map([[1, firstHtml]]);

  for (let jornada = 2; jornada <= maxJornada; jornada += 1) {
    await sleep(450);
    pages.set(jornada, await fetchText(`${baseUrl}${jornada}/`));
  }

  const results = [];
  for (const [jornada, html] of pages) {
    results.push(...parseAsobalPage(html, jornada));
  }

  results.sort((a, b) => a.date.localeCompare(b.date) || a.round - b.round || a.home.localeCompare(b.home, 'es'));

  const shortMap = Object.fromEntries(
    [...new Set(results.flatMap((result) => [result.home, result.away]))].map((team) => [team, makeShort(team)])
  );

  const standings = computeStandings(results, 'balonmano', shortMap);
  const regularRounds = Math.max(0, ...results.map((result) => result.round));
  const local = HANDBALL_DATA[season];

  return buildDataset({
    sport: 'balonmano',
    sportLabel: 'Balonmano',
    league: 'Liga ASOBAL',
    season,
    provider: 'AS.com',
    description: local?.meta?.description ?? `Resultados completos de la Liga ASOBAL ${season}, con las ${regularRounds} jornadas de la fase regular y la clasificación calculada a partir de todos los partidos.`,
    results,
    standings,
    regularRounds,
    totalRounds: regularRounds,
    scorers: local?.scorers ?? [],
    goalkeepers: local?.goalkeepers ?? []
  });
};

const writeDataset = async (sport, season, dataset) => {
  const directory = path.join(HISTORY_DIR, sport);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, `${season}.json`), JSON.stringify(dataset));
  return {
    season,
    champion: dataset.meta.champion,
    teamCount: dataset.meta.teamCount,
    resultCount: dataset.meta.resultCount,
    regularRounds: dataset.meta.regularRounds
  };
};

const writeCatalogs = async (catalog) => {
  const seasonsBySport = Object.fromEntries(
    Object.entries(catalog).map(([sport, rows]) => [
      sport,
      rows.map((row) => row.season).sort().reverse()
    ])
  );
  const allSeasons = [...new Set(Object.values(seasonsBySport).flat())].sort().reverse();

  await fs.writeFile(
    path.join(ROOT, 'data', 'seasons.js'),
    `export const SEASONS_BY_SPORT = ${JSON.stringify(seasonsBySport, null, 2)};\n\nexport const ALL_SEASONS = ${JSON.stringify(allSeasons, null, 2)};\n`
  );

  await fs.writeFile(
    path.join(HISTORY_DIR, 'catalog.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), seasonsBySport, catalog }, null, 2)
  );
};

const main = async () => {
  await fs.mkdir(HISTORY_DIR, { recursive: true });
  const catalog = { futbol: [], baloncesto: [], balonmano: [] };
  const only = process.argv[2] ?? 'all';
  const runFootball = only === 'all' || only === 'futbol';
  const runBasketball = only === 'all' || only === 'baloncesto';
  const runHandball = only === 'all' || only === 'balonmano';
  const existingCatalog = JSON.parse(await fs.readFile(path.join(HISTORY_DIR, 'catalog.json'), 'utf8').catch(() => 'null'));

  if (existingCatalog?.catalog) {
    for (const sport of Object.keys(catalog)) {
      if (!((sport === 'futbol' && runFootball) || (sport === 'baloncesto' && runBasketball) || (sport === 'balonmano' && runHandball))) {
        catalog[sport] = existingCatalog.catalog[sport] ?? [];
      }
    }
  }

  for (let year = FOOTBALL_START; runFootball && year <= FOOTBALL_END; year += 1) {
    const season = `${year}-${year + 1}`;
    try {
      const dataset = await parseFootballSeason(year);
      catalog.futbol.push(await writeDataset('futbol', season, dataset));
      console.log(`futbol ${season}: ${dataset.meta.resultCount} partidos`);
    } catch (error) {
      console.error(`futbol ${season}: ${error.message}`);
    }
  }

  for (let editionId = ACB_START; runBasketball && editionId <= ACB_END; editionId += 1) {
    const startYear = editionId + 1935;
    const season = `${startYear}-${startYear + 1}`;
    try {
      const dataset = await parseAcbSeason(editionId);
      catalog.baloncesto.push(await writeDataset('baloncesto', season, dataset));
      console.log(`baloncesto ${season}: ${dataset.meta.resultCount} partidos`);
    } catch (error) {
      console.error(`baloncesto ${season}: ${error.message}`);
    }
    await sleep(120);
  }

  for (const season of ASOBAL_SEASONS.filter(() => runHandball)) {
    try {
      const dataset = await parseAsobalSeason(season);
      catalog.balonmano.push(await writeDataset('balonmano', season, dataset));
      console.log(`balonmano ${season}: ${dataset.meta.resultCount} partidos`);
    } catch (error) {
      console.error(`balonmano ${season}: ${error.message}`);
    }
  }

  await writeCatalogs(catalog);
  console.log('Catálogos actualizados en data/seasons.js y data/history/catalog.json');
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
