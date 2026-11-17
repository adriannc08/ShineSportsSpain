/**
 * app.js
 * ---------------------------------------------------------------------------
 * Orquestador de la SPA:
 *  - Controla el formulario de acceso y la validación.
 *  - Gestiona el enrutado por hash sin recargar la página.
 *  - Consume SportsDataService (api_connector.js) y pinta el dashboard.
 *  - Renderiza vistas distintas para fútbol, baloncesto y balonmano.
 * ---------------------------------------------------------------------------
 */

import {
  SPORTS,
  VIEWS,
  SportsDataService,
  getSeasonsForSport,
  isValidSeason,
  setAvailableSeasons
} from './api_connector.js';

/* ========================================================================== */
/* 1. Configuración, estado y referencias                                     */
/* ========================================================================== */

const runtimeConfig = typeof window !== 'undefined' && window.IBERIA_STATS_CONFIG
  ? window.IBERIA_STATS_CONFIG
  : {};

const service = new SportsDataService(runtimeConfig);

const loadAvailableSeasons = async () => {
  const statsEndpoint = String(runtimeConfig.statsEndpoint || '/api/stats');
  const configEndpoint = statsEndpoint.endsWith('/stats')
    ? statsEndpoint.replace(/\/stats\/?$/, '/config')
    : '/api/config';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(configEndpoint, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const config = await response.json();
    if (config?.seasonsBySport) setAvailableSeasons(config.seasonsBySport);
  } catch (error) {
    console.warn('No se pudo cargar la cobertura de temporadas; usando catálogo local.', error.message);
  } finally {
    clearTimeout(timer);
  }
};

const state = {
  sport: null,
  season: null,
  view: 'overview',
  data: null,
  activeKey: null,
  requestId: 0,
  loading: false
};

const notifiedKeys = new Set();
const matchDetailsCache = new Map();
let toastTimer = null;
let activeMatchKey = null;
let matchRequestId = 0;
let matchModalTrigger = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const els = {
  welcome: $('#welcome-view'),
  dashboard: $('#dashboard-view'),
  form: $('#selector-form'),
  sportSelect: $('#sport-select'),
  seasonSelect: $('#season-select'),
  seasonHint: $('#season-hint'),
  preview: $('#selection-preview'),
  formError: $('#form-error'),
  consultButton: $('#consult-button'),
  content: $('#dashboard-content'),
  desktopNav: $('#dashboard-nav'),
  mobileNav: $('#mobile-nav'),
  loadingOverlay: $('#loading-overlay'),
  loadingDetail: $('#loading-detail'),
  toast: $('#toast'),
  matchModal: $('#match-modal'),
  matchModalBody: $('#match-modal-body'),
  sourceBadge: $('#source-badge'),
  sidebarSource: $('#sidebar-source'),
  sidebarSourceDot: $('#sidebar-source-dot'),
  sidebarUpdated: $('#sidebar-updated'),
  sidebarLeagueName: $('#sidebar-league-name'),
  sidebarSportIcon: $('#sidebar-sport-icon'),
  sidebarSeason: $('#sidebar-season'),
  sidebarTeamCount: $('#sidebar-team-count'),
  breadcrumbLeague: $('#breadcrumb-league'),
  dashboardTitle: $('#dashboard-title'),
  lastUpdated: $('#last-updated')
};

/* ========================================================================== */
/* 2. Utilidades de formato                                                   */
/* ========================================================================== */

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character]);

const number = (value, digits = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  return parsed.toLocaleString('es-ES', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
};

const decimal = (value, digits = 1) => number(value, digits);
const signed = (value) => {
  const parsed = Number(value) || 0;
  if (parsed > 0) return `+${number(parsed)}`;
  return number(parsed);
};

const percent = (value, digits = 0) => `${number(Number(value) * 100, digits)}%`;

const currentSport = () => SPORTS[state.sport] ?? SPORTS.futbol;

const populateSeasonOptions = (sport, selected = '') => {
  const validSport = Boolean(sport && SPORTS[sport]);
  const seasons = validSport ? getSeasonsForSport(sport) : [];

  if (!validSport) {
    els.seasonSelect.innerHTML = '<option value="" selected disabled>Selecciona un deporte primero…</option>';
    els.seasonSelect.disabled = true;
    if (els.seasonHint) {
      els.seasonHint.textContent = 'Elige primero el deporte para desbloquear sus temporadas.';
    }
    return;
  }

  if (!seasons.length) {
    els.seasonSelect.innerHTML = '<option value="" selected disabled>Sin temporadas con datos…</option>';
    els.seasonSelect.disabled = true;
    if (els.seasonHint) {
      els.seasonHint.textContent = 'No hay temporadas con datos disponibles para este deporte.';
    }
    return;
  }

  const value = seasons.includes(selected) ? selected : seasons[0];
  els.seasonSelect.innerHTML = seasons
    .map((season) => `<option value="${escapeHtml(season)}">${escapeHtml(season)}</option>`)
    .join('');
  els.seasonSelect.disabled = false;
  els.seasonSelect.value = value;
  if (els.seasonHint) {
    els.seasonHint.textContent = `${seasons.length} temporadas disponibles · selecciona una para consultar.`;
  }
};

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? `${value}T12:00:00`
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
};

const formatUpdated = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const teamHue = (name) => {
  let hash = 0;
  const text = String(name ?? '');
  for (let index = 0; index < text.length; index += 1) {
    hash = text.charCodeAt(index) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
};

const initials = (name) => {
  const ignored = new Set([
    'fc', 'real', 'club', 'cb', 'bm', 'de', 'del', 'la', 'el', 'los', 'las',
    'baloncesto', 'basket', 'balonmano', 'bàsquet', 'sad', 'union', 'unión'
  ]);

  const words = String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const significant = words.filter((word) => !ignored.has(word.toLowerCase()));
  const source = significant.length ? significant : words;
  const value = source.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  return value || 'EQ';
};

const teamShort = (name) => {
  const row = state.data?.standings?.find((entry) => entry.team === name);
  if (row?.short) return row.short;
  if (state.data?.standings?.length) {
    const partial = state.data.standings.find(
      (entry) => name.includes(entry.team) || entry.team.includes(name)
    );
    if (partial?.short) return partial.short;
  }
  return initials(name);
};

const teamBadge = (name, size = '') => {
  const hue = teamHue(name);
  const sizeClass = size ? ` ${size}` : '';
  return `<span class="team-badge${sizeClass}" style="--badge-hue:${hue}" title="${escapeHtml(name)}">${escapeHtml(teamShort(name))}</span>`;
};

const icon = (name, className = 'h-4 w-4') => {
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect>',
    table: '<path d="M4 5h16"></path><path d="M4 12h16"></path><path d="M4 19h16"></path><path d="M8 5v14"></path><path d="M16 5v14"></path>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4"></path><path d="M8 3v4"></path><path d="M3 11h18"></path>',
    chart: '<path d="M4 20V10"></path><path d="M10 20V4"></path><path d="M16 20v-7"></path><path d="M22 20V7"></path>',
    trophy: '<path d="M8 21h8"></path><path d="M12 17v4"></path><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"></path><path d="M7 6H4v2a3 3 0 0 0 3 3"></path><path d="M17 6h3v2a3 3 0 0 1-3 3"></path>',
    shield: '<path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z"></path><path d="m9 12 2 2 4-4"></path>',
    target: '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1"></circle>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
    flame: '<path d="M12 22c4 0 7-2.7 7-7 0-3-2-5.5-4-7.5-.5 2-1.5 3.2-3 4.2.3-2.6-.8-5-2.5-7.2C8.5 7 5 9.8 5 15c0 4.3 3 7 7 7Z"></path>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"></ellipse><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5"></path><path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"></path>',
    clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
    arrow: '<path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.7"></path><path d="M20 4v7h-7"></path>',
    alert: '<path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"></path>',
    whistle: '<circle cx="12" cy="12" r="8"></circle><path d="M12 4v8l4 4"></path>',
    x: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
    ball: '<circle cx="12" cy="12" r="9"></circle><path d="M12 3v18"></path><path d="M3 12h18"></path><path d="m5.6 5.6 12.8 12.8"></path><path d="m18.4 5.6-12.8 12.8"></path>'
  };

  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true">${paths[name] ?? paths.ball}</svg>`;
};

/* ========================================================================== */
/* 3. Formulario de acceso                                                    */
/* ========================================================================== */

const updatePreview = () => {
  const sport = els.sportSelect.value;
  const season = els.seasonSelect.value;

  if (!sport || !season) {
    els.preview.classList.remove('has-selection');
    els.preview.innerHTML = `
      <div class="flex items-center gap-3 text-slate-500">
        <span class="preview-icon">⌁</span>
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.14em]">Vista previa de la consulta</p>
          <p class="mt-1 text-xs text-slate-500">Elige deporte y temporada para ver la cobertura.</p>
        </div>
      </div>`;
    return;
  }

  const meta = SPORTS[sport];
  if (!meta) return;

  els.preview.classList.add('has-selection');
  els.preview.style.setProperty('--accent', meta.accent);
  els.preview.style.setProperty('--accent-2', meta.accent2);
  els.preview.style.setProperty('--accent-soft', `${meta.accent}22`);
  els.preview.style.setProperty('--accent-line', `${meta.accent}55`);

  els.preview.innerHTML = `
    <div class="preview-top">
      <span class="preview-icon">${meta.icon}</span>
      <div class="min-w-0">
        <p class="preview-title">${escapeHtml(meta.league)}</p>
        <p class="preview-subtitle">${escapeHtml(meta.country)} · Base de datos ${escapeHtml(season)}</p>
      </div>
      <span class="preview-badge">${escapeHtml(season)}</span>
    </div>
    <div class="preview-modules">
      ${meta.modules.map((module) => `<span class="preview-module">${escapeHtml(module)}</span>`).join('')}
    </div>`;
};

const showFormError = (message, field) => {
  els.formError.textContent = message;
  els.formError.classList.remove('hidden');

  if (field) {
    const target = field === 'sport' ? els.sportSelect : els.seasonSelect;
    target.focus();
    target.classList.add('ring-2', 'ring-rose-500/40');
    setTimeout(() => target.classList.remove('ring-2', 'ring-rose-500/40'), 1800);
  }
};

const clearFormError = () => {
  els.formError.textContent = '';
  els.formError.classList.add('hidden');
};

const handleSubmit = (event) => {
  event.preventDefault();
  clearFormError();

  const sport = els.sportSelect.value;
  const season = els.seasonSelect.value;

  if (!sport || !SPORTS[sport]) {
    showFormError('Selecciona un deporte válido para continuar.', 'sport');
    return;
  }

  if (!season || !isValidSeason(sport, season)) {
    showFormError('Selecciona una temporada disponible para este deporte.', 'season');
    return;
  }

  navigate(sport, season, 'overview');
};

/* ========================================================================== */
/* 4. Enrutado SPA                                                            */
/* ========================================================================== */

