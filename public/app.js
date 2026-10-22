// Pathway front end: hash router + small view functions. No build step.
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    keepalive: !!opts.keepalive,
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (res.status === 401 && path !== '/login' && path !== '/session') { location.reload(); throw new Error('signed out'); }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

/* ---------- tiny markdown ---------- */
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}
function md(src) {
  const fences = [];
  src = String(src || '').replace(/```[^\n]*\n([\s\S]*?)```/g, (_, code) => { fences.push(code); return `\u0000F${fences.length - 1}\u0000`; });
  return src.split(/\n{2,}/).map((block) => {
    const b = block.trim();
    let m;
    if ((m = b.match(/^\u0000F(\d+)\u0000$/))) return `<pre><code>${esc(fences[+m[1]])}</code></pre>`;
    if (b.startsWith('## ')) return `<h2>${inline(b.slice(3))}</h2>`;
    const lines = b.split('\n');
    if (lines.every((l) => l.startsWith('- '))) return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`;
    if (lines.every((l) => l.startsWith('|'))) {
      const rows = lines.filter((l) => !/^\|[\s:-]+\|?$/.test(l) || !/^\|[-\s:|]+$/.test(l)).map((l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
      const [head, ...body] = rows;
      return `<div class="tablewrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    return `<p>${lines.map(inline).join('<br>')}</p>`;
  }).join('');
}

/* ---------- shell ---------- */
let session = null;
let cleanup = null;

function theme() {
  try { const t = localStorage.getItem('theme'); if (t) document.documentElement.dataset.theme = t; } catch { /* storage blocked */ }
}
function toggleTheme() {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch { /* ignore */ }
}

function shell(inner, { wide = false } = {}) {
  app.innerHTML = `
    <header class="top">
      <a class="brand" href="#/">Path<span>way</span></a>
      <span class="sp"></span>
      <span class="who">${esc(session.user.username)}</span>
      <button class="btn small" id="theme" type="button">Theme</button>
      <button class="btn small" id="logout" type="button">Sign out</button>
    </header>
    <main>${inner}</main>`;
  $('#theme').onclick = toggleTheme;
  $('#logout').onclick = async () => {
    window.removeEventListener('hashchange', route);
    if (cleanup) { cleanup(); cleanup = null; } // save while still signed in
    await new Promise((r) => setTimeout(r, 150));
    await api('/logout', { method: 'POST', body: {} });
    location.hash = '#/';
    location.reload();
  };
}

/* ---------- auth ---------- */
function renderAuth() {
  const first = session.firstRun;
  let creating = first;
  const draw = () => {
    app.innerHTML = `
      <div class="auth">
        <h1>${creating ? 'Create your account' : 'Sign in'}</h1>
        <p class="lead">${creating ? (first ? 'This first account owns the site.' : 'Pick a username and a password of 8+ characters.') : 'Pick up where you left off.'}</p>
        <form id="f">
          <label>Username<input id="u" autocomplete="username" required minlength="3" maxlength="32" autofocus></label>
          <label>Password<input id="p" type="password" autocomplete="${creating ? 'new-password' : 'current-password'}" required minlength="${creating ? 8 : 1}"></label>
          <p class="msg-err" id="err" role="alert"></p>
          <button class="btn primary" type="submit">${creating ? 'Create account' : 'Sign in'}</button>
        </form>
        ${!first && session.canSignup ? `<p class="lead" style="margin-top:1rem"><a href="#" id="swap">${creating ? 'I already have an account' : 'Create an account'}</a></p>` : ''}
      </div>`;
    $('#swap')?.addEventListener('click', (e) => { e.preventDefault(); creating = !creating; draw(); });
    $('#f').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api(creating ? '/register' : '/login', { method: 'POST', body: { username: $('#u').value.trim(), password: $('#p').value } });
        location.reload();
      } catch (err) { $('#err').textContent = err.message; }
    };
  };
  draw();
}

