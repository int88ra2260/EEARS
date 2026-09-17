// utils/eventStats.js
// 共用的活動統計工具函數，供活動報表和班級參與概況使用

const { sequelize } = require('../models');

/**
 * 取得單個活動的簽到統計
 * @param {number} eventId - 活動ID
 * @returns {Promise<Object>} 簽到統計對象
 */
async function getEventCheckinStats(eventId) {
  const stats = await sequelize.query(`
    SELECT 
      COUNT(DISTINCT id) as totalReservations,
      SUM(CASE WHEN checkinStatus = '已簽到' THEN 1 ELSE 0 END) as checkedIn,
      SUM(CASE WHEN checkinStatus = '未簽到' THEN 1 ELSE 0 END) as notCheckedIn,
      SUM(CASE WHEN checkinStatus = '已登記違規' THEN 1 ELSE 0 END) as violations
    FROM reservations
    WHERE eventId = :eventId
  `, {
    replacements: { eventId },
    type: sequelize.QueryTypes.SELECT
  });

  if (stats.length === 0) {
    return {
      totalReservations: 0,
      checkedIn: 0,
      notCheckedIn: 0,
      violations: 0
    };
  }

  return {
    totalReservations: parseInt(stats[0].totalReservations) || 0,
    checkedIn: parseInt(stats[0].checkedIn) || 0,
    notCheckedIn: parseInt(stats[0].notCheckedIn) || 0,
    violations: parseInt(stats[0].violations) || 0
  };
}

/**
 * 取得多個活動的簽到統計（批量查詢）
 * @param {Array<number>} eventIds - 活動ID陣列
 * @returns {Promise<Map<number, Object>>} Map<eventId, 簽到統計對象>
 */
async function getMultipleEventsCheckinStats(eventIds) {
  if (!eventIds || eventIds.length === 0) {
    return new Map();
  }

  // 使用 COUNT(DISTINCT id) 確保不重複計算，並確保數值正確轉換
  const stats = await sequelize.query(`
    SELECT 
      eventId,
      COUNT(DISTINCT id) as totalReservations,
      SUM(CASE WHEN checkinStatus = '已簽到' THEN 1 ELSE 0 END) as checkedIn,
      SUM(CASE WHEN checkinStatus = '未簽到' THEN 1 ELSE 0 END) as notCheckedIn,
      SUM(CASE WHEN checkinStatus = '已登記違規' THEN 1 ELSE 0 END) as violations
    FROM reservations
    WHERE eventId IN (:eventIds)
    GROUP BY eventId
  `, {
    replacements: { eventIds },
    type: sequelize.QueryTypes.SELECT
  });

  const statsMap = new Map();
  
  // 初始化所有活動ID為0
  eventIds.forEach(id => {
    statsMap.set(id, {
      totalReservations: 0,
      checkedIn: 0,
      notCheckedIn: 0,
      violations: 0
    });
  });

  // 填入實際統計數據，確保數值正確轉換
  stats.forEach(stat => {
    const eventId = parseInt(stat.eventId);
    if (!isNaN(eventId)) {
      statsMap.set(eventId, {
        totalReservations: parseInt(stat.totalReservations) || 0,
        checkedIn: parseInt(stat.checkedIn) || 0,
        notCheckedIn: parseInt(stat.notCheckedIn) || 0,
        violations: parseInt(stat.violations) || 0
      });
    }
  });

  return statsMap;
}

/**
 * 取得指定學生的活動參與統計（供班級參與概況使用）
 * @param {Array<string>} studentIds - 學生ID陣列
 * @param {Object} semesterRange - 學期範圍 { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
 * @param {string} activityType - 活動類型 ('All', 'ET', 'EC', 'JT', 'IF')
 * @returns {Promise<Object>} 參與統計對象
 */
async function getStudentParticipationStats(studentIds, semesterRange, activityType = 'All') {
  if (!studentIds || studentIds.length === 0) {
    return {
      participatedCount: 0,
      attendedCountTotal: 0,
      noShowCountTotal: 0,
      byType: {
        EnglishTable: 0,
        EnglishClub: 0,
        JobTalk: 0,
        InternationalForum: 0
      }
    };
  }

  // 活動類型映射（查詢時相容 code + legacy 顯示名）
  const eventTypeService = require('../services/eventTypeService');
  const ACTIVITY_TYPE_MAP = {
    ET: 'english_table',
    EC: 'english_club',
    JT: 'job_talk',
    IF: 'international_forum',
  };

  const activityTypeFilter =
    activityType !== 'All'
      ? (ACTIVITY_TYPE_MAP[activityType] || activityType)
      : null;
  const activityTypeValues = activityTypeFilter
    ? eventTypeService.getEventTypeQueryValues(activityTypeFilter)
    : null;

  // 查詢簽到統計
  const attendedStats = await sequelize.query(`
    SELECT 
      r.studentId,
      e.eventType,
      COUNT(r.id) as count
    FROM reservations r
    INNER JOIN events e ON r.eventId = e.id
    WHERE r.studentId IN (:studentIds)
      AND r.checkinStatus = '已簽到'
      AND e.date BETWEEN :startDate AND :endDate
      ${activityTypeValues ? 'AND e.eventType IN (:activityTypes)' : ''}
    GROUP BY r.studentId, e.eventType
  `, {
    replacements: {
      studentIds: studentIds,
      startDate: semesterRange.start,
      endDate: semesterRange.end,
      ...(activityTypeValues && { activityTypes: activityTypeValues })
    },
    type: sequelize.QueryTypes.SELECT
  });

  // 查詢違規統計
  const violationStats = await sequelize.query(`
    SELECT 
      r.studentId,
      COUNT(r.id) as count
    FROM reservations r
    INNER JOIN events e ON r.eventId = e.id
    WHERE r.studentId IN (:studentIds)
      AND r.checkinStatus = '已登記違規'
      AND e.date BETWEEN :startDate AND :endDate
      ${activityTypeValues ? 'AND e.eventType IN (:activityTypes)' : ''}
    GROUP BY r.studentId
  `, {
    replacements: {
      studentIds: studentIds,
      startDate: semesterRange.start,
      endDate: semesterRange.end,
      ...(activityTypeValues && { activityTypes: activityTypeValues })
    },
    type: sequelize.QueryTypes.SELECT
  });

  // 計算統計
  const participatedStudents = new Set();
  const byType = {
    EnglishTable: 0,
    EnglishClub: 0,
    JobTalk: 0,
    InternationalForum: 0
  };

  let attendedCountTotal = 0;
  let noShowCountTotal = 0;

  attendedStats.forEach(stat => {
    participatedStudents.add(stat.studentId);
    const count = parseInt(stat.count);
    attendedCountTotal += count;
    
    const code = eventTypeService.coerceEventTypeCode(stat.eventType, { fallback: '' });
    if (code === 'english_table') {
      byType.EnglishTable += count;
    } else if (code === 'english_club') {
      byType.EnglishClub += count;
    } else if (code === 'job_talk') {
      byType.JobTalk += count;
    } else if (code === 'international_forum') {
      byType.InternationalForum += count;
    }
  });

  violationStats.forEach(stat => {
    noShowCountTotal += parseInt(stat.count);
  });

  return {
    participatedCount: participatedStudents.size,
    attendedCountTotal,
    noShowCountTotal,
    byType
  };
}

module.exports = {
  getEventCheckinStats,
  getMultipleEventsCheckinStats,
  getStudentParticipationStats
};

