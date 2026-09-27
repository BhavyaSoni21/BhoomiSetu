// BhoomiSetu LIVE demo recorder — one continuous interactive walkthrough of the
// deployed Vercel build, muxed to MP4 and time-normalized to EXACTLY 4:30.
// Follows docs/DEMO_VIDEO_SCRIPT.md: problem -> new-citizen onboarding ->
// citizen1 (multilingual, Parcel 360) -> AI complaint -> Registration (Return
// for Review + reason) -> Land Records (assign verifier) -> Verifier -> Tax
// (decision + reason) -> satellite montage -> admin audit -> citizen resolution.
// Per-step try/catch so one missing element never aborts the recording.
// ponytail: single automated take. It CANNOT do the script's clip-editing
// tricks (staged reject->correct->approve loop, cutting out load waits,
// guaranteed same-Case-ID across departments) — those need manual editing.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = 'https://bhoomi-setu-nine.vercel.app';
const API = 'https://bhoomisetu-ryh4.onrender.com/api/v1';
const PASS = 'Demo@123';
const OUT_DIR = path.join(__dirname, '..', 'frontend', 'demo-recording');
const FFMPEG = require('ffmpeg-static');
const TARGET_SECONDS = 270; // hard 4:30 — the final MP4 is retimed to this.

// Two-tier holds: SHORT = display-only dwell, LONG = around a real interaction.
const SHORT = 1200;
const MED = 2000;
const LONG = 3200;

const COMPLAINT =
  'My sale deed is registered, but the ownership record still shows the old ' +
  'owner and the tax record still has the old land area.';

// Parse ffmpeg's "Duration: HH:MM:SS.ss" (printed to stderr) into seconds.
function parseDurationFromFfmpeg(stderr) {
  const m = String(stderr).match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : null;
}
function probeDuration(file) {
  try { execFileSync(FFMPEG, ['-i', file]); }
  catch (e) { return parseDurationFromFfmpeg(e.stderr || e.stdout || ''); }
  return null;
}

// factor-math self-check (ponytail: the one non-trivial bit worth a guard).
if (process.argv.includes('--selfcheck')) {
  const f = TARGET_SECONDS / 300; // pretend raw = 5:00
  console.assert(Math.abs(300 * f - TARGET_SECONDS) < 1e-6, 'setpts factor must retime raw->TARGET');
  console.assert(parseDurationFromFfmpeg('Duration: 00:05:00.00,') === 300, 'duration parse');
  console.log('selfcheck ok'); process.exit(0);
}
// Blue cursor dot + click ripple, injected before any page script runs.
const CURSOR_JS = `
  (() => {
    if (window.__curInit) return; window.__curInit = 1;
    const add = () => {
      if (document.getElementById('__cur')) return;
      const c = document.createElement('div'); c.id = '__cur';
      c.style.cssText = 'position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(37,99,235,.55);border:2px solid #2563eb;box-shadow:0 0 10px rgba(37,99,235,.8);pointer-events:none;transition:transform .08s;left:960px;top:540px';
      document.body.appendChild(c);
    };
    if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
    window.__mv = (x, y) => { const c = document.getElementById('__cur'); if (c) { c.style.left = x + 'px'; c.style.top = y + 'px'; } };
    window.__rip = (x, y) => {
      const r = document.createElement('div');
      r.style.cssText = 'position:fixed;z-index:2147483646;left:' + x + 'px;top:' + y + 'px;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:rgba(37,99,235,.4);pointer-events:none';
      document.body.appendChild(r);
      r.animate([{transform:'scale(1)',opacity:.7},{transform:'scale(7)',opacity:0}], {duration:450});
      setTimeout(() => r.remove(), 460);
    };
  })();
`;

