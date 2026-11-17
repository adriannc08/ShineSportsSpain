/**
 * api_connector.js
 * ---------------------------------------------------------------------------
 * Capa de acceso a datos de IberiaStats.
 *
 *  1. Catálogo de deportes, ligas y temporadas.
 *  2. Datos locales de respaldo (cargados desde data/*.js).
 *  3. SportsDataService: intenta el backend(/api/stats) y cae al dataset
 *     local ante cualquier error. Cachea en memoria y localStorage.
 *
 * El frontend NUNCA maneja API keys. server.js es el único que conoce las
 * credenciales de Football-Data.org y las APIs externas opcionales.
 * ---------------------------------------------------------------------------
 */

import { FOOTBALL_DATA } from './data/football.js';
import { BASKETBALL_DATA } from './data/basketball.js';
import { HANDBALL_DATA } from './data/handball.js';
import { decorateStandings } from './data/helpers.js';
import { ALL_SEASONS, SEASONS_BY_SPORT } from './data/seasons.js';

/* ========================================================================== */
/* 1. Catálogo                                                                */
/* ========================================================================== */

export { SEASONS_BY_SPORT };
export const SEASONS = ALL_SEASONS;

let availableSeasonsBySport = SEASONS_BY_SPORT;

export const setAvailableSeasons = (seasonsBySport) => {
  if (!seasonsBySport || typeof seasonsBySport !== 'object') return;
  availableSeasonsBySport = seasonsBySport;
};

export const getSeasonsForSport = (sport) => [...(availableSeasonsBySport[sport] ?? [])];
export const isValidSeason = (sport, season) => getSeasonsForSport(sport).includes(season);

export const SPORTS = Object.freeze({
  futbol: {
    id: 'futbol',
    icon: '⚽',
    label: 'Fútbol',
    league: 'Liga EA Sports',
    country: 'España',
    description:
      'Primera División del fútbol español. Clasificación, resultados, goleadores y rendimiento de los 20 equipos.',
    provider: 'Football-Data.org',
    competition: 'PD',
    modules: ['Clasificación', 'Resultados', 'Goleadores', 'Estadísticas de equipos'],
    leaderLabel: 'Goleadores',
    pointsLabel: 'Puntos',
    accent: '#22c55e',
    accent2: '#84cc16',
    theme: 'theme-futbol'
  },
  baloncesto: {
    id: 'baloncesto',
    icon: '🏀',
    label: 'Baloncesto',
    league: 'Liga ACB',
    country: 'España',
    description:
      'Liga Endesa ACB. Fase regular, anotadores, valoración, rebotes, asistencias y resultados por jornada.',
    provider: 'ACB / datos locales',
    competition: 'ACB',
    modules: ['Clasificación', 'Jornadas', 'Anotadores', 'Valoración · Rebotes · Asistencias'],
    leaderLabel: 'Anotadores',
    pointsLabel: 'Victorias',
    accent: '#f97316',
    accent2: '#f59e0b',
    theme: 'theme-baloncesto'
  },
  balonmano: {
    id: 'balonmano',
    icon: '🤾',
    label: 'Balonmano',
    league: 'Liga ASOBAL',
    country: 'España',
    description:
      'Liga ASOBAL de balonmano. Clasificación, jornadas, máximos goleadores y paradas de los porteros.',
    provider: 'ASOBAL / datos locales',
    competition: 'ASOBAL',
    modules: ['Clasificación', 'Jornadas', 'Goleadores', 'Paradas de porteros'],
    leaderLabel: 'Goleadores',
    pointsLabel: 'Puntos',
    accent: '#38bdf8',
    accent2: '#818cf8',
    theme: 'theme-balonmano'
  }
});

export const VIEWS = Object.freeze({
  overview: { id: 'overview', label: 'Resumen', shortLabel: 'Resumen', icon: 'grid' },
  standings: { id: 'standings', label: 'Clasificación', shortLabel: 'Tabla', icon: 'table' },
  results: { id: 'results', label: 'Resultados', shortLabel: 'Jornadas', icon: 'calendar' },
  leaders: { id: 'leaders', label: 'Estadísticas', shortLabel: 'Stats', icon: 'chart' }
});

