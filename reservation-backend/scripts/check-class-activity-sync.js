// scripts/check-class-activity-sync.js
// 檢查班級參與概況和活動報表的簽到和預約是否同步

require('dotenv').config();
const { sequelize, Class, ClassMembership, Reservation, Event } = require('../models');
const { Op } = require('sequelize');
const { SEMESTER_RANGES } = require('../utils/semesterConstants');

// 清洗學號（轉大寫、去除空白）
function cleanStudentId(str) {
  if (!str) return null;
  return str.toString().trim().toUpperCase().replace(/\s+/g, '');
}

async function checkClassActivitySync() {
  try {
    console.log('🔍 檢查班級參與概況和活動報表的簽到和預約是否同步...\n');

    // 1. 取得所有班級及其學生
    console.log('1. 取得班級資料...');
    const allClasses = await Class.findAll({
      include: [{
        model: ClassMembership,
        attributes: ['studentId']
      }],
      order: [['semester', 'ASC'], ['name', 'ASC']]
    });

    console.log(`   ✅ 班級總數: ${allClasses.length}`);

    // 按學期分組
    const classesBySemester = {};
    allClasses.forEach(classRecord => {
      if (!classesBySemester[classRecord.semester]) {
        classesBySemester[classRecord.semester] = [];
      }
      classesBySemester[classRecord.semester].push(classRecord);
    });

    // 2. 對每個學期進行檢查
    for (const [semester, classes] of Object.entries(classesBySemester)) {
      const semesterRange = SEMESTER_RANGES[semester];
      if (!semesterRange) {
        console.log(`\n   ⚠️  學期 ${semester} 沒有定義日期範圍，跳過`);
        continue;
      }

      console.log(`\n📅 學期: ${semester} (${semesterRange.start} ~ ${semesterRange.end})`);
      console.log(`   班級數: ${classes.length}`);

      // 取得該學期範圍內的所有活動
      // 注意：這裡載入所有需要的屬性，與活動報表的查詢不同
      const events = await Event.findAll({
        where: {
          date: {
            [Op.between]: [semesterRange.start, semesterRange.end]
          }
        },
        include: [{
          model: Reservation,
          attributes: ['id', 'studentId', 'checkinStatus', 'checkinTime']
        }],
        order: [['date', 'DESC']]
      });

      console.log(`   活動數: ${events.length}`);

      if (events.length === 0) {
        console.log(`   ⚠️  該學期範圍內沒有活動`);
        continue;
      }

      // 3. 對每個活動進行檢查
      let totalMismatches = 0;
      let totalChecked = 0;

      // 只檢查前10個有預約的活動（避免輸出過多）
      const eventsWithReservations = events.filter(e => (e.Reservations || []).length > 0);
      const sampleEvents = eventsWithReservations.slice(0, 10);
      
      if (eventsWithReservations.length === 0) {
        console.log(`   ⚠️  該學期範圍內沒有有預約的活動`);
        continue;
      }
      
      console.log(`   有預約的活動數: ${eventsWithReservations.length}`);

      for (const event of sampleEvents) {
        totalChecked++;
        
        // 從活動報表角度：計算該活動的總預約數和簽到數
        const eventReservations = event.Reservations || [];
        const eventTotalReservations = eventReservations.length;
        const eventTotalCheckedIn = eventReservations.filter(r => r.checkinStatus === '已簽到').length;
        const eventTotalNotCheckedIn = eventReservations.filter(r => r.checkinStatus === '未簽到').length;
        const eventTotalViolations = eventReservations.filter(r => r.checkinStatus === '已登記違規').length;
        
        // 檢查是否有重複的活動ID
        const duplicateEvents = events.filter(e => e.id === event.id);
        if (duplicateEvents.length > 1) {
          console.log(`\n   ⚠️  發現重複的活動ID: ${event.id} (${duplicateEvents.length} 個)`);
        }

        // 從班級參與概況角度：計算該活動中屬於班級學生的預約數和簽到數
        // 收集所有班級學生的學號
        const allClassStudentIds = new Set();
        classes.forEach(classRecord => {
          const studentIds = classRecord.ClassMemberships ? 
            classRecord.ClassMemberships.map(m => m.studentId).filter(id => id) : [];
          studentIds.forEach(id => {
            const cleanedId = cleanStudentId(id);
            if (cleanedId) {
              allClassStudentIds.add(cleanedId);
            }
          });
        });

        // 計算該活動中屬於班級學生的預約數和簽到數
        let classReservations = 0;
        let classCheckedIn = 0;
        let classNotCheckedIn = 0;
        let classViolations = 0;

        eventReservations.forEach(reservation => {
          const reservationStudentId = cleanStudentId(reservation.studentId);
          if (reservationStudentId && allClassStudentIds.has(reservationStudentId)) {
            classReservations++;
            if (reservation.checkinStatus === '已簽到') {
              classCheckedIn++;
            } else if (reservation.checkinStatus === '未簽到') {
              classNotCheckedIn++;
            } else if (reservation.checkinStatus === '已登記違規') {
              classViolations++;
            }
          }
        });

        // 比較數據
        const hasMismatch = false; // 這裡我們只是顯示數據，不判斷是否不一致
        // 因為班級參與概況只統計班級學生，而活動報表統計所有學生，所以數量不同是正常的

        // 顯示該活動的統計（只顯示有預約的活動，避免輸出過多）
        if (eventTotalReservations > 0) {
          console.log(`\n   📊 活動: ${event.name} (${event.date}) [${event.eventType || 'English Table'}]`);
          console.log(`      活動報表統計（所有學生）:`);
          console.log(`        - 總預約數: ${eventTotalReservations}`);
          console.log(`        - 已簽到: ${eventTotalCheckedIn}`);
          console.log(`        - 未簽到: ${eventTotalNotCheckedIn}`);
          console.log(`        - 已登記違規: ${eventTotalViolations}`);
          console.log(`      班級參與概況統計（班級學生）:`);
          console.log(`        - 總預約數: ${classReservations}`);
          console.log(`        - 已簽到: ${classCheckedIn}`);
          console.log(`        - 未簽到: ${classNotCheckedIn}`);
          console.log(`        - 已登記違規: ${classViolations}`);
          
          // 檢查數據一致性
          // 從資料庫直接查詢該活動的預約記錄，驗證簽到狀態是否一致
          const directQuery = await sequelize.query(`
            SELECT 
              COUNT(*) as totalReservations,
              SUM(CASE WHEN checkinStatus = '已簽到' THEN 1 ELSE 0 END) as checkedIn,
              SUM(CASE WHEN checkinStatus = '未簽到' THEN 1 ELSE 0 END) as notCheckedIn,
              SUM(CASE WHEN checkinStatus = '已登記違規' THEN 1 ELSE 0 END) as violations
            FROM Reservations
            WHERE eventId = :eventId
          `, {
            replacements: { eventId: event.id },
            type: sequelize.QueryTypes.SELECT
          });

          if (directQuery[0]) {
            const directTotal = parseInt(directQuery[0].totalReservations) || 0;
            const directCheckedIn = parseInt(directQuery[0].checkedIn) || 0;
            const directNotCheckedIn = parseInt(directQuery[0].notCheckedIn) || 0;
            const directViolations = parseInt(directQuery[0].violations) || 0;

            console.log(`      資料庫直接查詢統計（驗證）:`);
            console.log(`        - 總預約數: ${directTotal}`);
            console.log(`        - 已簽到: ${directCheckedIn}`);
            console.log(`        - 未簽到: ${directNotCheckedIn}`);
            console.log(`        - 已登記違規: ${directViolations}`);

            // 檢查是否一致
            // 注意：活動報表查詢可能只載入了部分屬性，所以這裡比較的是我們載入的數據和直接查詢的數據
            if (directTotal !== eventTotalReservations) {
              console.log(`        ⚠️  預約數不一致！載入的數據: ${eventTotalReservations}, 資料庫查詢: ${directTotal}`);
              console.log(`           可能原因：Sequelize include 查詢未正確載入所有預約記錄，或活動ID重複`);
              totalMismatches++;
            }
            if (directCheckedIn !== eventTotalCheckedIn) {
              console.log(`        ⚠️  簽到數不一致！載入的數據: ${eventTotalCheckedIn}, 資料庫查詢: ${directCheckedIn}`);
              totalMismatches++;
            }
            if (directNotCheckedIn !== eventTotalNotCheckedIn) {
              console.log(`        ⚠️  未簽到數不一致！載入的數據: ${eventTotalNotCheckedIn}, 資料庫查詢: ${directNotCheckedIn}`);
              totalMismatches++;
            }
            if (directViolations !== eventTotalViolations) {
              console.log(`        ⚠️  違規數不一致！載入的數據: ${eventTotalViolations}, 資料庫查詢: ${directViolations}`);
              totalMismatches++;
            }

            if (directTotal === eventTotalReservations && 
                directCheckedIn === eventTotalCheckedIn && 
                directNotCheckedIn === eventTotalNotCheckedIn &&
                directViolations === eventTotalViolations) {
              console.log(`        ✅ 載入的數據與資料庫查詢一致`);
            }
          }
        }
      }

      // 4. 檢查班級參與概況的統計邏輯
      console.log(`\n   4. 檢查班級參與概況的統計邏輯...`);
      
      // 取樣檢查前3個班級
      const sampleClasses = classes.slice(0, 3);
      
      for (const classRecord of sampleClasses) {
        const studentIds = classRecord.ClassMemberships ? 
          classRecord.ClassMemberships.map(m => m.studentId).filter(id => id) : [];
        
        if (studentIds.length === 0) {
          console.log(`\n      📊 班級: ${classRecord.name} (${classRecord.semester})`);
          console.log(`         - 學生數: 0 (沒有成員)`);
          continue;
        }

        const cleanedStudentIds = studentIds.map(id => cleanStudentId(id)).filter(id => id);

        // 使用班級參與概況的查詢邏輯
        const classStats = await sequelize.query(`
          SELECT 
            COUNT(r.id) as totalReservations,
            SUM(CASE WHEN r.checkinStatus = '已簽到' THEN 1 ELSE 0 END) as checkedIn,
            SUM(CASE WHEN r.checkinStatus = '未簽到' THEN 1 ELSE 0 END) as notCheckedIn,
            SUM(CASE WHEN r.checkinStatus = '已登記違規' THEN 1 ELSE 0 END) as violations
          FROM Reservations r
          INNER JOIN Events e ON r.eventId = e.id
          WHERE r.studentId IN (:studentIds)
            AND e.date BETWEEN :startDate AND :endDate
        `, {
          replacements: {
            studentIds: cleanedStudentIds,
            startDate: semesterRange.start,
            endDate: semesterRange.end
          },
          type: sequelize.QueryTypes.SELECT
        });

        if (classStats[0]) {
          const classTotal = parseInt(classStats[0].totalReservations) || 0;
          const classCheckedIn = parseInt(classStats[0].checkedIn) || 0;
          const classNotCheckedIn = parseInt(classStats[0].notCheckedIn) || 0;
          const classViolations = parseInt(classStats[0].violations) || 0;

          console.log(`\n      📊 班級: ${classRecord.name} (${classRecord.semester})`);
          console.log(`         - 學生數: ${studentIds.length}`);
          console.log(`         - 總預約數: ${classTotal}`);
          console.log(`         - 已簽到: ${classCheckedIn}`);
          console.log(`         - 未簽到: ${classNotCheckedIn}`);
          console.log(`         - 已登記違規: ${classViolations}`);
        }
      }

      if (totalMismatches > 0) {
        console.log(`\n   ⚠️  發現 ${totalMismatches} 個不一致的數據`);
      } else {
        console.log(`\n   ✅ 檢查的 ${totalChecked} 個活動數據一致`);
      }

      if (events.length > 10) {
        console.log(`\n   ... 還有 ${events.length - 10} 個活動未檢查`);
      }
    }

    // 5. 總結檢查
    console.log('\n\n📝 總結:');
    console.log('   1. 活動報表統計所有學生的預約和簽到');
    console.log('   2. 班級參與概況只統計班級學生的預約和簽到');
    console.log('   3. 兩者的數據來源都是 Reservations 表，應該是一致的');
    console.log('   4. 如果發現不一致，可能是：');
    console.log('      - 學號格式不一致（大小寫、空白）');
    console.log('      - 數據查詢邏輯有誤');
    console.log('      - 數據更新不同步');

    console.log('\n✅ 檢查完成！');

  } catch (error) {
    console.error('❌ 檢查過程中發生錯誤:', error);
  } finally {
    await sequelize.close();
  }
}

// 執行檢查
checkClassActivitySync();

