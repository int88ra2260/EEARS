'use strict';

const { Op } = require('sequelize');
const { StudentFeedback, StudentFeedbackMessage, Teacher } = require('../models');
const { sendEmailWithLog } = require('./emailLogService');

const CENTER_EMAIL = process.env.EMI_CENTER_EMAIL || 'emicenter@mail.nsysu.edu.tw';
const CENTER_PHONE = '07-5252000 分機 5808／5876';
const CENTER_HOURS = '週一至週五 09:00–17:00';
const HOURLY_LIMIT = 5;
const MESSAGE_MIN = 8;
const MESSAGE_MAX = 2000;
const NOTE_MAX = 2000;
const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 50;

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

const STATUS_LABELS = Object.freeze({
  open: '待處理',
  in_progress: '處理中',
  closed: '已結案',
});

const RECEIPT_SENT = `已送到中心。上班時間（${CENTER_HOURS}）也可打 ${CENTER_PHONE}。急件請直接打電話。`;
const RECEIPT_SAVED = `已記下，中心可在後台看到。寄信沒有成功，急件請於上班時間打 ${CENTER_PHONE}。`;
const ACTIVATION_MESSAGE = '請先到我的帳號收驗證碼，確認收信信箱後再使用。';

class StudentFeedbackError extends Error {
  constructor(status, code, message, extras = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.redirectUrl = extras.redirectUrl;
  }
}

function kindLabel(kind) {
  return KIND_LABELS[kind] || kind;
}

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

function statusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.open;
}

function invalid(message) {
  return new StudentFeedbackError(400, 'STUDENT_FEEDBACK_INVALID', message);
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

function accountPageUrl() {
  const base = String(process.env.FRONTEND_URL || 'http://emieears-siwan.nsysu.edu.tw').replace(/\/$/, '');
  return `${base}/student/account`;
}

function plain(row) {
  if (!row) return null;
  if (typeof row.get === 'function') return row.get({ plain: true });
  return row;
}

function normalizeMessage(value) {
  return String(value || '').split('\0').join('').trim();
}

function assertActivated(account) {
  if (!account || !account.studentId) {
    throw new StudentFeedbackError(401, 'STUDENT_AUTH_REQUIRED', '請先登入學生帳號');
  }
  if (!account.emailVerifiedAt) {
    throw new StudentFeedbackError(403, 'EMAIL_ACTIVATION_REQUIRED', ACTIVATION_MESSAGE, {
      redirectUrl: '/student/account',
    });
  }
}

function parseReplyRequested(value) {
  if (value === undefined || value === null || value === '') return true;
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  throw invalid('請選擇是否需要中心回覆');
}

function assertInput({ kind, category, message }) {
  if (!KIND_LABELS[kind]) throw invalid('請選擇問題回報或建議／許願');
  if (!CATEGORY_LABELS[category]) throw invalid('請選擇項目');
  const text = normalizeMessage(message);
  if (text.length < MESSAGE_MIN) throw invalid('請再用幾句話寫下發生了什麼，或想許的願');
  if (text.length > MESSAGE_MAX) throw invalid('內容請縮短到 2000 字以內');
  return text;
}

function assertNote(value, emptyMessage) {
  const text = normalizeMessage(value);
  if (!text) throw invalid(emptyMessage);
  if (text.length > NOTE_MAX) throw invalid('內容請縮短到 2000 字以內');
  return text;
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new StudentFeedbackError(404, 'STUDENT_FEEDBACK_NOT_FOUND', '找不到這筆回報');
  }
  return id;
}

function parsePage(value) {
  if (value === undefined || value === null || value === '') return 1;
  const page = Number(value);
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw invalid('頁碼不正確');
  return page;
}

function parsePageSize(value) {
  if (value === undefined || value === null || value === '') return PAGE_SIZE_DEFAULT;
  const size = Number(value);
  if (!Number.isInteger(size) || size < 1 || size > PAGE_SIZE_MAX) {
    throw invalid('每頁筆數請介於 1 到 50');
  }
  return size;
}

