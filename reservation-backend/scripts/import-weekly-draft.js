/**
 * 將 AI 工作流產出的週報 JSON 匯入為後台 draft。
 *
 * 用法：
 *   node scripts/import-weekly-draft.js --file ../.cursor/skills/eears-weekly-ai-workflow/drafts/2026-W27-summer-signal.json
 *   node scripts/import-weekly-draft.js --file path/to/draft.json --fill-events
 *   node scripts/import-weekly-draft.js --file path/to/draft.json --update --fill-events
 *   node scripts/import-weekly-draft.js --file path/to/draft.json --dry-run
 */
require('dotenv').config();

const path = require('path');
const { importWeeklyDraft } = require('../services/weeklyDraftImportService');

function parseArgs(argv) {
  const opts = {
    file: '',
    fillEvents: false,
    update: false,
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--fill-events') opts.fillEvents = true;
    else if (arg === '--update') opts.update = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--file' && argv[i + 1]) {
      opts.file = argv[i + 1];
      i += 1;
    } else if (!arg.startsWith('--') && !opts.file) {
      opts.file = arg;
    }
  }

  if (!opts.file) {
    opts.file = path.join(
      __dirname,
      '../../.cursor/skills/eears-weekly-ai-workflow/drafts/2026-W27-summer-signal.json'
    );
  }

  return opts;
}

async function main() {
  const opts = parseArgs(process.argv);
  const filePath = path.isAbsolute(opts.file)
    ? opts.file
    : path.resolve(process.cwd(), opts.file);

  const result = await importWeeklyDraft({
    filePath,
    fillEvents: opts.fillEvents,
    update: opts.update,
    dryRun: opts.dryRun,
  });

  if (result.dryRun) {
    console.log('[dry-run]', JSON.stringify(result, null, 2));
    return;
  }

  console.log(`週報草稿已${result.action === 'created' ? '建立' : '更新'}：`);
  console.log(`  id: ${result.id}`);
  console.log(`  issueKey: ${result.issueKey}`);
  console.log(`  slug: ${result.slug}`);
  if (result.filledEventIds?.length) {
    console.log(`  自動填入活動 ID: ${result.filledEventIds.join(', ')}`);
  } else if (opts.fillEvents) {
    console.log('  （本週區間內無活動，eventsHighlight 維持空陣列）');
  }
  console.log(`  後台編輯：${result.editUrl}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message || err);
    process.exit(err.status === 409 ? 2 : 1);
  });
