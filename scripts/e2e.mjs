// End-to-end check of the MVP workflow in a real browser:
// search → route → preview → seek → export → download → verify the file.
//
//   npm run build && npm run e2e            (uses installed Chrome; set VET_BROWSER=msedge for Edge)
//   VET_URL=http://localhost:5173 npm run e2e   (against a running dev server)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import { readFileSync } from 'node:fs';

const OUT = join(import.meta.dirname, 'out');
mkdirSync(OUT, { recursive: true });
const HEADLESS = process.env.VET_HEADED ? false : true;
const QUALITY = process.env.VET_QUALITY ?? '720p';
const FPS = process.env.VET_FPS ?? '30';
const DURATION = process.env.VET_DURATION ?? '5';

let server;
let url = process.env.VET_URL;
if (!url) {
  url = 'http://localhost:4173';
  server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { shell: true, stdio: 'pipe' });
  // Poll until the server answers (its log output is colourised and unreliable to parse).
  const deadline = Date.now() + 30_000;
  while (true) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error('preview server did not start');
    await new Promise((r) => setTimeout(r, 300));
  }
}

const step = (msg) => console.log(`\n▸ ${msg}`);
const errors = [];
const browser = await chromium.launch({
  channel: process.env.VET_BROWSER ?? 'chrome',
  headless: HEADLESS,
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 }, acceptDownloads: true });
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  step(`open ${url}`);
  await page.goto(url);
  await page.waitForFunction(() => !document.body.innerText.includes('LOADING MAP'), null, { timeout: 30_000 });
  console.log('  map style loaded');

  const pick = async (label, query, match) => {
    const input = page.getByRole('combobox', { name: label });
    await input.click();
    await input.fill(query);
    const option = page.getByRole('option').filter({ hasText: match }).first();
    await option.waitFor({ timeout: 15_000 });
    console.log(`  ${label}: "${(await option.innerText()).split('\n').join(' — ')}"`);
    await option.click();
  };

  step('search origin + destination');
  await pick('From', 'Da Nang', /Đà Nẵng/);
  await pick('To', 'Hue', /Huế/);

  step('car route');
  const summary = page.getByTestId('route-summary');
  await summary.waitFor({ timeout: 30_000 });
  console.log(`  ${await summary.innerText()}`);
  await page.waitForTimeout(2500);
  await page.getByTestId('preview-frame').screenshot({ path: join(OUT, '1-route.png') });

  step(`duration ${DURATION}s, ${QUALITY} ${FPS} fps`);
  const presetButton = page.getByRole('button', { name: `${DURATION}s`, exact: true });
  await presetButton.click();
  await page.getByRole('radio', { name: QUALITY === '4k' ? '4K' : QUALITY }).click();
  await page.getByRole('radiogroup', { name: 'Frame rate' }).getByRole('radio', { name: FPS }).click();

  step('preview playback');
  await page.getByTestId('play').click();
  await page.waitForTimeout(1500);
  const t1 = await page.getByTestId('current-time').innerText();
  await page.getByTestId('preview-frame').screenshot({ path: join(OUT, '2-playing.png') });
  await page.getByTestId('play').click(); // pause
  console.log(`  time after 1.5 s of playback: ${t1}`);
  if (t1 === '00:00') throw new Error('playback did not advance');

  step('seek');
  for (const [frac, name] of [
    [0.5, '3-seek-mid.png'],
    [0.97, '4-seek-end.png'],
  ]) {
    await page.getByTestId('seek').evaluate((el, f) => {
      el.value = String(Number(el.max) * f);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, frac);
    await page.waitForTimeout(2500);
    console.log(`  seek ${frac * 100}% → ${await page.getByTestId('current-time').innerText()}`);
    await page.getByTestId('preview-frame').screenshot({ path: join(OUT, name) });
  }

  step('export');
  const started = Date.now();
  await page.getByTestId('export').click();
  await page.getByTestId('export-dialog').waitFor();
  let lastLog = 0;
  while (true) {
    const done = await page.getByTestId('download').isVisible().catch(() => false);
    if (done) break;
    const text = await page.getByTestId('export-dialog').innerText();
    if (/EXPORT FAILED/.test(text)) throw new Error(`export failed: ${text}`);
    if (Date.now() - lastLog > 5000) {
      lastLog = Date.now();
      console.log(`  ${text.split('\n').filter(Boolean).slice(0, 4).join(' | ')}`);
    }
    if (Date.now() - started > 15 * 60_000) throw new Error('export timed out');
    await page.waitForTimeout(500);
  }
  console.log(`  ${(await page.getByTestId('export-dialog').innerText()).split('\n').filter(Boolean).join(' | ')}`);

  step('download');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download').click()]);
  const file = join(OUT, download.suggestedFilename());
  await download.saveAs(file);
  console.log(`  saved ${file} (${(statSync(file).size / 1e6).toFixed(2)} MB)`);

  step('frames from the exported video');
  const href = await page.getByTestId('download').getAttribute('href');
  await page.evaluate(async (src) => {
    const v = Object.assign(document.createElement('video'), { src, muted: true, id: 'vet-check' });
    Object.assign(v.style, { position: 'fixed', inset: '0', width: '1280px', height: '720px', zIndex: 9999, background: '#000' });
    document.body.appendChild(v);
    await new Promise((r) => v.addEventListener('loadeddata', r, { once: true }));
  }, href);
  for (const t of [0.5, Number(DURATION) / 2, Number(DURATION) - 0.1]) {
    await page.evaluate(async (time) => {
      const v = document.getElementById('vet-check');
      v.currentTime = time;
      await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
    }, t);
    await page.locator('#vet-check').screenshot({ path: join(OUT, `video-${t.toFixed(1)}s.png`) });
  }
  console.log('  saved video frame screenshots');

  step('verify video file');
  const input = new Input({ source: new BlobSource(new Blob([readFileSync(file)])), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  const duration = await input.computeDuration();
  const packets = await track.computePacketStats();
  const report = {
    format: (await input.getFormat()).name,
    codec: track.codec,
    width: track.displayWidth,
    height: track.displayHeight,
    duration: Number(duration.toFixed(3)),
    frames: packets.packetCount,
    fps: Number(packets.averagePacketRate.toFixed(2)),
  };
  console.log(' ', report);
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  const expectedFrames = Number(DURATION) * Number(FPS);
  if (report.frames !== expectedFrames) throw new Error(`expected ${expectedFrames} frames, got ${report.frames}`);
  if (Math.abs(report.duration - Number(DURATION)) > 0.05) throw new Error(`unexpected duration ${report.duration}`);

  console.log(`\n✓ MVP workflow passed${errors.length ? ` (${errors.length} console errors)` : ''}`);
} catch (err) {
  console.error('\n✗', err.message);
  process.exitCode = 1;
} finally {
  if (errors.length) console.log('console errors:\n ', [...new Set(errors)].slice(0, 15).join('\n  '));
  await browser.close();
  server?.kill();
  if (server && process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F']);
}
