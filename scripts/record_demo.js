// BhoomiSetu demo recorder — follows docs/DEMO_VIDEO_SCRIPT.md §3 flow.
// Records a single .webm walkthrough (no voiceover). Route-based navigation
// (routes are stable; deep-feature button selectors are not) with per-step
// try/catch so one missing element never aborts the whole recording.
// ponytail: URL-driven tour + best-effort clicks; upgrade to precise
// selectors per segment only if a segment reads as a bare page load.
const { chromium } = require('playwright');

const BASE = 'http://localhost:5173';
const PASS = 'Demo@123';
const HOLD = 2200;   // ms a page lingers on camera
const LONG = 3500;   // ms for the "wow" segments (map, change detection)

async function step(name, fn) {
  process.stdout.write(`▶ ${name}\n`);
  try { await fn(); }
  catch (e) { process.stdout.write(`  ⚠ ${name}: ${e.message.split('\n')[0]}\n`); }
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#login-email', email);
  await page.fill('#login-password', PASS);
  await page.waitForTimeout(700);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

async function logout(page) {
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.context().clearCookies();
}

async function visit(page, path, hold = HOLD) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(hold);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: 'demo-recording', size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();

  // Intro — landing page
  await step('Landing page', async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(HOLD);
  });

  // Segment A — Citizen
  await step('Citizen login', () => login(page, 'citizen1@example.com'));
  await step('A: My Parcels', () => visit(page, '/citizen/parcels'));
  await step('A: Parcel 360 (first parcel)', async () => {
    const link = page.locator('a[href*="/parcels/"]').first();
    if (await link.count()) { await link.click(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(LONG); }
    else await visit(page, '/citizen/find');
  });
  await step('B: Get Assistance / AI routing', () => visit(page, '/citizen/get-assistance', LONG));
  await step('A: My Cases', () => visit(page, '/citizen/my-cases'));

  // Officer segments
  await step('Officer login (dispute)', async () => { await logout(page); await login(page, 'dispute.officer@bhoomisetu.gov.in'); });
  await step('C: Officer GIS map', () => visit(page, '/officer/map', LONG));
  await step('D: Change detection', () => visit(page, '/officer/change-detection', LONG));
  await step('D: Historical imagery', () => visit(page, '/officer/historical-imagery', LONG));
  await step('E: Governance alerts', () => visit(page, '/officer/alerts', LONG));
  await step('E: Officer tasks / workflow', () => visit(page, '/officer/tasks'));

  // Verifier segment
  await step('Verifier login', async () => { await logout(page); await login(page, 'verifier1@bhoomisetu.gov.in'); });
  await step('F: Verifier portal (field evidence)', () => visit(page, '/verifier', LONG));

  await page.waitForTimeout(1000);
  await context.close();   // video is flushed to disk here
  await browser.close();

  const fs = require('fs');
  const files = fs.readdirSync('demo-recording').filter(f => f.endsWith('.webm'));
  process.stdout.write(`\n✅ Recording saved: demo-recording/${files.join(', ')}\n`);
})();