/* ---------- home ---------- */
const bar = (done, total) => `<div class="bar" role="progressbar" aria-valuenow="${done}" aria-valuemax="${total}"><i style="width:${total ? Math.round((100 * done) / total) : 0}%"></i></div>`;

async function renderHome() {
  const o = await api('/overview');
  const doneAll = o.courses.reduce((n, c) => n + c.done, 0);
  const hours = o.minutes >= 60 ? `${(o.minutes / 60).toFixed(1)} h` : `${o.minutes} min`;
  shell(`
    <div class="page">
      <h1>Welcome back, ${esc(session.user.username)}</h1>
      <p class="lead">${doneAll ? 'Your progress is saved automatically.' : 'Pick a course to begin. Everything you do here is saved.'}</p>
      ${o.last
        ? `<div class="resume"><div class="grow"><small>Continue where you stopped</small><strong>${esc(o.last.title)}</strong><small>${esc(o.last.course_title)}</small></div><a class="btn primary" href="#/l/${esc(o.last.slug)}">Resume</a></div>`
        : ''}
      <div class="stats">
        <div><b>${o.streak}</b><span>day streak</span></div>
        <div><b>${doneAll}</b><span>lessons done</span></div>
        <div><b>${esc(hours)}</b><span>time studied</span></div>
      </div>
      <div class="cards">${o.courses.map((c) => `
        <a class="card" href="#/c/${esc(c.slug)}">
          <h2>${esc(c.title)}</h2><p>${esc(c.description)}</p>
          ${bar(c.done, c.total)}<div class="barlabel">${c.done} of ${c.total} lessons</div>
        </a>`).join('')}</div>
    </div>`);
}

/* ---------- outline ---------- */
const KIND = { video: 'Lecture', quiz: 'Quiz', exercise: 'Exercise', pset: 'Problem set', reading: 'Reading' };

function outline(course, currentSlug) {
  const all = course.modules.flatMap((m) => m.lessons);
  const done = all.filter((l) => l.status === 'done').length;
  return `
    <div class="head"><b>${esc(course.title)}</b>${bar(done, all.length)}<div class="barlabel">${done} of ${all.length} lessons</div></div>
    ${course.modules.map((m) => {
      const d = m.lessons.filter((l) => l.status === 'done').length;
      const open = m.lessons.some((l) => l.slug === currentSlug) || (!currentSlug && m.lessons.some((l) => l.status !== 'done'));
      return `<details ${open ? 'open' : ''}><summary><span>${esc(m.title)}</span><small>${d}/${m.lessons.length}</small></summary>
        ${m.lessons.map((l) => `<a class="item ${l.slug === currentSlug ? 'current' : ''}" href="#/l/${esc(l.slug)}"><span class="dot ${l.status}"></span><span>${esc(l.title)}<br><span class="kind">${KIND[l.type] || l.type} · ${l.minutes} min</span></span></a>`).join('')}
      </details>`;
    }).join('')}`;
}

