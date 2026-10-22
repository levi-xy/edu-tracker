import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, seedAll } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const SECURE = process.env.COOKIE_SECURE === 'true';
const ALLOW_SIGNUP = process.env.ALLOW_SIGNUP === 'true';
const SESSION_DAYS = 30;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '300kb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// ---------- auth helpers ----------
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function setSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + SESSION_DAYS * 864e5;
  db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').run(sha(token), userId, expires);
  res.setHeader('Set-Cookie',
    `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${SECURE ? '; Secure' : ''}`);
}
function clearCookie(res) {
  res.setHeader('Set-Cookie', `sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${SECURE ? '; Secure' : ''}`);
}
function currentUser(req) {
  const token = parseCookies(req).sid;
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.id, u.username, u.is_admin, s.expires_at FROM sessions s
    JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(sha(token));
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha(token));
    return null;
  }
  return { id: row.id, username: row.username, isAdmin: !!row.is_admin };
}

// Mutating API calls must be JSON and same-origin: blocks cross-site form posts.
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (!req.is('application/json')) return res.status(415).json({ error: 'JSON required' });
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Bad origin' });
      } catch { return res.status(403).json({ error: 'Bad origin' }); }
    }
  }
  next();
});

const attempts = new Map();
function throttled(ip) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || a.reset < now) { attempts.set(ip, { n: 0, reset: now + 15 * 60e3 }); return false; }
  return a.n >= 10;
}
const failed = (ip) => { const a = attempts.get(ip); if (a) a.n++; };

const userCount = () => db.prepare('SELECT COUNT(*) c FROM users').get().c;
const canSignup = () => userCount() === 0 || ALLOW_SIGNUP;

// ---------- auth routes ----------
app.get('/api/session', (req, res) => {
  res.json({ user: currentUser(req), canSignup: canSignup(), firstRun: userCount() === 0 });
});

app.post('/api/register', (req, res) => {
  if (!canSignup()) return res.status(403).json({ error: 'Sign-ups are closed.' });
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || !/^[A-Za-z0-9_.-]{3,32}$/.test(username))
    return res.status(400).json({ error: 'Username: 3-32 letters, numbers, . _ -' });
  if (typeof password !== 'string' || password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (db.prepare('SELECT 1 FROM users WHERE username=?').get(username))
    return res.status(409).json({ error: 'That username is taken.' });
  const first = userCount() === 0;
  const r = db.prepare('INSERT INTO users (username,pass_hash,is_admin) VALUES (?,?,?)')
    .run(username, hashPassword(password), first ? 1 : 0);
  setSession(res, Number(r.lastInsertRowid));
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  if (throttled(req.ip)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const { username, password } = req.body || {};
  const u = typeof username === 'string' ? db.prepare('SELECT * FROM users WHERE username=?').get(username) : null;
  // Always run scrypt so response time does not reveal whether the user exists.
  const ok = u ? verifyPassword(String(password || ''), u.pass_hash)
               : (verifyPassword('x', hashPassword('y')), false);
  if (!ok) { failed(req.ip); return res.status(401).json({ error: 'Wrong username or password.' }); }
  setSession(res, u.id);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  const token = parseCookies(req).sid;
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha(token));
  clearCookie(res);
  res.json({ ok: true });
});

function auth(req, res, next) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'Not signed in' });
  req.user = u;
  next();
}
app.use('/api', (req, res, next) => (['/session', '/register', '/login', '/logout'].includes(req.path) ? next() : auth(req, res, next)));

// ---------- local video files ----------
const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR || path.join(here, 'media'));
const VIDEO_EXT = ['.mp4', '.m4v', '.webm', '.mov'];
function mediaInfo(name) {
  if (!name) return null;
  for (const ext of VIDEO_EXT) {
    if (fs.existsSync(path.join(MEDIA_DIR, name + ext))) {
      return { src: `/media/${name}${ext}`, captions: fs.existsSync(path.join(MEDIA_DIR, name + '.vtt')) ? `/media/${name}.vtt` : null };
    }
  }
  return { src: null, captions: null, expected: name };
}
// Only signed-in users can stream. express.static answers Range requests, so seeking works.
app.use('/media', (req, res, next) => (currentUser(req) ? next() : res.status(401).send('Sign in first')),
  express.static(MEDIA_DIR, { index: false, dotfiles: 'ignore', maxAge: '1h' }));

// ---------- learning data ----------
const lessonRow = (slug) => db.prepare(`
  SELECT l.*, m.slug AS module_slug, m.title AS module_title, c.id AS course_id, c.slug AS course_slug, c.title AS course_title
  FROM lessons l JOIN modules m ON m.id=l.module_id JOIN courses c ON c.id=m.course_id WHERE l.slug=?`).get(slug);

function courseLessons(courseId) {
  return db.prepare(`
    SELECT l.id, l.slug, l.title, l.type, l.minutes, m.slug AS module_slug
    FROM lessons l JOIN modules m ON m.id=l.module_id
    WHERE m.course_id=? ORDER BY m.ord, l.ord`).all(courseId);
}

function streakDays(userId) {
  const days = db.prepare(`SELECT DISTINCT date(updated_at) d FROM progress WHERE user_id=? ORDER BY d DESC`).all(userId).map((r) => r.d);
  const fmt = (d) => d.toISOString().slice(0, 10);
  let cur = new Date(); let n = 0;
  if (days[0] !== fmt(cur)) cur = new Date(Date.now() - 864e5); // allow "haven't studied yet today"
  for (const d of days) {
    if (d === fmt(cur)) { n++; cur = new Date(cur.getTime() - 864e5); } else if (d < fmt(cur)) break;
  }
  return n;
}

