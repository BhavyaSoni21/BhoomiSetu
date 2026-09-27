// Coverage diff: which code t() keys are MISSING from backend static/ui_strings_en.json,
// and which of those have an English value we can seed from the frontend fallback.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const FE = 'D:/Projects/SIH_2026_BhoomiSetu/frontend';
const BE = 'D:/Projects/SIH_2026_BhoomiSetu/backend-py';

const flatten = (obj, prefix = '', out = {}) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
};

// --- frontend English master = FALLBACK_STRINGS_RAW.en  U  flatten(en.json) ---
const enJson = flatten(JSON.parse(readFileSync(`${FE}/src/i18n/locales/en.json`, 'utf8')));

const ctx = readFileSync(`${FE}/src/context/LanguageContext.tsx`, 'utf8');
// isolate the object literal after `FALLBACK_STRINGS_RAW =` via brace matching
const start = ctx.indexOf('{', ctx.indexOf('FALLBACK_STRINGS_RAW'));
let depth = 0, end = start;
for (let i = start; i < ctx.length; i++) {
  if (ctx[i] === '{') depth++;
  else if (ctx[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
let rawEn = {};
try {
  const raw = eval('(' + ctx.slice(start, end) + ')');   // plain data object literal
  rawEn = raw.en || {};
} catch (e) { console.error('eval FALLBACK_STRINGS_RAW failed:', e.message); }

const feMaster = { ...rawEn, ...enJson };   // key -> English value
const feKeys = new Set(Object.keys(feMaster));

// --- backend base ---
const beEn = JSON.parse(readFileSync(`${BE}/static/ui_strings_en.json`, 'utf8'));
const beKeys = new Set(Object.keys(beEn));

// --- code t() keys (static literals only) ---
const files = [];
(function walk(d) {
  for (const name of readdirSync(d)) {
    const p = join(d, name); const s = statSync(p);
    if (s.isDirectory()) { if (name !== 'node_modules') walk(p); }
    else if (['.ts', '.tsx'].includes(extname(name)) && !name.endsWith('.d.ts')) files.push(p);
  }
})(`${FE}/src`);
const staticRe = /\bt\(\s*(['"])([\w.-]+)\1/g;
const codeKeys = new Set();
for (const f of files) {
  if (f.includes('LanguageContext.tsx')) continue;
  for (const m of readFileSync(f, 'utf8').matchAll(staticRe)) codeKeys.add(m[2]);
}

// === diffs ===
const codeMissingFromBE = [...codeKeys].filter(k => !beKeys.has(k));
const codeMissing_haveEnValue = codeMissingFromBE.filter(k => feKeys.has(k));
const codeMissing_noEnValue = codeMissingFromBE.filter(k => !feKeys.has(k));

// Broader: every frontend-fallback key not yet in backend (full sync set)
const feMissingFromBE = [...feKeys].filter(k => !beKeys.has(k));

console.log(`frontend fallback English keys (RAW.en U en.json): ${feKeys.size}`);
console.log(`backend ui_strings_en.json keys: ${beKeys.size}`);
console.log(`distinct static code t() keys: ${codeKeys.size}`);
console.log(`\n[1] code keys MISSING from backend ui_strings_en.json: ${codeMissingFromBE.length}`);
console.log(`    of those, WITH an English value to seed: ${codeMissing_haveEnValue.length}`);
console.log(`    of those, with NO English value anywhere (need real copy): ${codeMissing_noEnValue.length}`);
console.log(`\n--- keys with NO English value anywhere (must author text) ---`);
codeMissing_noEnValue.sort().forEach(k => console.log(`  ${k}`));
console.log(`\n[2] ALL frontend-fallback keys missing from backend (full sync candidate): ${feMissingFromBE.length}`);

// dump the seedable set (code-used, have value) to a file for the actual patch
import { writeFileSync } from 'fs';
const seed = {};
for (const k of codeMissing_haveEnValue) seed[k] = feMaster[k];
// also include the full FE-missing set values (superset), for optional full sync
const fullSeed = {};
for (const k of feMissingFromBE) fullSeed[k] = feMaster[k];
writeFileSync(`${FE}/scripts/_seed_code_missing_keys.json`, JSON.stringify(codeMissingFromBE.sort(), null, 2));
writeFileSync(`${FE}/scripts/_seed_code_missing.json`, JSON.stringify(seed, null, 2));
writeFileSync(`${FE}/scripts/_seed_full_missing.json`, JSON.stringify(fullSeed, null, 2));
console.log(`\nwrote scripts/_seed_code_missing.json (${Object.keys(seed).length}) and _seed_full_missing.json (${Object.keys(fullSeed).length})`);
