'use strict';

const WORKING_SET_CAP = 2000;

function normalizeStudentIdList(value, cap = WORKING_SET_CAP) {
  let raw = null;
  if (Array.isArray(value)) raw = value;
  else if (typeof value === 'string' && value.trim()) raw = value.split(/[,\s]+/);
  if (!raw) return null;

  const ids = [];
  const seen = new Set();
  for (const item of raw) {
    const id = String(item || '').trim().toUpperCase();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= cap) break;
  }
  return ids.length ? ids : null;
}

function studentIdAllowList(value, cap = WORKING_SET_CAP) {
  return normalizeStudentIdList(value, cap);
}

/**
 * 只保留帶入名單與名冊的交集。沒有名單時原樣返回。
 */
function applyRosterWorkingSet(students, studentIds) {
  const list = normalizeStudentIdList(studentIds);
  if (!list) return { students, workingSet: null };
  const allow = new Set(list);
  const matched = [];
  for (const student of students || []) {
    const id = String(student.studentId || '').trim().toUpperCase();
    if (!allow.has(id)) continue;
    matched.push(student.studentId === id ? student : { ...student, studentId: id });
  }
  return {
    students: matched,
    workingSet: {
      requested: list.length,
      matchedRoster: matched.length,
      omittedFromRoster: list.length - matched.length,
      note: '這份報表只算帶入名單裡、同時在本學期名冊的學生。不在名冊的人不會進分母。',
    },
  };
}

/**
 * 同一技能、GSE 實際成長大於 0 的學生。同一人多筆只留一次。
 */
function collectImprovedStudentsBySkill(rows, cap = WORKING_SET_CAP) {
  const sets = new Map();
  for (const row of rows || []) {
    if (!(Number(row.actualGseGrowth) > 0)) continue;
    const skill = String(row.skill || '').trim();
    const id = String(row.studentId || '').trim().toUpperCase();
    if (!skill || !id) continue;
    if (!sets.has(skill)) sets.set(skill, new Set());
    sets.get(skill).add(id);
  }
  const out = {};
  for (const [skill, set] of sets) {
    const all = [...set].sort();
    out[skill] = {
      total: all.length,
      truncated: all.length > cap,
      studentIds: all.slice(0, cap),
    };
  }
  return out;
}

module.exports = {
  WORKING_SET_CAP,
  normalizeStudentIdList,
  studentIdAllowList,
  applyRosterWorkingSet,
  collectImprovedStudentsBySkill,
};
