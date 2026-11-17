/* eslint-disable no-console */
'use strict';

/**
 * 補上問卷回覆的學期外鍵，並把 answersJson 寫進 survey_response_answers。
 * 預設只預覽。正式寫入：node scripts/backfill-survey-response-links.js --apply
 */
const { sequelize } = require('../models');
const { backfillResponseLinks } = require('../services/surveyDataGovernanceService');

async function main() {
  const apply = process.argv.includes('--apply');
  const stats = await backfillResponseLinks({ dryRun: !apply });
  console.log(JSON.stringify(stats, null, 2));
}

main()
  .catch((err) => {
    console.error('[backfill-survey-response-links]', err.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
