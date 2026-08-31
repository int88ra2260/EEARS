// scripts/populate-semester-for-registrations.js
// 根據報名時間自動填入學期欄位

const { sequelize, EnglishTestRegistration } = require('../models');
const { Op } = require('sequelize');

const { getSemesterByDate, getActiveRegistrationSemester, SEMESTER_RANGES } = require('../utils/englishTestRegistrationSemester');

async function populateSemester() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🚀 開始根據報名時間填入學期...\n');
    
    // 取得所有沒有學期的報名記錄
    const registrations = await EnglishTestRegistration.findAll({
      where: {
        [Op.or]: [
          { semester: null },
          { semester: '' }
        ]
      },
      transaction
    });
    
    console.log(`📋 找到 ${registrations.length} 筆需要填入學期的記錄\n`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const reg of registrations) {
      // 優先使用 createdAt（報名時間）
      const registrationDate = reg.createdAt || reg.updatedAt;
      const semester = getSemesterByDate(registrationDate);
      
      if (semester) {
        await reg.update({ semester }, { transaction });
        updated++;
        
        if (updated <= 10) {
          console.log(`  ✅ ${reg.studentId} (${reg.name}) → ${semester} (${registrationDate.toISOString().split('T')[0]})`);
        }
      } else {
        skipped++;
        if (skipped <= 10) {
          console.log(`  ⚠️  ${reg.studentId} (${reg.name}) → 無法判斷學期 (${registrationDate ? registrationDate.toISOString().split('T')[0] : '無日期'})`);
        }
      }
    }
    
    await transaction.commit();
    
    console.log(`\n✅ 完成！`);
    console.log(`  - 已更新: ${updated} 筆`);
    console.log(`  - 無法判斷: ${skipped} 筆`);
    
    if (skipped > 0) {
      console.log(`\n⚠️  有 ${skipped} 筆記錄無法自動判斷學期，請手動檢查`);
    }
    
  } catch (error) {
    await transaction.rollback();
    console.error('❌ 填入學期失敗:', error);
    throw error;
  }
}

// 執行
if (require.main === module) {
  populateSemester()
    .then(() => {
      console.log('\n✅ 完成！');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 錯誤:', error);
      process.exit(1);
    });
}

module.exports = { populateSemester, getSemesterByDate, getActiveRegistrationSemester, SEMESTER_RANGES };