/* ========================================================================== */
/* 2. Datos locales                                                           */
/* ========================================================================== */

export const LOCAL_DB = Object.freeze({
  'futbol:2022-2023': FOOTBALL_DATA['2022-2023'],
  'futbol:2023-2024': FOOTBALL_DATA['2023-2024'],
  'baloncesto:2022-2023': BASKETBALL_DATA['2022-2023'],
  'baloncesto:2023-2024': BASKETBALL_DATA['2023-2024'],
  'balonmano:2022-2023': HANDBALL_DATA['2022-2023'],
  'balonmano:2023-2024': HANDBALL_DATA['2023-2024']
});

/* ========================================================================== */
/* 3. Utilidades                                                              */
/* ========================================================================== */

const CACHE_PREFIX = 'iberia-stats:cache:v3:';
const MEMORY_TTL = 1000 * 60 * 60 * 6;

const clone = (value) => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeForm = (form) => {
  if (Array.isArray(form)) {
    return form
      .map((item) => {
        const code = String(item).toUpperCase();
        if (code.startsWith('W') || code === 'V') return 'W';
        if (code.startsWith('D') || code === 'E') return 'D';
        if (code.startsWith('L') || code === 'P') return 'L';
        return null;
      })
      .filter(Boolean)
      .slice(-5);
  }

  if (typeof form === 'string') {
    return normalizeForm(form.split(''));
  }

  return [];
};

const normalizeStandings = (rows) => {
  if (!Array.isArray(rows) || !rows.length) return [];

  return decorateStandings(
    rows.map((row, index) => {
      const position = toNumber(row.pos ?? row.position ?? index + 1, index + 1);
      const goalsFor = toNumber(row.goalsFor ?? row.pointsFor ?? row.goals_for);
      const goalsAgainst = toNumber(row.goalsAgainst ?? row.pointsAgainst ?? row.goals_against);

      return {
        pos: position,
        position,
        team: row.team ?? row.teamName ?? row.name ?? `Equipo ${index + 1}`,
        short: row.short ?? row.tla ?? '',
        played: toNumber(row.played ?? row.playedGames ?? row.games),
        won: toNumber(row.won ?? row.wins),
        drawn: toNumber(row.drawn ?? row.draws),
        lost: toNumber(row.lost ?? row.losses),
        goalsFor,
        goalsAgainst,
        pointsFor: toNumber(row.pointsFor ?? goalsFor),
        pointsAgainst: toNumber(row.pointsAgainst ?? goalsAgainst),
        points: toNumber(row.points),
        diff: row.diff != null ? toNumber(row.diff) : goalsFor - goalsAgainst,
        winPct: row.winPct != null ? toNumber(row.winPct) : undefined,
        streak: row.streak,
        logo: row.logo ?? row.crest ?? '',
        color: row.color ?? row.primaryColorHex ?? '',
        form: normalizeForm(row.form)
      };
    })
  );
};

const normalizeResults = (rows) => {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => ({
    id: row.id ?? row.matchId ?? null,
    round: toNumber(row.round ?? row.matchday ?? row.jornada),
    date: row.date ?? row.utcDate ?? row.kickoff ?? '',
    home: row.home ?? row.homeTeam?.name ?? row.homeTeam ?? 'Local',
    away: row.away ?? row.awayTeam?.name ?? row.awayTeam ?? 'Visitante',
    homeScore: toNumber(row.homeScore ?? row.score?.fullTime?.home ?? row.home_goals),
    awayScore: toNumber(row.awayScore ?? row.score?.fullTime?.away ?? row.away_goals),
    stage: row.stage ?? null,
    phase: row.phase ?? null
  }));
};

const normalizeScorers = (rows, sport) => {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const matches = toNumber(row.matches ?? row.playedMatches ?? row.games);
    const goals = toNumber(row.goals ?? row.avg ?? row.points ?? row.value);
    return {
      player: row.player ?? row.name ?? 'Jugador',
      team: row.team ?? row.teamName ?? 'Equipo',
      goals,
      assists: toNumber(row.assists),
      penalties: toNumber(row.penalties),
      matches,
      avg: row.avg != null ? toNumber(row.avg) : matches ? Number((goals / matches).toFixed(1)) : goals,
      total: toNumber(row.total)
    };
  });
};