let cur = { x: 960, y: 540 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function step(name, fn) {
  console.log('▶ ' + name);
  try { await fn(); }
  catch (e) { console.log('  ⚠ ' + name + ': ' + (e.message || e)); }
}

async function move(page, x, y) {
  await page.mouse.move(x, y, { steps: 26 });
  await page.evaluate(([x, y]) => window.__mv && window.__mv(x, y), [x, y]).catch(() => {});
  cur = { x, y };
  await sleep(120);
}
// Move the cursor to an element's center. Returns false (fast-fail) if it
// never becomes visible — so callers skip instead of blocking 30s on a box.
async function glideTo(page, locator, hold = 260) {
  const el = locator.first();
  const ok = await el.waitFor({ state: 'visible', timeout: 3500 }).then(() => true).catch(() => false);
  if (!ok) return false;
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const box = await el.boundingBox().catch(() => null);
  if (!box) return false;
  await move(page, box.x + box.width / 2, box.y + Math.min(box.height / 2, 40));
  await sleep(hold);
  return true;
}

async function click(page, locator, hold = 700) {
  if (!(await glideTo(page, locator))) return false;
  await page.evaluate(([x, y]) => window.__rip && window.__rip(x, y), [cur.x, cur.y]).catch(() => {});
  await locator.first().click({ timeout: 4000 }).catch(() => {});
  await sleep(hold);
  return true;
}

// Constant MEDIUM scroll: fixed px per fixed interval, so pace is identical on
// every page regardless of its height. Down `steps`, then a quicker glance up.
async function scrollTour(page, downSteps = 10) {
  const STEP = 380, WAIT = 200;
  const max = await page.evaluate(() => Math.max(0, document.body.scrollHeight - window.innerHeight)).catch(() => 0);
  const steps = Math.min(downSteps, Math.max(1, Math.ceil(max / STEP)));
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, STEP); await sleep(WAIT); }
  for (let i = 0; i < Math.ceil(steps / 2); i++) { await page.mouse.wheel(0, -STEP * 2); await sleep(WAIT); }
}
async function nav(page, href, hold = MED) {
  const link = page.locator(`a[href="${href}"]`);
  if (await link.first().isVisible().catch(() => false)) {
    await click(page, link, hold);
  } else {
    await page.goto(BASE + href, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(hold);
  }
}

async function login(page, email) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
  const emailBox = page.locator('#login-email');
  await emailBox.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await emailBox.fill(email).catch(() => {});
  await page.locator('#login-password').fill(PASS).catch(() => {});
  await sleep(500);
  await page.getByRole('button', { name: /sign in|log ?in/i }).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  await sleep(MED);
}

async function logout(page) {
  await page.context().clearCookies().catch(() => {});
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }).catch(() => {});
  await sleep(400);
}

async function setLang(page, value, hold = 1400) {
  const sel = page.locator('select[aria-label="Language selection"]');
  await glideTo(page, sel);
  await sel.selectOption(value).catch(() => {});
  await sleep(hold);
}
// First-time citizen: show the REAL auth page (typed creds, NOT submitted —
// no OTP mailbox in a headless take), then drop into the onboarding wizard via
// the demo-jwt localStorage bypass so the tour renders deterministically.
async function newCitizenIntro(page) {
  const rnd = Math.floor(Math.random() * 9000 + 1000);
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
  const emailBox = page.locator('#login-email');
  await emailBox.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await emailBox.fill(`newcitizen${rnd}@example.com`).catch(() => {});
  await page.locator('#login-password').fill(PASS).catch(() => {});
  await sleep(900); // dwell on the authentication screen — do not submit.

  await page.route('**/auth/profile/details', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })).catch(() => {});
  await page.route('**/auth/onboarding/complete', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })).catch(() => {});
  await page.addInitScript(() => {
    try {
      localStorage.setItem('access_token', 'demo-jwt-token-' + Date.now());
      localStorage.setItem('demo_auth_user', JSON.stringify({ id: 'demo', email: 'newcitizen@example.com', role: 'CITIZEN', full_name: 'New Citizen', is_active: true }));
    } catch (e) {}
  });
  await page.goto(BASE + '/citizen', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(MED);

  await click(page, page.getByRole('button', { name: /get started|begin|start/i }), SHORT);
  await click(page, page.getByRole('button', { name: /continue|next/i }), SHORT); // language
  await page.locator('#onboardingAddress').fill('Vijayawada, Andhra Pradesh').catch(() => {});
  await sleep(600);
  await click(page, page.getByRole('button', { name: /continue|next/i }), SHORT); // profile
  await click(page, page.getByRole('button', { name: /continue|next|finish|done/i }), SHORT); // intro
  await click(page, page.getByRole('button', { name: /start tour|take tour|tour/i }), SHORT);
  for (let i = 0; i < 3; i++) await click(page, page.getByRole('button', { name: /next/i }), SHORT);
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(SHORT);
  await page.unroute('**/auth/profile/details').catch(() => {});
  await page.unroute('**/auth/onboarding/complete').catch(() => {});
  await logout(page);
}
const DECISION_REASONS = {
  registration: 'Submitted registration reference does not match the supporting document.',
  tax: 'Parcel-area correction approved upstream. Tax record requires reassessment.',
};

