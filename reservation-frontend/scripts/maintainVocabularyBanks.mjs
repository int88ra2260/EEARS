/**
 * EEARS 字彙庫維護入口 — 依序重建 canonical → 微學習衍生題庫 → 稽核
 *
 * Usage:
 *   node scripts/maintainVocabularyBanks.mjs          # 完整重建
 *   node scripts/maintainVocabularyBanks.mjs --check  # 僅驗證（不寫檔）
 *   node scripts/maintainVocabularyBanks.mjs --skip-audit
 *
 * 詳見 docs/micro-learning/vocabulary-bank-maintenance.md
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const skipAudit = args.includes('--skip-audit');

/**
 * @param {string} script
 * @param {string[]} scriptArgs
 */
function runStep(script, scriptArgs = []) {
  const scriptPath = path.join(__dirname, script);
  const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`\n=== EEARS 字彙庫維護 ${checkOnly ? '(check)' : '(build)'} ===\n`);

runStep('buildCanonicalVocabularyBank.mjs', checkOnly ? ['--check'] : []);
runStep('buildMicroLearningQuestionBanks.mjs', checkOnly ? ['--check'] : []);

if (!skipAudit && !checkOnly) {
  runStep('auditCefrWordBanks.mjs');
}

console.log('\nDone. 建議接著執行：');
console.log('  npm test -- --watchAll=false --testPathPattern="vocabulary|wordBridge|listeningLadder"');
if (!checkOnly) {
  console.log('  npm run lint');
}
