// scripts/diagnose-class-stats-zero.js
// 診斷班級統計資料為0的原因

require('dotenv').config();
const { sequelize, Class, ClassMembership, Reservation, Event } = require('../models');
const { formatTaipeiDate } = require('../utils/time');

async function diagnoseClassStatsZero() {
  try {
    console.log('🔍 診斷班級統計資料為0的原因...\n');

    // 1. 檢查學期日期範圍
    console.log('1. 檢查學期日期範圍配置...');
    const SEMESTER_RANGES = {
      '114-1': { start: '2025-08-01', end: '2026-01-31' },
      '113-2': { start: '2025-02-01', end: '2025-07-31' },
      '114-2': { start: '2026-02-01', end: '2026-07-31' }
    };
    
    console.log('   114-1 學期範圍:', SEMESTER_RANGES['114-1']);
    console.log('   113-2 學期範圍:', SEMESTER_RANGES['113-2']);
    console.log('   當前日期:', formatTaipeiDate());

    // 2. 檢查活動日期範圍
    console.log('\n2. 檢查活動日期範圍...');
    const eventDateRange = await sequelize.query(`
      SELECT 
        MIN(date) as minDate,
        MAX(date) as maxDate,
        COUNT(*) as totalEvents
      FROM Events
    `, { type: sequelize.QueryTypes.SELECT });

    if (eventDateRange[0]) {
      console.log(`   活動日期範圍: ${eventDateRange[0].minDate} 到 ${eventDateRange[0].maxDate}`);
      console.log(`   活動總數: ${eventDateRange[0].totalEvents}`);
      
      // 檢查有多少活動在114-1學期範圍內
      const eventsIn1141 = await sequelize.query(`
        SELECT COUNT(*) as count
        FROM Events
        WHERE date BETWEEN '2025-08-01' AND '2026-01-31'
      `, { type: sequelize.QueryTypes.SELECT });
      console.log(`   114-1學期範圍內的活動數: ${eventsIn1141[0].count}`);
    }

    // 3. 檢查班級學生ID格式
    console.log('\n3. 檢查班級學生ID格式...');
    const sampleClass = await Class.findOne({
      include: [{
        model: ClassMembership,
        attributes: ['studentId'],
        limit: 5
      }]
    });

    if (sampleClass && sampleClass.ClassMemberships.length > 0) {
      const classStudentIds = sampleClass.ClassMemberships.map(m => m.studentId);
      console.log(`   班級: ${sampleClass.name} (${sampleClass.semester})`);
      console.log(`   學生ID範例:`, classStudentIds.slice(0, 3));
      console.log(`   學生ID格式檢查:`);
      classStudentIds.slice(0, 3).forEach(id => {
        console.log(`     - "${id}" (長度: ${id.length}, 類型: ${typeof id})`);
      });
    }

    // 4. 檢查預約資料中的studentId格式
    console.log('\n4. 檢查預約資料中的studentId格式...');
    const reservationStudentIds = await sequelize.query(`
      SELECT DISTINCT studentId
      FROM Reservations
      WHERE studentId IS NOT NULL
      LIMIT 5
    `, { type: sequelize.QueryTypes.SELECT });

    if (reservationStudentIds.length > 0) {
      console.log(`   預約資料中的studentId範例:`);
      reservationStudentIds.forEach(row => {
        console.log(`     - "${row.studentId}" (長度: ${row.studentId.length})`);
      });
    }

    // 5. 檢查ID匹配問題
    console.log('\n5. 檢查ID匹配問題...');
    if (sampleClass && sampleClass.ClassMemberships.length > 0) {
      const classStudentId = sampleClass.ClassMemberships[0].studentId;
      const matchingReservations = await sequelize.query(`
        SELECT COUNT(*) as count
        FROM Reservations
        WHERE studentId = :studentId
      `, {
        replacements: { studentId: classStudentId },
        type: sequelize.QueryTypes.SELECT
      });
      console.log(`   學生ID "${classStudentId}" 的預約數: ${matchingReservations[0].count}`);

      // 檢查大小寫不匹配
      const caseInsensitiveMatch = await sequelize.query(`
        SELECT COUNT(*) as count
        FROM Reservations
        WHERE UPPER(studentId) = UPPER(:studentId)
      `, {
        replacements: { studentId: classStudentId },
        type: sequelize.QueryTypes.SELECT
      });
      console.log(`   大小寫不敏感匹配的預約數: ${caseInsensitiveMatch[0].count}`);
    }

    // 6. 檢查預約資料的日期範圍
    console.log('\n6. 檢查預約資料的日期範圍...');
    const reservationDateRange = await sequelize.query(`
      SELECT 
        MIN(e.date) as minDate,
        MAX(e.date) as maxDate,
        COUNT(*) as totalReservations
      FROM Reservations r
      INNER JOIN Events e ON r.eventId = e.id
    `, { type: sequelize.QueryTypes.SELECT });

    if (reservationDateRange[0]) {
      console.log(`   預約活動日期範圍: ${reservationDateRange[0].minDate} 到 ${reservationDateRange[0].maxDate}`);
      console.log(`   預約總數: ${reservationDateRange[0].totalReservations}`);
    }

    // 7. 實際測試查詢（模擬統計查詢）
    console.log('\n7. 實際測試統計查詢...');
    if (sampleClass && sampleClass.ClassMemberships.length > 0) {
      const studentIds = sampleClass.ClassMemberships.map(m => m.studentId);
      const semesterRange = SEMESTER_RANGES[sampleClass.semester] || SEMESTER_RANGES['114-1'];
      
      console.log(`   測試班級: ${sampleClass.name}`);
      console.log(`   學期: ${sampleClass.semester}`);
      console.log(`   日期範圍: ${semesterRange.start} 到 ${semesterRange.end}`);
      console.log(`   學生數: ${studentIds.length}`);
      console.log(`   測試學生ID: ${studentIds[0]}`);

      // 測試查詢
      const testQuery = await sequelize.query(`
        SELECT 
          r.studentId,
          e.date,
          e.eventType,
          r.checkinStatus,
          COUNT(*) as count
        FROM Reservations r
        INNER JOIN Events e ON r.eventId = e.id
        WHERE r.studentId IN (:studentIds)
          AND e.date BETWEEN :startDate AND :endDate
        GROUP BY r.studentId, e.date, e.eventType, r.checkinStatus
        LIMIT 10
      `, {
        replacements: {
          studentIds: studentIds,
          startDate: semesterRange.start,
          endDate: semesterRange.end
        },
        type: sequelize.QueryTypes.SELECT
      });

      console.log(`   查詢結果數: ${testQuery.length}`);
      if (testQuery.length > 0) {
        console.log(`   範例結果:`);
        testQuery.slice(0, 3).forEach(row => {
          console.log(`     - 學生ID: ${row.studentId}, 日期: ${row.date}, 活動類型: ${row.eventType}, 狀態: ${row.checkinStatus}`);
        });
      } else {
        console.log(`   ⚠️  沒有找到符合條件的預約記錄！`);
        
        // 檢查是否有該學生的預約（不限日期）
        const anyReservation = await sequelize.query(`
          SELECT COUNT(*) as count
          FROM Reservations r
          INNER JOIN Events e ON r.eventId = e.id
          WHERE r.studentId = :studentId
        `, {
          replacements: { studentId: studentIds[0] },
          type: sequelize.QueryTypes.SELECT
        });
        console.log(`   該學生（不限日期）的預約數: ${anyReservation[0].count}`);
      }
    }

    // 8. 檢查簽到狀態
    console.log('\n8. 檢查簽到狀態分布...');
    const checkinStatus = await sequelize.query(`
      SELECT 
        checkinStatus,
        COUNT(*) as count
      FROM Reservations
      WHERE checkinStatus IS NOT NULL
      GROUP BY checkinStatus
    `, { type: sequelize.QueryTypes.SELECT });

    console.log(`   簽到狀態分布:`);
    checkinStatus.forEach(row => {
      console.log(`     - ${row.checkinStatus}: ${row.count}`);
    });

    console.log('\n✅ 診斷完成！');

  } catch (error) {
    console.error('❌ 診斷過程中發生錯誤:', error);
  } finally {
    await sequelize.close();
  }
}

// 執行診斷
diagnoseClassStatsZero();


