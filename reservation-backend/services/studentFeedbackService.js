'use strict';

const { Op } = require('sequelize');
const { StudentFeedback } = require('../models');
const { sendEmailWithLog } = require('./emailLogService');

const CENTER_EMAIL = process.env.EMI_CENTER_EMAIL || 'emicenter@mail.nsysu.edu.tw';
const CENTER_PHONE = '07-5252000 分機 5808／5876';
const CENTER_HOURS = '週一至週五 09:00–17:00';
const HOURLY_LIMIT = 5;
const MESSAGE_MIN = 8;
const MESSAGE_MAX = 2000;

const KIND_LABELS = Object.freeze({
  problem: '問題回報',
  wish: '建議／許願',
});

const CATEGORY_LABELS = Object.freeze({
  reservation: '預約或取消',
  survey: '問卷',
  account: '帳號或信箱',
  english_test: '培力報名',
  other: '其他',
});

const RECEIPT_SENT = `已送到中心。上班時間（${CENTER_HOURS}）也可打 ${CENTER_PHONE}。急件請直接打電話。`;
const RECEIPT_SAVED = `已記下，中心可在後台看到。寄信沒有成功，急件請於上班時間打 ${CENTER_PHONE}。`;

class StudentFeedbackError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function kindLabel(kind) {
  return KIND_LABELS[kind] || kind;
}

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

function formatTaipei(date) {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function normalizeMessage(value) {
  return String(value || '').split('\0').join('').trim();
}

function assertInput({ kind, category, message }) {
  if (!KIND_LABELS[kind]) {
    throw new StudentFeedbackError(400, 'STUDENT_FEEDBACK_INVALID', '請選擇問題回報或建議／許願');
  }
  if (!CATEGORY_LABELS[category]) {
    throw new StudentFeedbackError(400, 'STUDENT_FEEDBACK_INVALID', '請選擇項目');
  }
  const text = normalizeMessage(message);
  if (text.length < MESSAGE_MIN) {
    throw new StudentFeedbackError(400, 'STUDENT_FEEDBACK_INVALID', '請再用幾句話寫下發生了什麼，或想許的願');
  }
  if (text.length > MESSAGE_MAX) {
    throw new StudentFeedbackError(400, 'STUDENT_FEEDBACK_INVALID', '內容請縮短到 2000 字以內');
  }
  return text;
}

async function submitStudentFeedback({ account, kind, category, message }) {
  if (!account || !account.studentId) {
    throw new StudentFeedbackError(401, 'STUDENT_AUTH_REQUIRED', '請先登入學生帳號');
  }
  const text = assertInput({ kind, category, message });
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await StudentFeedback.count({
    where: {
      studentId: account.studentId,
      createdAt: { [Op.gte]: since },
    },
  });
  if (recent >= HOURLY_LIMIT) {
    throw new StudentFeedbackError(
      429,
      'STUDENT_FEEDBACK_RATE_LIMITED',
      `短時間內送出太多次。請稍後再試，或於上班時間打 ${CENTER_PHONE}。`,
    );
  }

  const row = await StudentFeedback.create({
    studentId: account.studentId,
    studentName: account.name || '',
    email: account.email || '',
    emailVerified: Boolean(account.emailVerifiedAt),
    kind,
    category,
    message: text,
    emailStatus: 'pending',
  });

  let emailStatus = 'failed';
  try {
    await sendEmailWithLog('studentFeedbackNotice', {
      centerEmail: CENTER_EMAIL,
      studentEmail: account.email || '',
      studentId: account.studentId,
      studentName: account.name || '',
      kindLabel: kindLabel(kind),
      categoryLabel: categoryLabel(category),
      message: text,
      emailVerified: Boolean(account.emailVerifiedAt),
      submittedAt: formatTaipei(row.createdAt || new Date()),
    }, {
      requestId: `student-feedback:${row.id}`,
      relatedEntityType: 'student_feedback',
      relatedEntityId: row.id,
    });
    emailStatus = 'sent';
  } catch {
    emailStatus = 'failed';
  }
  await row.update({ emailStatus });

  return {
    id: row.id,
    kind,
    category,
    emailStatus,
    message: emailStatus === 'sent' ? RECEIPT_SENT : RECEIPT_SAVED,
  };
}

async function listStudentFeedback({ kind } = {}) {
  const where = {};
  if (kind) {
    if (!KIND_LABELS[kind]) {
      throw new StudentFeedbackError(400, 'STUDENT_FEEDBACK_INVALID', '類型不正確');
    }
    where.kind = kind;
  }
  const rows = await StudentFeedback.findAll({
    where,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit: 100,
  });
  return rows.map((row) => {
    const item = row.get ? row.get({ plain: true }) : row;
    return {
      id: item.id,
      studentId: item.studentId,
      studentName: item.studentName,
      email: item.email,
      emailVerified: Boolean(item.emailVerified),
      kind: item.kind,
      kindLabel: kindLabel(item.kind),
      category: item.category,
      categoryLabel: categoryLabel(item.category),
      message: item.message,
      emailStatus: item.emailStatus,
      createdAt: item.createdAt,
    };
  });
}

module.exports = {
  CENTER_EMAIL,
  CENTER_PHONE,
  CENTER_HOURS,
  KIND_LABELS,
  CATEGORY_LABELS,
  RECEIPT_SENT,
  RECEIPT_SAVED,
  StudentFeedbackError,
  submitStudentFeedback,
  listStudentFeedback,
};