const normalizeLeaders = (leaders) => {
  if (!leaders || typeof leaders !== 'object') return {};

  return Object.fromEntries(
    Object.entries(leaders).map(([key, rows]) => [
      key,
      Array.isArray(rows)
        ? rows.map((row) => ({
            player: row.player ?? row.name ?? 'Jugador',
            team: row.team ?? row.teamName ?? 'Equipo',
            games: toNumber(row.games ?? row.matches ?? row.playedMatches),
            avg: toNumber(row.avg ?? row.value),
            total: toNumber(row.total)
          }))
        : []
    ])
  );
};

const normalizeGoalkeepers = (rows) => {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => ({
    player: row.player ?? row.name ?? 'Portero',
    team: row.team ?? row.teamName ?? 'Equipo',
    saves: toNumber(row.saves ?? row.paradas),
    matches: toNumber(row.matches ?? row.games),
    savePct: toNumber(row.savePct ?? row.percentage)
  }));
};

/* ========================================================================== */
/* 4. Servicio de datos                                                       */
/* ========================================================================== */

export class SportsDataService {
  constructor(options = {}) {
    this.config = {
      statsEndpoint: '/api/stats',
      remoteEnabled: true,
      timeoutMs: 5000,
      cacheTtlMs: MEMORY_TTL,
      ...options
    };
    this.memoryCache = new Map();
    this.lastResolution = null;
  }

  configure(options = {}) {
    this.config = { ...this.config, ...options };
    this.memoryCache.clear();
  }

  getSports() {
    return Object.values(SPORTS);
  }

  getSeasons() {
    return [...new Set(Object.values(availableSeasonsBySport).flat())].sort().reverse();
  }

  getSeasonsForSport(sport) {
    return getSeasonsForSport(sport);
  }

  hasLocalDataset(sport, season) {
    return Boolean(LOCAL_DB[`${sport}:${season}`]);
  }

  getLocalDataset(sport, season) {
    const local = LOCAL_DB[`${sport}:${season}`];
    return local ? clone(local) : null;
  }

  /**
   * Punto de entrada único para la UI.
   * Devuelve siempre un dataset válido o lanza un error controlado.
   */
  async getDataset(sport, season, options = {}) {
    const key = `${sport}:${season}`;
    const local = LOCAL_DB[key] ?? null;
    if (!SPORTS[sport] || !isValidSeason(sport, season)) {
      throw new Error(`Combinación no disponible: ${sport} / ${season}`);
    }

    const forceRefresh = Boolean(options.forceRefresh);

    if (!forceRefresh) {
      const memory = this.memoryCache.get(key);
      if (memory && Date.now() - memory.savedAt < this.config.cacheTtlMs) {
        this.lastResolution = memory.resolution;
        return clone(memory.data);
      }

      const stored = this.readCache(key);
      if (stored) {
        this.memoryCache.set(key, {
          data: stored.data,
          savedAt: stored.savedAt,
          resolution: stored.data.meta
        });
        this.lastResolution = stored.data.meta;
        return clone(stored.data);
      }
    }

    let dataset = null;
    let fallbackReason = null;

    if (this.config.remoteEnabled) {
      try {
        const remote = await this.fetchRemote(sport, season);
        dataset = this.normalizeDataset(remote, local, sport, season);
        if (dataset.meta.source === 'local') {
          fallbackReason = dataset.meta.fallbackReason || 'Proveedor externo sin configurar';
        }
      } catch (error) {
        fallbackReason = error.message || 'Error de conexión con la API';
      }
    } else {
      fallbackReason = 'Modo local activado en la configuración';
    }

    if (!dataset) {
      if (!local) {
        throw new Error(
          fallbackReason
            ? `No se pudo cargar el archivo histórico: ${fallbackReason}`
            : 'No hay datos disponibles para esta temporada'
        );
      }

      dataset = this.normalizeDataset(clone(local), local, sport, season);
      dataset.meta.source = 'local';
      dataset.meta.provider = local.meta.provider;
      dataset.meta.fallbackReason = fallbackReason;
    }

    dataset.meta.fetchedAt = new Date().toISOString();
    dataset.meta.cacheTtlMs = this.config.cacheTtlMs;

    const resolution = {
      source: dataset.meta.source,
      provider: dataset.meta.provider,
      fallbackReason: dataset.meta.fallbackReason ?? null,
      fetchedAt: dataset.meta.fetchedAt
    };

    this.lastResolution = resolution;
    this.memoryCache.set(key, {
      data: clone(dataset),
      savedAt: Date.now(),
      resolution
    });
    this.writeCache(key, dataset, resolution);

    return dataset;
  }

