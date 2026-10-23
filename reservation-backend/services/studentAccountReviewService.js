const { Op } = require('sequelize');
const { StudentAccount, StudentAccountReview } = require('../models');
const { findOfficialIdentity, normalizePersonName } = require('./studentIdentityRosterService');

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

async function replacePending({ studentId, email }) {
  await StudentAccountReview.update(
    { status: 'replaced' },
    {
      where: {
        status: 'pending',
        [Op.or]: [{ studentId }, { email }],
      },
    },
  );
}

async function savePendingReview({ studentId, name, email, passwordHash }) {
  await replacePending({ studentId, email });
  return StudentAccountReview.create({
    studentId,
    name,
    email,
    passwordHash,
    status: 'pending',
  });
}

async function findPendingByStudentId(studentId) {
  return StudentAccountReview.findOne({
    where: { studentId, status: 'pending' },
    order: [['id', 'DESC']],
  });
}

async function listPendingReviews() {
  const rows = await StudentAccountReview.findAll({
    where: { status: 'pending' },
    attributes: ['id', 'studentId', 'name', 'email', 'createdAt'],
    order: [['id', 'DESC']],
    limit: 100,
  });
  return rows.map((row) => ({
    id: row.id,
    studentId: row.studentId,
    name: row.name,
    email: row.email,
    createdAt: row.createdAt,
  }));
}

async function approveReview({ reviewId, reviewerId }) {
  const review = await StudentAccountReview.findByPk(reviewId);
  if (!review || review.status !== 'pending') {
    throw httpError(404, 'REVIEW_NOT_FOUND', '找不到待確認的申請');
  }

  const identity = await findOfficialIdentity(review.studentId);
  if (identity.covered && !identity.conflict) {
    const sameName = identity.name === normalizePersonName(review.name);
    if (!sameName) {
      throw httpError(400, 'STUDENT_IDENTITY_MISMATCH', '名冊姓名與申請姓名不符，請先拒絕這筆申請');
    }
  }
  if (identity.conflict) {
    throw httpError(409, 'STUDENT_IDENTITY_CONFLICT', '這個學號的名冊姓名不一致，請先核對名冊再決定');
  }

  const existing = await StudentAccount.findOne({
    where: {
      [Op.or]: [{ studentId: review.studentId }, { email: review.email }],
    },
  });
  if (existing) {
    throw httpError(409, 'STUDENT_ACCOUNT_EXISTS', '這個學號或信箱已經有帳號，無法核准');
  }

  const account = await StudentAccount.create({
    studentId: review.studentId,
    name: review.name,
    email: review.email,
    passwordHash: review.passwordHash,
    status: 'active',
    passwordChangedAt: new Date(),
  });
  await review.update({
    status: 'approved',
    reviewedBy: reviewerId || null,
    reviewedAt: new Date(),
  });
  await replacePending({ studentId: review.studentId, email: review.email });
  return account;
}

async function rejectReview({ reviewId, reviewerId }) {
  const review = await StudentAccountReview.findByPk(reviewId);
  if (!review || review.status !== 'pending') {
    throw httpError(404, 'REVIEW_NOT_FOUND', '找不到待確認的申請');
  }
  await review.update({
    status: 'rejected',
    reviewedBy: reviewerId || null,
    reviewedAt: new Date(),
  });
  return review;
}

module.exports = {
  savePendingReview,
  findPendingByStudentId,
  listPendingReviews,
  approveReview,
  rejectReview,
  replacePending,
};