async function renderCourse(slug) {
  const c = await api(`/courses/${encodeURIComponent(slug)}`);
  shell(`
    <div class="split">
      <nav class="side" aria-label="Course outline">${outline(c, null)}</nav>
      <div class="lesson">
        <div class="crumbs"><a href="#/">Home</a></div>
        <h1>${esc(c.title)}</h1>
        <p class="lead">${esc(c.description)}</p>
        ${c.nextSlug ? `<p><a class="btn primary" href="#/l/${esc(c.nextSlug)}">${c.modules.some((m) => m.lessons.some((l) => l.status !== 'todo')) ? 'Continue' : 'Start course'}</a></p>` : '<p class="banner ok">Course complete.</p>'}
        <div class="prose">${c.modules.map((m) => `<h2>${esc(m.title)}</h2><p>${esc(m.summary)}</p>`).join('')}</div>
        <p class="lead" style="margin-top:2rem;font-size:.85rem">${esc(c.license || '')}${c.source ? ` <a href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">Official course</a>` : ''}</p>
      </div>
    </div>`);
}

/* ---------- Python runner (Web Worker) ---------- */
let worker = null;
let workerReady = null;
let msgId = 0;
const waiting = new Map();

function startWorker() {
  worker = new Worker('/worker.js');
  workerReady = new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      const d = e.data;
      if (d.ready) resolve();
      else if (d.fatal) reject(new Error(d.fatal));
      else if (waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); }
    };
    worker.onerror = (e) => reject(new Error(e.message || 'Python failed to load'));
  });
  workerReady.catch(() => {});
}
function warmUp() { if (!worker) startWorker(); return workerReady; }

async function runPython(payload, timeoutMs) {
  await warmUp();
  const id = ++msgId;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiting.delete(id);
      worker.terminate(); worker = null; workerReady = null; startWorker();
      resolve({ timeout: true });
    }, timeoutMs);
    waiting.set(id, (d) => { clearTimeout(timer); resolve(d); });
    worker.postMessage({ id, payload });
  });
}

/* ---------- lesson ---------- */
async function renderLesson(slug) {
  const [L, course] = await Promise.all([api(`/lessons/${encodeURIComponent(slug)}`), null]);
  const c = await api(`/courses/${encodeURIComponent(L.course.slug)}`);
  const saveTimers = [];
  let secondsTimer = null;
  const put = (body, keepalive = false) => api(`/progress/${encodeURIComponent(L.slug)}`, { method: 'PUT', body, keepalive }).catch(() => {});

  const nav = `
    <div class="nav">
      ${L.prev ? `<a class="btn" href="#/l/${esc(L.prev)}">Previous</a>` : '<span></span>'}
      <button class="btn primary" id="next" type="button">${L.next ? 'Continue' : 'Finish course'}</button>
    </div>`;

  shell(`
    <div class="split">
      <nav class="side" aria-label="Course outline">${outline(c, L.slug)}</nav>
      <article class="lesson">
        <div class="crumbs"><a href="#/c/${esc(L.course.slug)}">${esc(L.course.title)}</a> / ${esc(L.module.title)}</div>
        <h1>${esc(L.title)}</h1>
        <div id="media"></div>
        <div class="prose">${md(L.body)}</div>
        <div id="work"></div>
        ${nav}
      </article>
    </div>`);

  const goNext = async () => {
    // Honor system: finishing a lecture or problem set just means you moved on.
    if (!['exercise', 'quiz'].includes(L.type)) await put({ status: 'done' });
    location.hash = L.next ? `#/l/${L.next}` : `#/c/${L.course.slug}`;
  };
  $('#next').onclick = goNext;

  // time on task (only while the tab is visible)
  secondsTimer = setInterval(() => { if (document.visibilityState === 'visible') put({ seconds: 15, status: 'in_progress' }); }, 15000);
  put({ status: 'in_progress' });

  const flushers = [];
  if (L.type === 'video') mountVideo(L, put, flushers);
  if (L.type === 'exercise') mountExercise(L, put, saveTimers, flushers);
  if (L.type === 'quiz') mountQuiz(L, put);

  cleanup = () => {
    clearInterval(secondsTimer);
    saveTimers.forEach(clearTimeout);
    flushers.forEach((f) => f());
  };
}