  /**
   * Consulta el backend normalizado. El backend es el que habla con
   * Football-Data.org / APIs externas y devuelve siempre nuestro contrato.
   */
  async fetchRemote(sport, season) {
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
      throw new Error('Sin backend: la app se está abriendo mediante file://');
    }

    const base = String(this.config.statsEndpoint).replace(/\/+$/, '');
    const url = `${base}/${encodeURIComponent(sport)}/${encodeURIComponent(season)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`API HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('La API no devolvió JSON');
      }

      const payload = await response.json();
      if (!payload || !Array.isArray(payload.standings) || !payload.standings.length) {
        throw new Error('Respuesta de API sin clasificación válida');
      }

      return payload;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Normaliza y completa la respuesta remota con los extras locales
   * (por ejemplo, estadísticas de equipo de fútbol que Football-Data no da).
   */
  normalizeDataset(payload, local, sport, season) {
    const localData = local ?? {};
    const meta = {
      ...(localData.meta ?? {}),
      ...(payload.meta || {}),
      sport,
      sportLabel: SPORTS[sport].label,
      league: SPORTS[sport].league,
      season
    };

    if (!meta.source) {
      meta.source = payload.meta?.source === 'local' ? 'local' : 'api';
    }

    const remoteStandings = normalizeStandings(payload.standings ?? []);
    const standings = remoteStandings.length
      ? remoteStandings
      : normalizeStandings(localData.standings ?? []);

    const results = normalizeResults(payload.results ?? localData.results ?? []);
    const remoteScorers = normalizeScorers(payload.scorers ?? [], sport);
    const scorers = remoteScorers.length
      ? remoteScorers
      : normalizeScorers(localData.scorers ?? [], sport);

    const leaders = normalizeLeaders(payload.leaders ?? localData.leaders ?? {});
    const remoteGoalkeepers = normalizeGoalkeepers(payload.goalkeepers ?? []);
    const goalkeepers = remoteGoalkeepers.length
      ? remoteGoalkeepers
      : normalizeGoalkeepers(localData.goalkeepers ?? []);

    const remoteTeamStats = Array.isArray(payload.teamStats) && payload.teamStats.length
      ? payload.teamStats
      : null;

    return {
      ...localData,
      ...payload,
      meta,
      standings,
      results,
      scorers,
      leaders,
      goalkeepers,
      teamStats: remoteTeamStats || localData.teamStats || []
    };
  }

  readCache(key) {
    const storage = this.getStorage();
    if (!storage) return null;

    try {
      const raw = storage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed?.savedAt || !parsed?.data) {
        storage.removeItem(CACHE_PREFIX + key);
        return null;
      }

      if (Date.now() - parsed.savedAt > this.config.cacheTtlMs) {
        storage.removeItem(CACHE_PREFIX + key);
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  writeCache(key, data, resolution) {
    const storage = this.getStorage();
    if (!storage) return;

    try {
      const serialized = JSON.stringify({ savedAt: Date.now(), resolution, data });
      if (serialized.length > 1_500_000) return;
      storage.setItem(CACHE_PREFIX + key, serialized);
    } catch {
      /* Cuota llena o almacenamiento bloqueado: la app sigue funcionando. */
    }
  }

  clearCache() {
    this.memoryCache.clear();
    const storage = this.getStorage();
    if (!storage) return;

    try {
      Object.keys(storage)
        .filter((key) => key.startsWith(CACHE_PREFIX))
        .forEach((key) => storage.removeItem(key));
    } catch {
      /* Noop */
    }
  }

  getStorage() {
    try {
      return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
    } catch {
      return null;
    }
  }
}

export const sportsDataService = new SportsDataService();
export default sportsDataService;