const parseRoute = () => {
  const match = window.location.hash.match(/^#\/liga\/([^/]+)\/([^/]+)(?:\/([^/]+))?/);
  if (!match) return null;

  const sport = decodeURIComponent(match[1]);
  const season = decodeURIComponent(match[2]);
  const view = match[3] ? decodeURIComponent(match[3]) : 'overview';

  if (!SPORTS[sport] || !isValidSeason(sport, season)) return null;

  return {
    sport,
    season,
    view: VIEWS[view] ? view : 'overview'
  };
};

const navigate = (sport, season, view = 'overview') => {
  if (!SPORTS[sport] || !isValidSeason(sport, season)) return;
  const target = `#/liga/${sport}/${season}/${VIEWS[view] ? view : 'overview'}`;

  if (window.location.hash === target) {
    handleRoute();
    return;
  }

  window.location.hash = target;
};

const showWelcome = () => {
  closeMatchModal({ restoreFocus: false });
  els.dashboard.classList.add('hidden');
  els.welcome.classList.remove('hidden');
  els.dashboard.classList.remove('theme-futbol', 'theme-baloncesto', 'theme-balonmano');
  document.title = 'IberiaStats · Estadísticas de ligas españolas';
  window.scrollTo({ top: 0, behavior: 'auto' });
};

const goHome = () => {
  clearFormError();
  const cleanUrl = window.location.pathname + window.location.search;

  if (window.location.hash) {
    window.history.pushState({}, '', cleanUrl);
  }

  handleRoute();
  window.scrollTo({ top: 0, behavior: 'auto' });
};

const handleRoute = () => {
  const route = parseRoute();

  if (!route) {
    showWelcome();
    return;
  }

  const key = `${route.sport}:${route.season}`;
  state.view = route.view;

  els.sportSelect.value = route.sport;
  populateSeasonOptions(route.sport, route.season);
  updatePreview();

  if (state.activeKey === key && state.data) {
    state.sport = route.sport;
    state.season = route.season;
    renderDashboard();
    return;
  }

  loadDataset(route.sport, route.season, route.view);
};

/* ========================================================================== */
/* 5. Carga de datos y estados                                                */
/* ========================================================================== */

const setLoading = (active, sport, season) => {
  state.loading = active;
  els.loadingOverlay.classList.toggle('hidden', !active);
  els.loadingOverlay.classList.toggle('flex', active);

  if (active && sport && season) {
    const meta = SPORTS[sport];
    els.loadingDetail.textContent = `${meta.icon} ${meta.league} · ${season}`;
  }

  els.consultButton.disabled = active;
  els.consultButton.classList.toggle('opacity-70', active);
};

const showToast = (message, type = 'info', duration = 4200) => {
  if (!els.toast) return;

  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.className = `pointer-events-none fixed bottom-5 right-5 z-[60] max-w-sm translate-y-0 rounded-2xl border px-4 py-3 text-sm opacity-100 shadow-2xl transition duration-300 toast-${type}`;

  toastTimer = window.setTimeout(() => {
    els.toast.className = 'pointer-events-none fixed bottom-5 right-5 z-[60] max-w-sm translate-y-3 rounded-2xl border px-4 py-3 text-sm opacity-0 shadow-2xl transition duration-300';
  }, duration);
};

const fatalError = (message) => {
  els.content.innerHTML = `
    <section class="panel fade-up">
      <div class="empty-state">
        <span class="empty-state-icon">${icon('alert', 'h-6 w-6')}</span>
        <h2 class="mt-4 font-display text-lg font-semibold text-white">No se pudo consultar la base de datos</h2>
        <p class="mt-2 max-w-md text-xs leading-relaxed text-slate-500">${escapeHtml(message)}</p>
        <button type="button" class="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-bold text-ink-950" data-action="home">
          ${icon('arrow', 'h-4 w-4')}
          Volver al selector
        </button>
      </div>
    </section>`;
};

const loadDataset = async (sport, season, view = 'overview') => {
  const requestId = state.requestId + 1;
  state.requestId = requestId;
  state.sport = sport;
  state.season = season;
  state.view = view;
  state.activeKey = `${sport}:${season}`;
  state.data = null;

  setLoading(true, sport, season);

  try {
    const data = await service.getDataset(sport, season);

    if (requestId !== state.requestId) return;

    state.data = data;
    renderDashboard();

    if (data.meta.source === 'local') {
      const key = `${sport}:${season}`;
      if (!notifiedKeys.has(key)) {
        notifiedKeys.add(key);
        const reason = data.meta.fallbackReason
          ? ` Mostrando dataset local: ${data.meta.fallbackReason}.`
          : ' Mostrando dataset local de respaldo.';
        showToast(`Proveedor externo no disponible.${reason}`, 'warn', 7000);
      }
    }
  } catch (error) {
    if (requestId !== state.requestId) return;

    const message = error instanceof Error ? error.message : 'Error desconocido';
    fatalError(`Combinación ${sport} / ${season}: ${message}`);
    showToast(`No se pudieron cargar los datos: ${message}`, 'error', 6000);
  } finally {
    if (requestId === state.requestId) {
      setLoading(false);
    }
  }
};

/* ========================================================================== */
/* 6. Shell del dashboard y navegación                                        */
/* ========================================================================== */

const viewCount = (view) => {
  if (!state.data) return '';
  if (view === 'standings') return String(state.data.standings?.length ?? '');
  if (view === 'results') return String(new Set((state.data.results ?? []).map((item) => item.round)).size);
  if (view === 'leaders') {
    if (state.sport === 'baloncesto') return String(state.data.leaders?.points?.length ?? '');
    if (state.sport === 'balonmano') return String(state.data.scorers?.length ?? '');
    return String(state.data.scorers?.length ?? '');
  }
  return '';
};

const buildNavMarkup = (mobile = false) => {
  const views = Object.values(VIEWS);

  return views.map((view) => {
    const active = state.view === view.id;
    const count = viewCount(view.id);
    const className = mobile ? 'tab-item' : 'nav-item';
    const activeClass = active ? ' is-active' : '';

    return `
      <button
        type="button"
        class="${className}${activeClass}"
        data-view="${view.id}"
        ${active ? 'aria-current="page"' : ''}
      >
        <span class="nav-icon">${icon(view.icon, mobile ? 'h-3.5 w-3.5' : 'h-4 w-4')}</span>
        <span>${mobile ? view.shortLabel : view.label}</span>
        ${count && !mobile ? `<span class="nav-count">${count}</span>` : ''}
      </button>`;
  }).join('');
};

const renderNavigation = () => {
  els.desktopNav.innerHTML = buildNavMarkup(false);
  els.mobileNav.innerHTML = buildNavMarkup(true);
};

const sourceColor = (data) => {
  if (data?.meta?.source === 'local') return 'is-local';
  if (data?.meta?.source === 'archive') return 'is-archive';
  return 'is-live';
};

const sourceLabel = (data) => {
  if (data?.meta?.source === 'archive') return 'Archivo histórico';
  if (data?.meta?.source === 'local') return 'Respaldo local';
  return 'API en vivo';
};

const updateSourceUI = (data) => {
  const meta = data.meta;
  const local = meta.source === 'local';
  const archive = meta.source === 'archive';

  els.sourceBadge.className = `source-badge hidden sm:flex ${sourceColor(data)}`;
  els.sourceBadge.innerHTML = `<span class="status-dot status-dot-sm"></span><span>${escapeHtml(sourceLabel(data))}</span>`;

  if (els.sidebarSource) {
    els.sidebarSource.textContent =
      meta.provider ?? (archive ? 'Archivo histórico IberiaStats' : local ? 'Base local IberiaStats' : 'Proveedor externo');
  }

  if (els.sidebarSourceDot) {
    const color = archive ? '#38bdf8' : local ? '#fbbf24' : '#34d399';
    const glow = archive
      ? 'rgba(56,189,248,.12)'
      : local
        ? 'rgba(251,191,36,.12)'
        : 'rgba(52,211,153,.12)';
    els.sidebarSourceDot.style.background = color;
    els.sidebarSourceDot.style.boxShadow = `0 0 0 3px ${glow}, 0 0 9px ${color}`;
  }

  const updated = meta.fetchedAt ?? meta.updatedAt;
  if (els.lastUpdated) els.lastUpdated.textContent = formatUpdated(updated);
  if (els.sidebarUpdated) {
    const prefix = archive ? 'Archivo histórico' : local ? 'Última sincronización local' : 'Actualizado';
    els.sidebarUpdated.textContent = `${prefix} · ${formatUpdated(updated)}`;
  }
};

const renderShell = () => {
  const meta = currentSport();
  const data = state.data;

  els.welcome.classList.add('hidden');
  els.dashboard.classList.remove('hidden');
  els.dashboard.classList.remove('theme-futbol', 'theme-baloncesto', 'theme-balonmano');
  els.dashboard.classList.add(meta.theme);

  if (els.sidebarSportIcon) els.sidebarSportIcon.textContent = meta.icon;
  if (els.sidebarLeagueName) els.sidebarLeagueName.textContent = meta.league;
  if (els.sidebarSeason) els.sidebarSeason.textContent = state.season;
  if (els.sidebarTeamCount) els.sidebarTeamCount.textContent = `${data.standings.length} equipos`;
  if (els.breadcrumbLeague) els.breadcrumbLeague.textContent = meta.league;
  if (els.dashboardTitle) els.dashboardTitle.textContent = VIEWS[state.view]?.label ?? 'Resumen';

  document.title = `${meta.league} ${state.season} · IberiaStats`;
  updateSourceUI(data);
  renderNavigation();
};

const renderDashboard = () => {
  if (!state.data) return;
  closeMatchModal({ restoreFocus: false });
  renderShell();
  renderView();
};

const renderView = () => {
  if (!state.data) return;

  const renderers = {
    overview: renderOverview,
    standings: renderStandings,
    results: renderResults,
    leaders: renderLeaders
  };

  const renderer = renderers[state.view] ?? renderOverview;
  els.content.innerHTML = renderer(state.data);
  els.content.classList.remove('fade-up');
  void els.content.offsetWidth;
  els.content.classList.add('fade-up');

  if (els.dashboardTitle) {
    els.dashboardTitle.textContent = VIEWS[state.view]?.label ?? 'Resumen';
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

/* ========================================================================== */
/* 7. Renderizadores de vistas                                                */
/* ========================================================================== */

const championOf = (data) => data.standings?.[0] ?? null;

const roundsOf = (data) =>
  [...new Set((data.results ?? []).map((result) => result.round))]
    .filter((round) => Number.isFinite(Number(round)) && Number(round) > 0)
    .sort((a, b) => Number(a) - Number(b));

const sortResultsByDate = (results) =>
  [...(results ?? [])].sort((a, b) => {
    const dateA = new Date(a.date).getTime() || 0;
    const dateB = new Date(b.date).getTime() || 0;
    if (dateA !== dateB) return dateB - dateA;
    return Number(b.round) - Number(a.round);
  });

const primaryLeaders = (data, sport) => {
  if (sport === 'baloncesto') {
    return (data.leaders?.points ?? []).map((entry) => ({
      ...entry,
      goals: entry.avg,
      matches: entry.games
    }));
  }
  return data.scorers ?? [];
};

const primaryValue = (entry, sport) => {
  if (!entry) return 0;
  return sport === 'baloncesto' ? Number(entry.avg) || 0 : Number(entry.goals) || 0;
};

const recordLabel = (row, sport) => {
  if (sport === 'baloncesto') return `${row.won}-${row.lost}`;
  return `${row.won}V · ${row.drawn}E · ${row.lost}D`;
};

const standingMainValue = (row, sport) =>
  sport === 'baloncesto' ? row.won : row.points;

const standingMainLabel = (sport) =>
  sport === 'baloncesto' ? 'Victorias' : 'Puntos';

const formPills = (form = []) =>
  `<span class="form-pills">${form
    .slice(-5)
    .map((result) => {
      const label = result === 'W' ? 'V' : result === 'D' ? 'E' : 'D';
      return `<span class="form-pill form-${escapeHtml(result)}">${label}</span>`;
    })
    .join('')}</span>`;

const zoneClass = (position, sport, total = 0) => {
  if (!total) return '';

  if (sport === 'futbol') {
    if (position <= 4) return 'zone-champions';
    if (position <= 6) return 'zone-europa';
    if (position > total - 3) return 'zone-relegation';
    return '';
  }
  if (sport === 'baloncesto') {
    if (position <= Math.min(8, total)) return 'zone-playoffs';
    if (total >= 16 && position > total - 2) return 'zone-relegation';
    return '';
  }
  if (position === 1) return 'zone-champions';
  if (position <= Math.min(5, total)) return 'zone-europa';
  if (position > total - 2) return 'zone-relegation';
  return '';
};

const legendForSport = (sport) => {
  if (sport === 'futbol') {
    return [
      { color: '#22c55e', label: 'Champions League' },
      { color: '#38bdf8', label: 'Europa / Conference' },
      { color: '#f43f5e', label: 'Descenso' }
    ];
  }
  if (sport === 'baloncesto') {
    return [
      { color: '#f97316', label: 'Playoffs' },
      { color: '#f43f5e', label: 'Descenso' }
    ];
  }
  return [
    { color: '#38bdf8', label: 'Champions League' },
    { color: '#818cf8', label: 'Competición europea' },
    { color: '#f43f5e', label: 'Descenso' }
  ];
};

const metricCard = ({ iconName, label, value, foot }) => `
  <article class="metric-card">
    <span class="metric-icon">${icon(iconName, 'h-4 w-4')}</span>
    <p class="metric-label">${escapeHtml(label)}</p>
    <p class="metric-value" title="${escapeHtml(value)}">${escapeHtml(value)}</p>
    <p class="metric-foot" title="${escapeHtml(foot)}">${escapeHtml(foot)}</p>
  </article>`;

const matchKey = (match) =>
  [match.id ?? '', match.round, match.date, match.home, match.away].join('|');

const matchCard = (match) => {
  const homeWins = Number(match.homeScore) > Number(match.awayScore);
  const awayWins = Number(match.awayScore) > Number(match.homeScore);
  const key = matchKey(match);

  return `
    <article
      class="match-card match-card-clickable"
      data-match-key="${escapeHtml(key)}"
      role="button"
      tabindex="0"
      aria-haspopup="dialog"
      aria-label="Ver detalles del partido ${escapeHtml(match.home)} contra ${escapeHtml(match.away)}"
    >
      <p class="match-date">${escapeHtml(formatDate(match.date))}</p>
      <div class="match-row">
        <div class="match-team home ${homeWins ? 'is-winner' : ''}">
          <span class="match-team-name">${escapeHtml(match.home)}</span>
          ${teamBadge(match.home, 'team-badge-sm')}
        </div>
        <span class="match-score">
          <span>${number(match.homeScore)}</span>
          <span class="sep">-</span>
          <span>${number(match.awayScore)}</span>
        </span>
        <div class="match-team away ${awayWins ? 'is-winner' : ''}">
          ${teamBadge(match.away, 'team-badge-sm')}
          <span class="match-team-name">${escapeHtml(match.away)}</span>
        </div>
      </div>
      <span class="match-open-hint">${icon('arrow', 'h-2 w-2')} Ver detalle</span>
    </article>`;
};

const renderOverview = (data) => {
  const sport = state.sport;
  const meta = SPORTS[sport];
  const champion = championOf(data);
  const leaders = primaryLeaders(data, sport);
  const topScorer = leaders[0];
  const rounds = roundsOf(data).length;
  const sortedByAttack = [...data.standings].sort(
    (a, b) =>
      Number(b.goalsFor ?? b.pointsFor ?? 0) -
      Number(a.goalsFor ?? a.pointsFor ?? 0)
  );
  const sortedByDefense = [...data.standings].sort(
    (a, b) =>
      Number(a.goalsAgainst ?? a.pointsAgainst ?? 0) -
      Number(b.goalsAgainst ?? b.pointsAgainst ?? 0)
  );
  const bestAttack = sortedByAttack[0];
  const bestDefense = sortedByDefense[0];
  const bestValuation = data.leaders?.valuation?.[0];
  const bestGoalkeeper = data.goalkeepers?.[0];

  let metrics;

  if (sport === 'baloncesto') {
    metrics = [
      {
        iconName: 'trophy',
        label: 'Líder fase regular',
        value: champion?.team ?? '—',
        foot: champion ? `${champion.won}-${champion.lost} · ${percent(champion.winPct)} victorias` : ''
      },
      {
        iconName: 'flame',
        label: 'Máximo anotador',
        value: topScorer?.player ?? '—',
        foot: topScorer ? `${decimal(topScorer.avg)} pts/partido · ${topScorer.team}` : ''
      },
      {
        iconName: 'chart',
        label: 'Mejor valoración',
        value: bestValuation?.player ?? '—',
        foot: bestValuation ? `${decimal(bestValuation.avg)} de valoración media` : ''
      },
      {
        iconName: 'target',
        label: 'Mejor ataque',
        value: bestAttack?.team ?? '—',
        foot: bestAttack ? `${number(bestAttack.pointsFor)} puntos anotados` : ''
      }
    ];
  } else if (sport === 'balonmano') {
    metrics = [
      {
        iconName: 'trophy',
        label: 'Campeón',
        value: champion?.team ?? '—',
        foot: champion ? `${number(champion.points)} puntos · ${champion.won} victorias` : ''
      },
      {
        iconName: 'flame',
        label: 'Máximo goleador',
        value: topScorer?.player ?? '—',
        foot: topScorer ? `${number(topScorer.goals)} goles · ${topScorer.team}` : ''
      },
      {
        iconName: 'shield',
        label: 'Mejor defensa',
        value: bestDefense?.team ?? '—',
        foot: bestDefense ? `${number(bestDefense.goalsAgainst)} goles encajados` : ''
      },
      {
        iconName: 'whistle',
        label: 'Mejor portero',
        value: bestGoalkeeper?.player ?? '—',
        foot: bestGoalkeeper ? `${number(bestGoalkeeper.saves)} paradas · ${decimal(bestGoalkeeper.savePct)}%` : ''
      }
    ];
  } else {
    metrics = [
      {
        iconName: 'trophy',
        label: 'Campeón',
        value: champion?.team ?? '—',
        foot: champion ? `${number(champion.points)} puntos · ${champion.won} victorias` : ''
      },
      {
        iconName: 'flame',
        label: 'Máximo goleador',
        value: topScorer?.player ?? '—',
        foot: topScorer ? `${number(topScorer.goals)} goles · ${topScorer.team}` : ''
      },
      {
        iconName: 'target',
        label: 'Mejor ataque',
        value: bestAttack?.team ?? '—',
        foot: bestAttack ? `${number(bestAttack.goalsFor)} goles a favor` : ''
      },
      {
        iconName: 'shield',
        label: 'Mejor defensa',
        value: bestDefense?.team ?? '—',
        foot: bestDefense ? `${number(bestDefense.goalsAgainst)} goles encajados` : ''
      }
    ];
  }

  const championLabel = sport === 'baloncesto' ? 'Líder fase regular' : 'Campeón';
  const championStats = champion
    ? sport === 'baloncesto'
      ? [
          { value: number(champion.won), label: 'Victorias' },
          { value: number(champion.pointsFor), label: 'Puntos' },
          { value: signed(champion.diff), label: 'Diferencia' }
        ]
      : [
          { value: number(champion.points), label: 'Puntos' },
          { value: number(champion.goalsFor), label: 'Goles a favor' },
          { value: signed(champion.diff), label: 'Diferencia' }
        ]
    : [];

  const topFive = data.standings.slice(0, 5);
  const leaderMax = primaryValue(leaders[0], sport) || 1;

  return `
    <div class="space-y-5">
      <section class="hero-panel fade-up">
        <div class="hero-panel-grid">
          <div>
            <div class="eyebrow-row">
              <span class="eyebrow"><span class="h-1.5 w-1.5 rounded-full" style="background:var(--accent)"></span>${escapeHtml(meta.league)}</span>
              <span class="eyebrow-plain">Temporada ${escapeHtml(state.season)}</span>
            </div>
            <h2 class="hero-title">${escapeHtml(meta.label)} · ${escapeHtml(state.season)}</h2>
            <p class="hero-copy">${escapeHtml(data.meta.description ?? meta.description)}</p>
            <div class="hero-chips">
              <span class="hero-chip">${icon('users', 'h-3 w-3')}${data.standings.length} equipos</span>
              <span class="hero-chip">${icon('calendar', 'h-3 w-3')}${rounds} jornadas</span>
              <span class="hero-chip">${icon('database', 'h-3 w-3')}${escapeHtml(data.meta.provider ?? meta.provider)}</span>
              <span class="hero-chip">${icon('clock', 'h-3 w-3')}${escapeHtml(formatUpdated(data.meta.fetchedAt ?? data.meta.updatedAt))}</span>
            </div>
          </div>

          <div class="champion-card">
            <p class="champion-label">${escapeHtml(championLabel)}</p>
            <div class="champion-badge">${champion ? teamBadge(champion.team, 'team-badge-lg') : ''}</div>
            <p class="champion-team">${escapeHtml(champion?.team ?? 'Sin datos')}</p>
            <p class="champion-meta">${champion ? `${recordLabel(champion, sport)} · ${champion.played} partidos` : ''}</p>
            <div class="champion-stats">
              ${championStats
                .map(
                  (item) => `
                  <div>
                    <p class="champion-stat-value">${escapeHtml(item.value)}</p>
                    <p class="champion-stat-label">${escapeHtml(item.label)}</p>
                  </div>`
                )
                .join('')}
            </div>
          </div>
        </div>
      </section>

      <div class="metric-grid fade-up" style="animation-delay:50ms">
        ${metrics.map(metricCard).join('')}
      </div>

      <div class="grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
        <section class="panel fade-up" style="animation-delay:100ms">
          <header class="panel-header">
            <div>
              <p class="panel-title">Clasificación general</p>
              <p class="panel-subtitle">Top 5 · ${escapeHtml(meta.league)} ${escapeHtml(state.season)}</p>
            </div>
            <button type="button" class="panel-link" data-view="standings">Ver tabla ${icon('arrow', 'h-2.5 w-2.5')}</button>
          </header>
          <div class="leader-list mt-2">
            ${topFive
              .map(
                (row, index) => `
                <div class="leader-item">
                  <span class="leader-rank ${index === 0 ? 'is-top' : ''}">${String(index + 1).padStart(2, '0')}</span>
                  ${teamBadge(row.team)}
                  <div class="leader-info">
                    <p class="leader-name">${escapeHtml(row.team)}</p>
                    <p class="leader-team">${escapeHtml(recordLabel(row, sport))} · ${row.played} PJ</p>
                  </div>
                  <div class="leader-value">${number(standingMainValue(row, sport))}<small>${standingMainLabel(sport)}</small></div>
                </div>`
              )
              .join('')}
          </div>
        </section>

        <section class="panel fade-up" style="animation-delay:140ms">
          <header class="panel-header">
            <div>
              <p class="panel-title">${escapeHtml(meta.leaderLabel)}</p>
              <p class="panel-subtitle">${sport === 'baloncesto' ? 'Media por partido' : 'Líderes de la temporada'}</p>
            </div>
            <button type="button" class="panel-link" data-view="leaders">Detalle ${icon('arrow', 'h-2.5 w-2.5')}</button>
          </header>
          <div class="leader-list mt-2">
            ${leaders
              .slice(0, 5)
              .map((entry, index) => {
                const value = primaryValue(entry, sport);
                const width = Math.max(8, (value / leaderMax) * 100);
                return `
                  <div class="leader-item">
                    <span class="leader-rank ${index === 0 ? 'is-top' : ''}">${String(index + 1).padStart(2, '0')}</span>
                    ${teamBadge(entry.team)}
                    <div class="leader-info">
                      <p class="leader-name">${escapeHtml(entry.player)}</p>
                      <p class="leader-team">${escapeHtml(entry.team)}</p>
                      <span class="leader-bar"><span class="leader-bar-fill" style="width:${width.toFixed(1)}%"></span></span>
                    </div>
                    <div class="leader-value">${decimal(value, sport === 'baloncesto' ? 1 : 0)}<small>${sport === 'baloncesto' ? 'pts/p' : 'goles'}</small></div>
                  </div>`;
              })
              .join('')}
          </div>
        </section>
      </div>

      <div class="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section class="panel fade-up" style="animation-delay:180ms">
          <header class="panel-header">
            <div>
              <p class="panel-title">Últimos resultados</p>
              <p class="panel-subtitle">${data.results.length} partidos disponibles en el dataset</p>
            </div>
            <button type="button" class="panel-link" data-view="results">Todas las jornadas ${icon('arrow', 'h-2.5 w-2.5')}</button>
          </header>
          <div class="mt-3 grid gap-2 sm:grid-cols-2">
            ${sortResultsByDate(data.results)
              .slice(0, 4)
              .map(matchCard)
              .join('')}
          </div>
        </section>

        <section class="panel fade-up" style="animation-delay:220ms">
          <header class="panel-header">
            <div>
              <p class="panel-title">Trazabilidad de datos</p>
              <p class="panel-subtitle">Origen, cobertura y estado del conector</p>
            </div>
            <span class="source-badge ${sourceColor(data)}">
              <span class="status-dot status-dot-sm"></span>
              ${data.meta.source === 'archive' ? 'Archivo' : data.meta.source === 'local' ? 'Local' : 'API'}
            </span>
          </header>

          <div class="mt-3 space-y-3">
            ${
              data.meta.source === 'archive'
                ? `<div class="notice notice-success">${icon('database', 'h-4 w-4 shrink-0')}<span>Datos históricos servidos desde el archivo de IberiaStats. La clasificación y los resultados se han validado al importar la temporada.</span></div>`
                : data.meta.source === 'local'
                  ? `<div class="notice">${icon('alert', 'h-4 w-4 shrink-0')}<span>${escapeHtml(
                      data.meta.fallbackReason
                        ? `Usando datos locales: ${data.meta.fallbackReason}`
                        : 'El proveedor externo no está disponible. Se muestra el dataset local de respaldo.'
                    )}</span></div>`
                  : `<div class="notice notice-success">${icon('shield', 'h-4 w-4 shrink-0')}<span>Respuesta recibida desde el backend. Esquema normalizado y validado.</span></div>`
            }

            <div class="source-list">
              <div class="source-row"><span class="source-key">Proveedor</span><span class="source-value">${escapeHtml(data.meta.provider ?? '—')}</span></div>
              ${
                data.meta.standingsSource
                  ? `<div class="source-row"><span class="source-key">Clasificación</span><span class="source-value">${escapeHtml(data.meta.standingsSource)}</span></div>`
                  : ''
              }
              ${
                data.meta.champion
                  ? `<div class="source-row"><span class="source-key">Campeón</span><span class="source-value">${escapeHtml(data.meta.champion)}</span></div>`
                  : ''
              }
              <div class="source-row"><span class="source-key">Cobertura</span><span class="source-value">${data.standings.length} equipos · ${rounds} jornadas</span></div>
              <div class="source-row"><span class="source-key">Actualización</span><span class="source-value">${escapeHtml(formatUpdated(data.meta.fetchedAt ?? data.meta.updatedAt))}</span></div>
              <div class="source-row"><span class="source-key">Caché local</span><span class="source-value">${data.meta.cacheTtlMs ? `${Math.round(data.meta.cacheTtlMs / 3600000)} h` : '6 h'}</span></div>
              <div class="source-row"><span class="source-key">Esquema</span><span class="source-value font-mono text-[10px]">JSON normalizado v1</span></div>
            </div>

            <button type="button" class="sidebar-action mt-1" data-action="home">
              ${icon('refresh', 'h-4 w-4')}
              Cambiar deporte o temporada
            </button>
          </div>
        </section>
      </div>
    </div>`;
};

const renderStandings = (data) => {
  const sport = state.sport;
  const meta = SPORTS[sport];
  const standings = data.standings ?? [];
  const legend = legendForSport(sport);
  const matchdays =
    data.meta?.regularRounds ?? new Set((data.results ?? []).map((result) => result.round)).size;

  const footballHeader = `
    <th class="text-left">#</th>
    <th class="text-left">Equipo</th>
    <th>PJ</th><th>V</th><th>E</th><th>D</th>
    <th>GF</th><th>GC</th><th>DG</th><th>Pts</th><th>Forma</th>`;

  const basketballHeader = `
    <th class="text-left">#</th>
    <th class="text-left">Equipo</th>
    <th>PJ</th><th>V</th><th>D</th>
    <th>PF</th><th>PC</th><th>DIF</th><th>%V</th><th>Racha</th>`;

  const handballHeader = `
    <th class="text-left">#</th>
    <th class="text-left">Equipo</th>
    <th>PJ</th><th>V</th><th>E</th><th>D</th>
    <th>GF</th><th>GC</th><th>DG</th><th>Pts</th><th>Forma</th>`;

  const header =
    sport === 'baloncesto' ? basketballHeader : sport === 'balonmano' ? handballHeader : footballHeader;

  const rows = standings
    .map((row) => {
      const zone = zoneClass(row.pos, sport, standings.length);
      const commonStart = `
        <tr class="${zone}">
          <td class="pos-cell"><span class="pos-badge">${row.pos}</span></td>
          <td class="text-left"><div class="team-cell">${teamBadge(row.team)}<span class="team-name">${escapeHtml(row.team)}</span></div></td>
          <td class="num-muted">${row.played}</td>
          <td class="num-strong">${row.won}</td>`;

      if (sport === 'baloncesto') {
        return `${commonStart}
          <td class="num-muted">${row.lost}</td>
          <td>${number(row.pointsFor)}</td>
          <td>${number(row.pointsAgainst)}</td>
          <td class="${row.diff >= 0 ? 'num-positive' : 'num-negative'}">${signed(row.diff)}</td>
          <td>${percent(row.winPct)}</td>
          <td><span class="num-strong">${escapeHtml(row.streak ?? '—')}</span></td>
        </tr>`;
      }

      return `${commonStart}
        <td class="num-muted">${row.drawn}</td>
        <td class="num-muted">${row.lost}</td>
        <td>${number(row.goalsFor)}</td>
        <td>${number(row.goalsAgainst)}</td>
        <td class="${row.diff >= 0 ? 'num-positive' : 'num-negative'}">${signed(row.diff)}</td>
        <td class="num-strong text-[0.8rem] text-white">${number(row.points)}</td>
        <td>${formPills(row.form)}</td>
      </tr>`;
    })
    .join('');

  return `
    <div class="space-y-5">
      <section class="panel fade-up">
        <header class="panel-header flex-col gap-3 sm:flex-row sm:items-center">
          <div>
            <p class="panel-title">Clasificación ${escapeHtml(meta.league)} · ${escapeHtml(state.season)}</p>
            <p class="panel-subtitle">${standings.length} equipos · ${matchdays} jornadas · ${sport === 'baloncesto' ? 'fase regular' : 'temporada completa'}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="source-badge ${sourceColor(data)}"><span class="status-dot status-dot-sm"></span>${escapeHtml(sourceLabel(data))}</span>
            <span class="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] text-slate-400">${matchdays} PJ</span>
          </div>
        </header>

        <div class="mt-3 table-scroll">
          <table class="stats-table">
            <thead><tr>${header}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>

        <div class="legend-row">
          ${legend
            .map(
              (item) => `<span class="legend-item"><span class="legend-swatch" style="background:${item.color}"></span>${escapeHtml(item.label)}</span>`
            )
            .join('')}
          <span class="legend-item ml-auto text-slate-600">Datos actualizados: ${escapeHtml(formatUpdated(data.meta.fetchedAt ?? data.meta.updatedAt))}</span>
        </div>
      </section>

      ${
        sport === 'futbol'
          ? `<section class="panel fade-up" style="animation-delay:80ms">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p class="panel-title">Estadísticas avanzadas de equipo</p>
                  <p class="panel-subtitle">Posesión, tiros, xG y disciplina · análisis de los 20 equipos</p>
                </div>
                <button type="button" class="panel-link" data-view="leaders">Abrir estadísticas ${icon('arrow', 'h-2.5 w-2.5')}</button>
              </div>
            </section>`
          : ''
      }
    </div>`;
};

/* ========================================================================== */
/* 7.1. Resultados por jornada                                                */
/* ========================================================================== */

const renderResults = (data) => {
  const sport = state.sport;
  const meta = SPORTS[sport];
  const results = data.results ?? [];
  const rounds = roundsOf(data);
  const total = results.length;
  const totalScore = results.reduce(
    (sum, match) => sum + Number(match.homeScore ?? 0) + Number(match.awayScore ?? 0),
    0
  );
  const homeWins = results.filter((match) => Number(match.homeScore) > Number(match.awayScore)).length;
  const draws = results.filter((match) => Number(match.homeScore) === Number(match.awayScore)).length;
  const average = total ? totalScore / total : 0;
  const scoreUnit = sport === 'futbol' ? 'goles' : sport === 'baloncesto' ? 'puntos' : 'goles';

  const groups = new Map();
  results.forEach((match) => {
    const round = Number(match.round) || 0;
    if (!groups.has(round)) groups.set(round, []);
    groups.get(round).push(match);
  });

  const orderedRounds = [...groups.keys()].sort((a, b) => b - a);

  const roundDateRange = (matches) => {
    const dates = matches
      .map((match) => new Date(match.date).getTime())
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    if (!dates.length) return 'Fecha por confirmar';
    const first = formatDate(new Date(dates[0]).toISOString());
    const last = formatDate(new Date(dates[dates.length - 1]).toISOString());
    return first === last ? first : `${first} — ${last}`;
  };

  const metrics = [
    {
      iconName: 'calendar',
      label: 'Partidos',
      value: number(total),
      foot: `${rounds.length} jornadas con datos`
    },
    {
      iconName: 'chart',
      label: `Media de ${scoreUnit}`,
      value: decimal(average, 1),
      foot: `Por partido · ${sport === 'baloncesto' ? 'anotación total' : 'goles totales'}`
    },
    {
      iconName: 'trophy',
      label: 'Victorias locales',
      value: total ? percent(homeWins / total) : '0%',
      foot: `${homeWins} partidos ganados en casa`
    },
    {
      iconName: 'users',
      label: 'Empates',
      value: number(draws),
      foot: sport === 'baloncesto' ? 'No existen empates en ACB' : `${total ? percent(draws / total) : '0%'} de los partidos`
    }
  ];

  const empty = `
    <section class="panel">
      <div class="empty-state">
        <span class="empty-state-icon">${icon('calendar', 'h-6 w-6')}</span>
        <p class="mt-4 text-sm font-semibold text-slate-200">No hay resultados disponibles</p>
        <p class="mt-1 text-xs text-slate-500">Prueba con otra temporada o conecta el proveedor externo.</p>
      </div>
    </section>`;

  return `
    <div class="space-y-5">
      <section class="panel fade-up">
        <header class="panel-header flex-col gap-3 sm:flex-row sm:items-center">
          <div>
            <p class="panel-title">Resultados por jornada</p>
            <p class="panel-subtitle">${escapeHtml(meta.league)} ${escapeHtml(state.season)} · ${rounds.length} jornadas disponibles</p>
          </div>
          <span class="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] text-slate-400">
            ${total} partidos
          </span>
        </header>
        <div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          ${metrics.map(metricCard).join('')}
        </div>
        ${
          data.meta.source === 'local'
            ? `<div class="notice notice-info mt-4">${icon('database', 'h-4 w-4 shrink-0')}<span>Mostrando la muestra de jornadas integrada en el dataset local. Al conectar el backend se sirve el calendario completo del proveedor.</span></div>`
            : ''
        }
      </section>

      ${
        sport === 'baloncesto'
          ? `<div class="notice notice-info">${icon('calendar', 'h-4 w-4 shrink-0')}<span>Las jornadas de fase final (playoffs y eliminatorias) pueden tener menos partidos porque las series terminan antes de agotar todos los encuentros. No son partidos faltantes.</span></div>`
          : ''
      }

      ${
        orderedRounds.length
          ? orderedRounds
              .map((round) => {
                const matches = groups.get(round).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
                const phaseLabel = matches.find((match) => match.phase)?.phase ?? null;
                const isPlayoff = matches.some((match) => match.stage === 'playoff');
                return `
                  <section class="panel fade-up" id="jornada-${round}">
                    <header class="panel-header">
                      <div>
                        <p class="panel-title">Jornada ${round === 0 ? '—' : round}${isPlayoff ? ' · Fase final' : ''}</p>
                        <p class="panel-subtitle">${phaseLabel ? `${escapeHtml(phaseLabel)} · ` : ''}${escapeHtml(roundDateRange(matches))} · ${matches.length} partidos</p>
                      </div>
                      <span class="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                        ${matches.length} resultados
                      </span>
                    </header>
                    <div class="match-grid mt-3">
                      ${matches.map(matchCard).join('')}
                    </div>
                  </section>`;
              })
              .join('')
          : empty
      }
    </div>`;
};

/* ========================================================================== */
/* 7.2. Estadísticas y líderes                                                */
/* ========================================================================== */

const personBadge = (name) => {
  const hue = teamHue(name);
  return `<span class="team-badge team-badge-sm" style="--badge-hue:${hue}">${escapeHtml(initials(name))}</span>`;
};

const scoringSpotlight = ({ kicker, entry, value, unit, stats = [] }) => {
  if (!entry) return '';

  return `
    <section class="hero-panel fade-up">
      <div class="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div class="min-w-0">
          <div class="eyebrow-row">
            <span class="eyebrow">${escapeHtml(kicker)}</span>
            <span class="eyebrow-plain">${escapeHtml(state.season)}</span>
          </div>
          <div class="mt-4 flex items-center gap-3">
            ${teamBadge(entry.team, 'team-badge-lg')}
            <div class="min-w-0">
              <h2 class="hero-title">${escapeHtml(entry.player)}</h2>
              <p class="hero-copy !mt-1">${escapeHtml(entry.team)}</p>
            </div>
          </div>
          <div class="mt-4 flex items-baseline gap-2">
            <span class="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">${escapeHtml(value)}</span>
            <span class="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">${escapeHtml(unit)}</span>
          </div>
          <div class="hero-chips">
            ${stats
              .map(
                (item) => `<span class="hero-chip"><span class="text-slate-500">${escapeHtml(item.label)}</span><span class="font-semibold text-slate-200">${escapeHtml(item.value)}</span></span>`
              )
              .join('')}
          </div>
        </div>

        <div class="champion-card md:min-w-[190px]">
          <p class="champion-label">Ranking</p>
          <p class="mt-2 font-display text-5xl font-bold tracking-tight text-white">#1</p>
          <p class="champion-meta">${escapeHtml(currentSport().league)} · ${escapeHtml(state.season)}</p>
          <div class="mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-500">
            ${icon('trophy', 'h-3.5 w-3.5')}
            Líder estadístico
          </div>
        </div>
      </div>
    </section>`;
};

const leaderCardMarkup = ({ title, subtitle, entries, valueKey = 'avg', unit = 'pts', decimals = 1 }) => {
  const rows = entries ?? [];
  const max = rows.length ? Math.max(...rows.map((entry) => Number(entry[valueKey]) || 0), 1) : 1;

  return `
    <article class="leader-card">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="leader-card-title">${escapeHtml(title)}</p>
          <p class="leader-card-subtitle">${escapeHtml(subtitle)}</p>
        </div>
        <span class="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-slate-500">${escapeHtml(unit)}</span>
      </div>
      <div class="leader-list mt-2">
        ${
          rows.length
            ? rows
                .slice(0, 5)
                .map((entry, index) => {
                  const value = Number(entry[valueKey]) || 0;
                  const width = Math.max(7, (value / max) * 100);
                  return `
                    <div class="leader-item">
                      <span class="leader-rank ${index === 0 ? 'is-top' : ''}">${String(index + 1).padStart(2, '0')}</span>
                      ${teamBadge(entry.team)}
                      <div class="leader-info">
                        <p class="leader-name">${escapeHtml(entry.player)}</p>
                        <p class="leader-team">${escapeHtml(entry.team)}</p>
                        <span class="leader-bar"><span class="leader-bar-fill" style="width:${width.toFixed(1)}%"></span></span>
                      </div>
                      <div class="leader-value">${decimal(value, decimals)}<small>${escapeHtml(unit)}</small></div>
                    </div>`;
                })
                .join('')
            : `<p class="py-5 text-center text-xs text-slate-600">Sin datos disponibles</p>`
        }
      </div>
    </article>`;
};

const footballScorersTable = (data) => {
  const scorers = data.scorers ?? [];
  const max = Math.max(...scorers.map((entry) => Number(entry.goals) || 0), 1);

  return `
    <section class="panel fade-up" style="animation-delay:80ms">
      <header class="panel-header">
        <div>
          <p class="panel-title">Tabla de goleadores</p>
          <p class="panel-subtitle">Top ${Math.min(10, scorers.length)} · goles, asistencias y penaltis</p>
        </div>
        <span class="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] text-slate-400">Pichichi</span>
      </header>
      <div class="mt-3 table-scroll">
        <table class="stats-table" style="min-width:760px">
          <thead>
            <tr>
              <th class="text-left">#</th>
              <th class="text-left">Jugador</th>
              <th>Equipo</th>
              <th>PJ</th>
              <th>Goles</th>
              <th>Asist.</th>
              <th>Penaltis</th>
              <th>G/P</th>
              <th>Peso</th>
            </tr>
          </thead>
          <tbody>
            ${scorers
              .slice(0, 10)
              .map((entry, index) => {
                const perMatch = entry.matches ? (Number(entry.goals) / Number(entry.matches)).toFixed(2) : '0.00';
                return `
                  <tr>
                    <td class="pos-cell"><span class="pos-badge">${String(index + 1).padStart(2, '0')}</span></td>
                    <td class="text-left">
                      <div class="team-cell">
                        ${personBadge(entry.player)}
                        <span class="team-name">${escapeHtml(entry.player)}</span>
                      </div>
                    </td>
                    <td class="num-muted">${escapeHtml(entry.team)}</td>
                    <td>${number(entry.matches)}</td>
                    <td class="num-strong text-[0.82rem] text-white">${number(entry.goals)}</td>
                    <td>${number(entry.assists)}</td>
                    <td>${number(entry.penalties)}</td>
                    <td>${escapeHtml(perMatch)}</td>
                    <td>
                      <span class="leader-bar inline-block w-16 align-middle"><span class="leader-bar-fill" style="width:${Math.max(6, (Number(entry.goals) / max) * 100).toFixed(1)}%"></span></span>
                    </td>
                  </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </section>`;
};

const footballTeamStatsTable = (data) => {
  const stats = [...(data.teamStats ?? [])].sort((a, b) => Number(b.possession) - Number(a.possession));

  return `
    <section class="panel fade-up" style="animation-delay:120ms">
      <header class="panel-header flex-col gap-2 sm:flex-row sm:items-center">
        <div>
          <p class="panel-title">Estadísticas de equipos</p>
          <p class="panel-subtitle">Posesión, tiros, xG, córners y disciplina · ordenado por posesión</p>
        </div>
        <span class="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] text-slate-400">${stats.length} equipos</span>
      </header>
      <div class="mt-3 table-scroll">
        <table class="stats-table" style="min-width:860px">
          <thead>
            <tr>
              <th class="text-left">Equipo</th>
              <th>Posesión</th>
              <th>Tiros/P</th>
              <th>A puerta</th>
              <th>Córners/P</th>
              <th>xG/P</th>
              <th>Amarillas</th>
              <th>Rojas</th>
              <th>Porterías 0</th>
            </tr>
          </thead>
          <tbody>
            ${stats
              .map(
                (entry) => `
                <tr>
                  <td class="text-left"><div class="team-cell">${teamBadge(entry.team)}<span class="team-name">${escapeHtml(entry.team)}</span></div></td>
                  <td><span class="num-strong text-[0.8rem] text-white">${decimal(entry.possession)}%</span></td>
                  <td>${decimal(entry.shots)}</td>
                  <td>${decimal(entry.shotsOnTarget)}</td>
                  <td>${decimal(entry.corners)}</td>
                  <td>${decimal(entry.xg, 2)}</td>
                  <td>${number(entry.yellowCards)}</td>
                  <td>${number(entry.redCards)}</td>
                  <td>${number(entry.cleanSheets)}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
      <p class="mt-3 text-[10px] leading-relaxed text-slate-600">
        Posesión, tiros y xG son métricas estimadas de la temporada. Las tarjetas y porterías a cero proceden del consolidado local.
      </p>
    </section>`;
};

const renderFootballLeaders = (data) => {
  const scorers = data.scorers ?? [];
  const top = scorers[0];
  const assists = [...scorers].sort((a, b) => Number(b.assists) - Number(a.assists));

  return `
    <div class="space-y-5">
      ${
        top
          ? scoringSpotlight({
              kicker: 'Pichichi · Goleadores',
              entry: top,
              value: number(top.goals),
              unit: 'goles',
              stats: [
                { label: 'Partidos', value: number(top.matches) },
                { label: 'Asistencias', value: number(top.assists) },
                { label: 'Penaltis', value: number(top.penalties) },
                { label: 'Goles/partido', value: decimal(top.matches ? top.goals / top.matches : 0, 2) }
              ]
            })
          : ''
      }

      <div class="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        ${footballScorersTable(data)}
        ${leaderCardMarkup({
          title: 'Máximos asistentes',
          subtitle: 'Asistencias totales en la temporada',
          entries: assists,
          valueKey: 'assists',
          unit: 'asist.',
          decimals: 0
        })}
      </div>

      ${footballTeamStatsTable(data)}
    </div>`;
};

const basketballScorersTable = (data) => {
  const entries = data.leaders?.points ?? [];
  const max = Math.max(...entries.map((entry) => Number(entry.avg) || 0), 1);

  return `
    <section class="panel fade-up" style="animation-delay:80ms">
      <header class="panel-header">
        <div>
          <p class="panel-title">Tabla de anotadores</p>
          <p class="panel-subtitle">Top ${Math.min(10, entries.length)} · puntos totales y media por partido</p>
        </div>
        <span class="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] text-slate-400">Anotadores</span>
      </header>
      <div class="mt-3 table-scroll">
        <table class="stats-table" style="min-width:720px">
          <thead>
            <tr>
              <th class="text-left">#</th>
              <th class="text-left">Jugador</th>
              <th>Equipo</th>
              <th>PJ</th>
              <th>Puntos</th>
              <th>Media</th>
              <th>Peso</th>
            </tr>
          </thead>
          <tbody>
            ${entries
              .slice(0, 10)
              .map(
                (entry, index) => `
                <tr>
                  <td class="pos-cell"><span class="pos-badge">${String(index + 1).padStart(2, '0')}</span></td>
                  <td class="text-left"><div class="team-cell">${personBadge(entry.player)}<span class="team-name">${escapeHtml(entry.player)}</span></div></td>
                  <td class="num-muted">${escapeHtml(entry.team)}</td>
                  <td>${number(entry.games)}</td>
                  <td class="num-strong text-[0.82rem] text-white">${number(entry.total)}</td>
                  <td>${decimal(entry.avg)}</td>
                  <td>
                    <span class="leader-bar inline-block w-20 align-middle"><span class="leader-bar-fill" style="width:${Math.max(6, (Number(entry.avg) / max) * 100).toFixed(1)}%"></span></span>
                  </td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>`;
};

const basketballTeamStatsTable = (data) => {
  const rows = [...(data.standings ?? [])].sort(
    (a, b) => Number(a.pos ?? a.position ?? 0) - Number(b.pos ?? b.position ?? 0)
  );

  return `
    <section class="panel fade-up" style="animation-delay:120ms">
      <header class="panel-header flex-col gap-2 sm:flex-row sm:items-center">
        <div>
          <p class="panel-title">Estadísticas de equipos</p>
          <p class="panel-subtitle">Puntos, defensa y racha · fase regular${data.meta?.regularRounds ? ` · ${data.meta.regularRounds} jornadas` : ''}</p>
        </div>
        <span class="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] text-slate-400">${rows.length} equipos</span>
      </header>
      <div class="mt-3 table-scroll">
        <table class="stats-table" style="min-width:900px">
          <thead>
            <tr>
              <th class="text-left">#</th>
              <th class="text-left">Equipo</th>
              <th>PJ</th>
              <th>V</th>
              <th>D</th>
              <th>%V</th>
              <th>PF</th>
              <th>PC</th>
              <th>DIF</th>
              <th>PPP</th>
              <th>PPC</th>
              <th>Forma</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row) => {
                const played = Number(row.played) || 0;
                const pointsFor = Number(row.pointsFor ?? row.goalsFor) || 0;
                const pointsAgainst = Number(row.pointsAgainst ?? row.goalsAgainst) || 0;
                const ppg = played ? pointsFor / played : 0;
                const ppc = played ? pointsAgainst / played : 0;
                const position = row.pos ?? row.position;
                return `
                  <tr>
                    <td class="pos-cell"><span class="pos-badge">${String(position).padStart(2, '0')}</span></td>
                    <td class="text-left"><div class="team-cell">${teamBadge(row.team)}<span class="team-name">${escapeHtml(row.team)}</span></div></td>
                    <td>${number(played)}</td>
                    <td>${number(row.won)}</td>
                    <td>${number(row.lost)}</td>
                    <td>${percent(row.winPct)}</td>
                    <td class="num-strong text-[0.8rem] text-white">${number(pointsFor)}</td>
                    <td>${number(pointsAgainst)}</td>
                    <td>${signed(row.diff)}</td>
                    <td>${decimal(ppg)}</td>
                    <td>${decimal(ppc)}</td>
                    <td>${formPills(row.form)}</td>
                  </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>
      <p class="mt-3 text-[10px] leading-relaxed text-slate-600">
        PPP = puntos anotados por partido · PPC = puntos recibidos por partido.
        ${data.meta?.standingsSource ? `Clasificación: ${escapeHtml(data.meta.standingsSource)}.` : ''}
      </p>
    </section>`;
};

const renderBasketballLeaders = (data) => {
  const points = data.leaders?.points ?? [];
  const top = points[0];
  const matchdays =
    data.meta?.regularRounds ?? new Set((data.results ?? []).map((result) => result.round)).size;
  const hasIndividual =
    Boolean(top) ||
    (data.scorers?.length ?? 0) > 0 ||
    Object.values(data.leaders ?? {}).some((rows) => Array.isArray(rows) && rows.length > 0);

  return `
    <div class="space-y-5">
      ${
        hasIndividual
          ? `
            ${
              top
                ? scoringSpotlight({
                    kicker: 'Máximo anotador ACB',
                    entry: top,
                    value: decimal(top.avg),
                    unit: 'puntos/partido',
                    stats: [
                      { label: 'Partidos', value: number(top.games) },
                      { label: 'Puntos totales', value: number(top.total) },
                      { label: 'Jornadas', value: number(matchdays) }
                    ]
                  })
                : ''
            }

            <div class="grid gap-4 lg:grid-cols-2">
              ${leaderCardMarkup({
                title: 'Puntos',
                subtitle: 'Media anotadora por partido',
                entries: data.leaders?.points,
                valueKey: 'avg',
                unit: 'pts',
                decimals: 1
              })}
              ${leaderCardMarkup({
                title: 'Valoración ACB',
                subtitle: 'Media de valoración por partido',
                entries: data.leaders?.valuation,
                valueKey: 'avg',
                unit: 'val',
                decimals: 1
              })}
              ${leaderCardMarkup({
                title: 'Rebotes',
                subtitle: 'Media de rebotes por partido',
                entries: data.leaders?.rebounds,
                valueKey: 'avg',
                unit: 'reb',
                decimals: 1
              })}
              ${leaderCardMarkup({
                title: 'Asistencias',
                subtitle: 'Media de asistencias por partido',
                entries: data.leaders?.assists,
                valueKey: 'avg',
                unit: 'asi',
                decimals: 1
              })}
            </div>

            ${points.length ? basketballScorersTable(data) : ''}
          `
          : `<div class="notice notice-info">${icon('database', 'h-4 w-4 shrink-0')}<span>Las estadísticas individuales de esta temporada histórica no están disponibles en la fuente gratuita. Se muestran las estadísticas de equipo calculadas desde la clasificación.</span></div>`
      }

      ${basketballTeamStatsTable(data)}
    </div>`;
};

const handballScorersTable = (data) => {
  const entries = data.scorers ?? [];
  const max = Math.max(...entries.map((entry) => Number(entry.goals) || 0), 1);

  return `
    <section class="panel fade-up" style="animation-delay:80ms">
      <header class="panel-header">
        <div>
          <p class="panel-title">Tabla de goleadores</p>
          <p class="panel-subtitle">Top ${Math.min(10, entries.length)} · goles, media y penaltis</p>
        </div>
        <span class="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] text-slate-400">Goleadores</span>
      </header>
      <div class="mt-3 table-scroll">
        <table class="stats-table" style="min-width:700px">
          <thead>
            <tr>
              <th class="text-left">#</th>
              <th class="text-left">Jugador</th>
              <th>Equipo</th>
              <th>PJ</th>
              <th>Goles</th>
              <th>Media</th>
              <th>Penaltis</th>
              <th>Peso</th>
            </tr>
          </thead>
          <tbody>
            ${entries
              .slice(0, 10)
              .map(
                (entry, index) => `
                <tr>
                  <td class="pos-cell"><span class="pos-badge">${String(index + 1).padStart(2, '0')}</span></td>
                  <td class="text-left"><div class="team-cell">${personBadge(entry.player)}<span class="team-name">${escapeHtml(entry.player)}</span></div></td>
                  <td class="num-muted">${escapeHtml(entry.team)}</td>
                  <td>${number(entry.matches)}</td>
                  <td class="num-strong text-[0.82rem] text-white">${number(entry.goals)}</td>
                  <td>${decimal(entry.avg)}</td>
                  <td>${number(entry.penalties)}</td>
                  <td>
                    <span class="leader-bar inline-block w-16 align-middle"><span class="leader-bar-fill" style="width:${Math.max(6, (Number(entry.goals) / max) * 100).toFixed(1)}%"></span></span>
                  </td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>`;
};

const goalkeepersTable = (data) => {
  const entries = data.goalkeepers ?? [];
  const max = Math.max(...entries.map((entry) => Number(entry.saves) || 0), 1);

  return `
    <section class="panel fade-up" style="animation-delay:120ms">
      <header class="panel-header">
        <div>
          <p class="panel-title">Paradas de porteros</p>
          <p class="panel-subtitle">Volumen de paradas y porcentaje de acierto</p>
        </div>
        <span class="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] text-slate-400">Porteros</span>
      </header>
      <div class="mt-3 table-scroll">
        <table class="stats-table" style="min-width:680px">
          <thead>
            <tr>
              <th class="text-left">#</th>
              <th class="text-left">Portero</th>
              <th>Equipo</th>
              <th>PJ</th>
              <th>Paradas</th>
              <th>% Acierto</th>
              <th>Peso</th>
            </tr>
          </thead>
          <tbody>
            ${entries
              .map(
                (entry, index) => `
                <tr>
                  <td class="pos-cell"><span class="pos-badge">${String(index + 1).padStart(2, '0')}</span></td>
                  <td class="text-left"><div class="team-cell">${personBadge(entry.player)}<span class="team-name">${escapeHtml(entry.player)}</span></div></td>
                  <td class="num-muted">${escapeHtml(entry.team)}</td>
                  <td>${number(entry.matches)}</td>
                  <td class="num-strong text-[0.82rem] text-white">${number(entry.saves)}</td>
                  <td>${decimal(entry.savePct)}%</td>
                  <td>
                    <span class="leader-bar inline-block w-16 align-middle"><span class="leader-bar-fill" style="width:${Math.max(6, (Number(entry.saves) / max) * 100).toFixed(1)}%"></span></span>
                  </td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>`;
};

const renderHandballLeaders = (data) => {
  const top = data.scorers?.[0];
  const topKeeper = data.goalkeepers?.[0];

  return `
    <div class="space-y-5">
      ${
        top
          ? scoringSpotlight({
              kicker: 'Máximo goleador ASOBAL',
              entry: top,
              value: number(top.goals),
              unit: 'goles',
              stats: [
                { label: 'Partidos', value: number(top.matches) },
                { label: 'Media', value: decimal(top.avg) },
                { label: 'Penaltis', value: number(top.penalties) }
              ]
            })
          : ''
      }

      <div class="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        ${handballScorersTable(data)}
        ${leaderCardMarkup({
          title: 'Mejores porteros',
          subtitle: 'Paradas totales en la liga',
          entries: data.goalkeepers,
          valueKey: 'saves',
          unit: 'paradas',
          decimals: 0
        })}
      </div>

      ${goalkeepersTable(data)}

      ${
        topKeeper
          ? `<section class="panel fade-up">
              <div class="flex items-start gap-3">
                <span class="metric-icon">${icon('whistle', 'h-4 w-4')}</span>
                <div>
                  <p class="panel-title">Dato destacado</p>
                  <p class="mt-1 text-xs leading-relaxed text-slate-400">
                    <span class="font-semibold text-white">${escapeHtml(topKeeper.player)}</span> (${escapeHtml(topKeeper.team)}) lideró las paradas con
                    <span class="font-mono text-brand-400">${number(topKeeper.saves)}</span> intervenciones y un
                    <span class="font-mono text-brand-400">${decimal(topKeeper.savePct)}%</span> de acierto.
                  </p>
                </div>
              </div>
            </section>`
          : ''
      }
    </div>`;
};

const renderLeadersUnavailable = () => `
  <section class="panel fade-up">
    <div class="empty-state">
      <span class="empty-state-icon">${icon('database', 'h-6 w-6')}</span>
      <h2 class="mt-4 font-display text-lg font-semibold text-white">Estadísticas individuales no disponibles</h2>
      <p class="mt-2 max-w-lg text-xs leading-relaxed text-slate-500">
        Esta temporada histórica incluye clasificación y resultados completos, pero la fuente gratuita no publica goleadores, valoraciones o paradas por jugador.
      </p>
      <button type="button" class="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-bold text-ink-950" data-view="standings">
        ${icon('table', 'h-4 w-4')}
        Ver clasificación
      </button>
    </div>
  </section>`;

const renderLeaders = (data) => {
  const hasStats =
    (data.scorers?.length ?? 0) > 0 ||
    (data.goalkeepers?.length ?? 0) > 0 ||
    (data.teamStats?.length ?? 0) > 0 ||
    Object.values(data.leaders ?? {}).some((rows) => Array.isArray(rows) && rows.length > 0);

  if (state.sport === 'baloncesto') return renderBasketballLeaders(data);
  if (!hasStats) return renderLeadersUnavailable();
  if (state.sport === 'balonmano') return renderHandballLeaders(data);
  return renderFootballLeaders(data);
};

const standingFor = (team) => {
  const rows = state.data?.standings ?? [];
  return (
    rows.find((row) => row.team === team) ??
    rows.find((row) => row.team.includes(team) || team.includes(row.team)) ??
    null
  );
};

const teamColorFor = (name, preferred) => {
  const color = preferred || standingFor(name)?.color;
  return /^#[0-9a-f]{6}$/i.test(String(color ?? ''))
    ? color
    : `hsl(${teamHue(name)} 62% 42%)`;
};

const formatMatchDateTime = (value) => {
  if (!value) return '';
  if (!String(value).includes('T')) return formatDate(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  const time = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
  return `${formatDate(value)} · ${time}`;
};

const matchRecordLabel = (row, sport) => {
  if (!row) return 'Sin datos de temporada';
  const draws = sport === 'futbol' ? ` · ${number(row.drawn)}E` : '';
  return `${row.pos}º · ${number(row.won)}V${draws} · ${number(row.lost)}D`;
};

const teamLogoMarkup = (name, logo, size = 'team-logo-xl') => {
  if (logo) {
    return `<span class="${size} team-logo"><img src="${escapeHtml(logo)}" alt="Escudo de ${escapeHtml(name)}" loading="lazy" referrerpolicy="no-referrer"></span>`;
  }
  return teamBadge(name, size === 'team-logo-lg' ? 'team-badge-lg' : 'team-badge-xl');
};

const statCompareRow = ({ label, home, away, homeRaw, awayRaw, hint = '' }) => {
  const homeValue = Number(homeRaw) || 0;
  const awayValue = Number(awayRaw) || 0;
  const max = Math.max(homeValue, awayValue, 1);
  const homeWidth = (homeValue / max) * 100;
  const awayWidth = (awayValue / max) * 100;

  return `
    <div class="match-stat-row">
      <span class="match-stat-value is-home">${home}</span>
      <div class="match-stat-middle">
        <div class="match-stat-label">
          <span class="uppercase tracking-wider">${escapeHtml(label)}</span>
          ${hint ? `<span>${escapeHtml(hint)}</span>` : ''}
        </div>
        <div class="match-stat-track">
          <span class="match-stat-side is-home"><span style="width:${homeWidth.toFixed(1)}%"></span></span>
          <span class="match-stat-side is-away"><span style="width:${awayWidth.toFixed(1)}%"></span></span>
        </div>
      </div>
      <span class="match-stat-value is-away">${away}</span>
    </div>`;
};

const renderTeamContextCard = (name, row, sport) => {
  const points = row?.points ?? 0;
  const goalsFor = row?.goalsFor ?? row?.pointsFor ?? 0;
  const goalsAgainst = row?.goalsAgainst ?? row?.pointsAgainst ?? 0;
  const rows = [
    ['Posición', row ? `${row.pos}º` : '—'],
    [sport === 'baloncesto' ? 'Victorias' : 'Puntos', row ? number(points) : '—'],
    ['Partidos', row ? number(row.played) : '—'],
    ['A favor', row ? number(goalsFor) : '—'],
    ['En contra', row ? number(goalsAgainst) : '—'],
    ['% victorias', row ? percent(row.winPct) : '—'],
    ['Forma', formPills(row?.form ?? []) || '—']
  ];

  return `
    <div class="match-context-card">
      <div class="team-cell">
        ${teamLogoMarkup(name, row?.logo, 'team-logo-lg')}
        <span class="match-context-name">${escapeHtml(name)}</span>
      </div>
      ${rows
        .map(
          ([label, value]) => `
            <div class="match-context-row">
              <span>${escapeHtml(label)}</span>
              <strong>${value}</strong>
            </div>`
        )
        .join('')}
    </div>`;
};

const renderMatchH2H = (match) => {
  const h2h = (state.data?.results ?? [])
    .filter(
      (row) =>
        (row.home === match.home && row.away === match.away) ||
        (row.home === match.away && row.away === match.home)
    )
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || Number(a.round) - Number(b.round))
    .slice(-8)
    .reverse();

  if (!h2h.length) return '';

  return `
    <section class="match-detail-section">
      <div class="match-detail-heading">
        <div>
          <h3 class="match-detail-title">Cara a cara esta temporada</h3>
          <p class="match-detail-subtitle">Todos los encuentros entre ambos equipos en el archivo consultado.</p>
        </div>
        <span class="match-detail-chip">${h2h.length} partidos</span>
      </div>
      <div class="match-h2h-list">
        ${h2h
          .map(
            (row) => `
              <div class="match-h2h-row">
                <span class="match-h2h-date">${escapeHtml(formatDate(row.date))}</span>
                <span class="match-h2h-teams">${escapeHtml(row.home)} — ${escapeHtml(row.away)}</span>
                <span class="match-h2h-score">${number(row.homeScore)} - ${number(row.awayScore)}</span>
              </div>`
          )
          .join('')}
      </div>
    </section>`;
};

const renderBasketballPeriods = (details) => {
  if (!details.periods?.length) return '';

  return `
    <section class="match-detail-section">
      <div class="match-detail-heading">
        <div>
          <h3 class="match-detail-title">Parciales</h3>
          <p class="match-detail-subtitle">Puntos anotados en cada cuarto y total del partido.</p>
        </div>
      </div>
      <div class="table-scroll">
        <table class="match-period-table">
          <thead>
            <tr>
              <th>Equipo</th>
              ${details.periods
                .map(
                  (period) =>
                    `<th>${period.quarter > 4 ? `OT${period.quarter - 4}` : period.quarter}</th>`
                )
                .join('')}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${escapeHtml(details.home.name)}</td>
              ${details.periods
                .map((period) => `<td class="is-home">${number(period.home)}</td>`)
                .join('')}
              <td>${number(details.homeScore)}</td>
            </tr>
            <tr>
              <td>${escapeHtml(details.away.name)}</td>
              ${details.periods
                .map((period) => `<td class="is-away">${number(period.away)}</td>`)
                .join('')}
              <td>${number(details.awayScore)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>`;
};

const renderBasketballPlayers = (details) => {
  const totalPlayers = (details.home.players?.length ?? 0) + (details.away.players?.length ?? 0);
  if (!totalPlayers) return '';

  const playerTable = (team) => {
    const players = [...(team.players ?? [])].sort(
      (a, b) => Number(b.points) - Number(a.points) || Number(b.rating) - Number(a.rating)
    );

    return `
      <div class="match-boxscore-team">
        <h4>${escapeHtml(team.name)}</h4>
        <div class="table-scroll">
          <table class="stats-table match-player-table">
            <thead>
              <tr>
                <th class="text-left">Jugador</th>
                <th>MIN</th>
                <th>PTS</th>
                <th>T2</th>
                <th>T3</th>
                <th>TL</th>
                <th>REB</th>
                <th>AS</th>
                <th>ROB</th>
                <th>PER</th>
                <th>TAP</th>
                <th>F</th>
                <th>VAL</th>
              </tr>
            </thead>
            <tbody>
              ${players
                .map(
                  (player) => `
                    <tr>
                      <td class="text-left">
                        <span class="team-name" title="${escapeHtml(player.position)}">${escapeHtml(player.name)}</span>
                      </td>
                      <td>${escapeHtml(player.minutes)}</td>
                      <td class="num-strong text-white">${number(player.points)}</td>
                      <td>${number(player.twoPointersMade)}/${number(player.twoPointersAttempted)}</td>
                      <td>${number(player.threePointersMade)}/${number(player.threePointersAttempted)}</td>
                      <td>${number(player.freeThrowsMade)}/${number(player.freeThrowsAttempted)}</td>
                      <td>${number(player.totalRebounds)}</td>
                      <td>${number(player.assists)}</td>
                      <td>${number(player.steals)}</td>
                      <td>${number(player.turnovers)}</td>
                      <td>${number(player.blocks)}</td>
                      <td>${number(player.personalFouls)}</td>
                      <td class="num-strong text-white">${number(player.rating)}</td>
                    </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  };

  return `
    <section class="match-detail-section">
      <details class="match-boxscore">
        <summary>
          Boxscore por jugador
          <span>${totalPlayers} jugadores · datos oficiales ACB</span>
        </summary>
        <div class="match-boxscore-grid">
          ${playerTable(details.home)}
          ${playerTable(details.away)}
        </div>
      </details>
    </section>`;
};

const renderBasketballDetail = (details) => {
  const home = details.home;
  const away = details.away;
  const homeTotals = home.totals;
  const awayTotals = away.totals;
  const rows = [
    {
      label: 'Puntos',
      home: number(homeTotals.points),
      away: number(awayTotals.points),
      homeRaw: homeTotals.points,
      awayRaw: awayTotals.points
    },
    {
      label: 'Tiros de 2',
      home: `${number(home.percentages.twoPt, 1)}%`,
      away: `${number(away.percentages.twoPt, 1)}%`,
      homeRaw: home.percentages.twoPt,
      awayRaw: away.percentages.twoPt,
      hint: `${number(homeTotals.twoPointersMade)}/${number(homeTotals.twoPointersAttempted)} · ${number(awayTotals.twoPointersMade)}/${number(awayTotals.twoPointersAttempted)}`
    },
    {
      label: 'Tiros de 3',
      home: `${number(home.percentages.threePt, 1)}%`,
      away: `${number(away.percentages.threePt, 1)}%`,
      homeRaw: home.percentages.threePt,
      awayRaw: away.percentages.threePt,
      hint: `${number(homeTotals.threePointersMade)}/${number(homeTotals.threePointersAttempted)} · ${number(awayTotals.threePointersMade)}/${number(awayTotals.threePointersAttempted)}`
    },
    {
      label: 'Tiros libres',
      home: `${number(home.percentages.ft, 1)}%`,
      away: `${number(away.percentages.ft, 1)}%`,
      homeRaw: home.percentages.ft,
      awayRaw: away.percentages.ft,
      hint: `${number(homeTotals.freeThrowsMade)}/${number(homeTotals.freeThrowsAttempted)} · ${number(awayTotals.freeThrowsMade)}/${number(awayTotals.freeThrowsAttempted)}`
    },
    {
      label: 'Rebotes',
      home: number(homeTotals.totalRebounds),
      away: number(awayTotals.totalRebounds),
      homeRaw: homeTotals.totalRebounds,
      awayRaw: awayTotals.totalRebounds,
      hint: `${number(homeTotals.offRebounds)}+${number(homeTotals.defRebounds)} · ${number(awayTotals.offRebounds)}+${number(awayTotals.defRebounds)}`
    },
    {
      label: 'Asistencias',
      home: number(homeTotals.assists),
      away: number(awayTotals.assists),
      homeRaw: homeTotals.assists,
      awayRaw: awayTotals.assists
    },
    {
      label: 'Robos',
      home: number(homeTotals.steals),
      away: number(awayTotals.steals),
      homeRaw: homeTotals.steals,
      awayRaw: awayTotals.steals
    },
    {
      label: 'Pérdidas',
      home: number(homeTotals.turnovers),
      away: number(awayTotals.turnovers),
      homeRaw: homeTotals.turnovers,
      awayRaw: awayTotals.turnovers
    },
    {
      label: 'Tapones',
      home: number(homeTotals.blocks),
      away: number(awayTotals.blocks),
      homeRaw: homeTotals.blocks,
      awayRaw: awayTotals.blocks
    },
    {
      label: 'Faltas',
      home: number(homeTotals.personalFouls),
      away: number(awayTotals.personalFouls),
      homeRaw: homeTotals.personalFouls,
      awayRaw: awayTotals.personalFouls
    },
    {
      label: 'Valoración',
      home: number(homeTotals.rating),
      away: number(awayTotals.rating),
      homeRaw: homeTotals.rating,
      awayRaw: awayTotals.rating
    }
  ];

  return `
    <section class="match-detail-section">
      <div class="match-detail-heading">
        <div>
          <h3 class="match-detail-title">Estadísticas generales</h3>
          <p class="match-detail-subtitle">Comparativa oficial de equipo · ACB.com</p>
        </div>
        <span class="match-detail-chip">Boxscore oficial</span>
      </div>
      <div class="match-stat-list">
        ${rows.map(statCompareRow).join('')}
      </div>
    </section>
    ${renderBasketballPeriods(details)}
    ${renderBasketballPlayers(details)}`;
};

const renderDerivedMatchDetail = (match, error = null) => {
  const sport = state.sport;
  const homeScore = Number(match.homeScore) || 0;
  const awayScore = Number(match.awayScore) || 0;
  const diff = homeScore - awayScore;
  const total = homeScore + awayScore;
  const unit = sport === 'baloncesto' ? 'puntos' : 'goles';
  const winner =
    diff === 0 ? 'Empate' : diff > 0 ? `Victoria de ${match.home}` : `Victoria de ${match.away}`;
  const homeRow = standingFor(match.home);
  const awayRow = standingFor(match.away);
  const noDetailText =
    sport === 'futbol'
      ? 'La fuente histórica gratuita solo conserva el marcador final. No publica los minutos de los goles, disparos a puerta, posesión ni tarjetas por partido para esta temporada.'
      : 'La fuente histórica de ASOBAL solo conserva el marcador final. No publica lanzamientos, paradas de portero, faltas ni exclusiones por partido para esta temporada.';

  return `
    <section class="match-detail-section">
      <div class="match-detail-heading">
        <div>
          <h3 class="match-detail-title">Claves del partido</h3>
          <p class="match-detail-subtitle">Resumen calculado a partir del marcador y la temporada.</p>
        </div>
      </div>
      <div class="match-detail-chips" style="justify-content:flex-start">
        <span class="match-detail-chip"><strong>${escapeHtml(winner)}</strong></span>
        <span class="match-detail-chip">Diferencia <strong>${number(Math.abs(diff))}</strong></span>
        <span class="match-detail-chip">Total <strong>${number(total)} ${unit}</strong></span>
        <span class="match-detail-chip">Ambos marcan <strong>${homeScore > 0 && awayScore > 0 ? 'Sí' : 'No'}</strong></span>
      </div>
      <div class="match-context-grid mt-4">
        ${renderTeamContextCard(match.home, homeRow, sport)}
        ${renderTeamContextCard(match.away, awayRow, sport)}
      </div>
    </section>
    ${renderMatchH2H(match)}
    ${
      error
        ? `<section class="match-detail-section"><div class="match-data-note">${icon('alert', 'h-4 w-4 shrink-0')}<div><strong>No se pudo cargar el detalle oficial</strong><p>${escapeHtml(error)}. Se muestra el resumen disponible en el archivo histórico.</p></div></div></section>`
        : sport === 'baloncesto'
          ? `<section class="match-detail-section"><div class="match-data-note">${icon('database', 'h-4 w-4 shrink-0')}<div><strong>Boxscore no disponible</strong><p>Este partido no tiene un identificador oficial de ACB en el archivo. Se muestra el resumen calculado con el marcador y la clasificación.</p></div></div></section>`
          : `<section class="match-detail-section"><div class="match-data-note">${icon('database', 'h-4 w-4 shrink-0')}<div><strong>Detalle avanzado no disponible</strong><p>${escapeHtml(noDetailText)}</p></div></div></section>`
    }`;
};

const renderMatchHero = (match, details = null, loading = false) => {
  const homeName = details?.home?.name ?? match.home;
  const awayName = details?.away?.name ?? match.away;
  const homeScore = Number(details?.homeScore ?? match.homeScore) || 0;
  const awayScore = Number(details?.awayScore ?? match.awayScore) || 0;
  const homeRow = standingFor(homeName);
  const awayRow = standingFor(awayName);
  const homeLogo = details?.home?.logo ?? homeRow?.logo ?? null;
  const awayLogo = details?.away?.logo ?? awayRow?.logo ?? null;
  const homeColor = teamColorFor(homeName, details?.home?.color);
  const awayColor = teamColorFor(awayName, details?.away?.color);
  const homeWins = homeScore > awayScore;
  const awayWins = awayScore > homeScore;
  const roundLabel = Number(match.round) ? `Jornada ${match.round}` : 'Partido';
  const phase = match.phase ?? (match.stage === 'playoff' ? 'Fase final' : null);
  const dateLabel = details?.start ? formatMatchDateTime(details.start) : formatDate(match.date);
  const referees = details?.referees?.length ? details.referees.join(' · ') : '';
  const chips = [
    dateLabel,
    roundLabel,
    phase,
    details?.arena,
    details?.attendance ? `${number(details.attendance)} espectadores` : '',
    referees ? `Árbitros: ${referees}` : ''
  ].filter(Boolean);
  const status = loading
    ? 'Cargando detalle'
    : details?.matchFinished === false
      ? 'En juego'
      : 'Finalizado';

  return `
    <div class="match-detail" style="--home-color:${escapeHtml(homeColor)};--away-color:${escapeHtml(awayColor)}">
      <div class="match-detail-hero">
        <div class="match-detail-scoreboard">
          <div class="match-detail-team ${homeWins ? 'is-winner' : ''}">
            ${teamLogoMarkup(homeName, homeLogo)}
            <div>
              <p class="match-detail-team-name">${escapeHtml(homeName)}</p>
              <p class="match-detail-team-meta">${escapeHtml(matchRecordLabel(homeRow, state.sport))}</p>
            </div>
          </div>
          <div class="match-detail-score">
            <div class="match-detail-score-main">
              <span>${number(homeScore)}</span>
              <span class="sep">-</span>
              <span>${number(awayScore)}</span>
            </div>
            <span class="match-detail-status">${escapeHtml(status)}</span>
          </div>
          <div class="match-detail-team ${awayWins ? 'is-winner' : ''}">
            ${teamLogoMarkup(awayName, awayLogo)}
            <div>
              <p class="match-detail-team-name">${escapeHtml(awayName)}</p>
              <p class="match-detail-team-meta">${escapeHtml(matchRecordLabel(awayRow, state.sport))}</p>
            </div>
          </div>
        </div>
        <div class="match-detail-chips">
          ${chips
            .map(
              (chip, index) =>
                `<span class="match-detail-chip">${index === 0 ? icon('calendar', 'h-2.5 w-2.5') : ''}${escapeHtml(chip)}</span>`
            )
            .join('')}
        </div>
      </div>
    </div>`;
};

const renderMatchDetail = (match, details = null, loading = false, error = null) => {
  const sport = state.sport;
  const meta = SPORTS[sport];
  const body = loading
    ? `<div class="match-loading">
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <div class="skeleton"></div>
      </div>`
    : details
      ? renderBasketballDetail(details)
      : renderDerivedMatchDetail(match, error);

  return `
    <div class="match-modal-bar">
      <div class="match-modal-eyebrow">
        ${icon('ball', 'h-3 w-3')}
        <span>${escapeHtml(meta.league)} · ${escapeHtml(state.season)}</span>
      </div>
      <button type="button" class="match-modal-close" data-action="close-match" aria-label="Cerrar detalle del partido">
        ${icon('x', 'h-4 w-4')}
      </button>
    </div>
    <h2 id="match-modal-title" class="sr-only">Detalle de ${escapeHtml(match.home)} contra ${escapeHtml(match.away)}</h2>
    ${renderMatchHero(match, details, loading)}
    ${body}
    <div class="match-detail-footer">
      <span>${details ? 'Fuente: ACB.com · boxscore oficial' : 'Fuente: archivo histórico de IberiaStats'} · Escudos según disponibilidad</span>
      <span>${escapeHtml(meta.league)} ${escapeHtml(state.season)}</span>
    </div>`;
};

const matchDetailEndpoint = (sport, season, id) => {
  const base = String(runtimeConfig.matchEndpoint || '/api/match').replace(/\/+$/, '');
  return `${base}/${encodeURIComponent(sport)}/${encodeURIComponent(season)}/${encodeURIComponent(id)}`;
};

const loadMatchDetails = async (match, requestId) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(matchDetailEndpoint(state.sport, state.season, match.id), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store'
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }
    if (!response.ok) {
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    if (!payload?.available) {
      throw new Error(payload?.error || 'Detalle no disponible');
    }
    if (requestId !== matchRequestId || activeMatchKey !== matchKey(match)) return;

    matchDetailsCache.set(String(match.id), payload);
    els.matchModalBody.innerHTML = renderMatchDetail(match, payload, false);
  } catch (error) {
    if (requestId !== matchRequestId || activeMatchKey !== matchKey(match)) return;
    const message = error instanceof Error ? error.message : 'Error desconocido';
    els.matchModalBody.innerHTML = renderMatchDetail(match, null, false, message);
  } finally {
    clearTimeout(timer);
  }
};

const openMatchModal = (key) => {
  const match = (state.data?.results ?? []).find((row) => matchKey(row) === key);
  if (!match) return;

  activeMatchKey = key;
  matchModalTrigger = document.activeElement;
  matchRequestId += 1;
  const requestId = matchRequestId;
  const canLoadDetails = state.sport === 'baloncesto' && Number.isFinite(Number(match.id));
  const cached = canLoadDetails ? matchDetailsCache.get(String(match.id)) : null;

  els.matchModal.classList.remove('hidden');
  els.matchModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  els.matchModalBody.innerHTML = renderMatchDetail(
    match,
    cached ?? null,
    canLoadDetails && !cached
  );

  window.requestAnimationFrame(() => {
    els.matchModal?.querySelector('[data-action="close-match"]')?.focus();
  });

  if (canLoadDetails && !cached) {
    loadMatchDetails(match, requestId);
  }
};

const closeMatchModal = ({ restoreFocus = true } = {}) => {
  if (!els.matchModal || els.matchModal.classList.contains('hidden')) return;

  activeMatchKey = null;
  matchRequestId += 1;
  els.matchModal.classList.add('hidden');
  els.matchModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');

  if (restoreFocus && matchModalTrigger && document.contains(matchModalTrigger)) {
    matchModalTrigger.focus();
  }
  matchModalTrigger = null;
};

/* ========================================================================== */
/* 8. Eventos e inicialización                                                */
/* ========================================================================== */

const bindEvents = () => {
  els.form.addEventListener('submit', handleSubmit);
  els.sportSelect.addEventListener('change', () => {
    clearFormError();
    populateSeasonOptions(els.sportSelect.value, els.seasonSelect.value);
    updatePreview();
  });
  els.seasonSelect.addEventListener('change', () => {
    clearFormError();
    updatePreview();
  });

  document.addEventListener('click', (event) => {
    const closeMatch = event.target.closest('[data-action="close-match"]');
    if (closeMatch) {
      event.preventDefault();
      closeMatchModal();
      return;
    }

    const matchTrigger = event.target.closest('[data-match-key]');
    if (matchTrigger) {
      event.preventDefault();
      openMatchModal(matchTrigger.dataset.matchKey);
      return;
    }

    const viewButton = event.target.closest('[data-view]');
    if (viewButton && state.sport && state.season) {
      event.preventDefault();
      navigate(state.sport, state.season, viewButton.dataset.view);
      return;
    }

    const homeAction = event.target.closest('[data-action="home"]');
    if (homeAction) {
      event.preventDefault();
      goHome();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMatchModal();
      return;
    }

    if (event.key !== 'Enter' && event.key !== ' ') return;
    const matchTrigger = event.target.closest?.('[data-match-key]');
    if (!matchTrigger) return;
    event.preventDefault();
    openMatchModal(matchTrigger.dataset.matchKey);
  });

  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('popstate', handleRoute);
};

const init = async () => {
  await loadAvailableSeasons();
  bindEvents();
  populateSeasonOptions(els.sportSelect.value, els.seasonSelect.value);
  updatePreview();

  if (window.location.hash) {
    handleRoute();
  } else {
    showWelcome();
  }
};

init();