app.get('/api/overview', (req, res) => {
  const uid = req.user.id;
  const courses = db.prepare('SELECT * FROM courses ORDER BY ord, id').all().map((c) => {
    const total = db.prepare('SELECT COUNT(*) n FROM lessons l JOIN modules m ON m.id=l.module_id WHERE m.course_id=?').get(c.id).n;
    const done = db.prepare(`SELECT COUNT(*) n FROM progress p JOIN lessons l ON l.id=p.lesson_id JOIN modules m ON m.id=l.module_id
      WHERE m.course_id=? AND p.user_id=? AND p.status='done'`).get(c.id, uid).n;
    return { slug: c.slug, title: c.title, description: c.description, total, done };
  });
  const last = db.prepare(`SELECT l.slug, l.title, l.type, c.slug AS course_slug, c.title AS course_title
    FROM state s JOIN lessons l ON l.id=s.last_lesson_id JOIN modules m ON m.id=l.module_id JOIN courses c ON c.id=m.course_id
    WHERE s.user_id=?`).get(uid) || null;
  const minutes = db.prepare('SELECT COALESCE(SUM(seconds),0) s FROM progress WHERE user_id=?').get(uid).s;
  res.json({ courses, last, streak: streakDays(uid), minutes: Math.round(minutes / 60) });
});

app.get('/api/courses/:slug', (req, res) => {
  const c = db.prepare('SELECT * FROM courses WHERE slug=?').get(req.params.slug);
  if (!c) return res.status(404).json({ error: 'No such course' });
  const prog = new Map(db.prepare(`SELECT l.slug, p.status FROM progress p JOIN lessons l ON l.id=p.lesson_id WHERE p.user_id=?`)
    .all(req.user.id).map((r) => [r.slug, r.status]));
  const modules = db.prepare('SELECT * FROM modules WHERE course_id=? ORDER BY ord').all(c.id).map((m) => ({
    slug: m.slug, title: m.title, summary: m.summary,
    lessons: db.prepare('SELECT slug,title,type,minutes FROM lessons WHERE module_id=? ORDER BY ord').all(m.id)
      .map((l) => ({ ...l, status: prog.get(l.slug) || 'todo' })),
  }));
  const all = modules.flatMap((m) => m.lessons);
  const next = all.find((l) => l.status !== 'done') || null;
  res.json({
    slug: c.slug, title: c.title, description: c.description, source: c.source_url, license: c.license,
    modules, nextSlug: next?.slug || null,
  });
});

app.get('/api/lessons/:slug', (req, res) => {
  const l = lessonRow(req.params.slug);
  if (!l) return res.status(404).json({ error: 'No such lesson' });
  const p = db.prepare('SELECT status, code, video_pos, attempts FROM progress WHERE user_id=? AND lesson_id=?').get(req.user.id, l.id)
    || { status: 'todo', code: null, video_pos: 0, attempts: 0 };
  const list = courseLessons(l.course_id);
  const i = list.findIndex((x) => x.id === l.id);
  db.prepare(`INSERT INTO state (user_id,last_lesson_id,updated_at) VALUES (?,?,datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET last_lesson_id=excluded.last_lesson_id, updated_at=excluded.updated_at`).run(req.user.id, l.id);
  res.json({
    slug: l.slug, type: l.type, title: l.title, body: l.body, video: mediaInfo(l.media), starter: l.starter,
    tests: l.tests ? JSON.parse(l.tests) : null, source: l.source_url, minutes: l.minutes,
    module: { slug: l.module_slug, title: l.module_title },
    course: { slug: l.course_slug, title: l.course_title },
    prev: list[i - 1]?.slug || null, next: list[i + 1]?.slug || null,
    progress: p,
  });
});

app.put('/api/progress/:slug', (req, res) => {
  const l = lessonRow(req.params.slug);
  if (!l) return res.status(404).json({ error: 'No such lesson' });
  const { code, status, videoPos, attempt, seconds } = req.body || {};
  const uid = req.user.id;
  db.prepare('INSERT OR IGNORE INTO progress (user_id,lesson_id) VALUES (?,?)').run(uid, l.id);
  const cur = db.prepare('SELECT status FROM progress WHERE user_id=? AND lesson_id=?').get(uid, l.id);
  const sets = ["updated_at=datetime('now')"]; const args = [];
  if (typeof code === 'string' && code.length <= 100_000) { sets.push('code=?'); args.push(code); }
  if (typeof videoPos === 'number' && videoPos >= 0 && Number.isFinite(videoPos)) { sets.push('video_pos=?'); args.push(videoPos); }
  if (attempt === true) sets.push('attempts=attempts+1');
  if (typeof seconds === 'number' && seconds > 0 && seconds <= 600) { sets.push('seconds=seconds+?'); args.push(Math.round(seconds)); }
  if (status === 'done' && cur.status !== 'done') sets.push("status='done'", "completed_at=datetime('now')");
  else if (status === 'in_progress' && cur.status === 'todo') sets.push("status='in_progress'");
  db.prepare(`UPDATE progress SET ${sets.join(', ')} WHERE user_id=? AND lesson_id=?`).run(...args, uid, l.id);
  res.json({ ok: true });
});

// ---------- static ----------
app.use('/pyodide', express.static(path.join(here, 'node_modules/pyodide'), { maxAge: '30d', immutable: true }));
app.use(express.static(path.join(here, 'public'), { maxAge: 0 }));
app.get('/healthz', (_req, res) => res.send('ok'));
app.use((_req, res) => res.status(404).send('Not found'));

await seedAll();
setInterval(() => db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()), 36e5).unref();
app.listen(PORT, () => console.log(`Pathway listening on :${PORT}`));
