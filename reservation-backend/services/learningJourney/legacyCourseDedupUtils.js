'use strict';

function normText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeCourseKey(name, instructor) {
  const courseName = normText(name)
    .replace(/[（(]/g, '(')
    .replace(/[）)]/g, ')')
    .replace(/[：:]/g, ':')
    .replace(/\s+/g, '');
  const instructorName = normText(instructor).replace(/\s+/g, '');
  return `${courseName}::${instructorName}`;
}

function isLegacyCourseCode(courseCode) {
  return String(courseCode || '').trim().startsWith('工作表');
}

module.exports = {
  normText,
  normalizeCourseKey,
  isLegacyCourseCode,
};
