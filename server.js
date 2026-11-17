/**
 * server.js
 * ---------------------------------------------------------------------------
 * Backend opcional (Node.js + Express) de IberiaStats.
 *
 *  - Sirve el frontend estático.
 *  - Expone GET /api/stats/:sport/:season con un contrato JSON normalizado.
 *  - Fútbol: consulta Football-Data.org usando FOOTBALL_DATA_API_KEY.
 *  - Baloncesto / balonmano: acepta un endpoint externo opcional (ACB_API_URL
 *    o ASOBAL_API_URL) que devuelva el mismo contrato normalizado.
 *  - Si no hay credenciales, el proveedor falla o devuelve un esquema inválido,
 *    responde con el dataset local de respaldo (nunca deja la app sin datos).
 *
 * Arranque:
 *   npm install
 *   cp .env.example .env
 *   npm start
 * ---------------------------------------------------------------------------
 */

import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCAL_DB, SPORTS } from './api_connector.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_DIR = path.join(__dirname, 'data', 'history');
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const CACHE_TTL_MS = Math.max(1, Number(process.env.CACHE_TTL_MINUTES) || 15) * 60 * 1000;
const REQUEST_TIMEOUT_MS = Math.max(1000, Number(process.env.UPSTREAM_TIMEOUT_MS) || 9000);

const FOOTBALL_BASE_URL = process.env.FOOTBALL_DATA_BASE_URL || 'https://api.football-data.org/v4';
const FOOTBALL_COMPETITION = process.env.FOOTBALL_DATA_COMPETITION || 'PD';

const ACB_API_BASE_URL = process.env.ACB_API_BASE_URL || 'https://api2.acb.com';
const ACB_API_KEY =
  process.env.ACB_API_KEY || '0dd94928-6f57-4c08-a3bd-b1b2f092976e';

const memoryCache = new Map();
const matchDetailCache = new Map();

const isDisplayableDataset = (dataset) =>
  Array.isArray(dataset?.standings) &&
  dataset.standings.length > 0 &&
  Array.isArray(dataset?.results) &&
  dataset.results.length > 0;

const buildAvailableSeasons = async () => {
  const coverage = Object.fromEntries(Object.keys(SPORTS).map((sport) => [sport, new Set()]));

  for (const sport of Object.keys(coverage)) {
    let files = [];
    try {
      files = await fs.readdir(path.join(HISTORY_DIR, sport));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const dataset = JSON.parse(await fs.readFile(path.join(HISTORY_DIR, sport, file), 'utf8'));
        if (isDisplayableDataset(dataset)) coverage[sport].add(file.slice(0, -5));
      } catch (error) {
        console.warn(`[IberiaStats] Archivo omitido ${sport}/${file}: ${error.message}`);
      }
    }
  }

  for (const [key, dataset] of Object.entries(LOCAL_DB)) {
    const [sport, season] = key.split(':');
    if (coverage[sport] && isDisplayableDataset(dataset)) coverage[sport].add(season);
  }

  return Object.fromEntries(
    Object.entries(coverage).map(([sport, seasons]) => [sport, [...seasons].sort().reverse()])
  );
};

const AVAILABLE_SEASONS_BY_SPORT = await buildAvailableSeasons();
const AVAILABLE_SEASONS = [...new Set(Object.values(AVAILABLE_SEASONS_BY_SPORT).flat())].sort().reverse();

/* ========================================================================== */
/* 1. Utilidades HTTP                                                         */
/* ========================================================================== */

const clone = (value) => structuredClone(value);

