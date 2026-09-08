// scripts/check-class-data-impact.js
// 檢查 migration 是否影響班級參與概況的資料

require('dotenv').config();
const { sequelize, Class, ClassMembership, Reservation, Event } = require('../models');
const { Op } = require('sequelize');
const { SEMESTER_RANGES } = require('../utils/semesterConstants');

// 清洗學號（轉大寫、去除空白）
function cleanStudentId(str) {
  if (!str) return null;
  return str.toString().trim().toUpperCase().replace(/\s+/g, '');
}

async function checkClassDataImpact() {
  try {
    console.log('🔍 檢查班級參與概況資料影響...\n');

    // 1. 檢查班級資料
    console.log('1. 檢查班級資料表...');
    const classCount = await Class.count();
    console.log(`   ✅ 班級總數: ${classCount}`);

    const classMembershipCount = await ClassMembership.count();
    console.log(`   ✅ 班級成員總數: ${classMembershipCount}`);

    // 2. 檢查預約資料（可能被清理的資料）
    console.log('\n2. 檢查預約資料...');
    const totalReservations = await Reservation.count();
    console.log(`   ✅ 預約總數: ${totalReservations}`);

    // 檢查簽到狀態分布
    const checkinStatusStats = await sequelize.query(`
      SELECT checkinStatus, COUNT(*) as count
      FROM Reservations
      GROUP BY checkinStatus
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log('\n   簽到狀態分布:');
    checkinStatusStats.forEach(stat => {
      console.log(`      - ${stat.checkinStatus || '(NULL)'}: ${stat.count} 筆`);
    });

    // 檢查是否有重複的預約（應該已經被清理）
    const duplicateByStudentId = await sequelize.query(`
      SELECT eventId, studentId, COUNT(*) as count
      FROM Reservations
      WHERE studentId IS NOT NULL
      GROUP BY eventId, studentId
      HAVING COUNT(*) > 1
    `, { type: sequelize.QueryTypes.SELECT });

    const duplicateByEmail = await sequelize.query(`
      SELECT eventId, studentEmail, COUNT(*) as count
      FROM Reservations
      WHERE studentEmail IS NOT NULL
      GROUP BY eventId, studentEmail
      HAVING COUNT(*) > 1
    `, { type: sequelize.QueryTypes.SELECT });

    if (duplicateByStudentId.length > 0) {
      console.log(`\n   ⚠️  發現 ${duplicateByStudentId.length} 組重複的預約（eventId + studentId）`);
      duplicateByStudentId.slice(0, 5).forEach(dup => {
        console.log(`      - eventId: ${dup.eventId}, studentId: ${dup.studentId}, 重複數: ${dup.count}`);
      });
    } else {
      console.log(`\n   ✅ 沒有發現重複的預約（eventId + studentId）`);
    }

    if (duplicateByEmail.length > 0) {
      console.log(`   ⚠️  發現 ${duplicateByEmail.length} 組重複的預約（eventId + studentEmail）`);
      duplicateByEmail.slice(0, 5).forEach(dup => {
        console.log(`      - eventId: ${dup.eventId}, studentEmail: ${dup.studentEmail}, 重複數: ${dup.count}`);
      });
    } else {
      console.log(`   ✅ 沒有發現重複的預約（eventId + studentEmail）`);
    }

    // 3. 檢查班級參與統計（取樣檢查）
    console.log('\n3. 檢查班級參與統計（詳細診斷）...');
    
    // 取得所有班級（按學期分組）
    const allClasses = await Class.findAll({
      include: [{
        model: ClassMembership,
        attributes: ['studentId']
      }],
      order: [['semester', 'ASC'], ['name', 'ASC']]
    });

    // 按學期分組
    const classesBySemester = {};
    allClasses.forEach(classRecord => {
      if (!classesBySemester[classRecord.semester]) {
        classesBySemester[classRecord.semester] = [];
      }
      classesBySemester[classRecord.semester].push(classRecord);
    });

    // 檢查每個學期的班級
    for (const [semester, classes] of Object.entries(classesBySemester)) {
      const semesterRange = SEMESTER_RANGES[semester];
      if (!semesterRange) {
        console.log(`\n   ⚠️  學期 ${semester} 沒有定義日期範圍，跳過`);
        continue;
      }

      console.log(`\n   📅 學期: ${semester} (${semesterRange.start} ~ ${semesterRange.end})`);
      console.log(`      班級數: ${classes.length}`);

      // 取樣檢查前 5 個班級
      const sampleClasses = classes.slice(0, 5);
      
      for (const classRecord of sampleClasses) {
        const studentIds = classRecord.ClassMemberships ? 
          classRecord.ClassMemberships.map(m => m.studentId).filter(id => id) : [];
        
        if (studentIds.length === 0) {
          console.log(`\n      📊 班級: ${classRecord.name} (${classRecord.semester})`);
          console.log(`         - 學生數: 0 (沒有成員)`);
          continue;
        }

        // 清洗學號（轉大寫、去除空白）
        const cleanedStudentIds = studentIds.map(id => cleanStudentId(id)).filter(id => id);

        // 使用 SQL 查詢預約數（包含學期範圍過濾）
        const reservationStats = await sequelize.query(`
          SELECT 
            r.studentId,
            COUNT(r.id) as reservationCount,
            SUM(CASE WHEN r.checkinStatus = '已簽到' THEN 1 ELSE 0 END) as attendedCount,
            SUM(CASE WHEN r.checkinStatus = '已登記違規' THEN 1 ELSE 0 END) as violationCount
          FROM Reservations r
          INNER JOIN Events e ON r.eventId = e.id
          WHERE r.studentId IN (:studentIds)
            AND e.date BETWEEN :startDate AND :endDate
          GROUP BY r.studentId
        `, {
          replacements: {
            studentIds: cleanedStudentIds,
            startDate: semesterRange.start,
            endDate: semesterRange.end
          },
          type: sequelize.QueryTypes.SELECT
        });

        // 計算總預約數和簽到數
        let totalReservations = 0;
        let totalAttended = 0;
        let totalViolations = 0;
        const studentsWithReservations = new Set();

        reservationStats.forEach(stat => {
          const count = parseInt(stat.reservationCount) || 0;
          const attended = parseInt(stat.attendedCount) || 0;
          const violations = parseInt(stat.violationCount) || 0;
          totalReservations += count;
          totalAttended += attended;
          totalViolations += violations;
          if (count > 0) {
            studentsWithReservations.add(stat.studentId);
          }
        });

        // 檢查學號匹配問題
        const allReservationStudentIds = await sequelize.query(`
          SELECT DISTINCT r.studentId
          FROM Reservations r
          INNER JOIN Events e ON r.eventId = e.id
          WHERE e.date BETWEEN :startDate AND :endDate
        `, {
          replacements: {
            startDate: semesterRange.start,
            endDate: semesterRange.end
          },
          type: sequelize.QueryTypes.SELECT
        });

        const reservationStudentIdsSet = new Set(
          allReservationStudentIds.map(r => cleanStudentId(r.studentId)).filter(id => id)
        );
        const classStudentIdsSet = new Set(cleanedStudentIds);
        
        // 找出匹配的學號
        const matchedIds = cleanedStudentIds.filter(id => reservationStudentIdsSet.has(id));
        const unmatchedInClass = cleanedStudentIds.filter(id => !reservationStudentIdsSet.has(id));
        const unmatchedInReservations = Array.from(reservationStudentIdsSet).filter(id => !classStudentIdsSet.has(id));

        console.log(`\n      📊 班級: ${classRecord.name} (${classRecord.semester})`);
        console.log(`         - 學生數: ${studentIds.length}`);
        console.log(`         - 預約數: ${totalReservations}`);
        console.log(`         - 簽到數: ${totalAttended}`);
        console.log(`         - 違規數: ${totalViolations}`);
        console.log(`         - 至少參與人數: ${studentsWithReservations.size}`);
        console.log(`         - 參與率: ${studentIds.length > 0 ? ((studentsWithReservations.size / studentIds.length) * 100).toFixed(2) : 0}%`);
        
        if (unmatchedInClass.length > 0 || unmatchedInReservations.length > 0) {
          console.log(`\n         ⚠️  學號匹配問題:`);
          console.log(`            - 班級中但沒有預約的學生: ${unmatchedInClass.length} 人`);
          if (unmatchedInClass.length > 0 && unmatchedInClass.length <= 10) {
            console.log(`              範例: ${unmatchedInClass.slice(0, 5).join(', ')}`);
          }
          console.log(`            - 有預約但不在班級中的學生: ${unmatchedInReservations.length} 人`);
          if (unmatchedInReservations.length > 0 && unmatchedInReservations.length <= 10) {
            console.log(`              範例: ${unmatchedInReservations.slice(0, 5).join(', ')}`);
          }
        } else {
          console.log(`         ✅ 學號匹配正常`);
        }
      }

      // 如果還有更多班級，顯示總覽
      if (classes.length > 5) {
        console.log(`\n      ... 還有 ${classes.length - 5} 個班級未顯示`);
      }
    }

    // 4. 檢查 teachers 表的 teacherLevel 欄位
    console.log('\n4. 檢查老師層級設定...');
    const { Teacher } = require('../models');
    const teachers = await Teacher.findAll({
      where: { role: 'teacher' },
      attributes: ['id', 'name', 'teacherLevel']
    });

    console.log(`   ✅ 老師總數: ${teachers.length}`);
    const levelCounts = {};
    teachers.forEach(teacher => {
      const level = teacher.teacherLevel || 'regular';
      levelCounts[level] = (levelCounts[level] || 0) + 1;
    });

    console.log('   層級分布:');
    Object.entries(levelCounts).forEach(([level, count]) => {
      const levelNames = {
        'executive': '執行長',
        'et_manager': 'English Table負責人',
        'if_manager': 'International Forum負責人',
        'jt_manager': 'Job Talk負責人',
        'regular': '一般老師'
      };
      console.log(`      - ${levelNames[level] || level}: ${count} 人`);
    });

    // 檢查特定人員的設定
    const specificTeachers = ['黃舒屏', '莊家雄', '戴藤懋', '傅安德'];
    console.log('\n   特定人員設定:');
    specificTeachers.forEach(name => {
      const teacher = teachers.find(t => t.name === name);
      if (teacher) {
        const levelNames = {
          'executive': '執行長',
          'et_manager': 'English Table負責人',
          'if_manager': 'International Forum負責人',
          'jt_manager': 'Job Talk負責人',
          'regular': '一般老師'
        };
        console.log(`      - ${name}: ${levelNames[teacher.teacherLevel] || teacher.teacherLevel || '未設定'}`);
      } else {
        console.log(`      - ${name}: ❌ 找不到此老師帳號`);
      }
    });

    console.log('\n✅ 檢查完成！');
    console.log('\n📝 總結與建議:');
    console.log('   1. 班級資料表（classes, class_memberships）狀態正常');
    console.log('   2. 預約資料表（Reservations）已檢查重複記錄');
    console.log('   3. 班級參與統計已按學期範圍正確計算');
    console.log('\n💡 如果發現問題:');
    console.log('   - 學號匹配問題：檢查班級名單中的學號格式是否正確（應為大寫，無空白）');
    console.log('   - 預約數為0：確認該學期範圍內是否有活動和預約記錄');
    console.log('   - 簽到數為0：檢查簽到功能是否正常運作，或所有預約是否都是「未簽到」狀態');
    console.log('   - 學期範圍：確認 SEMESTER_RANGES 設定是否正確');

  } catch (error) {
    console.error('❌ 檢查過程中發生錯誤:', error);
  } finally {
    await sequelize.close();
  }
}

// 執行檢查
checkClassDataImpact();


