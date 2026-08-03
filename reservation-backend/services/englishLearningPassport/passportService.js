'use strict';

const { Op } = require('sequelize');
const {
  sequelize,
  EnglishLearningPassport,
  EnglishLearningPointRule,
  EnglishLearningSubmission,
  EnglishLearningAttachment,
  EnglishLearningAuditLog,
} = require('../../models');
const {
  PASSPORT_STATUS,
  CERTIFICATION_STATUS,
  SUBMISSION_STATUS,
  CERTIFICATION_THRESHOLD,
} = require('./constants');
const {
  calculateSuggestedPoints,
  validateApproval,
  getRuleByCode,
  meetsDirectEnglishStandard,
} = require('./pointValidationService');
const { logElpAudit } = require('./auditService');

function normalizeStudentContext(ctx) {
  return {
    studentId: String(ctx.studentId || '').trim(),
    studentName: String(ctx.studentName || '').trim(),
    studentEmail: String(ctx.studentEmail || '').trim().toLowerCase(),
  };
}

function assertStudentMatchesPassport(passport, ctx) {
  const n = normalizeStudentContext(ctx);
  if (
    passport.studentId !== n.studentId ||
    passport.studentName.trim() !== n.studentName ||
    passport.studentEmail.toLowerCase() !== n.studentEmail
  ) {
    const err = new Error('學生身分驗證失敗');
    err.status = 403;
    err.code = 'STUDENT_MISMATCH';
    throw err;
  }
}

async function findBlockingPassport(studentId, transaction) {
  return EnglishLearningPassport.findOne({
    where: {
      studentId,
      status: { [Op.in]: [PASSPORT_STATUS.PENDING, PASSPORT_STATUS.ACTIVE, PASSPORT_STATUS.COMPLETED] },
    },
    order: [['id', 'DESC']],
    transaction,
  });
}

async function getPassportForStudent(ctx, transaction) {
  const n = normalizeStudentContext(ctx);
  const passport = await EnglishLearningPassport.findOne({
    where: { studentId: n.studentId },
    order: [['id', 'DESC']],
    transaction,
  });
  if (!passport) return null;
  assertStudentMatchesPassport(passport, n);
  return passport;
}

async function recalculatePassportPoints(passportId, transaction) {
  const sum = await EnglishLearningSubmission.sum('pointsApproved', {
    where: { passportId, status: SUBMISSION_STATUS.APPROVED },
    transaction,
  });
  const total = sum || 0;
  await EnglishLearningPassport.update(
    { totalApprovedPoints: total },
    { where: { id: passportId }, transaction },
  );
  return total;
}

function passportToPublic(passport) {
  if (!passport) return null;
  const p = passport.toJSON ? passport.toJSON() : passport;
  return {
    id: p.id,
    studentId: p.studentId,
    studentName: p.studentName,
    studentEmail: p.studentEmail,
    status: p.status,
    applicationReason: p.applicationReason,
    totalApprovedPoints: p.totalApprovedPoints,
    certificationStatus: p.certificationStatus,
    certificationRequestedAt: p.certificationRequestedAt,
    rejectionReason: p.rejectionReason,
    completedAt: p.completedAt,
    reviewedAt: p.reviewedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    threshold: CERTIFICATION_THRESHOLD,
    canRequestCertification:
      p.status === PASSPORT_STATUS.ACTIVE &&
      p.totalApprovedPoints >= CERTIFICATION_THRESHOLD &&
      p.certificationStatus !== CERTIFICATION_STATUS.PENDING &&
      p.certificationStatus !== CERTIFICATION_STATUS.APPROVED,
  };
}

function submissionToPublic(sub, { includeAttachments = false } = {}) {
  const s = sub.toJSON ? sub.toJSON() : sub;
  const out = {
    id: s.id,
    passportId: s.passportId,
    studentId: s.studentId,
    ruleCode: s.ruleCode,
    status: s.status,
    activityDate: s.activityDate,
    title: s.title,
    description: s.description,
    pointsRequested: s.pointsRequested,
    pointsApproved: s.pointsApproved,
    metadataJson: s.metadataJson,
    submittedAt: s.submittedAt,
    reviewedAt: s.reviewedAt,
    rejectionReason: s.rejectionReason,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    suggestedPoints: calculateSuggestedPoints(s.ruleCode, s.metadataJson || {}),
    meetsDirectEnglishStandard:
      s.ruleCode === 'EXTERNAL_EXAM' ? meetsDirectEnglishStandard(s.metadataJson || {}) : false,
  };
  if (includeAttachments && s.attachments) {
    out.attachments = s.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      filePath: a.filePath,
      mimeType: a.mimeType,
      fileSize: a.fileSize,
    }));
  }
  return out;
}

