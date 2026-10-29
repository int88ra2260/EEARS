const { Op } = require('sequelize');
const {
  Student,
  ClassMembership,
  EtEnrollmentSnapshot,
  EtStudentMaster,
} = require('../models');
const { normalizePersonName } = require('../utils/personName');

function collectNames(values) {
  return [...new Set(values.map(normalizePersonName).filter(Boolean))];
}

/**
 * 身分依據用官方名冊，不使用學生自己填過的預約信箱。
 * students 是一人一筆、姓名必填的學生主檔。
 * 修課名單、學期在學名冊、舊英檢學生主檔補上主檔沒匯到的人，讓自動核對蓋到最多學生。
 * 同一學號若名冊姓名不一致，視為衝突，不自動通過。
 */
async function findOfficialIdentity(studentId) {
  const id = String(studentId || '').trim().toUpperCase();
  if (!id) return { covered: false, conflict: false, name: null };

  const [student, memberships, snapshots, legacy] = await Promise.all([
    Student.findOne({ where: { studentId: id }, attributes: ['nameZh'] }),
    ClassMembership.findAll({
      where: { studentId: id },
      attributes: ['studentName'],
    }),
    EtEnrollmentSnapshot.findAll({
      where: { studentId: id, studentName: { [Op.ne]: null } },
      attributes: ['studentName'],
    }),
    EtStudentMaster.findOne({ where: { studentId: id }, attributes: ['name'] }),
  ]);

  const names = collectNames([
    student && student.nameZh,
    ...(memberships || []).map((row) => row.studentName),
    ...(snapshots || []).map((row) => row.studentName),
    legacy && legacy.name,
  ]);

  if (names.length === 0) return { covered: false, conflict: false, name: null };
  if (names.length > 1) return { covered: true, conflict: true, name: null };
  return { covered: true, conflict: false, name: names[0] };
}

module.exports = {
  normalizePersonName,
  findOfficialIdentity,
};
