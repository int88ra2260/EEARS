'use strict';

/**
 * EWL（英文寫作工坊）StudentApi 唯讀客戶端。
 * 文件：EWL學生活動資料API.pdf
 * 主資料來源：ReservationInfo（含 ConsultationTimeID、簽到時間）
 */

const DEFAULT_BASE_URL = 'https://emicenter.siwan.nsysu.edu.tw/EWL/StudentApi';
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGES = 500;

function getBaseUrl() {
  return String(process.env.EWL_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function getPageSize() {
  const n = Number(process.env.EWL_API_PAGE_SIZE);
  if (Number.isFinite(n) && n > 0 && n <= 500) return Math.floor(n);
  return DEFAULT_PAGE_SIZE;
}

function buildUrl(endpoint, params = {}) {
  const url = new URL(`${getBaseUrl()}/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

/**
 * @param {string} endpoint ActivityInfo | ReservationInfo | AttendanceInfo
 * @param {{ studentId?: string, startDate: string, endDate: string, page?: number, pageSize?: number }} query
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
async function fetchEwlPage(endpoint, query, opts = {}) {
  const fetchImpl = opts.fetchImpl || global.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('EWL API 需要 Node.js fetch（Node 18+）');
  }
  const url = buildUrl(endpoint, {
    studentId: query.studentId || undefined,
    startDate: query.startDate,
    endDate: query.endDate,
    page: query.page || 1,
    pageSize: query.pageSize || getPageSize()
  });
  const res = await fetchImpl(url, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`EWL API HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
    err.status = res.status;
    err.url = url;
    throw err;
  }
  const json = await res.json();
  if (json && json.success === false) {
    const err = new Error(json.message || 'EWL API 回傳失敗');
    err.code = 'EWL_API_ERROR';
    err.payload = json;
    throw err;
  }
  return json;
}

/**
 * 分頁拉取完整資料列。
 * @returns {Promise<{ rows: object[], totalCount: number, pagesFetched: number }>}
 */
async function fetchAllEwlRows(endpoint, query, opts = {}) {
  const pageSize = query.pageSize || getPageSize();
  const first = await fetchEwlPage(endpoint, { ...query, page: 1, pageSize }, opts);
  const totalCount = Number(first.totalCount || 0);
  const totalPages = Math.max(1, Number(first.totalPages || Math.ceil(totalCount / pageSize) || 1));
  const rows = Array.isArray(first.data) ? [...first.data] : [];

  let pagesFetched = 1;
  for (let page = 2; page <= totalPages && page <= MAX_PAGES; page += 1) {
    const next = await fetchEwlPage(endpoint, { ...query, page, pageSize }, opts);
    if (Array.isArray(next.data) && next.data.length) {
      rows.push(...next.data);
    }
    pagesFetched += 1;
    if (!next.needsPagination && (!next.data || next.data.length === 0)) break;
  }

  return { rows, totalCount, pagesFetched };
}

async function fetchReservationInfo(query, opts = {}) {
  return fetchAllEwlRows('ReservationInfo', query, opts);
}

async function fetchAttendanceInfo(query, opts = {}) {
  return fetchAllEwlRows('AttendanceInfo', query, opts);
}

async function fetchActivityInfo(query, opts = {}) {
  return fetchAllEwlRows('ActivityInfo', query, opts);
}

module.exports = {
  DEFAULT_BASE_URL,
  getBaseUrl,
  getPageSize,
  buildUrl,
  fetchEwlPage,
  fetchAllEwlRows,
  fetchReservationInfo,
  fetchAttendanceInfo,
  fetchActivityInfo
};