function mountVideo(L, put, flushers) {
  const box = $('#media');
  const v = L.video;
  if (!v?.src) {
    box.innerHTML = `<div class="notice"><strong>No video file yet.</strong><br>Put the lecture file at <code>media/${esc(v?.expected || 'lecture-N')}.mp4</code> (next to the app, in the folder mounted as <code>/media</code>), then reload this page.${L.source ? `<br>Meanwhile, watch it on the <a href="${esc(L.source)}" target="_blank" rel="noopener noreferrer">official lecture page</a>.` : ''}</div>`;
    return;
  }
  box.innerHTML = `
    <div class="player" id="player"><video id="vid" controls preload="metadata" playsinline>
      <source src="${esc(v.src)}">${v.captions ? `<track kind="subtitles" srclang="en" label="English" src="${esc(v.captions)}" default>` : ''}
    </video></div>
    <div class="vbar"><span>Speed</span>
      ${[0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => `<button class="btn small" type="button" data-speed="${s}">${s}x</button>`).join('')}
      <span class="sp"></span>
      <button class="btn small" id="aud" type="button" aria-pressed="false">Audio only</button>
    </div>`;
  const vid = $('#vid');
  let lastSaved = 0;
  let finished = L.progress.status === 'done';
  const setSpeed = (s) => {
    vid.playbackRate = s;
    document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('on', +b.dataset.speed === s));
    try { localStorage.setItem('speed', String(s)); } catch { /* ignore */ }
  };
  let speed = 1;
  try { speed = +localStorage.getItem('speed') || 1; } catch { /* ignore */ }
  setSpeed(speed);
  document.querySelectorAll('[data-speed]').forEach((b) => { b.onclick = () => setSpeed(+b.dataset.speed); });
  $('#aud').onclick = (e) => {
    const on = $('#player').classList.toggle('audio-only');
    e.currentTarget.classList.toggle('on', on);
    e.currentTarget.setAttribute('aria-pressed', String(on));
  };
  vid.addEventListener('loadedmetadata', () => {
    const p = L.progress.video_pos;
    if (p > 5 && p < vid.duration - 10) vid.currentTime = p;
  });
  const save = (force) => {
    if (!vid.duration) return;
    const t = vid.currentTime;
    if (!force && Math.abs(t - lastSaved) < 5) return;
    lastSaved = t;
    put({ videoPos: t });
    if (!finished && t / vid.duration >= 0.92) { finished = true; put({ status: 'done' }); }
  };
  vid.addEventListener('timeupdate', () => save(false));
  vid.addEventListener('pause', () => save(true));
  vid.addEventListener('ended', () => { finished = true; put({ videoPos: 0, status: 'done' }); });
  flushers.push(() => { if (vid.duration) put({ videoPos: vid.currentTime }, true); });
}

function mountQuiz(L, put) {
  const work = $('#work');
  const PASS = 0.7;
  let last = null;
  try { last = JSON.parse(L.progress.code || 'null'); } catch { last = null; }
  const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

  function draw() {
    // Options are shuffled on every attempt so you cannot memorise positions.
    const qs = L.tests.map((t, qi) => ({ ...t, qi, opts: shuffle(t.options.map((text, oi) => ({ text, oi }))) }));
    work.innerHTML = `
      ${last ? `<p class="status">Last score: ${last.score} of ${last.total}${last.score / last.total >= PASS ? ' (passed)' : ''}</p>` : ''}
      <form id="qz">
        ${qs.map((q, n) => `
          <fieldset class="q" data-q="${q.qi}">
            <legend>${n + 1}. ${inline(q.q)}</legend>
            ${q.opts.map((o, k) => `<label class="opt"><input type="radio" name="q${q.qi}" value="${o.oi}" required> <span>${inline(o.text)}</span></label>`).join('')}
            <div class="why" hidden></div>
          </fieldset>`).join('')}
        <div class="toolbar"><button class="btn primary" type="submit">Check answers</button><span class="status" id="qst"></span></div>
      </form>
      <div id="qres"></div>`;
    $('#qz').onsubmit = async (e) => {
      e.preventDefault();
      let score = 0;
      qs.forEach((q) => {
        const picked = +new FormData(e.target).get(`q${q.qi}`);
        const ok = picked === q.answer;
        if (ok) score++;
        const box = work.querySelector(`[data-q="${q.qi}"]`);
        box.classList.add(ok ? 'right' : 'wrong');
        box.querySelectorAll('input').forEach((i) => { i.disabled = true; });
        box.querySelectorAll('.opt').forEach((lab) => {
          const v = +lab.querySelector('input').value;
          if (v === q.answer) lab.classList.add('is-answer');
          else if (v === picked) lab.classList.add('is-picked');
        });
        const why = box.querySelector('.why');
        why.hidden = false;
        why.innerHTML = `<strong>${ok ? 'Correct.' : 'Not quite.'}</strong> ${inline(q.why)}`;
      });
      const total = qs.length;
      const passed = score / total >= PASS;
      last = { score, total };
      $('#qz button[type=submit]').disabled = true;
      $('#qres').innerHTML = `<div class="banner ${passed ? 'ok' : 'bad'}">${score} of ${total} correct. ${passed ? 'Passed.' : 'Review the explanations, then try again.'}</div>
        <div class="toolbar"><button class="btn" id="retry" type="button">Try again</button></div>`;
      $('#retry').onclick = () => { window.scrollTo(0, 0); draw(); };
      await put({ attempt: true, code: JSON.stringify({ score, total }), ...(passed ? { status: 'done' } : {}) });
    };
  }
  draw();
}

