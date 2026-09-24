// scripts/screenshots.mjs
// Captures the 5 main README screenshots into docs/screenshots/.
// Run against a LOCALLY RUNNING app (frontend + backend, seeded demo data).
//
//   npm i -D playwright && npx playwright install chromium
//   node scripts/screenshots.mjs            # BASE_URL defaults to http://localhost:5173
//   BASE_URL=http://localhost:5173 node scripts/screenshots.mjs
//
// Uses the built-in demo accounts (shared password Demo@123, from LoginPage.tsx).
// Dynamic pages (parcel 360, officer case) are best-effort: the script opens the
// list, clicks the first item, and captures. If no item exists (empty seed), it
// captures the list page instead and prints a warning — not a hard failure.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = (process.env.BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
const OUT = path.resolve('docs/screenshots');
const PW = process.env.DEMO_PASSWORD || 'Demo@123';

const CRED = {
  citizen: 'citizen1@example.com',
  officer: 'landrecords.officer@bhoomisetu.gov.in', // richest seeded queue + field evidence
  admin: 'admin@bhoomisetu.gov.in',
};

// clickFirst: comma-separated selector list; first match is clicked before capture.
const SHOTS = [
  { name: '01-gis-map', as: 'citizen', goto: '/citizen/map', waitMs: 7000, fullPage: false },
  { name: '02-parcel-360', as: 'citizen', goto: '/citizen/parcels', waitMs: 4000, fullPage: false,
    clickFirst: 'text=View Parcel 360' },
  { name: '03-officer-evidence-chain', as: 'officer', goto: '/officer/requests', waitMs: 2500,
    clickFirst: 'button.w-full.rounded-xl.border, tbody tr.cursor-pointer, .case-card' },
  { name: '04-citizen-get-assistance', as: 'citizen', goto: '/citizen/get-assistance', waitMs: 1500 },
  { name: '05-admin-dashboard', as: 'admin', goto: '/admin', waitMs: 2000 },
];

let currentRole = null;

async function login(page, role) {
  if (currentRole === role) return;
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.fill('#login-email', CRED[role]);
  await page.fill('#login-password', PW);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 20000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState('networkidle').catch(() => {});
  currentRole = role;
}

async function capture(page, shot) {
  await login(page, shot.as);
  await page.goto(BASE + shot.goto, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});

  if (shot.clickFirst) {
    const el = page.locator(shot.clickFirst).first();
    if (await el.count().then((n) => n > 0).catch(() => false)) {
      await el.click().catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
    } else {
      console.warn(`  ! ${shot.name}: no item to open, capturing list page instead`);
    }
  }

  await page.waitForTimeout(shot.waitMs || 1500); // let map tiles / charts settle
  const file = path.join(OUT, shot.name + '.png');
  await page.screenshot({ path: file, fullPage: shot.fullPage !== false });
  console.log(`  ✓ ${shot.name} -> ${path.relative(process.cwd(), file)}`);
}

(async () => {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    // MapLibre GL draws on a WebGL canvas; headless Chromium has no GPU, so
    // force software WebGL (SwiftShader) or the map captures blank.
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  console.log(`Capturing ${SHOTS.length} screenshots from ${BASE}`);
  for (const shot of SHOTS) {
    try {
      await capture(page, shot);
    } catch (err) {
      console.error(`  ✗ ${shot.name}: ${err.message}`);
    }
  }
  await browser.close();
  console.log(`Done. Files in ${path.relative(process.cwd(), OUT)}/`);
})();
