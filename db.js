import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(here, 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'pathway.db'));
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  license TEXT,
  ord INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS modules (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  ord INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  ord INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  media TEXT,
  starter TEXT,
  tests TEXT,
  source_url TEXT,
  minutes INTEGER NOT NULL DEFAULT 10
);
CREATE TABLE IF NOT EXISTS progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'todo',
  code TEXT,
  video_pos REAL NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  seconds INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  PRIMARY KEY (user_id, lesson_id)
);
CREATE TABLE IF NOT EXISTS state (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Older databases limited lesson types with a CHECK constraint. Rebuild the table once to lift it.
const lessonsSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='lessons'").get()?.sql || '';
if (/CHECK\s*\(\s*type\s+IN/i.test(lessonsSql)) {
  db.exec('PRAGMA foreign_keys = OFF; BEGIN;');
  try {
    db.exec(lessonsSql.replace(/CHECK\s*\(\s*type\s+IN\s*\([^)]*\)\s*\)/i, '').replace('CREATE TABLE lessons', 'CREATE TABLE lessons_new').replace('CREATE TABLE "lessons"', 'CREATE TABLE lessons_new'));
    db.exec('INSERT INTO lessons_new SELECT * FROM lessons; DROP TABLE lessons; ALTER TABLE lessons_new RENAME TO lessons; COMMIT;');
  } catch (e) { db.exec('ROLLBACK;'); throw e; }
  db.exec('PRAGMA foreign_keys = ON;');
}

// Course content lives in seed/*.js. Re-running is safe: content is updated in
// place; your progress and saved code are never touched.
export async function seedAll() {
  const dir = path.join(here, 'seed');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
  const upCourse = db.prepare(`
    INSERT INTO courses (slug,title,description,source_url,license,ord) VALUES (?,?,?,?,?,?)
    ON CONFLICT(slug) DO UPDATE SET title=excluded.title, description=excluded.description,
      source_url=excluded.source_url, license=excluded.license, ord=excluded.ord
    RETURNING id`);
  const upModule = db.prepare(`
    INSERT INTO modules (course_id,slug,title,summary,ord) VALUES (?,?,?,?,?)
    ON CONFLICT(slug) DO UPDATE SET course_id=excluded.course_id, title=excluded.title,
      summary=excluded.summary, ord=excluded.ord
    RETURNING id`);
  const upLesson = db.prepare(`
    INSERT INTO lessons (module_id,slug,ord,type,title,body,media,starter,tests,source_url,minutes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(slug) DO UPDATE SET module_id=excluded.module_id, ord=excluded.ord, type=excluded.type,
      title=excluded.title, body=excluded.body, media=excluded.media,
      starter=excluded.starter, tests=excluded.tests, source_url=excluded.source_url, minutes=excluded.minutes`);

  for (const f of files) {
    const { default: c } = await import(pathToFileURL(path.join(dir, f)).href);
    db.exec('BEGIN');
    try {
      const course = upCourse.get(c.slug, c.title, c.description || '', c.source || null, c.license || null, c.ord || 0);
      c.modules.forEach((m, mi) => {
        const mod = upModule.get(course.id, m.slug, m.title, m.summary || '', mi);
        m.lessons.forEach((l, li) => {
          upLesson.run(
            mod.id, l.slug, li, l.type, l.title, l.body || '', l.media || null,
            l.starter ?? null, l.tests ? JSON.stringify(l.tests) : null, l.source || null, l.minutes || 10,
          );
        });
      });
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
}