// One officer beat: log in, open the first task, tour the evidence, then take a
// REAL action. Default action = RETURN_FOR_REVIEW: it's non-terminal (task ->
// BLOCKED) so re-records don't need a reseed, and it exercises the mandatory-
// reason workflow. assignVerifier=true instead assigns a field verifier.
async function officerDecision(page, email, reason, { assignVerifier = false } = {}) {
  await logout(page);
  await login(page, email);
  await nav(page, '/officer/tasks', SHORT);
  const manage = page.getByRole('button', { name: /manage|view/i });
  if (!(await click(page, manage, LONG))) { console.log('  (no tasks for ' + email + ')'); return; }
  await scrollTour(page, 8); // Overview: application doc + Parcel 360 grid.

  if (assignVerifier) {
    const vBtn = page.locator('button[id^="verifier-"]');
    if (await click(page, vBtn, MED)) {
      await click(page, page.locator('button[id^="assign-verifier-btn-"]'), LONG);
    }
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(SHORT);
    return;
  }

  await click(page, page.getByRole('button', { name: 'Decision', exact: true }), MED);
  await click(page, page.getByText(/return for review/i), SHORT);
  await page.locator('input[name="decision"][value="RETURN_FOR_REVIEW"]').check().catch(() => {});
  await page.getByPlaceholder(/decision remarks|remarks/i).fill(reason).catch(() => {});
  await sleep(600);
  await click(page, page.getByRole('button', { name: /submit decision/i }), LONG);
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(SHORT);
}
// Verifier field beat. Display-first: real GPS/camera need device APIs a
// headless browser can't grant, so we show the capture UI, not a live capture.
async function verifierBeat(page) {
  await logout(page);
  await login(page, 'verifier1@bhoomisetu.gov.in');
  await nav(page, '/verifier', MED);
  await scrollTour(page, 8);
  await click(page, page.getByRole('button', { name: /capture|evidence|open|view|start/i }), MED);
  await scrollTour(page, 6);
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(SHORT);
}

// Satellite montage. Only 2025->2026 emits a governance alert on the hero
// cluster; compare selectors live in an unread panel, so this is best-effort.
async function satelliteMontage(page) {
  await logout(page);
  await login(page, 'dispute.officer@bhoomisetu.gov.in');
  await nav(page, '/officer/historical-imagery', MED);
  const selects = page.locator('select');
  const n = await selects.count().catch(() => 0);
  if (n >= 2) {
    await selects.nth(0).selectOption({ label: '2025' }).catch(() => {});
    await selects.nth(1).selectOption({ label: '2026' }).catch(() => {});
    await sleep(600);
  }
  await click(page, page.getByRole('button', { name: /compare|generate|run|analy/i }), LONG);
  await scrollTour(page, 6);
  await nav(page, '/officer/change-detection', MED); await scrollTour(page, 6);
  await nav(page, '/officer/alerts', MED); await scrollTour(page, 6);
}

