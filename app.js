/* Study Tracker – lógica de la aplicación (JavaScript puro, sin dependencias salvo Chart.js opcional) */
(function () {
  'use strict';

  /* =====================================================================
     Constantes
     ===================================================================== */
  const STORAGE_KEY = 'studytracker.v1';
  const TIMER_KEY = 'studytracker.timer.v1';
  const TYPES = {
    teoria: 'Teoría',
    ejercicios: 'Ejercicios',
    repaso: 'Repaso',
    simulacro: 'Simulacro',
    trabajo: 'Trabajo académico'
  };
  const TYPE_COLORS = {
    teoria: '#16325c',
    ejercicios: '#2a9d8f',
    repaso: '#e9a23b',
    simulacro: '#7b5ea7',
    trabajo: '#8a97a8'
  };
  const PALETTE = ['#1f4e8c', '#2a9d8f', '#7b5ea7', '#e9a23b', '#4f8a3c', '#c0577a', '#3d7ea6', '#d9633b', '#8a6d3b', '#5b6c8f', '#6a994e', '#9a4f4f'];
  const DEFAULT_SUBJECTS = [
    { id: 'econometria2', name: 'Econometría II', color: '#1f4e8c', weeklyGoal: 8 },
    { id: 'macro23', name: 'Macroeconomía II-III', color: '#2a9d8f', weeklyGoal: 8 },
    { id: 'optimizacion', name: 'Optimización', color: '#7b5ea7', weeklyGoal: 4 },
    { id: 'micro', name: 'Microeconomía', color: '#e9a23b', weeklyGoal: 4 },
    { id: 'regional', name: 'Economía Regional', color: '#4f8a3c', weeklyGoal: 0 },
    { id: 'ingles', name: 'Inglés', color: '#c0577a', weeklyGoal: 2 },
    { id: 'industrial', name: 'Economía Industrial', color: '#3d7ea6', weeklyGoal: 4 },
    { id: 'tfg-ade', name: 'TFG ADE', color: '#d9633b', weeklyGoal: 0 },
    { id: 'tfg-eco', name: 'TFG Economía', color: '#8a6d3b', weeklyGoal: 0 },
    { id: 'practicas', name: 'Prácticas', color: '#5b6c8f', weeklyGoal: 0 }
  ];
  const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const VIEWS = ['dashboard', 'registro', 'asignaturas', 'estadisticas', 'calendario', 'configuracion'];

  /* =====================================================================
     Utilidades de fecha y formato (todo en hora local, sin UTC)
     ===================================================================== */
  const pad = n => String(n).padStart(2, '0');
  const el = id => document.getElementById(id);
  const fmtDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const fmtTime = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
  const parseDate = s => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12, 0, 0); };
  const todayStr = () => fmtDate(new Date());
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); };
  const weekStart = s => { const d = parseDate(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return fmtDate(d); };
  const diffDays = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
  const monthStart = s => s.slice(0, 8) + '01';
  const monthEnd = s => { const d = parseDate(s); return fmtDate(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)); };
  const weekdayIdx = s => (parseDate(s).getDay() + 6) % 7;
  const isValidDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && fmtDate(parseDate(s)) === s;
  const isValidTime = s => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
  const nowHM = () => fmtTime(new Date());

  // Minutos entre dos horas "HH:MM". Si el fin es anterior al inicio se entiende que cruza la medianoche.
  function calcMinutes(start, end) {
    const s = parseInt(start.slice(0, 2), 10) * 60 + parseInt(start.slice(3), 10);
    const e = parseInt(end.slice(0, 2), 10) * 60 + parseInt(end.slice(3), 10);
    return (e - s + 1440) % 1440;
  }

  const nf1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
  function fmtDur(min) {
    min = Math.round(min);
    if (min <= 0) return '0 min';
    const h = Math.floor(min / 60), m = min % 60;
    if (!h) return m + ' min';
    return m ? h + ' h ' + pad(m) + ' min' : h + ' h';
  }
  const hrs = min => Math.round(min / 60 * 100) / 100;
  const fmtLong = s => parseDate(s).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtMid = s => parseDate(s).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const fmtDM = s => parseDate(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const fmtClock = ms => {
    const t = Math.floor(Math.max(0, ms) / 1000);
    return pad(Math.floor(t / 3600)) + ':' + pad(Math.floor(t / 60) % 60) + ':' + pad(t % 60);
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* =====================================================================
     Estado y persistencia
     ===================================================================== */
  function defaultState() {
    return {
      version: 1,
      subjects: DEFAULT_SUBJECTS.map(s => Object.assign({}, s)),
      sessions: [],
      settings: { weeklyGoal: 30, monthlyGoal: 120, lastSubject: '', lastType: 'teoria', lastExport: null }
    };
  }

  // Valida y normaliza datos (de LocalStorage o de una importación). Lanza error si el formato no es válido.
  function sanitize(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.subjects) || !Array.isArray(raw.sessions)) {
      throw new Error('Formato no válido');
    }
    const subjects = [];
    const subjectIds = new Set();
    raw.subjects.forEach((s, i) => {
      if (!s || typeof s !== 'object') return;
      const name = String(s.name == null ? '' : s.name).trim().slice(0, 60);
      if (!name) return;
      let id = typeof s.id === 'string' && s.id ? s.id : uid();
      if (subjectIds.has(id)) id = uid();
      subjectIds.add(id);
      const color = (typeof s.color === 'string' && /^#[0-9a-f]{6}$/i.test(s.color)) ? s.color : PALETTE[i % PALETTE.length];
      let g = Number(s.weeklyGoal);
      if (!isFinite(g) || g < 0) g = 0;
      subjects.push({ id, name, color, weeklyGoal: Math.min(g, 100) });
    });

    let dropped = 0;
    const sessions = [];
    const sessionIds = new Set();
    raw.sessions.forEach(s => {
      const ok = s && typeof s === 'object' && subjectIds.has(s.subjectId) && isValidDate(s.date) && isValidTime(s.start) && isValidTime(s.end);
      if (!ok) { dropped++; return; }
      const minutes = calcMinutes(s.start, s.end);
      if (minutes <= 0) { dropped++; return; }
      let id = typeof s.id === 'string' && s.id && !sessionIds.has(s.id) ? s.id : uid();
      sessionIds.add(id);
      sessions.push({
        id, subjectId: s.subjectId, date: s.date, start: s.start, end: s.end, minutes,
        type: TYPES[s.type] ? s.type : 'teoria',
        notes: String(s.notes == null ? '' : s.notes).slice(0, 300)
      });
    });

    const st = (raw.settings && typeof raw.settings === 'object') ? raw.settings : {};
    const num = (v, def, max) => { v = Number(v); return (isFinite(v) && v >= 0) ? Math.min(v, max) : def; };
    const settings = {
      weeklyGoal: num(st.weeklyGoal, 30, 168),
      monthlyGoal: num(st.monthlyGoal, 120, 744),
      lastSubject: typeof st.lastSubject === 'string' ? st.lastSubject : '',
      lastType: TYPES[st.lastType] ? st.lastType : 'teoria',
      lastExport: typeof st.lastExport === 'string' ? st.lastExport : null
    };
    return { state: { version: 1, subjects, sessions, settings }, dropped };
  }

  let loadProblem = null;
  function loadState() {
    let text = null;
    try { text = localStorage.getItem(STORAGE_KEY); } catch (e) { loadProblem = 'No se puede acceder al almacenamiento del navegador. Los datos no se conservarán.'; }
    if (!text) return defaultState();
    try {
      return sanitize(JSON.parse(text)).state;
    } catch (e) {
      try { localStorage.setItem(STORAGE_KEY + '.corrupt', text); } catch (_) { /* nada */ }
      loadProblem = 'Los datos guardados estaban dañados. Se ha conservado una copia aparte y se ha iniciado una base de datos nueva.';
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      toast('No se pudo guardar en el navegador (¿almacenamiento lleno o bloqueado?). Exporta una copia de seguridad.', true);
      return false;
    }
  }

  let state = loadState();

  /* ---- Cronómetro (estado propio y persistente) ---- */
  function defaultTimer() { return { status: 'idle', acc: 0, since: null, subjectId: '', type: 'teoria' }; }
  function loadTimer() {
    try {
      const t = JSON.parse(localStorage.getItem(TIMER_KEY));
      if (!t || typeof t !== 'object') return defaultTimer();
      const status = ['idle', 'running', 'paused'].includes(t.status) ? t.status : 'idle';
      const acc = isFinite(t.acc) && t.acc >= 0 ? t.acc : 0;
      const since = isFinite(t.since) ? t.since : null;
      if (status === 'running' && since == null) return { status: 'paused', acc, since: null, subjectId: String(t.subjectId || ''), type: TYPES[t.type] ? t.type : 'teoria' };
      return { status, acc, since: status === 'running' ? since : null, subjectId: String(t.subjectId || ''), type: TYPES[t.type] ? t.type : 'teoria' };
    } catch (e) { return defaultTimer(); }
  }
  function saveTimer() { try { localStorage.setItem(TIMER_KEY, JSON.stringify(timer)); } catch (e) { /* nada */ } }
  let timer = loadTimer();
  const timerElapsed = () => timer.acc + (timer.status === 'running' ? Math.max(0, Date.now() - timer.since) : 0);

  /* =====================================================================
     Consultas y agregados
     ===================================================================== */
  const sum = list => list.reduce((a, s) => a + s.minutes, 0);
  const inRange = (from, to) => state.sessions.filter(s => s.date >= from && s.date <= to);
  const subjectById = id => state.subjects.find(s => s.id === id);
  function groupMinutes(list, keyFn) {
    const m = {};
    list.forEach(s => { const k = keyFn(s); m[k] = (m[k] || 0) + s.minutes; });
    return m;
  }
  const byDate = list => groupMinutes(list, s => s.date);
  const bySubject = list => groupMinutes(list, s => s.subjectId);
  const byType = list => groupMinutes(list, s => s.type);
  function topKey(map) {
    let best = null, bv = 0;
    Object.keys(map).forEach(k => { if (map[k] > bv) { bv = map[k]; best = k; } });
    return best ? { key: best, minutes: bv } : null;
  }
  function sortSessionsDesc(list) {
    return list.slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : (a.start < b.start ? 1 : a.start > b.start ? -1 : 0));
  }
  const weekBounds = (t) => { const f = weekStart(t); return { from: f, to: addDays(f, 6) }; };
  const monthBounds = (t) => ({ from: monthStart(t), to: monthEnd(t) });
  const plannedWeeklyHours = () => state.subjects.reduce((a, s) => a + s.weeklyGoal, 0);

  /* =====================================================================
     Interfaz común: toast, modal, gráficos
     ===================================================================== */
  let toastTimer = null;
  function toast(msg, isError) {
    const t = el('toast');
    t.textContent = msg;
    t.classList.toggle('error', !!isError);
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), isError ? 6000 : 2800);
  }
  function openModal(html) {
    el('modal-body').innerHTML = html;
    el('modal').classList.remove('hidden');
    const first = el('modal-body').querySelector('input, select, textarea, button');
    if (first) first.focus();
  }
  function closeModal() { el('modal').classList.add('hidden'); el('modal-body').innerHTML = ''; }

  const charts = {};
  let chartReady = false;
  function destroyCharts() { Object.keys(charts).forEach(k => { charts[k].destroy(); delete charts[k]; }); }
  function chartNote(canvas, text) {
    const box = canvas.parentElement;
    let n = box.querySelector('.chart-note');
    if (text) {
      if (!n) { n = document.createElement('p'); n.className = 'chart-note'; box.appendChild(n); }
      n.textContent = text;
      canvas.style.display = 'none';
    } else {
      if (n) n.remove();
      canvas.style.display = '';
    }
  }
  function drawChart(id, config, isEmpty) {
    const canvas = el(id);
    if (!canvas) return;
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
    if (typeof Chart === 'undefined') {
      chartNote(canvas, 'No se pudo cargar Chart.js (hace falta conexión a Internet la primera vez). El resto de la aplicación funciona con normalidad.');
      return;
    }
    if (isEmpty) { chartNote(canvas, 'Sin datos todavía.'); return; }
    chartNote(canvas, null);
    if (!chartReady) {
      Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
      Chart.defaults.color = '#6b7686';
      Chart.defaults.borderColor = '#e8ecf2';
      chartReady = true;
    }
    charts[id] = new Chart(canvas.getContext('2d'), config);
  }
  const hoursAxis = { beginAtZero: true, ticks: { callback: v => nf1.format(v) + ' h' } };
  const tipHours = ctx => ' ' + (ctx.dataset.label ? ctx.dataset.label + ': ' : '') + fmtDur(ctx.parsed.y != null && ctx.chart.options.indexAxis !== 'y' ? ctx.parsed.y * 60 : ctx.parsed.x * 60);
  const baseOpts = extra => Object.assign({ responsive: true, maintainAspectRatio: false }, extra);

  /* =====================================================================
     Navegación
     ===================================================================== */
  let current = 'dashboard';
  let pendingEdit = null;
  let pendingDate = null;

  function navigate() {
    let h = location.hash.replace('#', '');
    if (!VIEWS.includes(h)) h = 'dashboard';
    current = h;
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('hidden', v.id !== 'view-' + h));
    document.querySelectorAll('#nav a').forEach(a => {
      const on = a.dataset.view === h;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    destroyCharts();
    render();
    if (current === 'registro') {
      if (pendingEdit) { loadSessionIntoForm(pendingEdit); pendingEdit = null; }
      else if (pendingDate) { el('f-date').value = pendingDate; pendingDate = null; updateDuration(); }
    }
    window.scrollTo(0, 0);
  }

  function render() {
    fillSelects();
    renderTimerUI();
    switch (current) {
      case 'dashboard': renderDashboard(); break;
      case 'registro': renderHistory(); break;
      case 'asignaturas': renderSubjects(); break;
      case 'estadisticas': renderStats(); break;
      case 'calendario': renderCalendar(); break;
      case 'configuracion': renderSettings(); break;
    }
  }

  function typeOptions(withAll) {
    return (withAll ? '<option value="">Todos</option>' : '') +
      Object.keys(TYPES).map(k => '<option value="' + k + '">' + TYPES[k] + '</option>').join('');
  }
  function subjectOptions(withAll) {
    return (withAll ? '<option value="">Todas</option>' : '') +
      state.subjects.map(s => '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>').join('');
  }
  function fillSelect(id, html) {
    const sel = el(id);
    if (!sel) return;
    const prev = sel.value;
    if (sel.dataset.sig !== html) { sel.innerHTML = html; sel.dataset.sig = html; }
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
  }
  function fillSelects() {
    const sOpts = subjectOptions(false);
    fillSelect('f-subject', sOpts);
    fillSelect('t-subject', sOpts);
    fillSelect('h-subject', subjectOptions(true));
    fillSelect('f-type', typeOptions(false));
    fillSelect('t-type', typeOptions(false));
    fillSelect('h-type', typeOptions(true));
    if (!el('f-subject').value && state.subjects.length) el('f-subject').value = validSubject(state.settings.lastSubject) || state.subjects[0].id;
    if (timer.subjectId && subjectById(timer.subjectId)) el('t-subject').value = timer.subjectId;
    else if (state.subjects.length && !el('t-subject').value) el('t-subject').value = state.subjects[0].id;
    el('t-type').value = timer.type;
  }
  const validSubject = id => (id && subjectById(id)) ? id : '';

  /* =====================================================================
     PANEL
     ===================================================================== */
  function kpi(label, value, sub) {
    return '<div class="kpi"><div class="label">' + esc(label) + '</div><div class="value">' + esc(value) + '</div>' +
      (sub ? '<div class="kpi-sub">' + esc(sub) + '</div>' : '') + '</div>';
  }
  function bar(pct, cls) {
    return '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(Math.min(pct, 100)) + '"><div class="bar-fill ' + (cls || '') + '" style="width:' + Math.min(Math.max(pct, 0), 100) + '%"></div></div>';
  }
  // Una barra va en naranja si, a partir del miércoles, el avance semanal queda claramente por detrás del ritmo esperado.
  function barClass(pct, weekly) {
    if (pct >= 100) return 'ok';
    if (weekly) {
      const idx = weekdayIdx(todayStr());
      const pace = (idx + 1) / 7 * 100;
      if (idx >= 2 && pct < pace * 0.6) return 'warn';
    }
    return '';
  }
  function goalRow(label, studiedMin, goalH, weekly) {
    if (!(goalH > 0)) {
      return '<div class="goal-row"><div class="goal-head"><span>' + label + '</span><span class="muted">Sin objetivo · estudiado ' + fmtDur(studiedMin) + '</span></div></div>';
    }
    const pct = studiedMin / (goalH * 60) * 100;
    return '<div class="goal-row"><div class="goal-head"><span>' + label + '</span><span><strong>' + fmtDur(studiedMin) + '</strong> estudiadas de ' + nf1.format(goalH) + ' h de objetivo · ' + Math.round(pct) + ' %</span></div>' +
      bar(pct, barClass(pct, weekly)) + '</div>';
  }

  function balanceData() {
    const t = todayStr();
    const from = addDays(weekStart(t), -21);
    const list = inRange(from, t);
    const total = sum(list);
    const m = bySubject(list);
    const goalSum = state.subjects.reduce((a, s) => a + (s.weeklyGoal > 0 ? s.weeklyGoal : 0), 0);
    if (total < 60 || goalSum <= 0) return { rows: [], from, enough: false };
    const rows = state.subjects.map(s => {
      const minutes = m[s.id] || 0;
      const real = minutes / total * 100;
      const planned = s.weeklyGoal > 0 ? s.weeklyGoal / goalSum * 100 : 0;
      let status = 'ok', label = 'Equilibrado';
      if (planned === 0) { if (minutes === 0) return null; status = ''; label = 'Sin objetivo'; }
      else {
        const ratio = real / planned;
        if (ratio > 1.35) { status = 'warn'; label = 'Demasiado'; }
        else if (ratio < 0.65) { status = 'warn'; label = 'Poco'; }
      }
      return { s, minutes, real, planned, status, label };
    }).filter(Boolean);
    return { rows, from, enough: true };
  }

  function renderDashboard() {
    const t = todayStr();
    const wk = weekBounds(t), mo = monthBounds(t);
    const all = state.sessions;
    const todayM = sum(all.filter(s => s.date === t));
    const weekM = sum(inRange(wk.from, wk.to));
    const monthM = sum(inRange(mo.from, mo.to));
    const totalM = sum(all);
    let avg = 0, since = '';
    if (all.length) {
      const first = all.reduce((a, s) => s.date < a ? s.date : a, all[0].date);
      const days = Math.max(1, diffDays(first, t) + 1);
      avg = totalM / days;
      since = 'desde el ' + fmtDM(first);
    }
    const top = topKey(bySubject(all));
    const topSubject = top ? subjectById(top.key) : null;

    el('dash-date').textContent = capitalize(fmtLong(t));
    el('dash-empty').classList.toggle('hidden', all.length > 0);
    el('dash-kpis').innerHTML =
      kpi('Hoy', fmtDur(todayM)) +
      kpi('Esta semana', fmtDur(weekM), state.settings.weeklyGoal > 0 ? 'objetivo ' + nf1.format(state.settings.weeklyGoal) + ' h' : '') +
      kpi('Este mes', fmtDur(monthM), state.settings.monthlyGoal > 0 ? 'objetivo ' + nf1.format(state.settings.monthlyGoal) + ' h' : '') +
      kpi('Total acumulado', fmtDur(totalM)) +
      kpi('Sesiones', String(all.length)) +
      kpi('Media diaria', fmtDur(avg), since) +
      kpi('Asignatura principal', topSubject ? topSubject.name : '—', topSubject ? fmtDur(top.minutes) : '');

    el('dash-goals').innerHTML = '<h2>Objetivos · horas estudiadas vs. planificadas</h2>' +
      goalRow('Objetivo semanal global', weekM, state.settings.weeklyGoal, true) +
      goalRow('Objetivo mensual global', monthM, state.settings.monthlyGoal, false) +
      '<p class="muted small" style="margin-top:10px">Horas planificadas en las asignaturas: ' + nf1.format(plannedWeeklyHours()) + ' h/semana · estudiadas esta semana: ' + fmtDur(weekM) + '.</p>';

    // Balance de dedicación
    const b = balanceData();
    let bh = '<h2>Balance de dedicación · últimas 4 semanas</h2>';
    if (!b.enough) {
      bh += '<p class="muted">Se necesita al menos 1 hora estudiada en las últimas cuatro semanas y objetivos semanales definidos para calcular el balance.</p>';
    } else {
      bh += '<p class="muted small" style="margin-bottom:8px">Compara el porcentaje real del tiempo estudiado con el porcentaje previsto según tus objetivos semanales. «Demasiado» o «Poco» aparece si la diferencia supera aproximadamente un tercio.</p>' +
        '<div class="balance-row head"><div>Asignatura</div><div>Horas (4 sem.)</div><div>Real</div><div>Previsto</div><div>Estado</div></div>' +
        b.rows.map(r => '<div class="balance-row"><div class="balance-name"><span class="dot" style="--c:' + r.s.color + '"></span>' + esc(r.s.name) + '</div><div>' + fmtDur(r.minutes) + '</div><div>' + Math.round(r.real) + ' %</div><div>' + (r.planned ? Math.round(r.planned) + ' %' : '—') + '</div><div><span class="badge ' + r.status + '">' + r.label + '</span></div></div>').join('');
    }
    el('dash-balance').innerHTML = bh;

    drawDaily30();
    drawDistribution('ch-dist', bySubject(all));
    drawWeekly12();
    drawCompare(wk);
  }

  function drawDaily30() {
    const t = todayStr();
    const days = [];
    for (let i = 29; i >= 0; i--) days.push(addDays(t, -i));
    const m = byDate(state.sessions);
    const data = days.map(d => hrs(m[d] || 0));
    const datasets = [{ type: 'bar', label: 'Horas', data, backgroundColor: '#16325c', borderRadius: 3, order: 2 }];
    if (state.settings.weeklyGoal > 0) {
      datasets.push({ type: 'line', label: 'Objetivo diario medio', data: days.map(() => Math.round(state.settings.weeklyGoal / 7 * 100) / 100), borderColor: '#e8892b', borderDash: [6, 4], borderWidth: 2, pointRadius: 0, fill: false, order: 1 });
    }
    drawChart('ch-daily', {
      type: 'bar',
      data: { labels: days.map(d => { const p = parseDate(d); return p.getDate() + '/' + (p.getMonth() + 1); }), datasets },
      options: baseOpts({
        interaction: { mode: 'index', intersect: false },
        scales: { y: hoursAxis, x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } } },
        plugins: { legend: { display: datasets.length > 1, position: 'bottom' }, tooltip: { callbacks: { title: items => fmtMid(days[items[0].dataIndex]), label: tipHours } } }
      })
    }, false);
  }

  function drawDistribution(canvasId, minutesBySubject) {
    const subs = state.subjects.filter(s => (minutesBySubject[s.id] || 0) > 0);
    drawChart(canvasId, {
      type: 'doughnut',
      data: { labels: subs.map(s => s.name), datasets: [{ data: subs.map(s => hrs(minutesBySubject[s.id])), backgroundColor: subs.map(s => s.color), borderWidth: 2, borderColor: '#fff' }] },
      options: baseOpts({
        cutout: '58%',
        plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: ctx => ' ' + ctx.label + ': ' + fmtDur(ctx.parsed * 60) } } }
      })
    }, subs.length === 0);
  }

  function drawWeekly12() {
    const t = weekStart(todayStr());
    const weeks = [];
    for (let i = 11; i >= 0; i--) weeks.push(addDays(t, -7 * i));
    const m = groupMinutes(state.sessions, s => weekStart(s.date));
    const datasets = [{ type: 'line', label: 'Horas', data: weeks.map(w => hrs(m[w] || 0)), borderColor: '#16325c', backgroundColor: 'rgba(22,50,92,0.1)', fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#16325c', order: 2 }];
    if (state.settings.weeklyGoal > 0) {
      datasets.push({ type: 'line', label: 'Objetivo semanal', data: weeks.map(() => state.settings.weeklyGoal), borderColor: '#e8892b', borderDash: [6, 4], borderWidth: 2, pointRadius: 0, fill: false, order: 1 });
    }
    drawChart('ch-weekly', {
      type: 'line',
      data: { labels: weeks.map(fmtDM), datasets },
      options: baseOpts({
        interaction: { mode: 'index', intersect: false },
        scales: { y: hoursAxis, x: { grid: { display: false } } },
        plugins: { legend: { display: datasets.length > 1, position: 'bottom' }, tooltip: { callbacks: { title: items => 'Semana del ' + fmtDM(weeks[items[0].dataIndex]), label: tipHours } } }
      })
    }, state.sessions.length === 0);
  }

  function drawCompare(wk) {
    const m = bySubject(inRange(wk.from, wk.to));
    const subs = state.subjects.filter(s => s.weeklyGoal > 0 || (m[s.id] || 0) > 0);
    drawChart('ch-compare', {
      type: 'bar',
      data: {
        labels: subs.map(s => s.name),
        datasets: [
          { label: 'Objetivo (planificado)', data: subs.map(s => s.weeklyGoal), backgroundColor: '#d6dde8', borderRadius: 3 },
          { label: 'Estudiado', data: subs.map(s => hrs(m[s.id] || 0)), backgroundColor: subs.map(s => (s.weeklyGoal > 0 && (m[s.id] || 0) >= s.weeklyGoal * 60) ? '#2e9d63' : '#16325c'), borderRadius: 3 }
        ]
      },
      options: baseOpts({
        indexAxis: 'y',
        scales: { x: { beginAtZero: true, ticks: { callback: v => nf1.format(v) + ' h' } }, y: { grid: { display: false } } },
        plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmtDur(ctx.parsed.x * 60) } } }
      })
    }, subs.length === 0);
  }

  /* =====================================================================
     REGISTRO: formulario
     ===================================================================== */
  let editingId = null;
  const ui = {
    filters: { subject: '', from: '', to: '', type: '' },
    histLimit: 50,
    cal: null,
    calSel: null
  };

  function setFormError(msg) { el('f-error').textContent = msg || ''; }

  function updateDuration() {
    const s = el('f-start').value, e = el('f-end').value;
    const box = el('f-duration');
    if (!isValidTime(s) || !isValidTime(e)) { box.textContent = '—'; return; }
    const m = calcMinutes(s, e);
    if (m === 0) { box.textContent = 'El inicio y el fin coinciden'; return; }
    box.textContent = fmtDur(m) + (e < s ? ' · cruza la medianoche' : '');
  }

  function resetForm(keepDate) {
    editingId = null;
    el('form-title').textContent = 'Nueva sesión';
    el('f-submit').textContent = 'Guardar sesión';
    el('f-cancel').classList.add('hidden');
    const t = todayStr();
    el('f-date').max = t;
    if (!keepDate || !el('f-date').value) el('f-date').value = t;
    el('f-start').value = '';
    el('f-end').value = '';
    el('f-notes').value = '';
    const sid = validSubject(el('f-subject').value) || validSubject(state.settings.lastSubject) || (state.subjects[0] && state.subjects[0].id) || '';
    el('f-subject').value = sid;
    el('f-type').value = TYPES[state.settings.lastType] ? state.settings.lastType : 'teoria';
    setFormError('');
    updateDuration();
  }

  function loadSessionIntoForm(id) {
    const s = state.sessions.find(x => x.id === id);
    if (!s) return;
    editingId = id;
    el('form-title').textContent = 'Editar sesión';
    el('f-submit').textContent = 'Guardar cambios';
    el('f-cancel').classList.remove('hidden');
    el('f-date').max = todayStr();
    el('f-subject').value = s.subjectId;
    el('f-date').value = s.date;
    el('f-type').value = s.type;
    el('f-start').value = s.start;
    el('f-end').value = s.end;
    el('f-notes').value = s.notes;
    setFormError('');
    updateDuration();
    el('session-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function validateSession(d) {
    if (!state.subjects.length) return 'Primero crea una asignatura en la sección Asignaturas.';
    if (!subjectById(d.subjectId)) return 'Selecciona una asignatura.';
    if (!isValidDate(d.date)) return 'Indica una fecha válida.';
    if (d.date > todayStr()) return 'La fecha no puede ser futura.';
    if (!isValidTime(d.start)) return 'Indica la hora de inicio.';
    if (!isValidTime(d.end)) return 'Indica la hora de finalización.';
    if (calcMinutes(d.start, d.end) <= 0) return 'La duración debe ser mayor que 0: el inicio y el fin no pueden coincidir.';
    return '';
  }

  function submitSession(e) {
    e.preventDefault();
    const d = {
      subjectId: el('f-subject').value,
      date: el('f-date').value,
      start: el('f-start').value,
      end: el('f-end').value,
      type: el('f-type').value,
      notes: el('f-notes').value.trim().slice(0, 300)
    };
    const err = validateSession(d);
    if (err) { setFormError(err); return; }
    const minutes = calcMinutes(d.start, d.end);
    if (!TYPES[d.type]) d.type = 'teoria';
    if (editingId) {
      const s = state.sessions.find(x => x.id === editingId);
      if (s) Object.assign(s, d, { minutes });
      toast('Sesión actualizada');
    } else {
      state.sessions.push(Object.assign({ id: uid(), minutes }, d));
      toast('Sesión guardada · ' + fmtDur(minutes));
    }
    state.settings.lastSubject = d.subjectId;
    state.settings.lastType = d.type;
    saveState();
    resetForm(true);
    render();
    el('f-start').focus();
  }

  function editSession(id) {
    if (current !== 'registro') { pendingEdit = id; location.hash = '#registro'; return; }
    loadSessionIntoForm(id);
  }

  function deleteSession(id) {
    const s = state.sessions.find(x => x.id === id);
    if (!s) return;
    const sub = subjectById(s.subjectId);
    if (!confirm('¿Eliminar la sesión de ' + (sub ? sub.name : 'asignatura') + ' del ' + fmtDM(s.date) + ' (' + fmtDur(s.minutes) + ')?')) return;
    state.sessions = state.sessions.filter(x => x.id !== id);
    if (editingId === id) resetForm(true);
    saveState();
    render();
    toast('Sesión eliminada');
  }

  function newSessionOn(date) {
    if (current !== 'registro') { pendingDate = date; location.hash = '#registro'; return; }
    el('f-date').value = date;
    updateDuration();
  }

  /* ---- Historial ---- */
  function filteredSessions() {
    const f = ui.filters;
    return sortSessionsDesc(state.sessions.filter(s =>
      (!f.subject || s.subjectId === f.subject) && (!f.from || s.date >= f.from) &&
      (!f.to || s.date <= f.to) && (!f.type || s.type === f.type)));
  }

  function renderHistory() {
    const list = filteredSessions();
    const shown = list.slice(0, ui.histLimit);
    const filtered = ui.filters.subject || ui.filters.from || ui.filters.to || ui.filters.type;
    el('h-summary').textContent = list.length
      ? list.length + (list.length === 1 ? ' sesión' : ' sesiones') + ' · ' + fmtDur(sum(list)) + (filtered ? ' (con filtros)' : '')
      : (state.sessions.length ? 'Ninguna sesión coincide con los filtros.' : 'Todavía no has registrado sesiones.');
    if (!list.length) { el('h-table').innerHTML = ''; el('h-more').classList.add('hidden'); return; }
    el('h-table').innerHTML = '<table class="responsive"><thead><tr><th>Fecha</th><th>Asignatura</th><th>Horario</th><th class="num">Duración</th><th>Tipo</th><th>Observaciones</th><th></th></tr></thead><tbody>' +
      shown.map(s => {
        const sub = subjectById(s.subjectId);
        return '<tr><td data-label="Fecha">' + fmtMid(s.date) + '</td>' +
          '<td data-label="Asignatura"><span class="dot" style="--c:' + (sub ? sub.color : '#999') + '"></span>' + esc(sub ? sub.name : '—') + '</td>' +
          '<td data-label="Horario">' + s.start + ' – ' + s.end + '</td>' +
          '<td data-label="Duración" class="num">' + fmtDur(s.minutes) + '</td>' +
          '<td data-label="Tipo">' + TYPES[s.type] + '</td>' +
          '<td data-label="Notas" class="notes-cell">' + esc(s.notes) + '</td>' +
          '<td><div class="row-actions"><button type="button" class="btn sm" data-action="edit-session" data-id="' + esc(s.id) + '">Editar</button><button type="button" class="btn sm danger" data-action="delete-session" data-id="' + esc(s.id) + '">Eliminar</button></div></td></tr>';
      }).join('') + '</tbody></table>';
    el('h-more').classList.toggle('hidden', list.length <= ui.histLimit);
  }

  function readFilters() {
    ui.filters = { subject: el('h-subject').value, from: el('h-from').value, to: el('h-to').value, type: el('h-type').value };
    ui.histLimit = 50;
    renderHistory();
  }

  /* =====================================================================
     CRONÓMETRO
     ===================================================================== */
  function renderTimerUI() {
    const ms = timerElapsed();
    const clock = fmtClock(ms);
    el('t-display').textContent = clock;
    const st = el('t-state');
    st.className = 'timer-state ' + timer.status;
    st.textContent = timer.status === 'running' ? 'En marcha' : timer.status === 'paused' ? 'En pausa' : 'Detenido';
    el('t-start').classList.toggle('hidden', timer.status === 'running');
    el('t-start').textContent = timer.status === 'paused' ? 'Reanudar' : 'Iniciar';
    el('t-pause').classList.toggle('hidden', timer.status !== 'running');
    el('t-finish').disabled = timer.status === 'idle';
    el('t-discard').disabled = timer.status === 'idle';
    const pill = el('timer-pill');
    pill.classList.toggle('hidden', timer.status === 'idle' || current === 'registro');
    pill.classList.toggle('paused', timer.status === 'paused');
    el('pill-time').textContent = clock;
    document.title = timer.status === 'idle' ? 'Study Tracker' : (timer.status === 'running' ? '▶ ' : '⏸ ') + clock + ' · Study Tracker';
  }

  function startTimer() {
    if (!state.subjects.length) { toast('Primero crea una asignatura.', true); return; }
    if (timer.status === 'idle') {
      timer.acc = 0;
      timer.subjectId = el('t-subject').value;
      timer.type = el('t-type').value;
    }
    timer.status = 'running';
    timer.since = Date.now();
    saveTimer();
    renderTimerUI();
  }
  function pauseTimer() {
    if (timer.status !== 'running') return;
    timer.acc = timerElapsed();
    timer.status = 'paused';
    timer.since = null;
    saveTimer();
    renderTimerUI();
  }
  function discardTimer() {
    if (!confirm('¿Descartar el tiempo cronometrado (' + fmtClock(timerElapsed()) + ')?')) return;
    resetTimer();
  }
  function resetTimer() { timer = defaultTimer(); saveTimer(); renderTimerUI(); }

  function finishTimer() {
    if (timer.status === 'idle') return;
    pauseTimer();
    const mins = Math.max(1, Math.round(timerElapsed() / 60000));
    if (!state.subjects.length) { toast('Primero crea una asignatura.', true); return; }
    const sid = validSubject(el('t-subject').value) || state.subjects[0].id;
    openModal(
      '<h2>Guardar sesión</h2>' +
      '<p class="muted" style="margin-bottom:14px">Tiempo cronometrado: <strong>' + fmtClock(timerElapsed()) + '</strong>. La sesión terminará ahora mismo.</p>' +
      '<div class="form-grid">' +
      '<div class="full"><label for="m-subject">Asignatura</label><select id="m-subject">' + subjectOptions(false) + '</select></div>' +
      '<div><label for="m-type">Tipo de actividad</label><select id="m-type">' + typeOptions(false) + '</select></div>' +
      '<div><label for="m-min">Duración (minutos)</label><input type="number" id="m-min" min="1" max="1439" step="1" value="' + mins + '"></div>' +
      '<div class="full"><label for="m-notes">Observaciones (opcional)</label><textarea id="m-notes" rows="2" maxlength="300"></textarea></div>' +
      '</div><div class="form-error" id="m-error" role="alert"></div>' +
      '<div class="modal-actions"><button type="button" class="btn" id="m-back">Volver</button><button type="button" class="btn danger" id="m-discard">Descartar</button><button type="button" class="btn primary" id="m-save">Guardar sesión</button></div>'
    );
    el('m-subject').value = sid;
    el('m-type').value = el('t-type').value;
    el('m-back').onclick = closeModal;
    el('m-discard').onclick = () => { closeModal(); discardTimer(); };
    el('m-save').onclick = () => {
      const m = parseInt(el('m-min').value, 10);
      if (!isFinite(m) || m < 1 || m > 1439) { el('m-error').textContent = 'La duración debe estar entre 1 y 1439 minutos.'; return; }
      const end = new Date();
      const start = new Date(end.getTime() - m * 60000);
      const sess = {
        id: uid(), subjectId: el('m-subject').value, date: fmtDate(start), start: fmtTime(start), end: fmtTime(end),
        minutes: 0, type: el('m-type').value, notes: el('m-notes').value.trim().slice(0, 300)
      };
      sess.minutes = calcMinutes(sess.start, sess.end);
      if (!subjectById(sess.subjectId) || sess.minutes <= 0) { el('m-error').textContent = 'No se pudo calcular la sesión.'; return; }
      state.sessions.push(sess);
      state.settings.lastSubject = sess.subjectId;
      state.settings.lastType = sess.type;
      saveState();
      closeModal();
      resetTimer();
      render();
      toast('Sesión guardada · ' + fmtDur(sess.minutes));
    };
  }

  /* =====================================================================
     ASIGNATURAS Y OBJETIVOS
     ===================================================================== */
  function renderSubjects() {
    const t = todayStr();
    const wk = weekBounds(t), mo = monthBounds(t);
    const weekList = inRange(wk.from, wk.to);
    const weekBy = bySubject(weekList);
    const totBy = bySubject(state.sessions);
    const cnt = {};
    state.sessions.forEach(s => { cnt[s.subjectId] = (cnt[s.subjectId] || 0) + 1; });

    if (document.activeElement !== el('g-weekly')) el('g-weekly').value = state.settings.weeklyGoal;
    if (document.activeElement !== el('g-monthly')) el('g-monthly').value = state.settings.monthlyGoal;
    el('goals-progress').innerHTML =
      goalRow('Esta semana', sum(weekList), state.settings.weeklyGoal, true) +
      goalRow('Este mes', sum(inRange(mo.from, mo.to)), state.settings.monthlyGoal, false) +
      '<p class="muted small" style="margin-top:10px">Planificado en las asignaturas: ' + nf1.format(plannedWeeklyHours()) + ' h/semana' +
      (state.settings.weeklyGoal > 0 && Math.abs(plannedWeeklyHours() - state.settings.weeklyGoal) > 0.01 ? ' (el objetivo global es ' + nf1.format(state.settings.weeklyGoal) + ' h)' : '') + '.</p>';

    if (!state.subjects.length) {
      el('subject-list').innerHTML = '<div class="notice" style="grid-column:1/-1">No hay asignaturas. Pulsa «Nueva asignatura» para crear la primera.</div>';
      return;
    }
    el('subject-list').innerHTML = state.subjects.map(s => {
      const wm = weekBy[s.id] || 0;
      const pct = s.weeklyGoal > 0 ? wm / (s.weeklyGoal * 60) * 100 : null;
      const goalLine = s.weeklyGoal > 0
        ? '<div class="goal-head"><span>Esta semana: <strong>' + fmtDur(wm) + '</strong> de ' + nf1.format(s.weeklyGoal) + ' h</span><span class="badge ' + (pct >= 100 ? 'ok' : barClass(pct, true) === 'warn' ? 'warn' : '') + '">' + Math.round(pct) + ' %</span></div>' + bar(pct, barClass(pct, true))
        : '<div class="goal-head"><span class="muted">Sin objetivo semanal · esta semana: ' + fmtDur(wm) + '</span></div>';
      return '<article class="subject-card" style="--c:' + s.color + '">' +
        '<div class="sc-head"><h3><span class="dot"></span>' + esc(s.name) + '</h3><div class="sc-actions"><button type="button" class="btn sm" data-action="edit-subject" data-id="' + esc(s.id) + '">Editar</button><button type="button" class="btn sm danger" data-action="delete-subject" data-id="' + esc(s.id) + '">Eliminar</button></div></div>' +
        goalLine +
        '<dl class="sc-stats"><div><dt>Acumulado</dt><dd>' + fmtDur(totBy[s.id] || 0) + '</dd></div><div><dt>Sesiones</dt><dd>' + (cnt[s.id] || 0) + '</dd></div>' +
        '<div><dt>Objetivo/sem.</dt><dd><span class="goal-input-wrap"><input type="number" class="goal-input" data-goal="' + esc(s.id) + '" min="0" max="100" step="0.5" value="' + s.weeklyGoal + '" aria-label="Objetivo semanal en horas de ' + esc(s.name) + '"> h</span></dd></div></dl>' +
        '</article>';
    }).join('');
  }

  function openSubjectModal(id) {
    const s = id ? subjectById(id) : null;
    const usedColors = state.subjects.map(x => x.color.toLowerCase());
    const color = s ? s.color : (PALETTE.find(c => !usedColors.includes(c)) || PALETTE[state.subjects.length % PALETTE.length]);
    openModal(
      '<h2>' + (s ? 'Editar asignatura' : 'Nueva asignatura') + '</h2>' +
      '<div class="form-grid">' +
      '<div class="full"><label for="sm-name">Nombre</label><input type="text" id="sm-name" maxlength="60" value="' + esc(s ? s.name : '') + '"></div>' +
      '<div><label for="sm-color">Color</label><input type="color" id="sm-color" value="' + color + '"></div>' +
      '<div><label for="sm-goal">Objetivo semanal (h)</label><input type="number" id="sm-goal" min="0" max="100" step="0.5" value="' + (s ? s.weeklyGoal : 0) + '"></div>' +
      '</div><div class="form-error" id="sm-error" role="alert"></div>' +
      '<div class="modal-actions"><button type="button" class="btn" id="sm-cancel">Cancelar</button><button type="button" class="btn primary" id="sm-save">' + (s ? 'Guardar cambios' : 'Añadir') + '</button></div>'
    );
    el('sm-cancel').onclick = closeModal;
    const save = () => {
      const name = el('sm-name').value.trim();
      const goal = parseFloat(String(el('sm-goal').value).replace(',', '.'));
      if (!name) { el('sm-error').textContent = 'Escribe un nombre.'; return; }
      if (state.subjects.some(x => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) { el('sm-error').textContent = 'Ya existe una asignatura con ese nombre.'; return; }
      if (!isFinite(goal) || goal < 0 || goal > 100) { el('sm-error').textContent = 'El objetivo debe estar entre 0 y 100 horas.'; return; }
      if (s) { s.name = name.slice(0, 60); s.color = el('sm-color').value; s.weeklyGoal = goal; }
      else state.subjects.push({ id: uid(), name: name.slice(0, 60), color: el('sm-color').value, weeklyGoal: goal });
      saveState();
      closeModal();
      render();
      toast(s ? 'Asignatura actualizada' : 'Asignatura añadida');
    };
    el('sm-save').onclick = save;
    el('sm-name').addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  }

  function deleteSubject(id) {
    const s = subjectById(id);
    if (!s) return;
    const n = state.sessions.filter(x => x.subjectId === id).length;
    const msg = n
      ? '¿Eliminar «' + s.name + '»? Se borrarán también sus ' + n + ' sesiones (' + fmtDur(sum(state.sessions.filter(x => x.subjectId === id))) + '). Esta acción no se puede deshacer; considera exportar antes una copia de seguridad.'
      : '¿Eliminar la asignatura «' + s.name + '»?';
    if (!confirm(msg)) return;
    state.subjects = state.subjects.filter(x => x.id !== id);
    state.sessions = state.sessions.filter(x => x.subjectId !== id);
    if (timer.subjectId === id) { timer.subjectId = ''; saveTimer(); }
    if (state.settings.lastSubject === id) state.settings.lastSubject = '';
    if (ui.filters.subject === id) ui.filters.subject = '';
    if (editingId && !state.sessions.some(x => x.id === editingId)) editingId = null;
    saveState();
    render();
    toast('Asignatura eliminada');
  }

  function setGlobalGoal(key, inputId, max) {
    const v = parseFloat(String(el(inputId).value).replace(',', '.'));
    if (!isFinite(v) || v < 0 || v > max) {
      toast('Introduce un número entre 0 y ' + max + '.', true);
      el(inputId).value = state.settings[key];
      return;
    }
    state.settings[key] = v;
    saveState();
    render();
  }

  /* =====================================================================
     ESTADÍSTICAS
     ===================================================================== */
  function statsRange() {
    const t = todayStr();
    const p = el('st-period').value;
    let from = t, to = t, label = '';
    switch (p) {
      case 'week': from = weekStart(t); to = addDays(from, 6); label = 'Esta semana'; break;
      case 'month': from = monthStart(t); to = monthEnd(t); label = 'Este mes'; break;
      case '7d': from = addDays(t, -6); label = 'Últimos 7 días'; break;
      case '30d': from = addDays(t, -29); label = 'Últimos 30 días'; break;
      case '90d': from = addDays(t, -89); label = 'Últimos 90 días'; break;
      case 'year': from = t.slice(0, 4) + '-01-01'; to = t.slice(0, 4) + '-12-31'; label = 'Este año'; break;
      case 'all': from = state.sessions.length ? state.sessions.reduce((a, s) => s.date < a ? s.date : a, t) : t; label = 'Todo el historial'; break;
      case 'custom': {
        let f = el('st-from').value, e = el('st-to').value;
        if (!isValidDate(f)) f = isValidDate(e) ? e : t;
        if (!isValidDate(e)) e = t;
        if (f > e) { const x = f; f = e; e = x; }
        from = f; to = e; label = 'Personalizado'; break;
      }
    }
    const effTo = to < t ? to : t;
    const days = Math.max(1, diffDays(from, effTo) + 1);
    return { from, to, effTo, days, label, key: p };
  }

  function statsSubjectRows(r) {
    const per = inRange(r.from, r.to);
    const pm = bySubject(per);
    const tm = bySubject(state.sessions);
    const pc = {}, tc = {};
    per.forEach(s => { pc[s.subjectId] = (pc[s.subjectId] || 0) + 1; });
    state.sessions.forEach(s => { tc[s.subjectId] = (tc[s.subjectId] || 0) + 1; });
    return state.subjects.map(s => ({ s, periodMin: pm[s.id] || 0, totalMin: tm[s.id] || 0, periodCnt: pc[s.id] || 0, totalCnt: tc[s.id] || 0 }))
      .sort((a, b) => b.periodMin - a.periodMin || b.totalMin - a.totalMin);
  }

  function renderStats() {
    const r = statsRange();
    const custom = el('st-period').value === 'custom';
    el('st-custom-from').classList.toggle('hidden', !custom);
    el('st-custom-to').classList.toggle('hidden', !custom);
    el('st-range-label').textContent = r.label + ' · ' + fmtDM(r.from) + ' – ' + fmtDM(r.to) + ' ' + parseDate(r.to).getFullYear();

    const per = inRange(r.from, r.to);
    const total = sum(per);
    const dm = byDate(per);
    const studiedDays = Object.keys(dm).length;
    const bestDay = topKey(dm);
    const wdm = groupMinutes(per, s => weekdayIdx(s.date));
    const bestWd = topKey(wdm);
    const topSub = topKey(bySubject(per));
    const topSubject = topSub ? subjectById(topSub.key) : null;

    el('st-kpis').innerHTML =
      kpi('Total del periodo', fmtDur(total), per.length + (per.length === 1 ? ' sesión' : ' sesiones')) +
      kpi('Media diaria', fmtDur(total / r.days), 'sobre ' + r.days + (r.days === 1 ? ' día' : ' días')) +
      kpi('Media por día estudiado', studiedDays ? fmtDur(total / studiedDays) : '—', studiedDays + ' de ' + r.days + ' días con estudio') +
      kpi('Día más productivo', bestDay ? fmtMid(bestDay.key) : '—', bestDay ? fmtDur(bestDay.minutes) : '') +
      kpi('Día de la semana más productivo', bestWd ? capitalize(WEEKDAYS[bestWd.key]) : '—', bestWd ? fmtDur(bestWd.minutes) + ' en total' : '') +
      kpi('Asignatura más trabajada', topSubject ? topSubject.name : '—', topSubject ? fmtDur(topSub.minutes) : '');

    const rows = statsSubjectRows(r);
    // Horas por asignatura
    const withData = rows.filter(x => x.periodMin > 0);
    drawChart('ch-st-subject', {
      type: 'bar',
      data: { labels: withData.map(x => x.s.name), datasets: [{ label: 'Horas', data: withData.map(x => hrs(x.periodMin)), backgroundColor: withData.map(x => x.s.color), borderRadius: 3 }] },
      options: baseOpts({
        indexAxis: 'y',
        scales: { x: { beginAtZero: true, ticks: { callback: v => nf1.format(v) + ' h' } }, y: { grid: { display: false } } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + fmtDur(ctx.parsed.x * 60) } } }
      })
    }, withData.length === 0);

    // Tipos
    const tm = byType(per);
    const typeKeys = Object.keys(TYPES).filter(k => (tm[k] || 0) > 0);
    drawChart('ch-st-type', {
      type: 'doughnut',
      data: { labels: typeKeys.map(k => TYPES[k]), datasets: [{ data: typeKeys.map(k => hrs(tm[k])), backgroundColor: typeKeys.map(k => TYPE_COLORS[k]), borderWidth: 2, borderColor: '#fff' }] },
      options: baseOpts({ cutout: '58%', plugins: { legend: { position: 'right', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: ctx => ' ' + ctx.label + ': ' + fmtDur(ctx.parsed * 60) + ' (' + Math.round(ctx.parsed * 60 / total * 100) + ' %)' } } } })
    }, typeKeys.length === 0);

    // Semanas dentro del periodo (máx. 26 más recientes)
    let weeks = [];
    for (let w = weekStart(r.from); w <= weekStart(r.effTo >= r.from ? r.effTo : r.from); w = addDays(w, 7)) weeks.push(w);
    if (weeks.length > 26) weeks = weeks.slice(-26);
    const wm = groupMinutes(per, s => weekStart(s.date));
    drawChart('ch-st-week', {
      type: 'bar',
      data: { labels: weeks.map(fmtDM), datasets: [{ label: 'Horas', data: weeks.map(w => hrs(wm[w] || 0)), backgroundColor: '#16325c', borderRadius: 3 }] },
      options: baseOpts({
        scales: { y: hoursAxis, x: { grid: { display: false } } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: items => 'Semana del ' + fmtDM(weeks[items[0].dataIndex]), label: tipHours } } }
      })
    }, total === 0);

    // Meses (últimos 12, independiente del periodo)
    const now = parseDate(todayStr());
    const months = [];
    for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1, 12); months.push(fmtDate(d).slice(0, 7)); }
    const mm = groupMinutes(state.sessions, s => s.date.slice(0, 7));
    drawChart('ch-st-month', {
      type: 'bar',
      data: { labels: months.map(k => parseDate(k + '-01').toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })), datasets: [{ label: 'Horas', data: months.map(k => hrs(mm[k] || 0)), backgroundColor: '#1d4177', borderRadius: 3 }] },
      options: baseOpts({ scales: { y: hoursAxis, x: { grid: { display: false } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: tipHours } } } })
    }, state.sessions.length === 0);

    renderFourWeeks();

    // Tabla de asignaturas
    const totP = sum(per), totAll = sum(state.sessions);
    el('st-table').innerHTML = state.subjects.length
      ? '<table><thead><tr><th>Asignatura</th><th class="num">Horas en el periodo</th><th class="num">% del periodo</th><th class="num">Total acumulado</th><th class="num">Sesiones (periodo / total)</th></tr></thead><tbody>' +
        rows.map(x => '<tr><td><span class="dot" style="--c:' + x.s.color + '"></span>' + esc(x.s.name) + '</td><td class="num">' + fmtDur(x.periodMin) + '</td><td class="num">' + (totP ? Math.round(x.periodMin / totP * 100) + ' %' : '—') + '</td><td class="num">' + fmtDur(x.totalMin) + '</td><td class="num">' + x.periodCnt + ' / ' + x.totalCnt + '</td></tr>').join('') +
        '</tbody><tfoot><tr><td>Total</td><td class="num">' + fmtDur(totP) + '</td><td class="num">' + (totP ? '100 %' : '—') + '</td><td class="num">' + fmtDur(totAll) + '</td><td class="num">' + per.length + ' / ' + state.sessions.length + '</td></tr></tfoot></table>'
      : '<p class="muted">No hay asignaturas.</p>';
  }

  function renderFourWeeks() {
    const t = todayStr();
    const cur = weekStart(t);
    const weeks = [addDays(cur, -21), addDays(cur, -14), addDays(cur, -7), cur];
    const list = inRange(weeks[0], addDays(cur, 6));
    const wkSub = {};
    weeks.forEach(w => { wkSub[w] = {}; });
    list.forEach(s => { const w = weekStart(s.date); wkSub[w][s.subjectId] = (wkSub[w][s.subjectId] || 0) + s.minutes; });
    const subs = state.subjects.filter(s => weeks.some(w => (wkSub[w][s.id] || 0) > 0));
    const labels = weeks.map((w, i) => fmtDM(w) + (i === 3 ? ' (en curso)' : ''));
    drawChart('ch-st-4w', {
      type: 'bar',
      data: { labels, datasets: subs.map(s => ({ label: s.name, data: weeks.map(w => hrs(wkSub[w][s.id] || 0)), backgroundColor: s.color, stack: 'a' })) },
      options: baseOpts({
        scales: { x: { stacked: true, grid: { display: false } }, y: Object.assign({ stacked: true }, hoursAxis) },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmtDur(ctx.parsed.y * 60) } } }
      })
    }, subs.length === 0);

    const totals = weeks.map(w => sum(list.filter(s => weekStart(s.date) === w)));
    const rowsSubs = state.subjects.filter(s => weeks.some(w => (wkSub[w][s.id] || 0) > 0) || s.weeklyGoal > 0);
    el('st-4w-table').innerHTML = '<table><thead><tr><th>Asignatura</th>' + labels.map(l => '<th class="num">' + l + '</th>').join('') + '<th class="num">Media semanal</th><th class="num">Objetivo</th></tr></thead><tbody>' +
      rowsSubs.map(s => {
        const vals = weeks.map(w => wkSub[w][s.id] || 0);
        return '<tr><td><span class="dot" style="--c:' + s.color + '"></span>' + esc(s.name) + '</td>' + vals.map(v => '<td class="num">' + fmtDur(v) + '</td>').join('') + '<td class="num">' + fmtDur(vals.reduce((a, b) => a + b, 0) / 4) + '</td><td class="num">' + (s.weeklyGoal > 0 ? nf1.format(s.weeklyGoal) + ' h' : '—') + '</td></tr>';
      }).join('') +
      '</tbody><tfoot><tr><td>Total</td>' + totals.map(v => '<td class="num">' + fmtDur(v) + '</td>').join('') + '<td class="num">' + fmtDur(totals.reduce((a, b) => a + b, 0) / 4) + '</td><td class="num">' + (state.settings.weeklyGoal > 0 ? nf1.format(state.settings.weeklyGoal) + ' h' : '—') + '</td></tr></tfoot></table>';
  }

  /* =====================================================================
     CALENDARIO (mapa de calor)
     ===================================================================== */
  function renderCalendar() {
    const t = todayStr();
    if (!ui.cal) { const d = parseDate(t); ui.cal = { y: d.getFullYear(), m: d.getMonth() }; if (!ui.calSel) ui.calSel = t; }
    const first = new Date(ui.cal.y, ui.cal.m, 1, 12);
    const firstStr = fmtDate(first);
    const lastStr = monthEnd(firstStr);
    const nDays = parseInt(lastStr.slice(8), 10);
    const offset = (first.getDay() + 6) % 7;
    const list = inRange(firstStr, lastStr);
    const dm = byDate(list);
    const maxM = Math.max(120, ...Object.values(dm));
    el('cal-title').textContent = first.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    let html = '';
    for (let i = 0; i < offset; i++) html += '<div class="cal-cell empty"></div>';
    for (let d = 1; d <= nDays; d++) {
      const ds = firstStr.slice(0, 8) + pad(d);
      const m = dm[ds] || 0;
      const r = m / maxM;
      const lvl = m === 0 ? 0 : r <= 0.25 ? 1 : r <= 0.5 ? 2 : r <= 0.75 ? 3 : 4;
      html += '<button type="button" class="cal-cell l' + lvl + (ds === t ? ' today' : '') + (ds === ui.calSel ? ' selected' : '') + (ds > t ? ' future' : '') +
        '" data-action="cal-day" data-date="' + ds + '" title="' + fmtLong(ds) + ': ' + fmtDur(m) + '" aria-label="' + fmtLong(ds) + ', ' + fmtDur(m) + '"><span class="d">' + d + '</span><span class="h">' + (m ? nf1.format(m / 60) + ' h' : '') + '</span></button>';
    }
    el('cal-grid').innerHTML = html;

    const studied = Object.keys(dm).length;
    const best = topKey(dm);
    el('cal-summary').textContent = 'Días con estudio: ' + studied + ' · Total del mes: ' + fmtDur(sum(list)) + (best ? ' · Mejor día: ' + fmtDM(best.key) + ' (' + fmtDur(best.minutes) + ')' : '');

    // Detalle del día
    const box = el('cal-day');
    if (!ui.calSel) { box.innerHTML = '<p class="muted">Selecciona un día para ver sus sesiones.</p>'; return; }
    const day = sortSessionsDesc(state.sessions.filter(s => s.date === ui.calSel)).reverse();
    let h = '<div class="view-head" style="margin-bottom:10px"><div><h2 style="margin-bottom:2px">' + capitalize(fmtLong(ui.calSel)) + '</h2><p class="muted small">' + (day.length ? day.length + (day.length === 1 ? ' sesión' : ' sesiones') + ' · ' + fmtDur(sum(day)) : 'Sin sesiones este día') + '</p></div>' +
      (ui.calSel <= t ? '<button type="button" class="btn sm primary" data-action="new-on" data-date="' + ui.calSel + '">+ Añadir sesión</button>' : '') + '</div>';
    h += day.map(s => {
      const sub = subjectById(s.subjectId);
      return '<div class="day-session"><div class="ds-main"><span class="dot" style="--c:' + (sub ? sub.color : '#999') + '"></span><div><strong>' + esc(sub ? sub.name : '—') + '</strong> · ' + s.start + ' – ' + s.end + ' · ' + fmtDur(s.minutes) + ' · ' + TYPES[s.type] +
        (s.notes ? '<div class="muted small">' + esc(s.notes) + '</div>' : '') + '</div></div>' +
        '<div class="row-actions"><button type="button" class="btn sm" data-action="edit-session" data-id="' + esc(s.id) + '">Editar</button><button type="button" class="btn sm danger" data-action="delete-session" data-id="' + esc(s.id) + '">Eliminar</button></div></div>';
    }).join('');
    box.innerHTML = h;
  }

  function calMove(delta) {
    const d = new Date(ui.cal.y, ui.cal.m + delta, 1, 12);
    ui.cal = { y: d.getFullYear(), m: d.getMonth() };
    ui.calSel = null;
    renderCalendar();
  }

  /* =====================================================================
     AJUSTES: exportar, importar, CSV, reinicio
     ===================================================================== */
  function renderSettings() {
    let size = 0;
    try { size = new Blob([localStorage.getItem(STORAGE_KEY) || '']).size; } catch (e) { /* nada */ }
    el('s-info').textContent = state.subjects.length + ' asignaturas · ' + state.sessions.length + ' sesiones · ' + (size / 1024).toFixed(1).replace('.', ',') + ' KB usados en este navegador.';
    el('s-last-export').textContent = state.settings.lastExport
      ? 'Última exportación: ' + new Date(state.settings.lastExport).toLocaleString('es-ES')
      : 'Todavía no has exportado ninguna copia.';
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function exportJSON() {
    const stamp = new Date().toISOString();
    state.settings.lastExport = stamp;
    saveState();
    const payload = { app: 'study-tracker', version: 1, exportedAt: stamp, subjects: state.subjects, sessions: state.sessions, settings: state.settings };
    download('study-tracker-copia-' + todayStr() + '.json', JSON.stringify(payload, null, 2), 'application/json');
    renderSettings();
    toast('Copia de seguridad exportada');
  }

  function importJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => toast('No se pudo leer el archivo.', true);
    reader.onload = () => {
      let res;
      try { res = sanitize(JSON.parse(reader.result)); }
      catch (e) { toast('El archivo no es una copia de seguridad válida.', true); return; }
      const n = res.state;
      const msg = 'Se reemplazarán TODOS los datos actuales por:\n• ' + n.subjects.length + ' asignaturas\n• ' + n.sessions.length + ' sesiones' +
        (res.dropped ? '\n(' + res.dropped + ' sesiones inválidas se descartarán)' : '') + '\n\n¿Continuar?';
      if (!confirm(msg)) return;
      state = n;
      ui.filters = { subject: '', from: '', to: '', type: '' };
      saveState();
      resetForm(false);
      render();
      toast('Datos importados correctamente');
    };
    reader.readAsText(file);
  }

  const csvText = v => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return csvCell(s); };
  const csvCell = s => /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  const csvNum = n => String(Math.round(n * 100) / 100).replace('.', ',');
  const csvFile = rows => '\ufeff' + rows.map(r => r.join(';')).join('\r\n');

  function exportSessionsCSV() {
    const rows = [['Fecha', 'Inicio', 'Fin', 'Duración (min)', 'Horas', 'Asignatura', 'Tipo', 'Observaciones']];
    sortSessionsDesc(state.sessions).forEach(s => {
      const sub = subjectById(s.subjectId);
      rows.push([s.date, s.start, s.end, s.minutes, csvNum(s.minutes / 60), csvText(sub ? sub.name : ''), TYPES[s.type], csvText(s.notes)]);
    });
    download('study-tracker-sesiones-' + todayStr() + '.csv', csvFile(rows), 'text/csv;charset=utf-8');
  }

  function exportStatsCSV() {
    const r = statsRange();
    const rows = [['Asignatura', 'Periodo desde', 'Periodo hasta', 'Horas en el periodo', 'Horas acumuladas', 'Sesiones en el periodo', 'Sesiones totales', 'Objetivo semanal (h)']];
    statsSubjectRows(r).forEach(x => rows.push([csvText(x.s.name), r.from, r.to, csvNum(x.periodMin / 60), csvNum(x.totalMin / 60), x.periodCnt, x.totalCnt, csvNum(x.s.weeklyGoal)]));
    download('study-tracker-estadisticas-' + todayStr() + '.csv', csvFile(rows), 'text/csv;charset=utf-8');
  }

  function resetAll() {
    if (!confirm('¿Reiniciar TODOS los datos? Se borrarán sesiones, objetivos y cronómetro, y se restaurarán las asignaturas iniciales.')) return;
    const word = prompt('Esta acción no se puede deshacer. Escribe BORRAR para confirmar:');
    if (!word || word.trim().toUpperCase() !== 'BORRAR') { toast('Reinicio cancelado'); return; }
    state = defaultState();
    timer = defaultTimer();
    ui.filters = { subject: '', from: '', to: '', type: '' };
    saveState();
    saveTimer();
    resetForm(false);
    render();
    toast('Datos reiniciados');
  }

  /* =====================================================================
     Eventos
     ===================================================================== */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const id = b.dataset.id;
    switch (b.dataset.action) {
      case 'edit-session': editSession(id); break;
      case 'delete-session': deleteSession(id); break;
      case 'new-subject': openSubjectModal(); break;
      case 'edit-subject': openSubjectModal(id); break;
      case 'delete-subject': deleteSubject(id); break;
      case 'cal-day': ui.calSel = b.dataset.date; renderCalendar(); break;
      case 'cal-prev': calMove(-1); break;
      case 'cal-next': calMove(1); break;
      case 'cal-today': { const d = parseDate(todayStr()); ui.cal = { y: d.getFullYear(), m: d.getMonth() }; ui.calSel = todayStr(); renderCalendar(); break; }
      case 'new-on': newSessionOn(b.dataset.date); break;
      case 'more-history': ui.histLimit += 50; renderHistory(); break;
      case 'now': el(b.dataset.target).value = nowHM(); updateDuration(); break;
    }
  });

  document.addEventListener('change', e => {
    const t = e.target;
    if (t.matches && t.matches('.goal-input')) {
      const s = subjectById(t.dataset.goal);
      const v = parseFloat(String(t.value).replace(',', '.'));
      if (s && isFinite(v) && v >= 0 && v <= 100) { s.weeklyGoal = v; saveState(); render(); }
      else { toast('El objetivo debe estar entre 0 y 100 horas.', true); render(); }
    }
  });

  el('session-form').addEventListener('submit', submitSession);
  ['f-start', 'f-end'].forEach(id => { el(id).addEventListener('input', updateDuration); el(id).addEventListener('change', updateDuration); });
  el('f-cancel').addEventListener('click', () => resetForm(false));

  ['h-subject', 'h-from', 'h-to', 'h-type'].forEach(id => el(id).addEventListener('change', readFilters));
  el('h-clear').addEventListener('click', () => {
    el('h-subject').value = ''; el('h-from').value = ''; el('h-to').value = ''; el('h-type').value = '';
    readFilters();
  });

  el('t-start').addEventListener('click', startTimer);
  el('t-pause').addEventListener('click', pauseTimer);
  el('t-finish').addEventListener('click', finishTimer);
  el('t-discard').addEventListener('click', discardTimer);
  el('t-subject').addEventListener('change', () => { if (timer.status !== 'idle') { timer.subjectId = el('t-subject').value; saveTimer(); } });
  el('t-type').addEventListener('change', () => { timer.type = el('t-type').value; if (timer.status !== 'idle') saveTimer(); });

  el('g-weekly').addEventListener('change', () => setGlobalGoal('weeklyGoal', 'g-weekly', 168));
  el('g-monthly').addEventListener('change', () => setGlobalGoal('monthlyGoal', 'g-monthly', 744));

  el('st-period').addEventListener('change', () => {
    if (el('st-period').value === 'custom' && !el('st-from').value) { el('st-from').value = addDays(todayStr(), -29); el('st-to').value = todayStr(); }
    renderStats();
  });
  ['st-from', 'st-to'].forEach(id => el(id).addEventListener('change', renderStats));
  el('st-csv').addEventListener('click', exportStatsCSV);

  el('s-export').addEventListener('click', exportJSON);
  el('s-import-btn').addEventListener('click', () => el('s-import').click());
  el('s-import').addEventListener('change', e => { importJSON(e.target.files[0]); e.target.value = ''; });
  el('s-csv-sessions').addEventListener('click', exportSessionsCSV);
  el('s-csv-stats').addEventListener('click', () => { exportStatsCSV(); });
  el('s-reset').addEventListener('click', resetAll);

  el('modal').addEventListener('mousedown', e => { if (e.target === el('modal')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !el('modal').classList.contains('hidden')) closeModal(); });

  window.addEventListener('hashchange', navigate);
  window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY) { state = loadState(); render(); }
    else if (e.key === TIMER_KEY) { timer = loadTimer(); renderTimerUI(); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderTimerUI(); });
  setInterval(() => { if (timer.status === 'running') renderTimerUI(); }, 1000);

  /* =====================================================================
     Arranque
     ===================================================================== */
  if (!localStorage.getItem(STORAGE_KEY)) saveState();
  resetForm(false);
  navigate();
  if (loadProblem) toast(loadProblem, true);

  // Modo sin conexión / instalable: solo funciona servida por http(s), no abriendo el archivo directamente.
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo offline */ }); });
  }

  // Gancho mínimo para pruebas automáticas (no afecta al uso normal)
  window.__studyTracker = { getState: () => state, calcMinutes, fmtDur };
})();
