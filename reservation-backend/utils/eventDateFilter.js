/**
 * Normalize event / filter date values to YYYY-MM-DD for reliable range comparison.
 * @param {unknown} value
 * @returns {string} YYYY-MM-DD or ''
 */
function toYmd(value) {
  if (value == null || value === '') return '';

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const raw = String(value).trim();
  if (!raw) return '';

  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;

  const slash = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slash) {
    return `${slash[1]}-${String(slash[2]).padStart(2, '0')}-${String(slash[3]).padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return toYmd(parsed);
  }

  return '';
}

/**
 * Filter events by optional single date or inclusive date range.
 * Prefer dateFrom/dateTo when present; otherwise fall back to single `date`.
 *
 * @param {Array<{ date?: unknown }>} events
 * @param {{ date?: string, dateFrom?: string, dateTo?: string }} filters
 * @returns {Array}
 */
function filterEventsByDateQuery(events, filters = {}) {
  if (!Array.isArray(events) || events.length === 0) return [];

  let dateFrom = toYmd(filters.dateFrom);
  let dateTo = toYmd(filters.dateTo);
  const single = toYmd(filters.date);

  if (dateFrom && dateTo && dateFrom > dateTo) {
    const swap = dateFrom;
    dateFrom = dateTo;
    dateTo = swap;
  }

  if (!dateFrom && !dateTo && !single) return events;

  return events.filter((event) => {
    const eventDate = toYmd(event?.date);
    if (!eventDate) return false;

    if (dateFrom || dateTo) {
      if (dateFrom && eventDate < dateFrom) return false;
      if (dateTo && eventDate > dateTo) return false;
      return true;
    }

    return eventDate === single;
  });
}

module.exports = {
  toYmd,
  filterEventsByDateQuery,
};
