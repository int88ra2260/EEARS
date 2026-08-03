/**
 * EEARS 報表匯出檔名（ASCII，避免 Windows 下載異常）
 * 格式：EEARS_<reportType>_<semester>_<YYYYMMDD_HHmm>.<ext>
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** 學期、ID 等路徑片段：只保留英數、連字號、底線 */
function sanitizeFilenameSegment(raw, fallback = 'x') {
  if (raw === null || raw === undefined) return fallback;
  const s = String(raw).trim();
  if (!s) return fallback;
  const cleaned = s.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return cleaned || fallback;
}

function formatTimestampForFilename(date = new Date()) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  return `${y}${m}${d}_${hh}${mm}`;
}

/**
 * @param {object} opts
 * @param {'overview'|'high-risk'|'class'|'teacher-dashboard'} opts.reportType
 * @param {string} opts.semester
 * @param {string} [opts.classId]
 * @param {string} [opts.teacherId]
 * @param {string} [opts.ext] default xlsx
 */
function buildEearsReportBasename(opts) {
  const stamp = formatTimestampForFilename();
  const sem = sanitizeFilenameSegment(opts.semester, 'semester');
  const ext = sanitizeFilenameSegment(opts.ext || 'xlsx', 'xlsx').replace(/\./g, '');

  let middle = '';
  if (opts.reportType === 'overview') {
    middle = `overview_${sem}`;
  } else if (opts.reportType === 'high-risk') {
    middle = `high-risk_${sem}`;
  } else if (opts.reportType === 'class') {
    middle = `class_${sem}_class-${sanitizeFilenameSegment(opts.classId, '0')}`;
  } else if (opts.reportType === 'teacher-dashboard') {
    middle = `teacher-dashboard_${sem}_teacher-${sanitizeFilenameSegment(opts.teacherId, '0')}`;
  } else {
    middle = `report_${sem}`;
  }

  return { basename: `EEARS_${middle}_${stamp}`, ext };
}

function buildContentDispositionAttachment(basename, ext) {
  const filename = `${basename}.${ext}`;
  return `attachment; filename="${filename}"`;
}

module.exports = {
  sanitizeFilenameSegment,
  formatTimestampForFilename,
  buildEearsReportBasename,
  buildContentDispositionAttachment,
};
