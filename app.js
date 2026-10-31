import { subjects, allChapters, totalChapters, subjectByKey } from './chapters.js';

const SUPABASE_URL = 'https://bztsnkejidzjjlaghtly.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Cef2U5pCDcDJp9DUpe36KA_8DrAetWc';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
const STATE_TABLE = 'jee_one_shot_os_state';
const START_DATE = '2026-11-01';
const $ = (selector, root = document) => root.querySelector(selector);
const app = $('#app');
let currentUser = null;
let currentPage = 'dashboard';
let subjectFilter = 'ALL';
let searchQuery = '';
let authMode = 'signin';
let recoveryMode = false;
let cloudChannel = null;
let syncTimer = null;
let isHydrating = false;
let state = defaultState();

function defaultState() {
  return { startDate: START_DATE, completed: {}, theme: 'dark' };
}
function localKey(userId) { return `jee-oneshot-os:${userId}`; }
function safeParse(value) {
  try { return value ? JSON.parse(value) : null; } catch { return null; }
}
function mergeState(value) {
  const base = defaultState();
  if (!value || typeof value !== 'object') return base;
  return {
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(value.startDate || '') ? value.startDate : base.startDate,
    completed: value.completed && typeof value.completed === 'object' ? value.completed : {},
    theme: value.theme === 'light' ? 'light' : 'dark',
  };
}
function localSave() {
  if (currentUser) localStorage.setItem(localKey(currentUser.id), JSON.stringify(state));
}
function queueCloudSave() {
  if (!currentUser || isHydrating) return;
  localSave();
  setSyncStatus('Saving…');
  clearTimeout(syncTimer);
  syncTimer = setTimeout(saveCloud, 650);
}
async function saveCloud() {
  if (!currentUser) return;
  const snapshot = JSON.parse(JSON.stringify(state));
  const { error } = await supabase.from(STATE_TABLE).upsert({
    user_id: currentUser.id,
    state: snapshot,
    client_updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) {
    setSyncStatus('Offline · saved on this device');
    console.warn('Cloud sync failed:', error.message);
  } else {
    setSyncStatus('Synced');
  }
}
async function loadCloud() {
  if (!currentUser) return;
  isHydrating = true;
  setSyncStatus('Syncing…');
  const { data, error } = await supabase.from(STATE_TABLE).select('state').eq('user_id', currentUser.id).maybeSingle();
  if (error) {
    state = mergeState(safeParse(localStorage.getItem(localKey(currentUser.id))));
    setSyncStatus('Offline · local copy');
  } else if (data?.state) {
    state = mergeState(data.state);
    localSave();
    setSyncStatus('Synced');
  } else {
    state = mergeState(safeParse(localStorage.getItem(localKey(currentUser.id))));
    await saveCloud();
  }
  isHydrating = false;
  applyTheme();
  renderApp();
  subscribeToCloud();
}
function subscribeToCloud() {
  if (cloudChannel) supabase.removeChannel(cloudChannel);
  if (!currentUser) return;
  cloudChannel = supabase.channel(`oneshot-state-${currentUser.id}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: STATE_TABLE, filter: `user_id=eq.${currentUser.id}`
    }, payload => {
      if (payload.new?.state && !isHydrating) {
        const remote = mergeState(payload.new.state);
        // Only adopt remote changes when they differ; avoids unnecessary rerender loops.
        if (JSON.stringify(remote) !== JSON.stringify(state)) {
          state = remote;
          localSave();
          applyTheme();
          renderApp();
          setSyncStatus('Synced from another device');
        }
      }
    }).subscribe();
}
function setSyncStatus(value) {
  const node = $('#sync-status');
  if (node) node.textContent = value;
}
function applyTheme() {
  document.documentElement.dataset.theme = state.theme || 'dark';
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = state.theme === 'light' ? '#f5f7fb' : '#0b1020';
}
function dateOnly(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function isoDate(date) {
  const d = dateOnly(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function parseISO(value) {
  const [y,m,d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function dayOffset(dateString) {
  return Math.floor((dateOnly(parseISO(dateString)) - dateOnly(parseISO(state.startDate))) / 86400000);
}
function scheduleAtOffset(offset) {
  if (offset < 0) return null;
  const counts = { P: 0, C: 0, M: 0 };
  const caps = Object.fromEntries(subjects.map(s => [s.key, s.chapters.length]));
  let cursor = 0;
  let task = null;
  for (let day = 0; day <= offset; day++) {
    task = null;
    for (let scan = 0; scan < 3; scan++) {
      const key = ['P','C','M'][cursor % 3];
      cursor = (cursor + 1) % 3;
      if (counts[key] < caps[key]) {
        task = subjectByKey[key].chapters[counts[key]];
        counts[key] += 1;
        break;
      }
    }
    if (!task) return null;
  }
  return task;
}
function dateForOffset(offset) {
  const d = parseISO(state.startDate);
  d.setDate(d.getDate() + offset);
  return d;
}
function formatDate(date, options = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat('en-IN', options).format(date);
}
function isComplete(chapter) { return Boolean(state.completed[chapter.key]); }
function completedCount() { return allChapters.reduce((n, c) => n + (isComplete(c) ? 1 : 0), 0); }
function pct() { return Math.round(completedCount() / totalChapters * 100); }
function currentTask() {
  const offset = dayOffset(isoDate(new Date()));
  if (offset < 0) return { beforeStart: true, date: parseISO(state.startDate), chapter: scheduleAtOffset(0) };
  return { beforeStart: false, date: dateForOffset(offset), chapter: scheduleAtOffset(offset), offset };
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function subjectClass(key) { return key === 'P' ? 'physics' : key === 'C' ? 'chemistry' : 'mathematics'; }
function subjectName(key) { return subjectByKey[key]?.name || ''; }
function button(label, attrs = '', klass = 'button') { return `<button class="${klass}" ${attrs}>${label}</button>`; }

function renderAuth(message = '') {
  const title = recoveryMode ? 'Set a new password' : authMode === 'signup' ? 'Create your account' : 'Welcome back';
  const subtitle = recoveryMode ? 'Choose a new password for your account.' : authMode === 'signup' ? 'Create one account to sync progress across PC and Android.' : 'Sign in to pick up where you left off.';
  app.innerHTML = `
    <main class="auth-screen">
      <div class="auth-art"><div class="brand-mark">1<span>OS</span></div><p class="eyebrow">YOUR DAILY STUDY SYSTEM</p><h1>One video.<br><span>Every day.</span></h1><p class="auth-copy">A calm, focused tracker for your JEE one-shot journey across Physics, Chemistry and Mathematics.</p><div class="auth-pills"><span>116 chapters</span><span>3 subjects</span><span>No tests. No revision.</span></div><div class="orb orb-one"></div><div class="orb orb-two"></div></div>
      <section class="auth-panel"><div class="mobile-brand"><div class="brand-mark">1<span>OS</span></div><span>JEE OneShot OS</span></div><div class="auth-box"><p class="eyebrow">JEE ONESHOT OS</p><h2>${title}</h2><p class="muted">${subtitle}</p>
      <form id="auth-form" class="auth-form">
        ${!recoveryMode ? '<label>Email address<input id="auth-email" type="email" autocomplete="email" placeholder="you@example.com" required /></label>' : ''}
        <label>${recoveryMode ? 'New password' : 'Password'}<input id="auth-password" type="password" autocomplete="${recoveryMode ? 'new-password' : authMode === 'signup' ? 'new-password' : 'current-password'}" placeholder="At least 8 characters" minlength="8" required /></label>
        ${recoveryMode ? '<label>Confirm new password<input id="auth-confirm" type="password" autocomplete="new-password" minlength="8" required /></label>' : ''}
        <button class="button primary full" type="submit">${recoveryMode ? 'Update password' : authMode === 'signup' ? 'Create account' : 'Sign in'} <span>→</span></button>
      </form>
      ${!recoveryMode && authMode === 'signin' ? '<button class="text-button" id="forgot-password">Forgot password?</button>' : ''}
      <div class="auth-message ${message ? 'visible' : ''}" id="auth-message">${esc(message)}</div>
      ${!recoveryMode ? `<p class="auth-switch">${authMode === 'signup' ? 'Already have an account?' : 'New to OneShot OS?'} <button class="text-button" id="switch-auth">${authMode === 'signup' ? 'Sign in' : 'Create account'}</button></p>` : ''}
      <p class="fine-print">Your progress is private to your account and syncs through Supabase.</p></div></section>
    </main>`;
  $('#auth-form').addEventListener('submit', handleAuthSubmit);
  $('#switch-auth')?.addEventListener('click', () => { authMode = authMode === 'signup' ? 'signin' : 'signup'; renderAuth(); });
  $('#forgot-password')?.addEventListener('click', handleForgotPassword);
}
function showAuthMessage(message) {
  const el = $('#auth-message');
  if (el) { el.textContent = message; el.classList.add('visible'); }
}
async function handleAuthSubmit(event) {
  event.preventDefault();
  const submit = $('#auth-form button[type="submit"]');
  submit.disabled = true;
  const email = $('#auth-email')?.value.trim();
  const password = $('#auth-password').value;
  try {
    if (recoveryMode) {
      if (password !== $('#auth-confirm').value) throw new Error('Passwords do not match.');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      recoveryMode = false;
      renderAuth('Password updated. Sign in with your new password.');
      return;
    }
    if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data.session) {
        currentUser = data.user;
        state = defaultState();
        localSave();
        await loadCloud();
      } else {
        renderAuth('Account created. Check your email to verify it, then sign in.');
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      currentUser = data.user;
      await loadCloud();
    }
  } catch (error) {
    showAuthMessage(error.message || 'Something went wrong. Please try again.');
  } finally {
    if ($('#auth-form button[type="submit"]')) $('#auth-form button[type="submit"]').disabled = false;
  }
}
async function handleForgotPassword() {
  const email = $('#auth-email')?.value.trim();
  if (!email) { showAuthMessage('Enter your email address first.'); return; }
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  showAuthMessage(error ? error.message : 'If an account exists for that email, a password reset link has been sent.');
}

function renderApp() {
  if (!currentUser) return renderAuth();
  const task = currentTask();
  const done = completedCount();
  const taskDone = task.chapter ? isComplete(task.chapter) : false;
  const firstName = (currentUser.email || 'Student').split('@')[0];
  const pageTitles = { dashboard: 'Dashboard', schedule: 'Daily schedule', chapters: 'Chapter library', settings: 'Settings' };
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-brand"><div class="brand-mark small">1<span>OS</span></div><div><strong>OneShot OS</strong><small>JEE PREP TRACKER</small></div></div>
        <div class="side-label">WORKSPACE</div>
        <nav class="side-nav">
          ${navItem('dashboard','⌂','Dashboard')}
          ${navItem('schedule','▦','Daily schedule')}
          ${navItem('chapters','▤','Chapter library')}
        </nav>
        <div class="sidebar-bottom"><div class="sync-line"><span class="sync-dot"></span><span id="sync-status">Synced</span></div><button class="nav-item ${currentPage === 'settings' ? 'active' : ''}" data-page="settings"><span class="nav-icon">⚙</span><span>Settings</span></button><div class="user-chip"><div class="avatar">${esc(firstName.slice(0,1).toUpperCase())}</div><div class="user-meta"><strong>${esc(firstName)}</strong><small>${esc(currentUser.email)}</small></div><button class="icon-button" id="sign-out" title="Sign out" aria-label="Sign out">↗</button></div></div>
      </aside>
      <main class="main-content">
        <header class="topbar"><div><p class="eyebrow">YOUR JEE STUDY SPACE</p><h1>${pageTitles[currentPage]}</h1></div><div class="top-actions"><span class="date-chip">${formatDate(new Date(), { weekday:'long', day:'numeric', month:'long' })}</span><button class="icon-button theme-toggle" id="theme-toggle" title="Toggle theme">${state.theme === 'dark' ? '☼' : '☾'}</button></div></header>
        ${currentPage === 'dashboard' ? renderDashboard(task, done, taskDone) : currentPage === 'schedule' ? renderSchedule() : currentPage === 'chapters' ? renderChapters() : renderSettings()}
        <footer class="app-footer"><span>JEE OneShot OS</span><span>One video a day · Built for consistency</span></footer>
      </main>
    </div>`;
  bindAppEvents();
}
function navItem(page, icon, label) {
  return `<button class="nav-item ${currentPage === page ? 'active' : ''}" data-page="${page}"><span class="nav-icon">${icon}</span><span>${label}</span>${currentPage === page ? '<span class="nav-active-dot"></span>' : ''}</button>`;
}
function renderDashboard(task, done, taskDone) {
  const progress = pct();
  const chapter = task.chapter;
  let todayCard = '';
  if (task.beforeStart) {
    todayCard = `<div class="today-card"><div class="today-copy"><span class="status-pill upcoming">STARTING SOON</span><h2>Your first video is<br><span>almost here.</span></h2><p>Your plan starts ${formatDate(task.date, {day:'numeric',month:'long',year:'numeric'})}. Physics kicks things off.</p><div class="today-actions">${chapter ? `<a class="button primary" href="${esc(chapter.url)}" target="_blank" rel="noreferrer">Preview first video <span>↗</span></a>` : ''}</div></div><div class="today-visual"><div class="play-orbit"><div class="play-core">▶</div><span class="orbit-label">DAY 01</span></div></div></div>`;
  } else if (!chapter) {
    todayCard = `<div class="today-card finished-card"><div class="today-copy"><span class="status-pill complete">PLAN COMPLETE</span><h2>You made it<br><span>through all 116.</span></h2><p>Every chapter has a place in your completed library. Great work staying consistent.</p></div><div class="today-visual"><div class="play-orbit"><div class="play-core">✓</div></div></div></div>`;
  } else {
    const sub = subjectClass(chapter.subjectKey);
    todayCard = `<div class="today-card ${sub}-hero"><div class="today-copy"><div class="hero-pills"><span class="status-pill">TODAY'S ONE-SHOT</span><span class="subject-pill ${sub}">${esc(chapter.subject)}</span></div><p class="hero-date">DAY ${String(task.offset + 1).padStart(3,'0')} <span>·</span> ${formatDate(task.date, { weekday:'long', day:'numeric', month:'long' })}</p><h2>${esc(chapter.name)}</h2><p class="hero-sub">${esc(chapter.subject)} · Chapter ${String(chapter.number).padStart(2,'0')} of ${subjectByKey[chapter.subjectKey].chapters.length}</p><div class="today-actions"><a class="button primary" href="${esc(chapter.url)}" target="_blank" rel="noreferrer">Watch video <span>↗</span></a><button class="button ${taskDone ? 'completed-button' : 'secondary'}" data-complete="${chapter.key}">${taskDone ? '✓ Completed' : '○ Mark complete'}</button></div></div><div class="today-visual"><div class="play-orbit ${sub}"><div class="play-core">${taskDone ? '✓' : '▶'}</div><span class="orbit-label">${chapter.subjectKey} · ${String(chapter.number).padStart(2,'0')}</span></div></div></div>`;
  }
  return `<section class="welcome-row"><div><h2>Let's keep the streak going, ${esc(firstNameSafe())} <span class="wave">✦</span></h2><p>Small daily progress. One chapter at a time.</p></div><span class="plan-tag"><span class="green-dot"></span> Plan active</span></section>
    ${todayCard}
    <section class="stats-grid">
      <div class="stat-card"><div class="stat-top"><span class="stat-label">CHAPTERS COMPLETED</span><span class="stat-icon blue-icon">✓</span></div><div class="stat-value">${done}<span> / ${totalChapters}</span></div><div class="stat-foot"><div class="mini-bar"><span style="width:${progress}%"></span></div><span>${progress}%</span></div></div>
      <div class="stat-card"><div class="stat-top"><span class="stat-label">LEFT TO WATCH</span><span class="stat-icon violet-icon">▶</span></div><div class="stat-value">${totalChapters - done}<span> videos</span></div><p class="stat-note">One video scheduled per day</p></div>
      <div class="stat-card"><div class="stat-top"><span class="stat-label">TOTAL CHAPTERS</span><span class="stat-icon amber-icon">▤</span></div><div class="stat-value">${totalChapters}<span> entries</span></div><p class="stat-note">Across three JEE subjects</p></div>
    </section>
    <section class="section-block"><div class="section-heading"><div><p class="eyebrow">YOUR ROADMAP</p><h3>Subject progress</h3></div><button class="text-button" data-page="chapters">View all chapters <span>→</span></button></div><div class="subject-progress-grid">${subjects.map(s => {
      const count = s.chapters.filter(isComplete).length;
      const percent = Math.round(count / s.chapters.length * 100);
      return `<article class="subject-progress-card ${subjectClass(s.key)}"><div class="subject-card-top"><span class="subject-mark">${s.key}</span><span class="subject-count">${count}/${s.chapters.length}</span></div><h4>${s.name}</h4><div class="progress-track"><span style="width:${percent}%"></span></div><p>${percent}% complete</p></article>`;
    }).join('')}</div></section>
    <section class="section-block next-up-block"><div class="section-heading"><div><p class="eyebrow">COMING UP</p><h3>Next on your schedule</h3></div><button class="text-button" data-page="schedule">Open schedule <span>→</span></button></div><div class="upcoming-list">${getUpcoming(3).map(item => `<div class="upcoming-row"><div class="upcoming-date"><strong>${String(item.date.getDate()).padStart(2,'0')}</strong><span>${formatDate(item.date,{month:'short'})}</span></div><div class="upcoming-subject ${subjectClass(item.chapter.subjectKey)}"></div><div class="upcoming-title"><strong>${esc(item.chapter.name)}</strong><span>${esc(item.chapter.subject)}</span></div><span class="upcoming-arrow">↗</span></div>`).join('') || '<p class="muted">Your full plan is complete.</p>'}</div></section>`;
}
function firstNameSafe() { return (currentUser?.email || 'there').split('@')[0]; }
function getUpcoming(count = 7) {
  const today = dateOnly(new Date());
  const offset = dayOffset(isoDate(today));
  const start = Math.max(0, offset);
  const result = [];
  for (let i = start; i < start + 45 && result.length < count; i++) {
    const chapter = scheduleAtOffset(i);
    if (!chapter) break;
    const date = dateForOffset(i);
    if (date >= today) result.push({ date, chapter, offset: i });
  }
  return result;
}
function renderSchedule() {
  const todayOffset = dayOffset(isoDate(new Date()));
  const days = [];
  for (let i = Math.max(0, todayOffset); i < Math.max(0, todayOffset) + 14; i++) {
    const chapter = scheduleAtOffset(i);
    if (!chapter) break;
    days.push({ date: dateForOffset(i), chapter, offset: i });
  }
  return `<section class="page-intro"><div><p class="eyebrow">STAY ON TRACK</p><h2>Your daily rotation</h2><p>One video per day, rotating Physics → Chemistry → Mathematics. Finished subjects are skipped so no day is wasted.</p></div><div class="rotation-key"><span class="key-dot physics"></span> Physics <span class="key-dot chemistry"></span> Chemistry <span class="key-dot mathematics"></span> Mathematics</div></section>
  ${todayOffset < 0 ? `<div class="notice-card"><strong>Your plan begins ${formatDate(parseISO(state.startDate),{day:'numeric',month:'long',year:'numeric'})}.</strong><span>The first scheduled video is Physics · Basic Mathematics.</span></div>` : ''}
  <section class="schedule-list">${days.map((item, idx) => {
    const today = isoDate(item.date) === isoDate(new Date());
    const done = isComplete(item.chapter);
    return `<article class="schedule-row ${today ? 'is-today' : ''} ${done ? 'is-done' : ''}"><div class="schedule-date"><span>${today ? 'TODAY' : `DAY ${String(item.offset + 1).padStart(3,'0')}`}</span><strong>${formatDate(item.date,{day:'numeric',month:'short'})}</strong><small>${formatDate(item.date,{weekday:'long'})}</small></div><div class="schedule-marker ${subjectClass(item.chapter.subjectKey)}">${done ? '✓' : item.chapter.subjectKey}</div><div class="schedule-detail"><div class="schedule-detail-top"><span class="subject-pill ${subjectClass(item.chapter.subjectKey)}">${item.chapter.subject}</span>${done ? '<span class="completed-label">Completed</span>' : ''}</div><h3>${esc(item.chapter.name)}</h3><p>Chapter ${item.chapter.number} · ${item.chapter.subject}</p></div><div class="schedule-actions"><a class="icon-button" href="${esc(item.chapter.url)}" target="_blank" rel="noreferrer" title="Watch video">↗</a><button class="icon-button ${done ? 'is-checked' : ''}" data-complete="${item.chapter.key}" title="${done ? 'Mark incomplete' : 'Mark complete'}">${done ? '✓' : '○'}</button></div></article>`;
  }).join('')}</section><p class="schedule-footnote">Showing the next ${days.length} scheduled days. Completion status syncs to your account.</p>`;
}
function renderChapters() {
  const filtered = allChapters.filter(chapter => (subjectFilter === 'ALL' || chapter.subjectKey === subjectFilter) && chapter.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const done = filtered.filter(isComplete).length;
  return `<section class="page-intro"><div><p class="eyebrow">THE FULL ROADMAP</p><h2>Chapter library</h2><p>Open any video or mark it complete. Your progress follows your account across devices.</p></div><div class="library-count"><strong>${completedCount()}</strong><span>of ${totalChapters} complete</span></div></section>
  <section class="library-toolbar"><div class="filter-tabs"><button data-filter="ALL" class="filter-tab ${subjectFilter === 'ALL' ? 'selected' : ''}">All <span>${totalChapters}</span></button>${subjects.map(s => `<button data-filter="${s.key}" class="filter-tab ${subjectFilter === s.key ? 'selected' : ''}">${s.name} <span>${s.chapters.length}</span></button>`).join('')}</div><label class="search-box"><span>⌕</span><input id="chapter-search" type="search" value="${esc(searchQuery)}" placeholder="Search chapters…" /></label></section>
  <div class="library-result-line"><span>${filtered.length} chapters</span><span>${done} completed in this view</span></div>
  <section class="chapter-list">${filtered.map(chapter => {
    const complete = isComplete(chapter);
    return `<article class="chapter-row ${complete ? 'is-done' : ''}"><div class="chapter-number ${subjectClass(chapter.subjectKey)}">${String(chapter.number).padStart(2,'0')}</div><div class="chapter-info"><h3>${esc(chapter.name)}</h3><p><span class="subject-dot ${subjectClass(chapter.subjectKey)}"></span>${chapter.subject} <span class="bullet-sep">·</span> Video ${String(chapter.number).padStart(2,'0')}</p></div><div class="chapter-actions"><a class="icon-button play-link" href="${esc(chapter.url)}" target="_blank" rel="noreferrer" title="Open video">▶</a><button class="complete-toggle ${complete ? 'checked' : ''}" data-complete="${chapter.key}" title="${complete ? 'Mark incomplete' : 'Mark complete'}">${complete ? '✓' : ''}</button></div></article>`;
  }).join('') || '<div class="empty-state"><span>⌕</span><h3>No chapters found</h3><p>Try a different search or subject filter.</p></div>'}</section>`;
}
function renderSettings() {
  return `<section class="page-intro"><div><p class="eyebrow">MAKE IT YOURS</p><h2>Settings</h2><p>Manage your plan and account preferences.</p></div></section>
  <section class="settings-grid"><article class="settings-card"><div class="settings-card-heading"><div class="settings-icon">▦</div><div><h3>Study plan</h3><p>Choose the first day of your daily rotation.</p></div></div><label class="setting-field">Plan start date<input id="start-date" type="date" value="${esc(state.startDate)}" min="2020-01-01" /></label><p class="setting-help">Changing the start date shifts the daily schedule. Completed chapters remain completed.</p></article>
  <article class="settings-card"><div class="settings-card-heading"><div class="settings-icon">◐</div><div><h3>Appearance</h3><p>Choose a comfortable viewing theme.</p></div></div><div class="theme-options"><button data-theme-choice="dark" class="theme-option ${state.theme === 'dark' ? 'selected' : ''}"><span class="theme-preview dark-preview">◐</span><strong>Dark</strong><span>Low-glare workspace</span></button><button data-theme-choice="light" class="theme-option ${state.theme === 'light' ? 'selected' : ''}"><span class="theme-preview light-preview">☼</span><strong>Light</strong><span>Bright and clean</span></button></div></article>
  <article class="settings-card account-settings"><div class="settings-card-heading"><div class="settings-icon">◎</div><div><h3>Account & sync</h3><p>Your progress is private to your signed-in account.</p></div></div><div class="account-email"><span class="avatar">${esc((currentUser.email || 'S').slice(0,1).toUpperCase())}</span><div><strong>${esc(currentUser.email)}</strong><small id="settings-sync-status">${$('#sync-status')?.textContent || 'Connected to Supabase'}</small></div></div><div class="settings-actions"><button class="button secondary" id="sync-now">Sync now</button><button class="button danger-quiet" id="sign-out-settings">Sign out</button></div></article>
  <article class="settings-card plan-includes"><div class="settings-card-heading"><div class="settings-icon">✓</div><div><h3>Plan rules</h3><p>Kept intentionally simple.</p></div></div><ul><li>One scheduled video each day</li><li>Physics → Chemistry → Mathematics rotation</li><li>116 chapters across all three subjects</li><li>No revision module and no tests module</li></ul></article></section>`;
}
function bindAppEvents() {
  $$('[data-page]').forEach(el => el.addEventListener('click', () => { currentPage = el.dataset.page; renderApp(); }));
  $('#sign-out')?.addEventListener('click', signOut);
  $('#sign-out-settings')?.addEventListener('click', signOut);
  $('#theme-toggle')?.addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; applyTheme(); queueCloudSave(); renderApp(); });
  $$('[data-theme-choice]').forEach(el => el.addEventListener('click', () => { state.theme = el.dataset.themeChoice; applyTheme(); queueCloudSave(); renderApp(); }));
  $$('[data-complete]').forEach(el => el.addEventListener('click', () => {
    const key = el.dataset.complete;
    if (state.completed[key]) delete state.completed[key]; else state.completed[key] = true;
    queueCloudSave(); renderApp();
  }));
  $$('[data-filter]').forEach(el => el.addEventListener('click', () => { subjectFilter = el.dataset.filter; renderApp(); }));
  $('#chapter-search')?.addEventListener('input', event => {
    const position = event.target.selectionStart;
    searchQuery = event.target.value;
    renderApp();
    const input = $('#chapter-search');
    input?.focus(); input?.setSelectionRange(position, position);
  });
  $('#start-date')?.addEventListener('change', event => {
    if (!event.target.value) return;
    state.startDate = event.target.value;
    queueCloudSave(); renderApp();
  });
  $('#sync-now')?.addEventListener('click', async () => { await saveCloud(); const el = $('#settings-sync-status'); if (el) el.textContent = $('#sync-status')?.textContent || 'Synced'; });
}
function $$(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
async function signOut() {
  if (cloudChannel) { await supabase.removeChannel(cloudChannel); cloudChannel = null; }
  await supabase.auth.signOut();
  currentUser = null; state = defaultState(); currentPage = 'dashboard'; authMode = 'signin';
  renderAuth();
}

window.addEventListener('online', () => { if (currentUser) saveCloud(); });
window.addEventListener('focus', () => { if (currentUser) loadCloud(); });

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    recoveryMode = true;
    renderAuth();
    return;
  }
  if (session?.user) {
    currentUser = session.user;
    if (!$('#sync-status')) loadCloud();
  } else if (!recoveryMode) {
    currentUser = null;
    renderAuth();
  }
});

(async function init() {
  applyTheme();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    await loadCloud();
  } else if (!recoveryMode) {
    renderAuth();
  }
})();
