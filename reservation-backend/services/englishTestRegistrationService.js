// services/englishTestRegistrationService.js
const { Op } = require('sequelize');
const { EnglishTestRegistration } = require('../models');
const {
  getActiveRegistrationSemester,
  getSemesterByDate,
} = require('../utils/englishTestRegistrationSemester');
const REVIEW_FIELDS = [
  // 抵免審核相關欄位：一般學生不得覆蓋，僅管理端（且 payload 明確帶入）可以更新
  'exemption_review_status',
  'exemption_verified_type',
  'exemption_review_note',
  'exemption_reviewed_at',
  'exemption_reviewed_by'
];

const STUDENT_BLOCKED_FIELDS = new Set(REVIEW_FIELDS);

const NON_EDITABLE_STUDENT_STATUSES = Object.freeze(['approved', 'success', 'failed']);

function buildStudentFriendlyError({ code, message, status }) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

function computeSubmissionStatus(examType) {
  // 如果 examType 为 'NON'，status 設為 'revision'（不報名），否則為 'pending'（審核中）
  return examType === 'NON' ? 'revision' : 'pending';
}

function isBlankSemester(value) {
  const normalized = String(value ?? '').trim();
  return !normalized || normalized === 'null';
}

/**
 * 推斷報名紀錄所屬學期（優先 DB 欄位，其次 createdAt 區間，最後 fallback 目前學期）。
 */
function inferRegistrationSemester(registration, { atDate = new Date() } = {}) {
  if (!registration) return null;
  if (!isBlankSemester(registration.semester)) {
    return String(registration.semester).trim();
  }
  const fromCreated = getSemesterByDate(registration.createdAt || registration.updatedAt);
  if (fromCreated) return fromCreated;
  return getActiveRegistrationSemester(atDate);
}

function registrationBelongsToSemester(registration, semester, { atDate = new Date() } = {}) {
  if (!registration || !semester) return false;
  return inferRegistrationSemester(registration, { atDate }) === semester;
}

/**
 * 依學號 + 學期查詢；支援 semester 為 null 的舊資料（依 createdAt 推斷）。
 */
async function findRegistrationForSemester(studentId, semester, { transaction } = {}) {
  if (!studentId || !semester) {
    return { registration: null, legacySemesterInferred: false };
  }

  const direct = await EnglishTestRegistration.findOne({
    where: { studentId, semester },
    transaction,
  });
  if (direct) {
    return { registration: direct, legacySemesterInferred: false };
  }

  const legacyCandidates = await EnglishTestRegistration.findAll({
    where: {
      studentId,
      [Op.or]: [{ semester: null }, { semester: '' }, { semester: 'null' }],
    },
    transaction,
    order: [['id', 'DESC']],
  });

  for (const candidate of legacyCandidates) {
    if (inferRegistrationSemester(candidate) === semester) {
      return { registration: candidate, legacySemesterInferred: true };
    }
  }

  return { registration: null, legacySemesterInferred: false };
}

async function findExistingRegistration(studentId, semester, { transaction } = {}) {
  const { registration } = await findRegistrationForSemester(studentId, semester, { transaction });
  return registration;
}

function assertStudentMayEditRegistration(registration, { atDate = new Date() } = {}) {
  const activeSemester = getActiveRegistrationSemester(atDate);
  if (!registrationBelongsToSemester(registration, activeSemester, { atDate })) {
    throw buildStudentFriendlyError({
      code: 'REGISTRATION_SEMESTER_MISMATCH',
      status: 403,
      message: `此報名紀錄不屬於目前學期（${activeSemester}），無法修改。請使用「檢視與修正」查詢本學期資料。`,
    });
  }
}

function studentCanEditRegistration(registration) {
  if (!registration) return false;
  return !NON_EDITABLE_STUDENT_STATUSES.includes(registration.status);
}

function buildStudentStatusMessage(registration) {
  if (!registration || studentCanEditRegistration(registration)) return null;
  if (registration.status === 'approved' || registration.status === 'success') {
    return '你的基本資料已經通過審查，是否報名成功仍以信件通知為準，若是想要修改報考項目或是補照片請聯繫全英語卓越教學中心';
  }
  return '此報名已失敗，無法進行修改。如有疑問請聯繫全英語卓越教學中心';
}

function normalizePublicLookupFields({ studentId, name, idNumber }) {
  return {
    studentId: String(studentId || '').trim(),
    name: String(name || '').trim(),
    idNumber: String(idNumber || '').trim().toUpperCase(),
  };
}

function registrationMatchesIdentity(registration, { studentId, name, idNumber }) {
  if (!registration) return false;
  const normalizedId = String(idNumber || '').trim().toUpperCase();
  return (
    registration.idNumber.toUpperCase() === normalizedId
    && registration.name.trim() === String(name || '').trim()
    && registration.studentId.trim() === String(studentId || '').trim()
  );
}

/**
 * 公開「檢視與修正」查詢：僅回傳指定學期（預設目前有效學期）的報名紀錄。
 */
async function queryPublicRegistration(
  { studentId, name, idNumber },
  { atDate = new Date(), semester: semesterOverride } = {}
) {
  const normalized = normalizePublicLookupFields({ studentId, name, idNumber });
  const semester = semesterOverride || getActiveRegistrationSemester(atDate);

  const { registration, legacySemesterInferred } = await findRegistrationForSemester(
    normalized.studentId,
    semester
  );

  if (!registration) {
    return {
      found: false,
      semester,
      registration: null,
      canEdit: false,
      statusMessage: null,
      legacySemesterInferred: false,
    };
  }

  if (!registrationMatchesIdentity(registration, normalized)) {
    return {
      found: false,
      semester,
      registration: null,
      canEdit: false,
      statusMessage: null,
      legacySemesterInferred: false,
    };
  }

  const canEdit = studentCanEditRegistration(registration);
  return {
    found: true,
    semester,
    registration,
    canEdit,
    statusMessage: canEdit ? null : buildStudentStatusMessage(registration),
    legacySemesterInferred,
  };
}

