// End-to-end check in a real browser: sign up, play video, solve an exercise, reload, resume.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const PORT = 3111;
const base = `http://localhost:${PORT}`;
const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT, DATA_DIR: '/tmp/pw-data', MEDIA_DIR: '/tmp/pw-media' }, stdio: 'inherit' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = [];
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail.push(msg); };

try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`${base}/healthz`)).ok) break; } catch {} await sleep(200); }
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/api/login')) errors.push(`${r.status()} ${r.request().method()} ${r.url()}`); });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

  // unauthenticated API and media are closed
  check((await fetch(`${base}/api/overview`)).status === 401, 'API rejects anonymous requests');
  check((await fetch(`${base}/media/lecture-0.mp4`)).status === 401, 'media rejects anonymous requests');

  await page.goto(base);
  await page.fill('#u', 'tester');
  await page.fill('#p', 'correct horse battery');
  await page.click('button[type=submit]');
  await page.waitForSelector('.resume, .cards');
  check(await page.locator('.cards .card').count() === 1, 'home shows the course');
  check((await fetch(`${base}/api/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'second', password: 'longenough1' }) })).status === 403, 'second sign-up is closed');

  // video lesson
  await page.goto(`${base}/#/l/w0-lecture`);
  await page.waitForSelector('video');
  await page.evaluate(async () => { const v = document.querySelector('video'); v.muted = true; await Promise.race([new Promise((r) => (v.readyState >= 1 ? r() : v.addEventListener('loadedmetadata', r, { once: true }))), new Promise((_, j) => setTimeout(() => j(new Error('video metadata never loaded')), 10000))]); v.currentTime = 20; await v.play().catch(() => {}); });
  await sleep(6500);
  await page.evaluate(() => document.querySelector('video').pause());
  await sleep(800);
  await page.goto(`${base}/#/`);
  await page.waitForSelector('.resume');
  await page.goto(`${base}/#/l/w0-lecture`);
  await page.waitForSelector('video');
  const pos = await page.evaluate(async () => { const v = document.querySelector('video'); await new Promise((r) => (v.readyState >= 1 ? r() : v.addEventListener('loadedmetadata', r, { once: true }))); await new Promise((r) => setTimeout(r, 400)); return v.currentTime; });
  check(pos > 18 && pos < 35, `video resumes near where it stopped (${pos.toFixed(1)}s)`);

  // lecture without a file shows the helpful notice
  await page.goto(`${base}/#/l/w1-lecture`);
  await page.waitForSelector('.notice');
  check((await page.textContent('.notice')).includes('lecture-1'), 'missing video explains where to put the file');


  // quiz: answer every question with option index 0 (some wrong), then retry with the real answers
  await page.goto(`${base}/#/l/w0-quiz`);
  await page.waitForSelector('#qz');
  const answers = await page.evaluate(async () => (await (await fetch('/api/lessons/w0-quiz')).json()).tests.map((t) => ({ a: t.answer, opts: t.options })));
  const pickText = async (opts, idx) => { for (let n = 0; n < (await page.locator('.q').count()); n++) { /* placeholder */ } };
  // wrong run: always choose a wrong option
  for (let n = 0; n < answers.length; n++) {
    const q = page.locator('.q').nth(n);
    const lab = q.locator('.opt');
    // the first label whose input value is not the correct index
    for (let k = 0; k < 4; k++) {
      const v = await lab.nth(k).locator('input').getAttribute('value');
      const qi = await q.getAttribute('data-q');
      if (+v !== answers[+qi].a) { await lab.nth(k).locator('input').check(); break; }
    }
  }
  await page.click('#qz button[type=submit]');
  await page.waitForSelector('#qres .banner');
  check((await page.textContent('#qres .banner')).includes('0 of'), 'quiz: all-wrong answers score zero and do not pass');
  await page.click('#retry');
  await page.waitForSelector('#qz');
  for (let n = 0; n < answers.length; n++) {
    const q = page.locator('.q').nth(n);
    const qi = +(await q.getAttribute('data-q'));
    await q.locator(`input[value="${answers[qi].a}"]`).check();
  }
  await page.click('#qz button[type=submit]');
  await page.waitForSelector('#qres .banner.ok');
  check((await page.textContent('#qres .banner')).includes('Passed'), 'quiz: correct answers pass');
  await sleep(500);
  const qo = await (await ctx.request.get(`${base}/api/lessons/w0-quiz`)).json();
  check(qo.progress.status === 'done', 'quiz: pass is recorded as done');

  // exercise: wrong then right
  await page.goto(`${base}/#/l/w0-indoor-voice`);
  await page.waitForSelector('#code');
  await page.waitForFunction(() => !document.querySelector('#check').disabled, null, { timeout: 60000 });
  await page.fill('#code', 'print(input())');
  await page.click('#check');
  await page.waitForSelector('.banner');
  check((await page.textContent('.banner')).includes('of 3 checks passed'), 'wrong answer reports failures');
  await page.fill('#code', 'print(input().lower())');
  await page.click('#check');
  await page.waitForSelector('.banner.ok');
  check(true, 'right answer passes all checks');
  await sleep(500);

  // run with typed input
  await page.fill('#code', 'name = input("Name? ")\nprint("hi", name)');
  await page.locator('summary', { hasText: 'Input for Run' }).click();
  await page.fill('#stdin', 'Ada');
  await page.click('#run');
  await page.waitForSelector('.panel pre');
  check((await page.textContent('.panel pre')).includes('Name? Ada') , 'Run shows prompt and typed input');

  // infinite loop is stopped
  await page.fill('#code', 'while True:\n    pass');
  await page.click('#run');
  await page.waitForSelector('.banner.bad', { timeout: 15000 });
  check((await page.textContent('.banner.bad')).includes('Stopped after'), 'infinite loop is stopped');
  await page.waitForFunction(() => !document.querySelector('#run').disabled, null, { timeout: 60000 });

  // code survives reload
  await page.fill('#code', 'print(input().lower())  # saved');
  await sleep(1500);
  await page.reload();
  await page.waitForSelector('#code');
  check((await page.inputValue('#code')).includes('# saved'), 'code is restored after reload');

  // progress and resume card
  await page.goto(`${base}/#/`);
  await page.waitForSelector('.resume');
  check((await page.textContent('.resume')).includes('Indoor Voice'), 'Resume card points at the last lesson');
  const o = await (await ctx.request.get(`${base}/api/overview`)).json();
  check(o.courses[0].done >= 1, `progress counted (${o.courses[0].done} done)`);
  check(o.streak >= 1, 'streak counted');

  // phone width: no horizontal overflow
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`${base}/#/l/w1-file-extensions`);
  await page.waitForSelector('.tablewrap');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  check(!overflow, 'no horizontal scroll at phone width');

  // sign out and back in
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/#/`);
  await page.click('#logout');
  await page.waitForSelector('#f');
  await page.fill('#u', 'tester'); await page.fill('#p', 'wrong password');
  await page.click('button[type=submit]');
  await page.waitForFunction(() => document.querySelector('#err')?.textContent);
  check((await page.textContent('#err')).includes('Wrong'), 'bad password rejected');
  await page.fill('#p', 'correct horse battery'); await page.click('button[type=submit]');
  await page.waitForSelector('.resume');
  check(true, 'sign back in keeps progress');

  await page.screenshot({ path: '/tmp/pw-home.png' });
  check(errors.length === 0, `no browser errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  await browser.close();
} catch (e) {
  console.error('ERROR', e);
  fail.push(String(e));
} finally {
  srv.kill();
}
console.log(fail.length ? `\n${fail.length} failure(s)` : '\nAll smoke tests passed.');
process.exit(fail.length ? 1 : 0);
