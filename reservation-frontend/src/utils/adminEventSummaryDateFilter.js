/**
 * Pure helpers for admin event summary date filters (unit-testable).
 */
import dayjs from 'dayjs';

export function normalizeDateRange(from, to) {
  if (from && to && from > to) return { from: to, to: from };
  return { from: from || '', to: to || '' };
}

export function toEventSummaryYmd(value) {
  if (value == null || value === '') return '';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
}

export function buildEventSummaryDateParams({
  mode = 'single',
  date = '',
  dateFrom = '',
  dateTo = '',
} = {}) {
  if (mode === 'range') {
    const range = normalizeDateRange(dateFrom, dateTo);
    return {
      dateFrom: range.from || undefined,
      dateTo: range.to || undefined,
    };
  }
  return {
    date: date || undefined,
  };
}

/**
 * Client-side safety filter so UI never shows out-of-range rows
 * even if the API ignores dateFrom/dateTo.
 */
export function filterSummaryByDateParams(rows, dateParams = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  let from = toEventSummaryYmd(dateParams.dateFrom);
  let to = toEventSummaryYmd(dateParams.dateTo);
  const single = toEventSummaryYmd(dateParams.date);

  if (from && to && from > to) {
    const swap = from;
    from = to;
    to = swap;
  }

  if (!from && !to && !single) return rows;

  return rows.filter((row) => {
    const eventDate = toEventSummaryYmd(row?.date);
    if (!eventDate) return false;
    if (from || to) {
      if (from && eventDate < from) return false;
      if (to && eventDate > to) return false;
      return true;
    }
    return eventDate === single;
  });
}

/**
 * Resolve shortcut buttons into the next filter mode + date fields + API params.
 * @param {'today' | 'week' | 'clear'} preset
 * @param {string} [today] YYYY-MM-DD
 */
export function resolveDateFilterPreset(preset, today = dayjs().format('YYYY-MM-DD')) {
  if (preset === 'today') {
    return {
      mode: 'single',
      filterDate: today,
      filterDateFrom: today,
      filterDateTo: today,
      dateParams: { date: today },
    };
  }

  if (preset === 'week') {
    const from = dayjs(today).subtract(6, 'day').format('YYYY-MM-DD');
    return {
      mode: 'range',
      filterDate: today,
      filterDateFrom: from,
      filterDateTo: today,
      dateParams: { dateFrom: from, dateTo: today },
    };
  }

  if (preset === 'clear') {
    return {
      mode: null,
      filterDate: '',
      filterDateFrom: '',
      filterDateTo: '',
      dateParams: {},
    };
  }

  return null;
}