async function getStudentDashboard(ctx) {
  const passport = await getPassportForStudent(ctx);
  if (!passport) {
    return { passport: null, summary: null, submissions: [], rules: await listEnabledRules() };
  }

  const submissions = await EnglishLearningSubmission.findAll({
    where: { passportId: passport.id },
    include: [{ model: EnglishLearningAttachment, as: 'attachments' }],
    order: [['updatedAt', 'DESC']],
  });

  const approved = submissions.filter((s) => s.status === SUBMISSION_STATUS.APPROVED);
  const pending = submissions.filter((s) => s.status === SUBMISSION_STATUS.SUBMITTED);
  const rejected = submissions.filter((s) => s.status === SUBMISSION_STATUS.REJECTED);

  const pendingPoints = pending.reduce((sum, s) => sum + (s.pointsRequested || 0), 0);

  return {
    passport: passportToPublic(passport),
    summary: {
      approvedPoints: passport.totalApprovedPoints,
      pendingPoints,
      rejectedCount: rejected.length,
      approvedCount: approved.length,
      pendingCount: pending.length,
      threshold: CERTIFICATION_THRESHOLD,
    },
    submissions: submissions.map((s) => submissionToPublic(s, { includeAttachments: true })),
    rules: await listEnabledRules(),
  };
}

async function listEnabledRules() {
  const rules = await EnglishLearningPointRule.findAll({
    where: { isEnabled: true },
    order: [['sortOrder', 'ASC']],
  });
  return rules.map((r) => {
    const j = r.toJSON();
    return {
      code: j.code,
      name: j.name,
      description: j.description,
      basePoints: j.basePoints,
      maxPointsPerWeek: j.maxPointsPerWeek,
      maxPointsTotal: j.maxPointsTotal,
      isOnceOnly: j.isOnceOnly,
      requiresAttachment: j.requiresAttachment,
      sortOrder: j.sortOrder,
    };
  });
}

async function applyPassport(ctx, { applicationReason }, req) {
  const n = normalizeStudentContext(ctx);
  if (!n.studentId || !n.studentName || !n.studentEmail) {
    const err = new Error('缺少必要欄位');
    err.status = 400;
    err.code = 'REQUIRED_FIELD_MISSING';
    throw err;
  }

  return sequelize.transaction(async (transaction) => {
    const existing = await findBlockingPassport(n.studentId, transaction);
    if (existing) {
      const err = new Error('已有進行中或已完成的護照申請');
      err.status = 409;
      err.code = 'PASSPORT_ALREADY_EXISTS';
      throw err;
    }

    const passport = await EnglishLearningPassport.create(
      {
        studentId: n.studentId,
        studentName: n.studentName,
        studentEmail: n.studentEmail,
        status: PASSPORT_STATUS.PENDING,
        applicationReason: applicationReason || null,
        totalApprovedPoints: 0,
        certificationStatus: CERTIFICATION_STATUS.NONE,
      },
      { transaction },
    );

    await logElpAudit({
      req,
      studentContext: n,
      action: 'passport_apply',
      targetType: 'EnglishLearningPassport',
      targetId: passport.id,
      after: passportToPublic(passport),
    });

    return passportToPublic(passport);
  });
}

async function requireActivePassport(ctx, transaction) {
  const passport = await getPassportForStudent(ctx, transaction);
  if (!passport) {
    const err = new Error('尚未申請護照');
    err.status = 404;
    err.code = 'PASSPORT_NOT_FOUND';
    throw err;
  }
  if (passport.status !== PASSPORT_STATUS.ACTIVE) {
    const err = new Error('護照尚未核准，無法提交點數項目');
    err.status = 403;
    err.code = 'PASSPORT_NOT_ACTIVE';
    throw err;
  }
  return passport;
}

async function createSubmission(ctx, payload, req) {
  const { ruleCode, activityDate, title, description, metadataJson } = payload;
  const rule = await getRuleByCode(ruleCode);
  if (!rule) {
    const err = new Error('點數規則不存在或已停用');
    err.status = 400;
    err.code = 'RULE_NOT_FOUND';
    throw err;
  }

  const suggested = calculateSuggestedPoints(ruleCode, metadataJson || {}, rule);

  return sequelize.transaction(async (transaction) => {
    const passport = await requireActivePassport(ctx, transaction);
    const submission = await EnglishLearningSubmission.create(
      {
        passportId: passport.id,
        studentId: passport.studentId,
        ruleCode,
        status: SUBMISSION_STATUS.DRAFT,
        activityDate: activityDate || null,
        title: title || null,
        description: description || null,
        pointsRequested: suggested,
        metadataJson: metadataJson || {},
      },
      { transaction },
    );

    await logElpAudit({
      req,
      studentContext: normalizeStudentContext(ctx),
      action: 'submission_create',
      targetType: 'EnglishLearningSubmission',
      targetId: submission.id,
      after: submissionToPublic(submission),
    });

    return submissionToPublic(submission);
  });
}

async function getSubmissionForStudent(ctx, submissionId) {
  const passport = await getPassportForStudent(ctx);
  if (!passport) {
    const err = new Error('尚未申請護照');
    err.status = 404;
    err.code = 'PASSPORT_NOT_FOUND';
    throw err;
  }
  const submission = await EnglishLearningSubmission.findOne({
    where: { id: submissionId, passportId: passport.id },
    include: [{ model: EnglishLearningAttachment, as: 'attachments' }],
  });
  if (!submission) {
    const err = new Error('查無提交紀錄');
    err.status = 404;
    err.code = 'SUBMISSION_NOT_FOUND';
    throw err;
  }
  return submissionToPublic(submission, { includeAttachments: true });
}