const fetchJson = async (url, headers = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'IberiaStats/1.0',
        ...headers
      },
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const suffix = detail ? ` · ${detail.slice(0, 160)}` : '';
      throw new Error(`Upstream HTTP ${response.status}${suffix}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const readArchiveDataset = async (sport, season) => {
  const file = path.join(HISTORY_DIR, sport, `${season}.json`);

  try {
    const raw = await fs.readFile(file, 'utf8');
    const dataset = JSON.parse(raw);
    if (!isDisplayableDataset(dataset)) return null;
    return dataset;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};

const localDataset = (sport, season, fallbackReason = null) => {
  const source = LOCAL_DB[`${sport}:${season}`];
  if (!source) return null;

  const dataset = clone(source);
  dataset.meta = {
    ...dataset.meta,
    source: 'local',
    provider: dataset.meta.provider || 'Base local IberiaStats',
    fallbackReason,
    fetchedAt: new Date().toISOString()
  };
  return dataset;
};

const seasonStartYear = (season) => {
  const year = Number(String(season).slice(0, 4));
  if (!Number.isFinite(year)) throw new Error(`Temporada inválida: ${season}`);
  return year;
};

const roundStat = (value, digits = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(digits));
};

const shotPercentage = (made, attempted) => {
  const attempts = Number(attempted) || 0;
  return attempts ? roundStat((Number(made) || 0) / attempts * 100, 1) : 0;
};

const acbTotal = (teamBox) => {
  const periods = Array.isArray(teamBox?.statsByPeriods) ? teamBox.statsByPeriods : [];
  return periods.find((period) => Number(period.quarter) === 0)?.stats ?? periods[0]?.stats ?? {};
};

const normalizeAcbPlayer = (entry) => {
  const player = entry?.player ?? {};
  const name =
    player.nickname ||
    player.firstInitialAndLastName ||
    [player.firstName, player.lastName].filter(Boolean).join(' ') ||
    'Jugador';

  return {
    id: player.id ?? null,
    name,
    number: player.shirtNumber ?? '',
    position: player.gameRole ?? '',
    headshot: player.headshotImageUrl ?? null,
    minutes: entry.playTime ?? '0:00',
    points: Number(entry.points) || 0,
    twoPointersMade: Number(entry.twoPointersMade) || 0,
    twoPointersAttempted: Number(entry.twoPointersAttempted) || 0,
    threePointersMade: Number(entry.threePointersMade) || 0,
    threePointersAttempted: Number(entry.threePointersAttempted) || 0,
    freeThrowsMade: Number(entry.freeThrowsMade) || 0,
    freeThrowsAttempted: Number(entry.freeThrowsAttempted) || 0,
    offRebounds: Number(entry.offRebounds) || 0,
    defRebounds: Number(entry.defRebounds) || 0,
    totalRebounds: Number(entry.totalRebounds) || 0,
    assists: Number(entry.assists) || 0,
    steals: Number(entry.steals) || 0,
    turnovers: Number(entry.turnovers) || 0,
    blocks: Number(entry.blocks) || 0,
    personalFouls: Number(entry.personalFouls) || 0,
    foulsDrawn: Number(entry.foulsDrawn) || 0,
    plusMinus: Number(entry.plusMinus) || 0,
    rating: Number(entry.rating) || 0
  };
};

const normalizeAcbTeamBox = (teamBox, side) => {
  const stats = acbTotal(teamBox).players ?? [];
  const total = acbTotal(teamBox).total ?? {};
  const team = teamBox?.team ?? {};

  return {
    side,
    id: team.id ?? null,
    clubId: team.clubId ?? null,
    name: team.fullName || team.shortName || 'Equipo',
    short: team.abbreviatedName || '',
    logo: team.logo || team.secondaryLogo || null,
    color: team.primaryColorHex || null,
    coach: teamBox?.headCoach ?? null,
    totals: {
      points: Number(total.points) || 0,
      freeThrowsMade: Number(total.freeThrowsMade) || 0,
      freeThrowsAttempted: Number(total.freeThrowsAttempted) || 0,
      twoPointersMade: Number(total.twoPointersMade) || 0,
      twoPointersAttempted: Number(total.twoPointersAttempted) || 0,
      threePointersMade: Number(total.threePointersMade) || 0,
      threePointersAttempted: Number(total.threePointersAttempted) || 0,
      assists: Number(total.assists) || 0,
      offRebounds: Number(total.offRebounds) || 0,
      defRebounds: Number(total.defRebounds) || 0,
      totalRebounds: Number(total.totalRebounds) || 0,
      steals: Number(total.steals) || 0,
      turnovers: Number(total.turnovers) || 0,
      blocks: Number(total.blocks) || 0,
      receivedBlocks: Number(total.receivedBlocks) || 0,
      dunks: Number(total.dunks) || 0,
      personalFouls: Number(total.personalFouls) || 0,
      foulsDrawn: Number(total.foulsDrawn) || 0,
      plusMinus: Number(total.plusMinus) || 0,
      rating: Number(total.rating) || 0
    },
    percentages: {
      twoPt: shotPercentage(total.twoPointersMade, total.twoPointersAttempted),
      threePt: shotPercentage(total.threePointersMade, total.threePointersAttempted),
      ft: shotPercentage(total.freeThrowsMade, total.freeThrowsAttempted)
    },
    players: stats.map(normalizeAcbPlayer)
  };
};

const normalizeAcbMatch = (payload, matchId, header = null) => {
  const [homeBox, awayBox] = payload.teamBoxscores ?? [];
  const home = normalizeAcbTeamBox(homeBox, 'home');
  const away = normalizeAcbTeamBox(awayBox, 'away');
  const headerTeams = header?.teams ?? {};
  if (headerTeams.home?.logo) home.logo = headerTeams.home.logo;
  if (headerTeams.away?.logo) away.logo = headerTeams.away.logo;
  if (headerTeams.home?.primaryColorHex) home.color = headerTeams.home.primaryColorHex;
  if (headerTeams.away?.primaryColorHex) away.color = headerTeams.away.primaryColorHex;

  const quarterMap = new Map();

  for (const period of header?.quarterScores ?? []) {
    const quarter = Number(period.quarter);
    if (!quarter) continue;
    quarterMap.set(quarter, {
      quarter,
      home: Number(period.homeScore) || 0,
      away: Number(period.awayScore) || 0
    });
  }

  if (!quarterMap.size) {
    for (const period of homeBox?.statsByPeriods ?? []) {
      const quarter = Number(period.quarter);
      if (!quarter) continue;
      if (!quarterMap.has(quarter)) quarterMap.set(quarter, { quarter, home: 0, away: 0 });
      quarterMap.get(quarter).home = Number(period.stats?.total?.points) || 0;
    }

    for (const period of awayBox?.statsByPeriods ?? []) {
      const quarter = Number(period.quarter);
      if (!quarter) continue;
      if (!quarterMap.has(quarter)) quarterMap.set(quarter, { quarter, home: 0, away: 0 });
      quarterMap.get(quarter).away = Number(period.stats?.total?.points) || 0;
    }
  }

  return {
    available: true,
    matchId: Number(matchId),
    provider: 'ACB.com',
    start: header?.start ?? null,
    matchStatus: header?.matchStatus ?? null,
    matchFinished: header?.matchStatus === 'FINALIZED' || Boolean(payload.matchFinished),
    homeScore: Number(header?.currentHomeScore ?? home.totals.points) || home.totals.points,
    awayScore: Number(header?.currentAwayScore ?? away.totals.points) || away.totals.points,
    arena: payload.arena ?? null,
    attendance: Number(payload.attendance) || null,
    referees: Array.isArray(payload.referees) ? payload.referees : [],
    home,
    away,
    periods: [...quarterMap.values()].sort((a, b) => a.quarter - b.quarter)
  };
};

/* ========================================================================== */
/* 2. Adaptador Football-Data.org                                             */
/* ========================================================================== */

const fetchFootballDataset = async (season) => {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    throw new Error('FOOTBALL_DATA_API_KEY no configurada');
  }

  const startYear = seasonStartYear(season);
  const headers = { 'X-Auth-Token': apiKey };
  const seasonQuery = `season=${startYear}`;

  const [standingsPayload, scorersPayload, matchesPayload] = await Promise.all([
    fetchJson(
      `${FOOTBALL_BASE_URL}/competitions/${FOOTBALL_COMPETITION}/standings?${seasonQuery}`,
      headers
    ),
    fetchJson(
      `${FOOTBALL_BASE_URL}/competitions/${FOOTBALL_COMPETITION}/scorers?${seasonQuery}&limit=50`,
      headers
    ),
    fetchJson(
      `${FOOTBALL_BASE_URL}/competitions/${FOOTBALL_COMPETITION}/matches?${seasonQuery}&status=FINISHED`,
      headers
    )
  ]);

  const table =
    standingsPayload.standings?.find((group) => group.type === 'TOTAL')?.table ??
    standingsPayload.standings?.[0]?.table;

  if (!Array.isArray(table) || !table.length) {
    throw new Error('Football-Data.org devolvió una clasificación vacía');
  }

  const local = LOCAL_DB[`futbol:${season}`];

  const standings = table.map((row) => ({
    pos: row.position,
    team: row.team?.name ?? 'Equipo',
    short: row.team?.tla ?? '',
    played: row.playedGames,
    won: row.won,
    drawn: row.draw,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    points: row.points,
    form: row.form ?? ''
  }));

  const scorers = (scorersPayload.scorers ?? []).map((row) => ({
    player: row.player?.name ?? 'Jugador',
    team: row.team?.name ?? 'Equipo',
    goals: row.goals ?? 0,
    assists: row.assists ?? 0,
    penalties: row.penalties ?? 0,
    matches: row.playedMatches ?? 0
  }));

  const results = (matchesPayload.matches ?? [])
    .map((match) => ({
      round: match.matchday,
      date: match.utcDate,
      home: match.homeTeam?.name ?? 'Local',
      away: match.awayTeam?.name ?? 'Visitante',
      homeScore: match.score?.fullTime?.home ?? 0,
      awayScore: match.score?.fullTime?.away ?? 0
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return {
    meta: {
      ...(local?.meta ?? {}),
      sport: 'futbol',
      sportLabel: 'Fútbol',
      league: SPORTS.futbol.league,
      season,
      country: 'España',
      provider: 'Football-Data.org',
      source: 'api',
      fallbackReason: null,
      fetchedAt: new Date().toISOString(),
      champion: standings[0]?.team ?? local?.meta?.champion ?? null,
      hasExternalProvider: true,
      description: local?.meta?.description ?? 'Datos oficiales de la Liga EA Sports.'
    },
    standings,
    results,
    scorers,
    teamStats: local?.teamStats ?? []
  };
};

/* ========================================================================== */
/* 3. Adaptadores externos opcionales (ACB / ASOBAL)                          */
/* ========================================================================== */

const fetchExternalLeagueDataset = async (sport, season) => {
  const endpoint = sport === 'baloncesto' ? process.env.ACB_API_URL : process.env.ASOBAL_API_URL;
  if (!endpoint) {
    throw new Error(
      sport === 'baloncesto'
        ? 'ACB_API_URL no configurada; se usa el mock local'
        : 'ASOBAL_API_URL no configurada; se usa el mock local'
    );
  }

  const url = new URL(endpoint);
  url.searchParams.set('season', season);

  const headers = {};
  if (process.env.SPORTS_API_TOKEN) {
    headers.Authorization = `Bearer ${process.env.SPORTS_API_TOKEN}`;
  }

  const payload = await fetchJson(url.toString(), headers);

  if (!payload || !Array.isArray(payload.standings) || !payload.standings.length) {
    throw new Error('El endpoint externo no devolvió una clasificación válida');
  }

  return {
    ...payload,
    meta: {
      ...(payload.meta ?? {}),
      sport,
      sportLabel: SPORTS[sport].label,
      league: SPORTS[sport].league,
      season,
      country: 'España',
      provider: payload.meta?.provider ?? `API externa ${SPORTS[sport].league}`,
      source: 'api',
      fallbackReason: null,
      fetchedAt: new Date().toISOString(),
      hasExternalProvider: true
    }
  };
};

/* ========================================================================== */
/* 4. Resolución con caché y fallback                                         */
/* ========================================================================== */

const resolveDataset = async (sport, season, forceRefresh = false) => {
  const key = `${sport}:${season}`;
  const cached = memoryCache.get(key);

  if (!forceRefresh && cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
    return { dataset: cached.dataset, cached: true };
  }

  const archive = await readArchiveDataset(sport, season);
  if (archive) {
    archive.meta = {
      ...archive.meta,
      source: 'archive',
      provider: archive.meta.provider || 'Archivo histórico IberiaStats'
    };

    memoryCache.set(key, { dataset: archive, savedAt: Date.now() });
    return { dataset: archive, cached: false };
  }

  let remote = null;
  let fallbackReason = null;

  try {
    remote =
      sport === 'futbol'
        ? await fetchFootballDataset(season)
        : await fetchExternalLeagueDataset(sport, season);
  } catch (error) {
    fallbackReason = error instanceof Error ? error.message : 'Error de proveedor externo';
  }

  const dataset = remote ?? localDataset(sport, season, fallbackReason);

  if (!dataset) {
    throw new Error(`No existe dataset histórico, local ni remoto para ${sport} / ${season}`);
  }

  memoryCache.set(key, { dataset, savedAt: Date.now() });
  return { dataset, cached: false };
};

/* ========================================================================== */
/* 5. Middleware                                                              */
/* ========================================================================== */

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

/* ========================================================================== */
/* 6. API                                                                     */
/* ========================================================================== */

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'IberiaStats API',
    footballProviderConfigured: Boolean(process.env.FOOTBALL_DATA_API_KEY),
    basketballProviderConfigured: Boolean(process.env.ACB_API_URL), matchDetailsConfigured: Boolean(ACB_API_KEY),
    handballProviderConfigured: Boolean(process.env.ASOBAL_API_URL),
    seasons: AVAILABLE_SEASONS,
    seasonsBySport: AVAILABLE_SEASONS_BY_SPORT,
    sports: Object.keys(SPORTS)
  });
});

app.get('/api/config', (_req, res) => {
  res.json({
    sports: Object.values(SPORTS).map(({ id, label, league, icon }) => ({ id, label, league, icon })),
    seasons: AVAILABLE_SEASONS,
    seasonsBySport: AVAILABLE_SEASONS_BY_SPORT,
    cacheTtlMinutes: CACHE_TTL_MS / 60000
  });
});

app.get('/api/stats/:sport/:season', async (req, res, next) => {
  try {
    const { sport, season } = req.params;

    if (!SPORTS[sport]) {
      res.status(400).json({ error: 'Deporte no válido', validSports: Object.keys(SPORTS) });
      return;
    }

    const validSeasons = AVAILABLE_SEASONS_BY_SPORT[sport] ?? [];
    if (!validSeasons.includes(season)) {
      res.status(400).json({ error: 'Temporada no válida', validSeasons });
      return;
    }

    const forceRefresh = req.query.refresh === '1';
    const { dataset, cached } = await resolveDataset(sport, season, forceRefresh);

    res.setHeader('X-Data-Source', dataset.meta.source);
    res.setHeader('X-Cache', cached ? 'HIT' : 'MISS');
    res.json(dataset);
  } catch (error) {
    next(error);
  }
});

app.get('/api/match/:sport/:season/:matchId', async (req, res, next) => {
  try {
    const { sport, season, matchId } = req.params;

    if (sport !== 'baloncesto') {
      res.status(400).json({
        error: 'Detalle de partido no disponible para este deporte',
        available: false
      });
      return;
    }

    const validSeasons = AVAILABLE_SEASONS_BY_SPORT[sport] ?? [];
    if (!validSeasons.includes(season)) {
      res.status(400).json({ error: 'Temporada no válida', validSeasons });
      return;
    }

    if (!/^\d{1,9}$/.test(matchId)) {
      res.status(400).json({ error: 'ID de partido no válido' });
      return;
    }

    const cached = matchDetailCache.get(matchId);
    if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
      res.setHeader('X-Cache', 'HIT');
      res.json(cached.data);
      return;
    }

    const headers = {
      'X-APIKEY': ACB_API_KEY,
      Referer: 'https://www.acb.com/'
    };
    const [boxResult, header] = await Promise.all([
      fetchJson(
        `${ACB_API_BASE_URL}/api/matchdata/Result/boxscores?matchId=${encodeURIComponent(matchId)}`,
        headers
      )
        .then((payload) => ({ payload }))
        .catch((error) => ({ error })),
      fetchJson(
        `${ACB_API_BASE_URL}/api/matchdata/MatchHeader/match-header?matchId=${encodeURIComponent(matchId)}`,
        headers
      ).catch(() => null)
    ]);

    if (boxResult.error) {
      res.status(422).json({
        error: 'La ACB no ofrece boxscore para este partido histórico',
        available: false
      });
      return;
    }

    const payload = boxResult.payload;

    if (
      !payload?.matchFinished ||
      !Array.isArray(payload.teamBoxscores) ||
      payload.teamBoxscores.length < 2
    ) {
      res.status(422).json({
        error: 'La ACB todavía no ofrece el detalle completo de este partido',
        available: false
      });
      return;
    }

    const data = normalizeAcbMatch(payload, matchId, header);
    data.fetchedAt = new Date().toISOString();
    matchDetailCache.set(matchId, { data, savedAt: Date.now() });

    res.setHeader('X-Data-Source', 'ACB.com');
    res.setHeader('X-Cache', 'MISS');
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint de API no encontrado' });
});

/* ========================================================================== */
/* 7. Frontend estático                                                       */
/* ========================================================================== */

app.use(
  express.static(__dirname, {
    extensions: ['html'],
    etag: true,
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0
  })
);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    next();
    return;
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ========================================================================== */
/* 8. Manejo de errores y arranque                                            */
/* ========================================================================== */

app.use((error, _req, res, _next) => {
  console.error('[IberiaStats] Error:', error);
  res.status(500).json({
    error: 'Error interno del servidor',
    detail: process.env.NODE_ENV === 'production' ? undefined : String(error.message || error)
  });
});

const server = app.listen(PORT, () => {
  console.log(`IberiaStats disponible en http://localhost:${PORT}`);
  console.log(
    `Proveedores · Football-Data: ${process.env.FOOTBALL_DATA_API_KEY ? 'sí' : 'no'} · ` +
      `ACB: ${process.env.ACB_API_URL ? 'sí' : 'no'} · ASOBAL: ${process.env.ASOBAL_API_URL ? 'sí' : 'no'} · Detalle ACB: ${ACB_API_KEY ? 'sí' : 'no'}`
  );
  console.log(
    `Temporadas con datos · Fútbol: ${AVAILABLE_SEASONS_BY_SPORT.futbol?.length ?? 0} · ` +
      `ACB: ${AVAILABLE_SEASONS_BY_SPORT.baloncesto?.length ?? 0} · ` +
      `ASOBAL: ${AVAILABLE_SEASONS_BY_SPORT.balonmano?.length ?? 0}`
  );
});

const shutdown = (signal) => {
  console.log(`\n${signal} recibido. Cerrando servidor...`);
  server.close(() => process.exit(0));
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default app;
