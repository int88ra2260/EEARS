#!/usr/bin/env node
/**
 * 將現有 LeaderPublicProfile 資料遷移到學期指派系統
 * 
 * 用法：
 *   node scripts/migrate-leaders-to-semester.js [semesterId]
 * 
 * 範例：
 *   node scripts/migrate-leaders-to-semester.js 115-1
 */
'use strict';

const { LeaderPublicProfile, LeaderSemesterAssignment } = require('../models');

const DEFAULT_SEMESTER = '115-1';

async function migrate() {
  const semesterId = process.argv[2] || DEFAULT_SEMESTER;
  console.log(`\n將現有 Leaders 遷移到學期：${semesterId}\n`);

  // 找出所有 LeaderPublicProfile
  const leaders = await LeaderPublicProfile.findAll({
    order: [['sortOrder', 'ASC'], ['id', 'ASC']],
  });

  if (leaders.length === 0) {
    console.log('沒有找到任何 LeaderPublicProfile 資料。');
    return;
  }

  console.log(`找到 ${leaders.length} 位 Leaders：`);
  leaders.forEach((l, i) => {
    console.log(`  ${i + 1}. ${l.displayName} (slug: ${l.slug}, published: ${l.isPublished})`);
  });

  // 檢查是否已有該學期的指派
  const existingAssignments = await LeaderSemesterAssignment.findAll({
    where: { semesterId },
  });

  if (existingAssignments.length > 0) {
    console.log(`\n⚠️  學期 ${semesterId} 已有 ${existingAssignments.length} 筆指派，將跳過已存在的。`);
  }

  const existingLeaderIds = new Set(existingAssignments.map(a => a.leaderId));

  let created = 0;
  let skipped = 0;

  for (const leader of leaders) {
    if (existingLeaderIds.has(leader.id)) {
      console.log(`  略過：${leader.displayName}（已有指派）`);
      skipped++;
      continue;
    }

    await LeaderSemesterAssignment.create({
      leaderId: leader.id,
      semesterId,
      isPublished: leader.isPublished,
      sortOrder: leader.sortOrder,
    });
    console.log(`  建立：${leader.displayName} → ${semesterId}`);
    created++;
  }

  console.log(`\n完成！建立 ${created} 筆，略過 ${skipped} 筆。\n`);
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('遷移失敗：', err);
    process.exit(1);
  });
