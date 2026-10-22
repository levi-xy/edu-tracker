// Proves each grader: the known-good solution must pass every check, each wrong one must fail.
// Runs the same Python harness the browser uses, inside real Pyodide.
import fs from 'node:fs';
import { loadPyodide } from 'pyodide';
import course from '../seed/cs50p.js';
import { refs } from './refs.mjs';

const src = fs.readFileSync(new URL('../public/worker.js', import.meta.url), 'utf8');
const HARNESS = src.match(/const HARNESS = `([\s\S]*?)`;\n\nconst ready/)[1].replace(/\\\\/g, '\\');
const py = await loadPyodide();
py.runPython(HARNESS);

const grade = (code, tests) => {
  py.globals.set('_p', JSON.stringify({ mode: 'test', code, tests }));
  return JSON.parse(py.runPython('_handle(_p)')).results;
};
const exercises = course.modules.flatMap((m) => m.lessons).filter((l) => l.type === 'exercise');
let bad = 0;
for (const e of exercises) {
  const r = refs[e.slug];
  if (!r) { console.log(`MISSING refs for ${e.slug}`); bad++; continue; }
  const good = grade(r.good, e.tests);
  const goodFails = good.filter((t) => !t.ok);
  if (goodFails.length) { bad++; console.log(`FAIL ${e.slug}: correct solution rejected:`, goodFails.map((t) => `${t.name} -> got ${JSON.stringify(t.got)} ${t.error || ''}`)); }
  r.bad.forEach((b, i) => {
    const res = grade(b, e.tests);
    if (res.every((t) => t.ok)) { bad++; console.log(`FAIL ${e.slug}: wrong solution #${i + 1} was accepted`); }
  });
  // starter code must not pass by itself
  const st = grade(e.starter, e.tests);
  if (st.every((t) => t.ok)) { bad++; console.log(`FAIL ${e.slug}: starter code passes`); }
  console.log(`${goodFails.length ? 'x' : 'ok'}  ${e.slug}  (${e.tests.length} checks, ${r.bad.length} wrong variants)`);
}

// Quizzes: every question needs 4 distinct options, a valid answer index, and an explanation.
for (const l of course.modules.flatMap((m) => m.lessons).filter((x) => x.type === 'quiz')) {
  l.tests.forEach((q, i) => {
    const errs = [];
    if (!q.q) errs.push('no question');
    if (!Array.isArray(q.options) || q.options.length !== 4) errs.push('needs exactly 4 options');
    else if (new Set(q.options).size !== 4) errs.push('duplicate options');
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) errs.push('answer index out of range');
    if (!q.why || q.why.length < 20) errs.push('missing explanation');
    if (errs.length) { bad++; console.log(`FAIL ${l.slug} q${i + 1}: ${errs.join(', ')}`); }
  });
  console.log(`ok  ${l.slug}  (${l.tests.length} questions)`);
}
console.log(bad ? `\n${bad} problem(s)` : '\nAll graders and quizzes verified.');
process.exit(bad ? 1 : 0);