function parseDay(value, label, endOfDay) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw invalid(`${label}請用西元日期`);
  const date = new Date(`${value}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) throw invalid(`${label}不正確`);
  if (!endOfDay) return date;
  return new Date(date.getTime() + (24 * 60 * 60 * 1000) - 1);
}

function likeTerm(value) {
  const clean = String(value || '').trim().slice(0, 80).replace(/[%_]/g, '');
  return clean ? `%${clean}%` : '';
}

function isAssignable(teacher) {
  if (!teacher || teacher.isActive === false || teacher.isDemo) return false;
  if (teacher.role === 'admin' || teacher.role === 'office_staff') return true;
  return teacher.role === 'teacher' && teacher.teacherLevel === 'executive';
}

function assigneeRoleLabel(teacher) {
  if (teacher.role === 'admin') return '系統管理員';
  if (teacher.role === 'office_staff') return '行政人員';
  if (teacher.teacherLevel === 'executive') return '執行長';
  return '中心人員';
}

async function countRecentStudentWrites(studentId) {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [tickets, notes] = await Promise.all([
    StudentFeedback.count({
      where: { studentId, createdAt: { [Op.gte]: since } },
    }),
    StudentFeedbackMessage.count({
      where: { studentId, authorType: 'student', createdAt: { [Op.gte]: since } },
    }),
  ]);
  return tickets + notes;
}

function assertUnderLimit(count) {
  if (count >= HOURLY_LIMIT) {
    throw new StudentFeedbackError(
      429,
      'STUDENT_FEEDBACK_RATE_LIMITED',
      `短時間內送出太多次。請稍後再試，或於上班時間打 ${CENTER_PHONE}。`,
    );
  }
}

function presentStaffMessage(item) {
  return {
    id: item.id,
    authorType: item.authorType,
    visibility: item.visibility,
    body: item.body,
    teacherId: item.teacherId || null,
    teacherName: item.author ? item.author.name : null,
    emailStatus: item.emailStatus || null,
    createdAt: item.createdAt,
  };
}

function presentStaff(item, messages) {
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
    status: item.status || 'open',
    statusLabel: statusLabel(item.status || 'open'),
    replyRequested: item.replyRequested !== false,
    assignedTeacherId: item.assignedTeacherId || null,
    assigneeName: item.assignee ? item.assignee.name : null,
    closedAt: item.closedAt || null,
    messages: (messages || []).map(presentStaffMessage),
  };
}

function presentStudentMessage(item) {
  return {
    id: item.id,
    authorLabel: item.authorType === 'staff' ? '英語中心' : '你',
    body: item.body,
    createdAt: item.createdAt,
  };
}

function presentStudent(item, messages) {
  const visible = (messages || []).filter((entry) => entry.visibility === 'public');
  return {
    id: item.id,
    kind: item.kind,
    kindLabel: kindLabel(item.kind),
    category: item.category,
    categoryLabel: categoryLabel(item.category),
    message: item.message,
    createdAt: item.createdAt,
    status: item.status || 'open',
    statusLabel: statusLabel(item.status || 'open'),
    replyRequested: item.replyRequested !== false,
    closedAt: item.closedAt || null,
    messages: visible.map(presentStudentMessage),
  };
}

async function submitStudentFeedback({ account, kind, category, message, replyRequested }) {
  assertActivated(account);
  const text = assertInput({ kind, category, message });
  const wantsReply = parseReplyRequested(replyRequested);
  assertUnderLimit(await countRecentStudentWrites(account.studentId));

  const row = await StudentFeedback.create({
    studentId: account.studentId,
    studentName: account.name || '',
    email: account.email || '',
    emailVerified: true,
    kind,
    category,
    message: text,
    emailStatus: 'pending',
    status: 'open',
    replyRequested: wantsReply,
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
      emailVerified: true,
      replyRequested: wantsReply,
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
    status: 'open',
    replyRequested: wantsReply,
    emailStatus,
    message: emailStatus === 'sent' ? RECEIPT_SENT : RECEIPT_SAVED,
  };
}

async function findMessageIds(term) {
  const rows = await StudentFeedbackMessage.findAll({
    where: { body: { [Op.like]: term } },
    attributes: ['feedbackId'],
  });
  return [...new Set(rows.map((row) => plain(row).feedbackId).filter(Boolean))];
}

function buildAdminWhere(filters, messageIds) {
  const where = {};
  if (filters.kind) {
    if (!KIND_LABELS[filters.kind]) throw invalid('類型不正確');
    where.kind = filters.kind;
  }
  if (filters.status) {
    if (!STATUS_LABELS[filters.status]) throw invalid('狀態不正確');
    where.status = filters.status;
  }
  if (filters.category) {
    if (!CATEGORY_LABELS[filters.category]) throw invalid('項目不正確');
    where.category = filters.category;
  }
  if (filters.assignedTeacherId === 'none') {
    where.assignedTeacherId = null;
  } else if (filters.assignedTeacherId) {
    const id = Number(filters.assignedTeacherId);
    if (!Number.isInteger(id) || id <= 0) throw invalid('承辦人不正確');
    where.assignedTeacherId = id;
  }
  const from = parseDay(filters.from, '開始日期', false);
  const to = parseDay(filters.to, '結束日期', true);
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt[Op.gte] = from;
    if (to) where.createdAt[Op.lte] = to;
  }
  const term = likeTerm(filters.q);
  if (term) {
    const or = [
      { studentId: { [Op.like]: term } },
      { studentName: { [Op.like]: term } },
      { message: { [Op.like]: term } },
    ];
    if (messageIds.length) or.push({ id: { [Op.in]: messageIds } });
    where[Op.or] = or;
  }
  return where;
}

async function listStudentFeedback(filters = {}) {
  const page = parsePage(filters.page);
  const pageSize = parsePageSize(filters.pageSize);
  const term = likeTerm(filters.q);
  const messageIds = term ? await findMessageIds(term) : [];
  const where = buildAdminWhere(filters, messageIds);
  const result = await StudentFeedback.findAndCountAll({
    where,
    include: [{ model: Teacher, as: 'assignee', attributes: ['id', 'name'], required: false }],
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    distinct: true,
  });
  const rows = result.rows || [];
  return {
    items: rows.map((row) => {
      const item = presentStaff(plain(row), []);
      delete item.messages;
      return item;
    }),
    page,
    pageSize,
    total: result.count || 0,
  };
}

async function loadMessages(feedbackId, { publicOnly } = {}) {
  const where = { feedbackId };
  if (publicOnly) where.visibility = 'public';
  const rows = await StudentFeedbackMessage.findAll({
    where,
    order: [['createdAt', 'ASC'], ['id', 'ASC']],
    include: publicOnly ? [] : [{ model: Teacher, as: 'author', attributes: ['id', 'name'], required: false }],
  });
  return rows.map(plain);
}

async function loadCase(id) {
  const row = await StudentFeedback.findByPk(parseId(id), {
    include: [{ model: Teacher, as: 'assignee', attributes: ['id', 'name'], required: false }],
  });
  if (!row) throw new StudentFeedbackError(404, 'STUDENT_FEEDBACK_NOT_FOUND', '找不到這筆回報');
  return row;
}

async function getStudentFeedback(id) {
  const row = await loadCase(id);
  const item = plain(row);
  const messages = await loadMessages(item.id);
  return presentStaff(item, messages);
}

async function hasPublicStaffReply(feedbackId) {
  const count = await StudentFeedbackMessage.count({
    where: { feedbackId, authorType: 'staff', visibility: 'public' },
  });
  return count > 0;
}

async function listFeedbackAssignees() {
  const rows = await Teacher.findAll({
    where: {
      isActive: true,
      isDemo: false,
      [Op.or]: [
        { role: ['admin', 'office_staff'] },
        { role: 'teacher', teacherLevel: 'executive' },
      ],
    },
    attributes: ['id', 'name', 'role', 'teacherLevel', 'staffLevel'],
    order: [['name', 'ASC'], ['id', 'ASC']],
  });
  return rows.map((row) => {
    const teacher = plain(row);
    return {
      id: teacher.id,
      name: teacher.name,
      roleLabel: assigneeRoleLabel(teacher),
    };
  });
}

async function addStaffReply({ id, teacher, message }) {
  const text = assertNote(message, '請寫下回覆內容');
  const row = await loadCase(id);
  const item = plain(row);
  const created = await StudentFeedbackMessage.create({
    feedbackId: item.id,
    authorType: 'staff',
    visibility: 'public',
    body: text,
    teacherId: teacher && teacher.id ? teacher.id : null,
    emailStatus: 'pending',
  });
  const nextStatus = item.status === 'closed' || item.status === 'open' ? 'in_progress' : item.status;
  await row.update({
    status: nextStatus || 'in_progress',
    closedAt: null,
  });

  let emailStatus = 'failed';
  try {
    await sendEmailWithLog('studentFeedbackReply', {
      studentEmail: item.email,
      studentName: item.studentName,
      studentId: item.studentId,
      kindLabel: kindLabel(item.kind),
      categoryLabel: categoryLabel(item.category),
      accountUrl: accountPageUrl(),
    }, {
      requestId: `student-feedback-reply:${item.id}:${created.id}`,
      relatedEntityType: 'student_feedback',
      relatedEntityId: item.id,
    });
    emailStatus = 'sent';
  } catch {
    emailStatus = 'failed';
  }
  if (typeof created.update === 'function') await created.update({ emailStatus });

  return {
    item: await getStudentFeedback(item.id),
    emailStatus,
    notice: emailStatus === 'sent'
      ? '已回覆，並寄信通知學生。'
      : '已回覆。通知信沒有寄出，學生仍可在我的帳號看到。',
  };
}

async function addStaffNote({ id, teacher, message }) {
  const text = assertNote(message, '請寫下備註');
  const row = await loadCase(id);
  const item = plain(row);
  await StudentFeedbackMessage.create({
    feedbackId: item.id,
    authorType: 'staff',
    visibility: 'internal',
    body: text,
    teacherId: teacher && teacher.id ? teacher.id : null,
  });
  if (item.status === 'open') {
    await row.update({ status: 'in_progress', closedAt: null });
  }
  return getStudentFeedback(item.id);
}

async function updateStudentFeedbackCase({ id, patch = {} }) {
  const hasStatus = Object.prototype.hasOwnProperty.call(patch, 'status') && patch.status != null && patch.status !== '';
  const hasAssignee = Object.prototype.hasOwnProperty.call(patch, 'assignedTeacherId');
  if (!hasStatus && !hasAssignee) throw invalid('沒有要更新的內容');

  const row = await loadCase(id);
  const item = plain(row);
  const changes = {};

  if (hasAssignee) {
    if (patch.assignedTeacherId == null || patch.assignedTeacherId === '') {
      changes.assignedTeacherId = null;
    } else {
      const teacherId = Number(patch.assignedTeacherId);
      if (!Number.isInteger(teacherId) || teacherId <= 0) throw invalid('承辦人不正確');
      const assignee = await Teacher.findByPk(teacherId);
      const teacher = plain(assignee);
      if (!isAssignable(teacher)) throw invalid('這位同仁目前不能承接');
      changes.assignedTeacherId = teacher.id;
      if (item.status === 'open' && !hasStatus) changes.status = 'in_progress';
    }
  }

  if (hasStatus) {
    if (!STATUS_LABELS[patch.status] || patch.status === 'open') throw invalid('狀態不正確');
    if (patch.status === 'closed') {
      const wantsReply = item.replyRequested !== false;
      if (wantsReply && !(await hasPublicStaffReply(item.id))) {
        throw new StudentFeedbackError(
          409,
          'STUDENT_FEEDBACK_REPLY_REQUIRED',
          '這位學生希望得到回覆。請先寫一則學生看得到的回覆，再結案。',
        );
      }
      changes.status = 'closed';
      changes.closedAt = new Date();
    } else {
      changes.status = 'in_progress';
      changes.closedAt = null;
    }
  }

  await row.update(changes);
  return getStudentFeedback(item.id);
}

async function listMyStudentFeedback({ account, page, pageSize }) {
  assertActivated(account);
  const currentPage = parsePage(page);
  const size = parsePageSize(pageSize);
  const result = await StudentFeedback.findAndCountAll({
    where: { studentId: account.studentId },
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit: size,
    offset: (currentPage - 1) * size,
  });
  return {
    items: (result.rows || []).map((row) => {
      const item = presentStudent(plain(row), []);
      delete item.messages;
      return item;
    }),
    page: currentPage,
    pageSize: size,
    total: result.count || 0,
  };
}

async function loadOwnCase(account, id) {
  assertActivated(account);
  const row = await StudentFeedback.findByPk(parseId(id));
  const item = plain(row);
  if (!item || item.studentId !== account.studentId) {
    throw new StudentFeedbackError(404, 'STUDENT_FEEDBACK_NOT_FOUND', '找不到這筆回報');
  }
  return row;
}

async function getMyStudentFeedback({ account, id }) {
  const row = await loadOwnCase(account, id);
  const messages = await loadMessages(plain(row).id, { publicOnly: true });
  return presentStudent(plain(row), messages);
}

async function addStudentFollowUp({ account, id, message }) {
  const text = assertNote(message, '請寫下要補充的內容');
  const row = await loadOwnCase(account, id);
  assertUnderLimit(await countRecentStudentWrites(account.studentId));
  const item = plain(row);
  await StudentFeedbackMessage.create({
    feedbackId: item.id,
    authorType: 'student',
    visibility: 'public',
    body: text,
    studentId: account.studentId,
  });
  if (item.status === 'closed') {
    await row.update({ status: 'in_progress', closedAt: null });
  }
  return getMyStudentFeedback({ account, id: item.id });
}

module.exports = {
  CENTER_EMAIL,
  CENTER_PHONE,
  CENTER_HOURS,
  KIND_LABELS,
  CATEGORY_LABELS,
  STATUS_LABELS,
  RECEIPT_SENT,
  RECEIPT_SAVED,
  StudentFeedbackError,
  submitStudentFeedback,
  listStudentFeedback,
  getStudentFeedback,
  addStaffReply,
  addStaffNote,
  updateStudentFeedbackCase,
  listFeedbackAssignees,
  listMyStudentFeedback,
  getMyStudentFeedback,
  addStudentFollowUp,
};
