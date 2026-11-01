import { SEMESTER_RANGES } from '../../utils/semesterUtils';

/** 活動營運總覽文案。日期只格式化既有學期設定，不另建對照表。 */

export const OPS_POPULATION = '全中心活動，以活動日期篩選。';
export const OPS_TIME_FIELD = '活動日期（events.date）';

export const OPS_LABELS = Object.freeze({
  totalReservations: '預約筆數',
  bookingRate: '預約名額比',
  attendanceRate: '預約列簽到率',
  totalEventCapacity: '活動總名額',
  violationRate: '預約列違規狀態比',
  englishPassRate: '報名資料 B2 標記比例',
});

export const OPS_NOTES = Object.freeze({
  totalReservations: [
    '統計單位：預約列。',
    '定義：目前仍留在預約表上的列數。',
    '母體：所選學期活動日區間內、且能對上活動的預約列。',
    '計算：預約列筆數，沒有再除以名額。',
    '時間欄位：活動日期（events.date）。',
    '限制：取消成功會刪除該列，所以這不是累計預約總次數，也不是不重複學生數。',
  ],
  bookingRate: [
    '統計單位：預約列 ÷ 名額。',
    '定義：預約筆數 ÷ 活動總名額。',
    '母體：分子是預約列；分母是區間內所有活動名額加總，含沒有人預約的場次。',
    '時間欄位：活動日期（events.date）。',
    '限制：分母含學生端隱藏場次。隱藏場次佔比待資料驗證。畫面直接顯示 API 回傳值。',
  ],
  attendanceRate: [
    '統計單位：預約列。',
    '定義：已簽到的預約列 ÷ 全部預約列。',
    '母體：與預約筆數相同的預約列。',
    '時間欄位：活動日期（events.date）。',
    '限制：這不是學生出席率，也不是學習參與率。',
  ],
  totalEventCapacity: [
    '統計單位：名額加總。',
    '定義：區間內各活動可開放名額（maxCapacity）加總。',
    '母體：全中心活動，以活動日期篩選。',
    '時間欄位：活動日期（events.date）。',
    '限制：這是名額加總，不是場次數。含零預約場次與學生端隱藏場次。',
  ],
  violationRate: [
    '統計單位：預約列。',
    '定義：已登記違規的預約列 ÷ 全部預約列。',
    '母體：與預約筆數相同的預約列。',
    '時間欄位：活動日期（events.date），不是違規登錄日。',
    '限制：這不是違規紀錄表的事件比例。預約列狀態與違規表是否一致，待資料驗證。',
  ],
});

export const REGISTRATION_SUPPLEMENT_NOTES = Object.freeze([
  '數值來自報名表的 B2 標記（hasCEFRB2），不是活動簽到或預約。',
  '時間使用報名資料的學期標籤，不是活動日期。',
  '沒有與活動預約做 JOIN。',
  '不能據此認定活動提升學生英語能力。',
]);

export function finiteOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatCount(value) {
  const n = finiteOrNull(value);
  return n === null ? '—' : String(n);
}

export function formatPct1(value) {
  const n = finiteOrNull(value);
  return n === null ? '—' : `${n.toFixed(1)}%`;
}

export function isAllNumericZero(values) {
  return values.length > 0 && values.every((value) => finiteOrNull(value) === 0);
}

/**
 * 把既有 SEMESTER_RANGES 的 YYYY-MM-DD 轉成顯示用區間。
 * 沒有該學期設定時回傳 null，不補寫死日期。
 */
export function formatActivityDateWindow(semesterId, ranges = SEMESTER_RANGES) {
  const range = ranges?.[semesterId];
  if (!range?.start || !range?.end) return null;
  const slash = (iso) => {
    const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[1]}/${match[2]}/${match[3]}` : null;
  };
  const start = slash(range.start);
  const end = slash(range.end);
  if (!start || !end) return null;
  return `${start}–${end}`;
}