/**
 * createOrUpdateRegistration
 *
 * 欄位覆蓋規則（重點保護審核資料）：
 * 1) 一般學生重新送件（actor='student'）
 *    - 可覆蓋：報名表單中的基本/考試選項/分數/聯絡資訊/檔案路徑
 *    - 不可覆蓋（強制保留既有）：REVIEW_FIELDS（抵免審核相關欄位）
 *    - 若 payload 沒有提供檔案（payload 欄位為 null），會保留既有檔案，避免誤刪附件
 *
 * 2) 管理端匯入或編修（actor='admin'）
 *    - 優先使用 upsert（保留既有 id）
 *    - 只有當 payload 明確帶入 REVIEW_FIELDS 才會更新；未帶入則保留既有值
 */
async function createOrUpdateRegistration(payload, { transaction, actor = 'student' } = {}) {
  const studentId = payload?.studentId;
  const semester = payload?.semester;

  if (!studentId) {
    throw buildStudentFriendlyError({
      code: 'INVALID_PAYLOAD',
      message: '缺少必要欄位：studentId',
      status: 400
    });
  }

  // 依 Phase 1 規則：一律以 (studentId, semester) 作為唯一 key
  // 若 semester 為 null，可能導致唯一鍵無法有效去重，因此直接拒絕寫入。
  if (!semester) {
    throw buildStudentFriendlyError({
      code: 'SEMESTER_REQUIRED',
      message: '無法判斷本學期，請聯絡管理員後再進行處理',
      status: 400
    });
  }

  const existing = await findExistingRegistration(studentId, semester, { transaction });
  const statusFromPayload = computeSubmissionStatus(payload.examType);

  if (existing) {
    if (actor === 'student') {
      // 已通過/報名成功/報名失敗都只能檢視，不能重新送件覆蓋（沿用既有 canEdit 邏輯）
      if (['approved', 'success', 'failed'].includes(existing.status)) {
        throw buildStudentFriendlyError({
          code: 'DUPLICATE_REGISTRATION_NOT_ALLOWED',
          status: 409,
          message: '你本學期已提交培力英檢報名資料，如需修改請聯絡管理員或使用修改功能'
        });
      }
    }

    const updateData = { ...payload };

    // 学生：抵免審核欄位一律移除（保留既有審核資訊）
    if (actor === 'student') {
      for (const f of STUDENT_BLOCKED_FIELDS) {
        delete updateData[f];
      }

      // 学生重新送件時，若未提供檔案（null），保留既有附件
      const preserveFileFields = ['b2CertificateFile', 'disabilityCertFront', 'disabilityCertBack', 'idPhoto'];
      for (const f of preserveFileFields) {
        if (updateData[f] === null && existing[f] != null) {
          updateData[f] = existing[f];
        }
      }

      // 確保 status 與本次 examType 一致
      updateData.status = statusFromPayload;
    } else {
      // 管理端：只有當 payload 明確帶入 REVIEW_FIELDS 才更新
      for (const f of REVIEW_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(payload, f)) {
          delete updateData[f];
        }
      }
      if (!Object.prototype.hasOwnProperty.call(updateData, 'status') && payload.examType) {
        updateData.status = statusFromPayload;
      }
    }

    // 避免覆蓋 semester（unique key 使用語意一致的 semester）；順便 backfill 舊資料 null semester
    updateData.semester = semester;

    const legacySemesterBackfilled = isBlankSemester(existing.semester);
    await existing.update(updateData, { transaction });
    return { registration: existing, action: 'updated', legacySemesterBackfilled };
  }

  // 不存在：create
  const createData = { ...payload };

  // 学生：create 時也要確保審核欄位不被意外寫入
  if (actor === 'student') {
    for (const f of STUDENT_BLOCKED_FIELDS) delete createData[f];
    createData.status = statusFromPayload;
  }

  try {
    const registration = await EnglishTestRegistration.create(createData, { transaction });
    return { registration, action: 'created' };
  } catch (e) {
    // 可能存在競態：另一個請求剛剛 create 成功。
    // 若唯一鍵（studentId+semester）衝突，改為更新既有資料。
    if (e?.name === 'SequelizeUniqueConstraintError') {
      const latest = await findExistingRegistration(studentId, semester, { transaction });
      if (latest) {
        const updateData = { ...createData };
        if (actor === 'student') {
          for (const f of STUDENT_BLOCKED_FIELDS) delete updateData[f];
          updateData.status = statusFromPayload;
        }
        await latest.update(updateData, { transaction });
        return { registration: latest, action: 'updated' };
      }
    }
    throw e;
  }
}

module.exports = {
  findExistingRegistration,
  findRegistrationForSemester,
  createOrUpdateRegistration,
  queryPublicRegistration,
  studentCanEditRegistration,
  buildStudentStatusMessage,
  registrationMatchesIdentity,
  normalizePublicLookupFields,
  inferRegistrationSemester,
  registrationBelongsToSemester,
  assertStudentMayEditRegistration,
  isBlankSemester,
};