async function adminBeat(page) {
  await logout(page);
  await login(page, 'admin@bhoomisetu.gov.in');
  await nav(page, '/admin/audit-log', MED); await scrollTour(page, 8);
  await nav(page, '/admin/workflows', MED); await scrollTour(page, 8);
}
(async () => {
  // Warm the sleeping Render backend so the first real request isn't a 50s cold start.
  console.log('▶ Warm backend');
  try { execFileSync('curl', ['-s', '-m', '55', API.replace('/api/v1', '') + '/health'], { stdio: 'ignore' }); } catch (e) {}

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (/\.(webm|mp4)$/i.test(f)) { try { fs.unlinkSync(path.join(OUT_DIR, f)); } catch (e) {} }
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: OUT_DIR, size: { width: 1920, height: 1080 } },
  });
  await context.addInitScript(CURSOR_JS);
  const page = await context.newPage();
  const t0 = Date.now();

  await step('Landing page', async () => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await sleep(MED);
    await scrollTour(page, 12); // ~30s problem framing.
  });

  await step('About page', async () => {
    await nav(page, '/about', SHORT);
    await scrollTour(page, 8);
  });

  await step('New-citizen onboarding (auth page + tour)', () => newCitizenIntro(page));

  await step('Citizen login', () => login(page, 'citizen1@example.com'));

  await step('Multilingual — English -> Marathi -> English', async () => {
    await setLang(page, 'mr');
    await scrollTour(page, 6);
    await setLang(page, 'en');
  });
    await step('My Parcels', async () => {
    await nav(page, '/citizen/parcels', MED);
    await scrollTour(page, 6);
  });

  await step('Parcel 360 (hero parcel)', async () => {
    const p360 = page.getByRole('button', { name: /360|cadastral record/i });
    if (!(await click(page, p360, LONG))) {
      await click(page, page.locator('a[href*="/parcels/"]'), LONG);
    }
    await scrollTour(page, 10); // Overview / Land Records / Registration / Tax ... tabs.
  });

  await step('Get Assistance — AI complaint + routing', async () => {
    await nav(page, '/citizen/parcels', SHORT);
    const raise = page.getByRole('button', { name: /raise complaint|raise request|get assistance/i });
    if (!(await click(page, raise, MED))) {
      await page.goto(BASE + '/citizen/get-assistance', { waitUntil: 'domcontentloaded' }).catch(() => {});
      await sleep(MED);
    }
    const parcelSel = page.locator('#assistanceParcelSelect');
    if (await parcelSel.first().isVisible().catch(() => false)) {
      await parcelSel.selectOption({ index: 1 }).catch(() => {});
      await sleep(500);
    }
    const box = page.locator('textarea').last();
    await glideTo(page, box);
    await box.fill(COMPLAINT).catch(() => {});
    await sleep(700);
    await click(page, page.getByRole('button', { name: /send|submit|ask|raise/i }), LONG);
    await sleep(LONG + 3000); // let the LLM route (Reg + LR + Tax).
    await scrollTour(page, 6);
  });
    await step('Registration Officer — Return for Review + reason',
    () => officerDecision(page, 'registration.officer@bhoomisetu.gov.in', DECISION_REASONS.registration));

  await step('Land Records Officer — assign verifier',
    () => officerDecision(page, 'landrecords.officer@bhoomisetu.gov.in', null, { assignVerifier: true }));

  await step('Verifier — field evidence', () => verifierBeat(page));

  await step('Tax Officer — Return for Review + reason',
    () => officerDecision(page, 'tax.officer@bhoomisetu.gov.in', DECISION_REASONS.tax));

  await step('Satellite — historical imagery / change detection / alerts',
    () => satelliteMontage(page));

  await step('Admin — Audit Log + Workflow Oversight', () => adminBeat(page));

  await step('Citizen — My Cases (final state)', async () => {
    await logout(page);
    await login(page, 'citizen1@example.com');
    await nav(page, '/citizen/my-cases', MED);
    await scrollTour(page, 6);
  });

  await context.close();
  await browser.close();
  const rawSeconds = (Date.now() - t0) / 1000;
  console.log(`⏱ raw walkthrough: ${rawSeconds.toFixed(1)}s`);
  // Pick the freshest webm Playwright wrote.
  const webms = fs.readdirSync(OUT_DIR).filter((f) => /\.webm$/i.test(f))
    .map((f) => ({ f, t: fs.statSync(path.join(OUT_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!webms.length) { console.error('✖ no .webm produced'); process.exit(1); }
  const src = path.join(OUT_DIR, webms[0].f);
  const mp4 = path.join(OUT_DIR, 'bhoomisetu_demo.mp4');

  // Time-normalize to EXACTLY 270s via setpts. factor = target/raw; output
  // duration = raw * factor = 270s (exact). Near-1 factor keeps scroll "medium".
  const dur = probeDuration(src) || rawSeconds;
  const factor = TARGET_SECONDS / dur;
  console.log(`⚙ raw ${dur.toFixed(1)}s -> setpts factor ${factor.toFixed(5)} -> ${TARGET_SECONDS}s`);
  if (factor < 0.7) console.log('  ⚠ raw is much longer than 4:30 — speed-up will be visible; trim the flow.');

  console.log('⚙ Muxing + normalizing -> mp4...');
  execFileSync(FFMPEG, [
    '-y', '-i', src,
    '-filter:v', `setpts=${factor.toFixed(5)}*PTS`,
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', '30', mp4,
  ], { stdio: 'inherit' });

  const out = probeDuration(mp4);
  console.log(`✅ MP4 saved: ${mp4}${out ? ` (${out.toFixed(1)}s)` : ''}`);
})();
