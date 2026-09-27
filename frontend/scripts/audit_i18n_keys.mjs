// One-shot audit: t('...') keys used in code vs defined in en.json / hi.json
// and vs the inline FALLBACK_STRINGS_RAW in LanguageContext.tsx.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = 'src';
const en = JSON.parse(readFileSync('src/i18n/locales/en.json', 'utf8'));
const hi = JSON.parse(readFileSync('src/i18n/locales/hi.json', 'utf8'));

const flatten = (obj, prefix = '', out = {}) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
};
const enKeys = new Set(Object.keys(flatten(en)));
const hiKeys = new Set(Object.keys(flatten(hi)));

// Inline FALLBACK_STRINGS_RAW keys: parse the 'key': '...' pairs inside the raw block.
const langCtx = readFileSync('src/context/LanguageContext.tsx', 'utf8');
const rawBlock = langCtx.slice(
  langCtx.indexOf('FALLBACK_STRINGS_RAW'),
  langCtx.indexOf('export const FALLBACK_STRINGS')
);
const inlineKeys = new Set();
for (const m of rawBlock.matchAll(/['"]([\w.-]+)['"]\s*:/g)) inlineKeys.add(m[1]);

// Walk source, collect t('literal') / t("literal") and flag dynamic t(`...`) / t(var).
const files = [];
(function walk(d) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    const s = statSync(p);
    if (s.isDirectory()) { if (name !== 'node_modules') walk(p); }
    else if (['.ts', '.tsx'].includes(extname(name)) && !name.endsWith('.d.ts')) files.push(p);
  }
})(ROOT);

const used = new Map();          // key -> {file, hasInlineFallback}
const dynamic = [];              // {file, snippet}
// t('key') or t("key"), optional 2nd arg. Also catches i18n.t / .t(
const staticRe = /\bt\(\s*(['"])([\w.-]+)\1\s*(,)?/g;
const dynamicRe = /\bt\(\s*(`[^`]*`|[A-Za-z_$][\w$]*)\s*[,)]/g;

for (const f of files) {
  if (f.includes('LanguageContext.tsx')) continue; // definition site, not usage
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(staticRe)) {
    const key = m[2];
    const hasComma = !!m[3];
    // does an inline string fallback follow the comma?
    let inlineFallback = false;
    if (hasComma) {
      const after = src.slice(m.index + m[0].length).trimStart();
      inlineFallback = after.startsWith("'") || after.startsWith('"') || after.startsWith('`');
    }
    if (!used.has(key)) used.set(key, { file: f.replace(/\\/g, '/'), inlineFallback });
    else if (inlineFallback) used.get(key).inlineFallback = true;
  }
  for (const m of src.matchAll(dynamicRe)) {
    if (m[1] === 't') continue;
    dynamic.push({ file: f.replace(/\\/g, '/'), snippet: m[0].slice(0, 60) });
  }
}

const missingEn = [];
for (const [key, info] of used) {
  if (enKeys.has(key) || inlineKeys.has(key)) continue;
  missingEn.push({ key, ...info });
}
// Of the keys that DO resolve (in en.json), which lack a hi.json translation?
const missingHi = [];
for (const key of used.keys()) {
  if (enKeys.has(key) && !hiKeys.has(key)) missingHi.push(key);
}

const raw = missingEn.filter(m => !m.inlineFallback);
const fallbackOnly = missingEn.filter(m => m.inlineFallback);

console.log(`\n=== i18n key audit ===`);
console.log(`en.json keys: ${enKeys.size} | hi.json keys: ${hiKeys.size} | inline FALLBACK_STRINGS_RAW keys: ${inlineKeys.size}`);
console.log(`distinct static t('...') keys used in code: ${used.size}`);

console.log(`\n--- [A] USED IN CODE, MISSING EVERYWHERE, NO inline fallback -> RENDERS RAW (${raw.length}) ---`);
raw.sort((a,b)=>a.key.localeCompare(b.key)).forEach(m => console.log(`  ${m.key}   (${m.file})`));

console.log(`\n--- [B] MISSING from en.json/FALLBACK but HAS inline fallback -> works, shows fallback (${fallbackOnly.length}) ---`);
fallbackOnly.sort((a,b)=>a.key.localeCompare(b.key)).forEach(m => console.log(`  ${m.key}   (${m.file})`));

console.log(`\n--- [C] IN en.json but MISSING from hi.json -> English shown to Hindi users (${missingHi.length}) ---`);
missingHi.sort().forEach(k => console.log(`  ${k}`));

console.log(`\n--- [D] DYNAMIC t(\`...\`) / t(var) keys (cannot statically verify) (${dynamic.length}) ---`);
dynamic.slice(0, 40).forEach(d => console.log(`  ${d.snippet}   (${d.file})`));
if (dynamic.length > 40) console.log(`  ...and ${dynamic.length - 40} more`);
