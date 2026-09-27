// Extract inline fallback text: t('key', 'English text') / t("key","...") across src.
// Merges with _seed_code_missing.json to produce a complete English seed for the
// 600 code-used keys missing from the backend base.
import { readFileSync, readdirSync, writeFileSync, statSync } from 'fs';
import { join, extname } from 'path';

const FE = 'D:/Projects/SIH_2026_BhoomiSetu/frontend';
const files = [];
(function walk(d) {
  for (const name of readdirSync(d)) {
    const p = join(d, name); const s = statSync(p);
    if (s.isDirectory()) { if (name !== 'node_modules') walk(p); }
    else if (['.ts', '.tsx'].includes(extname(name)) && !name.endsWith('.d.ts')) files.push(p);
  }
})(`${FE}/src`);

// t( 'key' , 'fallback' )  -- capture key + a single/double/backtick string 2nd arg
const re = /\bt\(\s*(['"])([\w.-]+)\1\s*,\s*(['"`])((?:\\.|(?!\3)[\s\S])*?)\3/g;
const inline = {};
for (const f of files) {
  if (f.includes('LanguageContext.tsx')) continue;
  for (const m of readFileSync(f, 'utf8').matchAll(re)) {
    const key = m[2], val = m[4].replace(/\\(['"`])/g, '$1');
    if (!(key in inline)) inline[key] = val;   // first occurrence wins
  }
}

const seed = JSON.parse(readFileSync(`${FE}/scripts/_seed_code_missing.json`, 'utf8'));
// fill any seed key that has an inline fallback but wasn't already valued (all 551 had values;
// the 49 without values get filled here from inline text)
const codeMissing = JSON.parse(readFileSync(`${FE}/scripts/_seed_code_missing_keys.json`, 'utf8'));

// authored copy for the 3 with neither a data value NOR an inline fallback
const authored = {
  'myParcels.deleteModalDesc': 'Are you sure you want to delete this parcel? This action cannot be undone.',
  'officerPortal.assigningVerifier': 'Assigning verifier…',
  'officerPortal.loadingFindings': 'Loading findings…',
};

const complete = { ...seed };
let filledInline = 0, filledAuthored = 0, stillMissing = [];
for (const k of codeMissing) {
  if (k in complete) continue;
  if (k in inline) { complete[k] = inline[k]; filledInline++; }
  else if (k in authored) { complete[k] = authored[k]; filledAuthored++; }
  else stillMissing.push(k);
}

writeFileSync(`${FE}/scripts/_seed_complete_en.json`, JSON.stringify(complete, null, 2));
console.log(`seed (data values): ${Object.keys(seed).length}`);
console.log(`filled from inline fallbacks: ${filledInline}`);
console.log(`filled from authored copy: ${filledAuthored}`);
console.log(`complete English seed: ${Object.keys(complete).length}`);
if (stillMissing.length) { console.log(`STILL MISSING (${stillMissing.length}):`); stillMissing.forEach(k=>console.log('  '+k)); }
else console.log('all code-missing keys now have English text ✔');