function mountExercise(L, put, saveTimers, flushers) {
  const key = `draft:${L.slug}`;
  const saved = L.progress.code;
  const start = saved ?? L.starter ?? '';
  const work = $('#work');
  work.innerHTML = `
    <label for="code" class="status">Your code. Tab indents. Ctrl+Enter runs, Shift+Ctrl+Enter checks.</label>
    <textarea id="code" class="editor" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
    <div class="toolbar">
      <button class="btn" id="run" type="button" disabled>Run</button>
      <button class="btn primary" id="check" type="button" disabled>Check</button>
      <button class="btn" id="reset" type="button">Reset</button>
      <span class="sp"></span>
      <span class="status" id="st">Loading Python…</span>
      <button class="btn small" id="copy" type="button">Copy for Claude</button>
    </div>
    <details><summary class="status" style="cursor:pointer">Input for Run (one line per input() call)</summary>
      <textarea id="stdin" class="stdin" spellcheck="false" aria-label="Program input"></textarea></details>
    <div id="out"></div>
    <div class="verify"><strong>Verify with CS50.</strong> This page gives you practice feedback. CS50's own checker is the official test, so run it from the problem page${L.source ? `: <a href="${esc(L.source)}" target="_blank" rel="noopener noreferrer">open the problem set</a>` : ''}.</div>`;
  const code = $('#code');
  code.value = start;
  let lastReport = '';

  const persist = () => put({ code: code.value });
  code.addEventListener('input', () => {
    saveTimers.forEach(clearTimeout); saveTimers.length = 0;
    $('#st').textContent = 'Saving…';
    saveTimers.push(setTimeout(async () => { await persist(); $('#st').textContent = 'Saved'; }, 700));
  });
  flushers.push(() => { if (code.value !== (saved ?? L.starter ?? '')) put({ code: code.value }, true); });

  code.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = code.selectionStart;
      code.setRangeText('    ', s, code.selectionEnd, 'end');
      code.dispatchEvent(new Event('input'));
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      (e.shiftKey ? doCheck : doRun)();
    }
  });

  const setBusy = (b) => { $('#run').disabled = b; $('#check').disabled = b; };
  const out = $('#out');

  async function doRun() {
    setBusy(true); $('#st').textContent = 'Running…';
    const r = await runPython({ mode: 'run', code: code.value, stdin: $('#stdin').value }, 8000);
    setBusy(false); $('#st').textContent = '';
    if (r.timeout) { out.innerHTML = `<div class="banner bad">Stopped after 8 seconds. Is there a loop that never ends, or an input() waiting for a line that was not provided?</div>`; lastReport = 'Run timed out.'; return; }
    if (r.failure) { out.innerHTML = `<div class="banner bad">${esc(r.failure)}</div>`; return; }
    lastReport = r.result.output;
    out.innerHTML = `<div class="panel"><h3>Output</h3><pre>${esc(r.result.output) || '(no output)'}</pre></div>`;
  }

  async function doCheck() {
    setBusy(true); $('#st').textContent = 'Checking…';
    put({ attempt: true, code: code.value });
    const r = await runPython({ mode: 'test', code: code.value, tests: L.tests }, 15000);
    setBusy(false); $('#st').textContent = '';
    if (r.timeout) { out.innerHTML = `<div class="banner bad">Stopped after 15 seconds. A test probably ran into a loop that never ends.</div>`; lastReport = 'Tests timed out.'; return; }
    if (r.failure) { out.innerHTML = `<div class="banner bad">${esc(r.failure)}</div>`; return; }
    const res = r.result.results;
    const passed = res.filter((t) => t.ok).length;
    const all = passed === res.length;
    lastReport = res.map((t) => `${t.ok ? 'PASS' : 'FAIL'} ${t.name}` + (t.ok ? '' : `\n  input: ${JSON.stringify(t.stdin)}\n  expected: ${JSON.stringify(t.expected)}\n  got: ${JSON.stringify(t.got)}${t.error ? `\n  error: ${t.error}` : ''}`)).join('\n');
    out.innerHTML = `
      <div class="banner ${all ? 'ok' : 'bad'}">${all
        ? `All ${res.length} checks passed. Now confirm it with CS50's own checker, then press Continue.`
        : `${passed} of ${res.length} checks passed.`}</div>
      <div class="panel"><h3>Checks</h3>${res.map((t) => `
        <div class="test"><div class="t"><span class="${t.ok ? 'badge-ok' : 'badge-bad'}">${t.ok ? 'Pass' : 'Fail'}</span><span>${esc(t.name)}</span></div>
        ${t.ok ? '' : `
          ${t.stdin ? `<span class="lbl">Input</span><pre>${esc(t.stdin)}</pre>` : ''}
          ${t.expected != null ? `<span class="lbl">Expected output</span><pre>${esc(t.expected) || '(nothing)'}</pre>` : ''}
          ${t.error == null || t.expected != null ? `<span class="lbl">Your output</span><pre>${esc(t.got) || '(nothing)'}</pre>` : ''}
          ${t.error ? `<span class="lbl">Error</span><pre>${esc(t.error)}</pre>` : ''}`}
        </div>`).join('')}</div>`;
    if (all) { await put({ status: 'done', code: code.value }); }
  }

  $('#run').onclick = doRun;
  $('#check').onclick = doCheck;
  $('#reset').onclick = () => {
    if ($('#reset').dataset.sure !== '1') { $('#reset').dataset.sure = '1'; $('#reset').textContent = 'Click again to reset'; setTimeout(() => { $('#reset').dataset.sure = ''; $('#reset').textContent = 'Reset'; }, 3000); return; }
    $('#reset').dataset.sure = ''; $('#reset').textContent = 'Reset';
    code.value = L.starter ?? ''; code.dispatchEvent(new Event('input'));
  };
  $('#copy').onclick = async () => {
    const text = `I'm working on "${L.title}" in ${L.course.title}.\n\nTask:\n${L.body}\n\nMy code:\n\`\`\`python\n${code.value}\n\`\`\`\n\nLast result:\n${lastReport || '(not run yet)'}\n\nGive me a hint, not the full solution.`;
    try { await navigator.clipboard.writeText(text); $('#st').textContent = 'Copied. Paste it into Claude.'; }
    catch { out.innerHTML = `<div class="panel"><h3>Copy this</h3><pre>${esc(text)}</pre></div>`; }
  };

  warmUp().then(() => { setBusy(false); $('#st').textContent = ''; })
    .catch((e) => { $('#st').textContent = 'Python failed to load: ' + e.message; });
}

/* ---------- router ---------- */
async function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  const [, kind, id] = location.hash.split('/');
  try {
    if (kind === 'c' && id) await renderCourse(decodeURIComponent(id));
    else if (kind === 'l' && id) await renderLesson(decodeURIComponent(id));
    else await renderHome();
    window.scrollTo(0, 0);
  } catch (e) {
    if (e.message !== 'signed out') shell(`<div class="page"><h1>Something went wrong</h1><p class="lead">${esc(e.message)}</p><a class="btn" href="#/">Home</a></div>`);
  }
}

async function boot() {
  theme();
  session = await api('/session');
  if (!session.user) return renderAuth();
  window.addEventListener('hashchange', route);
  window.addEventListener('pagehide', () => { if (cleanup) { cleanup(); cleanup = null; } });
  route();
}
boot();
