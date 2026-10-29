const { compactPersonName } = require('../../../utils/personName');

function normalizeStudentId(input) {
  if (input === null || input === undefined) {
    return '';
  }
  return String(input).trim().replace(/\s+/g, '').toUpperCase();
}

function normalizeStudentPayload(payload = {}) {
  return {
    ...payload,
    studentId: normalizeStudentId(payload.studentId),
    nameZh: payload.nameZh ? compactPersonName(payload.nameZh) : '',
    nameEn: payload.nameEn ? String(payload.nameEn).trim() : null
  };
}

module.exports = {
  normalizeStudentId,
  normalizeStudentPayload
};
