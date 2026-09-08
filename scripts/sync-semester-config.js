/**
 * 將 shared/semesterConfig.js 同步到前端 ESM 檔，避免 CRA 無法 import 專案外路徑。
 * Usage: node scripts/sync-semester-config.js [--check]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHARED = path.join(ROOT, 'shared', 'semesterConfig.js');
const FRONTEND_OUT = path.join(
  ROOT,
  'reservation-frontend',
  'src',
  'config',
  'semesterConfig.js'
);

function buildFrontendModule({ SEMESTER_RANGES, SEMESTER_ORDER }) {
  const rangesLiteral = JSON.stringify(SEMESTER_RANGES, null, 2);
  const orderLiteral = JSON.stringify(SEMESTER_ORDER, null, 2);
  return `/**
 * AUTO-GENERATED from shared/semesterConfig.js — do not edit by hand.
 * Regenerate: node scripts/sync-semester-config.js
 */
export const SEMESTER_RANGES = Object.freeze(${rangesLiteral});

export const SEMESTER_ORDER = Object.freeze(${orderLiteral});
`;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  // Clear require cache so repeated runs see latest shared file
  delete require.cache[require.resolve(SHARED)];
  const config = require(SHARED);
  const next = buildFrontendModule(config);

  if (checkOnly) {
    if (!fs.existsSync(FRONTEND_OUT)) {
      console.error('[semester-config] missing frontend file:', FRONTEND_OUT);
      process.exit(1);
    }
    const current = fs.readFileSync(FRONTEND_OUT, 'utf8');
    if (current.replace(/\r\n/g, '\n') !== next.replace(/\r\n/g, '\n')) {
      console.error('[semester-config] frontend out of sync with shared/semesterConfig.js');
      console.error('Run: node scripts/sync-semester-config.js');
      process.exit(1);
    }
    console.log('[semester-config] OK — frontend matches shared');
    return;
  }

  fs.mkdirSync(path.dirname(FRONTEND_OUT), { recursive: true });
  fs.writeFileSync(FRONTEND_OUT, next, 'utf8');
  console.log('[semester-config] wrote', path.relative(ROOT, FRONTEND_OUT));
}

main();
