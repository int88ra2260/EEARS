// src/utils/reservationTime.js
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

export const RESERVATION_CUTOFF_HOURS = 2;

/**
 * 根據活動類型計算預約開始時間
 * @param {Object} event - 活動物件，包含 date, startTime, eventType
 * @returns {Object} - 包含 openStart 和 openEnd 的物件
 */
export function calculateReservationTime(event) {
  const eventStart = dayjs(`${event.date}T${event.startTime}`);
  
  let openStart;
  let openEnd;
  
  switch (event.eventType) {
    case 'English Table':
      // English Table保持原樣：前一天 00:00 開始
      openStart = eventStart.subtract(1, 'day').startOf('day');
      openEnd = eventStart.subtract(RESERVATION_CUTOFF_HOURS, 'hour');
      break;
      
    case 'Job Talk':
      // Job Talk：活動開始前一個禮拜的同一個weekday的中午12點
      openStart = eventStart.subtract(7, 'day').hour(12).minute(0).second(0);
      openEnd = eventStart.subtract(RESERVATION_CUTOFF_HOURS, 'hour');
      break;
      
    case 'English Club':
      // English Club：上禮拜三的中午12點
      // 直接計算：找到活動當週的星期三，然後減去7天
      openStart = eventStart.startOf('week').add(3, 'day').subtract(7, 'day').hour(12).minute(0).second(0);
      openEnd = eventStart.subtract(RESERVATION_CUTOFF_HOURS, 'hour');
      break;
      
    case 'International Forum':
      // International Forum：上禮拜五的中午12點  
      // 直接計算：找到活動當週的星期五，然後減去7天
      openStart = eventStart.startOf('week').add(5, 'day').subtract(7, 'day').hour(12).minute(0).second(0);
      openEnd = eventStart.subtract(RESERVATION_CUTOFF_HOURS, 'hour');
      break;
      
    default:
      // 預設使用 English Table 的邏輯（包含自定義活動類型）
      openStart = eventStart.subtract(1, 'day').startOf('day');
      openEnd = eventStart.subtract(RESERVATION_CUTOFF_HOURS, 'hour');
      break;
  }
  
  return { openStart, openEnd };
}

/**
 * 取得指定日期前最近的指定星期幾（上週）
 * @param {dayjs.Dayjs} targetDate - 目標日期
 * @param {number} weekday - 星期幾 (1=星期一, 2=星期二, ..., 7=星期日)
 * @returns {dayjs.Dayjs} - 最近的指定星期幾
 */
export function getLastWeekday(targetDate, weekday) {
  
  // 找到上週的指定星期幾
  // 先找到本週的指定星期幾，然後減去7天
  const startOfWeek = targetDate.startOf('week'); // 本週日
  let targetDayThisWeek;
  
  if (weekday === 7) {
    targetDayThisWeek = startOfWeek; // 本週日
  } else {
    targetDayThisWeek = startOfWeek.add(weekday, 'day'); // 本週的目標星期幾
  }
  
  // 減去7天得到上週的同一天
  return targetDayThisWeek.subtract(7, 'day');
}

/**
 * 取得指定日期當週的指定星期幾（如果已過則取下週）
 * @param {dayjs.Dayjs} targetDate - 目標日期
 * @param {number} weekday - 星期幾 (1=星期一, 2=星期二, ..., 7=星期日)
 * @returns {dayjs.Dayjs} - 當週或下週的指定星期幾
 */
export function getCurrentWeekday(targetDate, weekday) {
  // 取得當週的指定星期幾
  const startOfWeek = targetDate.startOf('week'); // 星期日
  
  // 計算當週的目標星期幾
  let targetDay;
  if (weekday === 7) {
    targetDay = startOfWeek; // 星期日
  } else {
    targetDay = startOfWeek.add(weekday, 'day'); // 星期一到星期六
  }
  
  // 如果目標星期幾已經過了（且已過了預約時間），取下週的
  const now = dayjs();
  if (targetDay.isBefore(now)) {
    return targetDay.add(7, 'day');
  }
  
  return targetDay;
}