async function updateSubmission(ctx, submissionId, payload, req) {
  return sequelize.transaction(async (transaction) => {
    const passport = await requireActivePassport(ctx, transaction);
    const submission = await EnglishLearningSubmission.findOne({
      where: { id: submissionId, passportId: passport.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!submission) {
      const err = new Error('查無提交紀錄');
      err.status = 404;
      err.code = 'SUBMISSION_NOT_FOUND';
      throw err;
    }
    if (submission.status === SUBMISSION_STATUS.APPROVED) {
      const err = new Error('已核准項目不可修改');
      err.status = 403;
      err.code = 'SUBMISSION_LOCKED';
      throw err;
    }
    if (![SUBMISSION_STATUS.DRAFT, SUBMISSION_STATUS.REJECTED].includes(submission.status)) {
      const err = new Error('目前狀態不可修改');
      err.status = 403;
      err.code = 'SUBMISSION_NOT_EDITABLE';
      throw err;
    }

    const before = submissionToPublic(submission);
    const rule = await getRuleByCode(payload.ruleCode || submission.ruleCode, transaction);
    const metadata = payload.metadataJson != null ? payload.metadataJson : submission.metadataJson;
    const ruleCode = payload.ruleCode || submission.ruleCode;
    const suggested = calculateSuggestedPoints(ruleCode, metadata || {}, rule);

    await submission.update(
      {
        ruleCode,
        activityDate: payload.activityDate != null ? payload.activityDate : submission.activityDate,
        title: payload.title != null ? payload.title : submission.title,
        description: payload.description != null ? payload.description : submission.description,
        metadataJson: metadata,
        pointsRequested: suggested,
        status: SUBMISSION_STATUS.DRAFT,
        rejectionReason: null,
      },
      { transaction },
    );

    await logElpAudit({
      req,
      studentContext: normalizeStudentContext(ctx),
      action: 'submission_update',
      targetType: 'EnglishLearningSubmission',
      targetId: submission.id,
      before,
      after: submissionToPublic(submission),
    });

    return submissionToPublic(submission);
  });
}

async function deleteSubmission(ctx, submissionId, req) {
  return sequelize.transaction(async (transaction) => {
    const passport = await requireActivePassport(ctx, transaction);
    const submission = await EnglishLearningSubmission.findOne({
      where: { id: submissionId, passportId: passport.id },
      transaction,
    });
    if (!submission) {
      const err = new Error('查無提交紀錄');
      err.status = 404;
      err.code = 'SUBMISSION_NOT_FOUND';
      throw err;
    }
    if (![SUBMISSION_STATUS.DRAFT, SUBMISSION_STATUS.REJECTED].includes(submission.status)) {
      const err = new Error('目前狀態不可刪除');
      err.status = 403;
      err.code = 'SUBMISSION_NOT_DELETABLE';
      throw err;
    }
    const before = submissionToPublic(submission);
    await submission.destroy({ transaction });
    await logElpAudit({
      req,
      studentContext: normalizeStudentContext(ctx),
      action: 'submission_delete',
      targetType: 'EnglishLearningSubmission',
      targetId: submissionId,
      before,
    });
    return { success: true };
  });
}

async function submitSubmission(ctx, submissionId, req) {
  return sequelize.transaction(async (transaction) => {
    const passport = await requireActivePassport(ctx, transaction);
    const submission = await EnglishLearningSubmission.findOne({
      where: { id: submissionId, passportId: passport.id },
      include: [{ model: EnglishLearningAttachment, as: 'attachments' }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!submission) {
      const err = new Error('查無提交紀錄');
      err.status = 404;
      err.code = 'SUBMISSION_NOT_FOUND';
      throw err;
    }
    if (![SUBMISSION_STATUS.DRAFT, SUBMISSION_STATUS.REJECTED].includes(submission.status)) {
      const err = new Error('目前狀態不可送出');
      err.status = 403;
      err.code = 'SUBMISSION_NOT_SUBMITTABLE';
      throw err;
    }

    const rule = await getRuleByCode(submission.ruleCode, transaction);
    if (rule && rule.requiresAttachment && (!submission.attachments || !submission.attachments.length)) {
      const err = new Error('此項目需要上傳附件');
      err.status = 400;
      err.code = 'ATTACHMENT_REQUIRED';
      throw err;
    }

    const before = submissionToPublic(submission);
    await submission.update(
      {
        status: SUBMISSION_STATUS.SUBMITTED,
        submittedAt: new Date(),
        rejectionReason: null,
      },
      { transaction },
    );

    await logElpAudit({
      req,
      studentContext: normalizeStudentContext(ctx),
      action: 'submission_submit',
      targetType: 'EnglishLearningSubmission',
      targetId: submission.id,
      before,
      after: submissionToPublic(submission),
    });

    return submissionToPublic(submission);
  });
}

async function addAttachment(ctx, submissionId, fileInfo, req) {
  return sequelize.transaction(async (transaction) => {
    const passport = await requireActivePassport(ctx, transaction);
    const submission = await EnglishLearningSubmission.findOne({
      where: { id: submissionId, passportId: passport.id },
      transaction,
    });
    if (!submission) {
      const err = new Error('查無提交紀錄');
      err.status = 404;
      err.code = 'SUBMISSION_NOT_FOUND';
      throw err;
    }
    if (submission.status === SUBMISSION_STATUS.APPROVED) {
      const err = new Error('已核准項目不可上傳附件');
      err.status = 403;
      err.code = 'SUBMISSION_LOCKED';
      throw err;
    }

    const attachment = await EnglishLearningAttachment.create(
      {
        submissionId: submission.id,
        fileName: fileInfo.fileName,
        filePath: fileInfo.filePath,
        mimeType: fileInfo.mimeType,
        fileSize: fileInfo.fileSize,
        uploadedBy: normalizeStudentContext(ctx).studentId,
      },
      { transaction },
    );

    await logElpAudit({
      req,
      studentContext: normalizeStudentContext(ctx),
      action: 'attachment_upload',
      targetType: 'EnglishLearningAttachment',
      targetId: attachment.id,
      after: { submissionId, fileName: fileInfo.fileName },
    });

    return {
      id: attachment.id,
      fileName: attachment.fileName,
      filePath: attachment.filePath,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
    };
  });
}

async function deleteAttachment(ctx, attachmentId, req) {
  return sequelize.transaction(async (transaction) => {
    const passport = await getPassportForStudent(ctx, transaction);
    if (!passport) {
      const err = new Error('尚未申請護照');
      err.status = 404;
      err.code = 'PASSPORT_NOT_FOUND';
      throw err;
    }
    const attachment = await EnglishLearningAttachment.findOne({
      where: { id: attachmentId },
      include: [{
        model: EnglishLearningSubmission,
        as: 'submission',
        where: { passportId: passport.id },
      }],
      transaction,
    });
    if (!attachment) {
      const err = new Error('查無附件');
      err.status = 404;
      err.code = 'ATTACHMENT_NOT_FOUND';
      throw err;
    }
    if (attachment.submission.status === SUBMISSION_STATUS.APPROVED) {
      const err = new Error('已核准項目不可刪除附件');
      err.status = 403;
      err.code = 'SUBMISSION_LOCKED';
      throw err;
    }
    await attachment.destroy({ transaction });
    await logElpAudit({
      req,
      studentContext: normalizeStudentContext(ctx),
      action: 'attachment_delete',
      targetType: 'EnglishLearningAttachment',
      targetId: attachmentId,
    });
    return { success: true };
  });
}

async function requestCertification(ctx, req) {
  return sequelize.transaction(async (transaction) => {
    const passport = await requireActivePassport(ctx, transaction);
    if (passport.totalApprovedPoints < CERTIFICATION_THRESHOLD) {
      const err = new Error(`累積點數未達 ${CERTIFICATION_THRESHOLD} 點`);
      err.status = 403;
      err.code = 'INSUFFICIENT_POINTS';
      throw err;
    }
    if (passport.certificationStatus === CERTIFICATION_STATUS.PENDING) {
      const err = new Error('已送出最終認證申請，請等候審核');
      err.status = 409;
      err.code = 'CERTIFICATION_ALREADY_PENDING';
      throw err;
    }
    if (passport.certificationStatus === CERTIFICATION_STATUS.APPROVED) {
      const err = new Error('已通過最終認證');
      err.status = 409;
      err.code = 'CERTIFICATION_ALREADY_APPROVED';
      throw err;
    }

    const before = passportToPublic(passport);
    await passport.update(
      {
        certificationStatus: CERTIFICATION_STATUS.PENDING,
        certificationRequestedAt: new Date(),
        certificationRejectionReason: null,
      },
      { transaction },
    );

    await logElpAudit({
      req,
      studentContext: normalizeStudentContext(ctx),
      action: 'certification_request',
      targetType: 'EnglishLearningPassport',
      targetId: passport.id,
      before,
      after: passportToPublic(passport),
    });

    return passportToPublic(passport);
  });
}

// —— Admin ——

async function listPassportsAdmin(filters = {}) {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.certificationStatus) where.certificationStatus = filters.certificationStatus;
  if (filters.studentId) where.studentId = { [Op.like]: `%${filters.studentId}%` };
  if (filters.studentName) where.studentName = { [Op.like]: `%${filters.studentName}%` };
  if (filters.studentEmail) where.studentEmail = { [Op.like]: `%${filters.studentEmail}%` };

  const rows = await EnglishLearningPassport.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: Math.min(Number(filters.limit) || 100, 500),
    offset: Number(filters.offset) || 0,
  });
  return rows.map(passportToPublic);
}

async function getPassportDetailAdmin(passportId) {
  const passport = await EnglishLearningPassport.findByPk(passportId);
  if (!passport) {
    const err = new Error('查無護照');
    err.status = 404;
    err.code = 'PASSPORT_NOT_FOUND';
    throw err;
  }

  const submissions = await EnglishLearningSubmission.findAll({
    where: { passportId },
    include: [{ model: EnglishLearningAttachment, as: 'attachments' }],
    order: [['submittedAt', 'DESC'], ['createdAt', 'DESC']],
  });

  const byRule = {};
  submissions
    .filter((s) => s.status === SUBMISSION_STATUS.APPROVED)
    .forEach((s) => {
      byRule[s.ruleCode] = (byRule[s.ruleCode] || 0) + (s.pointsApproved || 0);
    });

  const auditLogs = await EnglishLearningAuditLog.findAll({
    where: {
      [Op.or]: [
        { targetType: 'EnglishLearningPassport', targetId: String(passportId) },
        { targetType: 'EnglishLearningSubmission', targetId: { [Op.in]: submissions.map((s) => String(s.id)) } },
      ],
    },
    order: [['createdAt', 'DESC']],
    limit: 100,
  });

  return {
    passport: passportToPublic(passport),
    pointsByRule: byRule,
    submissions: submissions.map((s) => submissionToPublic(s, { includeAttachments: true })),
    auditLogs: auditLogs.map((l) => l.toJSON()),
  };
}

async function approvePassportAdmin(passportId, reviewerId, req) {
  return sequelize.transaction(async (transaction) => {
    const passport = await EnglishLearningPassport.findByPk(passportId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!passport) {
      const err = new Error('查無護照');
      err.status = 404;
      err.code = 'PASSPORT_NOT_FOUND';
      throw err;
    }
    if (passport.status !== PASSPORT_STATUS.PENDING) {
      const err = new Error('僅待審核護照可核准');
      err.status = 400;
      err.code = 'INVALID_PASSPORT_STATUS';
      throw err;
    }
    const before = passportToPublic(passport);
    await passport.update(
      {
        status: PASSPORT_STATUS.ACTIVE,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
      { transaction },
    );
    await logElpAudit({
      req,
      action: 'passport_approve',
      targetType: 'EnglishLearningPassport',
      targetId: passport.id,
      before,
      after: passportToPublic(passport),
    });
    return passportToPublic(passport);
  });
}

async function rejectPassportAdmin(passportId, reviewerId, reason, req) {
  if (!reason || !String(reason).trim()) {
    const err = new Error('退回原因為必填');
    err.status = 400;
    err.code = 'REJECTION_REASON_REQUIRED';
    throw err;
  }
  return sequelize.transaction(async (transaction) => {
    const passport = await EnglishLearningPassport.findByPk(passportId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!passport) {
      const err = new Error('查無護照');
      err.status = 404;
      err.code = 'PASSPORT_NOT_FOUND';
      throw err;
    }
    if (passport.status !== PASSPORT_STATUS.PENDING) {
      const err = new Error('僅待審核護照可退回');
      err.status = 400;
      err.code = 'INVALID_PASSPORT_STATUS';
      throw err;
    }
    const before = passportToPublic(passport);
    await passport.update(
      {
        status: PASSPORT_STATUS.REJECTED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: String(reason).trim(),
      },
      { transaction },
    );
    await logElpAudit({
      req,
      action: 'passport_reject',
      targetType: 'EnglishLearningPassport',
      targetId: passport.id,
      before,
      after: passportToPublic(passport),
    });
    return passportToPublic(passport);
  });
}

async function listSubmissionsAdmin(filters = {}) {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.ruleCode) where.ruleCode = filters.ruleCode;
  if (filters.studentId) where.studentId = { [Op.like]: `%${filters.studentId}%` };
  if (filters.dateFrom || filters.dateTo) {
    where.activityDate = {};
    if (filters.dateFrom) where.activityDate[Op.gte] = filters.dateFrom;
    if (filters.dateTo) where.activityDate[Op.lte] = filters.dateTo;
  }

  const include = [
    { model: EnglishLearningPassport, as: 'passport', attributes: ['studentName', 'studentEmail', 'status'] },
    { model: EnglishLearningAttachment, as: 'attachments' },
  ];

  if (filters.studentName) {
    include[0].where = { studentName: { [Op.like]: `%${filters.studentName}%` } };
    include[0].required = true;
  }

  const rows = await EnglishLearningSubmission.findAll({
    where,
    include,
    order: [['submittedAt', 'DESC'], ['createdAt', 'DESC']],
    limit: Math.min(Number(filters.limit) || 100, 500),
    offset: Number(filters.offset) || 0,
  });

  return rows.map((s) => {
    const pub = submissionToPublic(s, { includeAttachments: true });
    pub.studentName = s.passport ? s.passport.studentName : null;
    pub.studentEmail = s.passport ? s.passport.studentEmail : null;
    return pub;
  });
}

async function getSubmissionAdmin(submissionId) {
  const submission = await EnglishLearningSubmission.findByPk(submissionId, {
    include: [
      { model: EnglishLearningPassport, as: 'passport' },
      { model: EnglishLearningAttachment, as: 'attachments' },
    ],
  });
  if (!submission) {
    const err = new Error('查無提交紀錄');
    err.status = 404;
    err.code = 'SUBMISSION_NOT_FOUND';
    throw err;
  }
  const pub = submissionToPublic(submission, { includeAttachments: true });
  pub.studentName = submission.passport ? submission.passport.studentName : null;
  pub.studentEmail = submission.passport ? submission.passport.studentEmail : null;
  pub.passport = submission.passport ? passportToPublic(submission.passport) : null;
  return pub;
}

async function approveSubmissionAdmin(submissionId, reviewerId, pointsApproved, req) {
  return sequelize.transaction(async (transaction) => {
    const submission = await EnglishLearningSubmission.findByPk(submissionId, {
      include: [{ model: EnglishLearningPassport, as: 'passport' }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!submission) {
      const err = new Error('查無提交紀錄');
      err.status = 404;
      err.code = 'SUBMISSION_NOT_FOUND';
      throw err;
    }
    if (submission.status !== SUBMISSION_STATUS.SUBMITTED) {
      const err = new Error('僅待審核項目可核准');
      err.status = 400;
      err.code = 'INVALID_SUBMISSION_STATUS';
      throw err;
    }

    const validation = await validateApproval({
      studentId: submission.studentId,
      ruleCode: submission.ruleCode,
      activityDate: submission.activityDate,
      metadata: submission.metadataJson || {},
      pointsToApprove: pointsApproved,
      excludeSubmissionId: submission.id,
      transaction,
    });
    if (!validation.ok) {
      const err = new Error(validation.message);
      err.status = 400;
      err.code = validation.code;
      err.suggestedPoints = validation.suggestedPoints;
      throw err;
    }

    const before = submissionToPublic(submission);
    await submission.update(
      {
        status: SUBMISSION_STATUS.APPROVED,
        pointsApproved: validation.points,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
      { transaction },
    );

    const total = await recalculatePassportPoints(submission.passportId, transaction);

    await logElpAudit({
      req,
      action: 'submission_approve',
      targetType: 'EnglishLearningSubmission',
      targetId: submission.id,
      before,
      after: { ...submissionToPublic(submission), passportTotalPoints: total },
    });

    const updated = submissionToPublic(submission);
    updated.passportTotalPoints = total;
    return updated;
  });
}

async function rejectSubmissionAdmin(submissionId, reviewerId, reason, req) {
  if (!reason || !String(reason).trim()) {
    const err = new Error('退回原因為必填');
    err.status = 400;
    err.code = 'REJECTION_REASON_REQUIRED';
    throw err;
  }
  return sequelize.transaction(async (transaction) => {
    const submission = await EnglishLearningSubmission.findByPk(submissionId, { transaction });
    if (!submission) {
      const err = new Error('查無提交紀錄');
      err.status = 404;
      err.code = 'SUBMISSION_NOT_FOUND';
      throw err;
    }
    if (submission.status !== SUBMISSION_STATUS.SUBMITTED) {
      const err = new Error('僅待審核項目可退回');
      err.status = 400;
      err.code = 'INVALID_SUBMISSION_STATUS';
      throw err;
    }
    const before = submissionToPublic(submission);
    await submission.update(
      {
        status: SUBMISSION_STATUS.REJECTED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: String(reason).trim(),
      },
      { transaction },
    );
    await logElpAudit({
      req,
      action: 'submission_reject',
      targetType: 'EnglishLearningSubmission',
      targetId: submission.id,
      before,
      after: submissionToPublic(submission),
    });
    return submissionToPublic(submission);
  });
}

async function updateSubmissionPointsAdmin(submissionId, reviewerId, pointsApproved, req) {
  return sequelize.transaction(async (transaction) => {
    const submission = await EnglishLearningSubmission.findByPk(submissionId, { transaction });
    if (!submission) {
      const err = new Error('查無提交紀錄');
      err.status = 404;
      err.code = 'SUBMISSION_NOT_FOUND';
      throw err;
    }
    if (submission.status !== SUBMISSION_STATUS.APPROVED) {
      const err = new Error('僅已核准項目可調整點數');
      err.status = 400;
      err.code = 'INVALID_SUBMISSION_STATUS';
      throw err;
    }

    const validation = await validateApproval({
      studentId: submission.studentId,
      ruleCode: submission.ruleCode,
      activityDate: submission.activityDate,
      metadata: submission.metadataJson || {},
      pointsToApprove: pointsApproved,
      excludeSubmissionId: submission.id,
      transaction,
    });
    if (!validation.ok) {
      const err = new Error(validation.message);
      err.status = 400;
      err.code = validation.code;
      throw err;
    }

    const before = submissionToPublic(submission);
    await submission.update(
      {
        pointsApproved: validation.points,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
      { transaction },
    );
    const total = await recalculatePassportPoints(submission.passportId, transaction);

    await logElpAudit({
      req,
      action: 'submission_points_update',
      targetType: 'EnglishLearningSubmission',
      targetId: submission.id,
      before,
      after: { ...submissionToPublic(submission), passportTotalPoints: total },
    });

    const updated = submissionToPublic(submission);
    updated.passportTotalPoints = total;
    return updated;
  });
}

async function listCertificationRequestsAdmin() {
  const rows = await EnglishLearningPassport.findAll({
    where: { certificationStatus: CERTIFICATION_STATUS.PENDING },
    order: [['certificationRequestedAt', 'ASC']],
  });
  return rows.map(passportToPublic);
}

async function approveCertificationAdmin(passportId, reviewerId, req) {
  return sequelize.transaction(async (transaction) => {
    const passport = await EnglishLearningPassport.findByPk(passportId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!passport) {
      const err = new Error('查無護照');
      err.status = 404;
      err.code = 'PASSPORT_NOT_FOUND';
      throw err;
    }
    if (passport.certificationStatus !== CERTIFICATION_STATUS.PENDING) {
      const err = new Error('無待審核的最終認證申請');
      err.status = 400;
      err.code = 'INVALID_CERTIFICATION_STATUS';
      throw err;
    }
    if (passport.totalApprovedPoints < CERTIFICATION_THRESHOLD) {
      const err = new Error(`累積點數未達 ${CERTIFICATION_THRESHOLD} 點`);
      err.status = 400;
      err.code = 'INSUFFICIENT_POINTS';
      throw err;
    }

    const before = passportToPublic(passport);
    const now = new Date();
    await passport.update(
      {
        status: PASSPORT_STATUS.COMPLETED,
        certificationStatus: CERTIFICATION_STATUS.APPROVED,
        certificationReviewedBy: reviewerId,
        certificationReviewedAt: now,
        completedAt: now,
        certificationRejectionReason: null,
      },
      { transaction },
    );

    await logElpAudit({
      req,
      action: 'certification_approve',
      targetType: 'EnglishLearningPassport',
      targetId: passport.id,
      before,
      after: passportToPublic(passport),
    });

    return passportToPublic(passport);
  });
}

async function rejectCertificationAdmin(passportId, reviewerId, reason, req) {
  if (!reason || !String(reason).trim()) {
    const err = new Error('退回原因為必填');
    err.status = 400;
    err.code = 'REJECTION_REASON_REQUIRED';
    throw err;
  }
  return sequelize.transaction(async (transaction) => {
    const passport = await EnglishLearningPassport.findByPk(passportId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!passport) {
      const err = new Error('查無護照');
      err.status = 404;
      err.code = 'PASSPORT_NOT_FOUND';
      throw err;
    }
    if (passport.certificationStatus !== CERTIFICATION_STATUS.PENDING) {
      const err = new Error('無待審核的最終認證申請');
      err.status = 400;
      err.code = 'INVALID_CERTIFICATION_STATUS';
      throw err;
    }

    const before = passportToPublic(passport);
    await passport.update(
      {
        certificationStatus: CERTIFICATION_STATUS.REJECTED,
        certificationReviewedBy: reviewerId,
        certificationReviewedAt: new Date(),
        certificationRejectionReason: String(reason).trim(),
      },
      { transaction },
    );

    await logElpAudit({
      req,
      action: 'certification_reject',
      targetType: 'EnglishLearningPassport',
      targetId: passport.id,
      before,
      after: passportToPublic(passport),
    });

    return passportToPublic(passport);
  });
}

async function listRulesAdmin() {
  const rules = await EnglishLearningPointRule.findAll({ order: [['sortOrder', 'ASC']] });
  return rules.map((r) => r.toJSON());
}

function normalizeRuleCodeInput(raw) {
  const code = String(raw || '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{0,62}$/.test(code)) {
    const err = new Error('規則代碼須為大寫英文、數字或底線，且以英文字母開頭');
    err.status = 400;
    err.code = 'INVALID_RULE_CODE';
    throw err;
  }
  return code;
}

function buildRulePatchFromPayload(payload, { includeCode = false } = {}) {
  const patch = {};
  if (includeCode) {
    patch.code = normalizeRuleCodeInput(payload.code);
  }
  if (payload.name !== undefined) {
    const name = String(payload.name || '').trim();
    if (!name) {
      const err = new Error('項目名稱為必填');
      err.status = 400;
      err.code = 'INVALID_RULE_NAME';
      throw err;
    }
    patch.name = name;
  }
  if (payload.description !== undefined) patch.description = payload.description ? String(payload.description).trim() : null;
  if (payload.basePoints !== undefined) {
    const basePoints = Number(payload.basePoints);
    if (!Number.isFinite(basePoints) || basePoints < 0) {
      const err = new Error('預設點數須為 0 以上的數字');
      err.status = 400;
      err.code = 'INVALID_BASE_POINTS';
      throw err;
    }
    patch.basePoints = basePoints;
  }
  const optionalNums = ['maxPointsPerWeek', 'maxPointsTotal', 'sortOrder'];
  optionalNums.forEach((key) => {
    if (payload[key] === undefined) return;
    if (payload[key] === null || payload[key] === '') {
      patch[key] = key === 'sortOrder' ? 0 : null;
      return;
    }
    const n = Number(payload[key]);
    patch[key] = Number.isFinite(n) ? n : null;
  });
  ['isOnceOnly', 'requiresAttachment', 'isEnabled'].forEach((key) => {
    if (payload[key] !== undefined) patch[key] = !!payload[key];
  });
  return patch;
}

async function createRuleAdmin(payload, req) {
  const patch = buildRulePatchFromPayload(payload, { includeCode: true });
  if (patch.name === undefined) {
    const err = new Error('項目名稱為必填');
    err.status = 400;
    err.code = 'INVALID_RULE_NAME';
    throw err;
  }
  if (patch.basePoints === undefined) {
    const err = new Error('預設點數為必填');
    err.status = 400;
    err.code = 'INVALID_BASE_POINTS';
    throw err;
  }
  const existing = await EnglishLearningPointRule.findOne({ where: { code: patch.code } });
  if (existing) {
    const err = new Error('規則代碼已存在');
    err.status = 409;
    err.code = 'RULE_CODE_EXISTS';
    throw err;
  }
  const rule = await EnglishLearningPointRule.create({
    code: patch.code,
    name: patch.name,
    description: patch.description ?? null,
    basePoints: patch.basePoints,
    maxPointsPerWeek: patch.maxPointsPerWeek ?? null,
    maxPointsTotal: patch.maxPointsTotal ?? null,
    isOnceOnly: patch.isOnceOnly ?? false,
    requiresAttachment: patch.requiresAttachment ?? false,
    isEnabled: patch.isEnabled !== false,
    sortOrder: patch.sortOrder ?? 0,
  });
  await logElpAudit({
    req,
    action: 'rule_create',
    targetType: 'EnglishLearningPointRule',
    targetId: rule.id,
    before: null,
    after: rule.toJSON(),
  });
  return rule.toJSON();
}

async function updateRuleAdmin(ruleId, payload, req) {
  const rule = await EnglishLearningPointRule.findByPk(ruleId);
  if (!rule) {
    const err = new Error('查無規則');
    err.status = 404;
    err.code = 'RULE_NOT_FOUND';
    throw err;
  }
  const before = rule.toJSON();
  const allowed = [
    'name', 'description', 'basePoints', 'maxPointsPerWeek',
    'maxPointsTotal', 'isOnceOnly', 'requiresAttachment', 'isEnabled', 'sortOrder',
  ];
  const patch = {};
  allowed.forEach((k) => {
    if (payload[k] !== undefined) patch[k] = payload[k];
  });
  if (patch.name !== undefined && !String(patch.name || '').trim()) {
    const err = new Error('項目名稱為必填');
    err.status = 400;
    err.code = 'INVALID_RULE_NAME';
    throw err;
  }
  if (patch.name !== undefined) patch.name = String(patch.name).trim();
  if (patch.basePoints !== undefined) {
    const basePoints = Number(patch.basePoints);
    if (!Number.isFinite(basePoints) || basePoints < 0) {
      const err = new Error('預設點數須為 0 以上的數字');
      err.status = 400;
      err.code = 'INVALID_BASE_POINTS';
      throw err;
    }
    patch.basePoints = basePoints;
  }
  await rule.update(patch);
  await logElpAudit({
    req,
    action: 'rule_update',
    targetType: 'EnglishLearningPointRule',
    targetId: rule.id,
    before,
    after: rule.toJSON(),
  });
  return rule.toJSON();
}

async function deleteRuleAdmin(ruleId, req) {
  const rule = await EnglishLearningPointRule.findByPk(ruleId);
  if (!rule) {
    const err = new Error('查無規則');
    err.status = 404;
    err.code = 'RULE_NOT_FOUND';
    throw err;
  }
  const usageCount = await EnglishLearningSubmission.count({ where: { ruleCode: rule.code } });
  if (usageCount > 0) {
    const err = new Error('已有學生申請使用此規則，無法刪除');
    err.status = 409;
    err.code = 'RULE_IN_USE';
    throw err;
  }
  const before = rule.toJSON();
  await rule.destroy();
  await logElpAudit({
    req,
    action: 'rule_delete',
    targetType: 'EnglishLearningPointRule',
    targetId: before.id,
    before,
    after: null,
  });
  return { id: before.id, code: before.code };
}

async function listAuditLogsAdmin(filters = {}) {
  const where = {};
  if (filters.action) where.action = filters.action;
  if (filters.targetType) where.targetType = filters.targetType;
  const rows = await EnglishLearningAuditLog.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: Math.min(Number(filters.limit) || 100, 500),
    offset: Number(filters.offset) || 0,
  });
  return rows.map((r) => r.toJSON());
}

module.exports = {
  normalizeStudentContext,
  getStudentDashboard,
  listEnabledRules,
  applyPassport,
  createSubmission,
  getSubmissionForStudent,
  updateSubmission,
  deleteSubmission,
  submitSubmission,
  addAttachment,
  deleteAttachment,
  requestCertification,
  listPassportsAdmin,
  getPassportDetailAdmin,
  approvePassportAdmin,
  rejectPassportAdmin,
  listSubmissionsAdmin,
  getSubmissionAdmin,
  approveSubmissionAdmin,
  rejectSubmissionAdmin,
  updateSubmissionPointsAdmin,
  listCertificationRequestsAdmin,
  approveCertificationAdmin,
  rejectCertificationAdmin,
  listRulesAdmin,
  createRuleAdmin,
  updateRuleAdmin,
  deleteRuleAdmin,
  listAuditLogsAdmin,
  passportToPublic,
  submissionToPublic,
};
