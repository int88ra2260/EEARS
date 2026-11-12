'use strict';

const { Op, fn, col, literal } = require('sequelize');
const {
  sequelize,
  StudentFeedback,
  StudentFeedbackMessage,
  StudentFeedbackEvent,
  Teacher,
} = require('../models');
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
  learning_journey: '學習歷程',
  display: '介面顯示',
  other: '其他',
});

const PRIORITY_LABELS = Object.freeze({
  P0: 'P0（最優先）',
  P1: 'P1（高）',
  P2: 'P2（中）',
  P3: 'P3（低）',
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

function priorityLabel(priority) {
  if (priority == null || priority === '') return '未設定';
  return PRIORITY_LABELS[priority] || String(priority);
}

function samePriority(left, right) {
  const normalize = (value) => (value == null || value === '' ? null : String(value));
  return normalize(left) === normalize(right);
}

function invalid(message) {
  return new StudentFeedbackError(400, 'STUDENT_FEEDBACK_INVALID', message);
}

function publicOrigin() {
  const fallback = 'http://emieears-siwan.nsysu.edu.tw';
  try {
    const parsed = new URL(process.env.FRONTEND_URL || fallback);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fallback;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return fallback;
  }
}

function accountPageUrl() {
  return `${publicOrigin()}/student/account`;
}

function adminFeedbackUrl() {
  return `${publicOrigin()}/admin/student-feedback`;
}

function plain(row) {
  if (!row) return null;
  if (typeof row.get === 'function') return row.get({ plain: true });
  return row;
}

function sameId(left, right) {
  if (left == null && right == null) return true;
  return Number(left) === Number(right);
}

function actorFieldsFrom(actor) {
  if (actor && actor.studentId) {
    return {
      actorType: 'student',
      actorTeacherId: null,
      actorStudentId: String(actor.studentId).slice(0, 20),
    };
  }
  const teacherId = actor ? Number(actor.id) : NaN;
  return {
    actorType: 'staff',
    actorTeacherId: Number.isInteger(teacherId) && teacherId > 0 ? teacherId : null,
    actorStudentId: null,
  };
}

async function withTransaction(work) {
  const transaction = await sequelize.transaction();
  try {
    const result = await work(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

function eventValue(eventType, value) {
  const source = value && typeof value === 'object' ? value : {};
  if (eventType === 'STATUS_CHANGED') return { status: source.status || null };
  if (eventType === 'ASSIGNEE_CHANGED') {
    return { assignedTeacherId: source.assignedTeacherId == null ? null : Number(source.assignedTeacherId) };
  }
  if (eventType === 'PRIORITY_CHANGED') {
    return { priority: source.priority == null || source.priority === '' ? null : String(source.priority) };
  }
  return {};
}

function presentEvent(item) {
  return {
    id: item.id,
    feedbackId: item.feedbackId,
    eventType: item.eventType,
    actorType: item.actorType,
    actorTeacherId: item.actorTeacherId || null,
    actorStudentId: item.actorStudentId || null,
    beforeValue: eventValue(item.eventType, item.beforeValue),
    afterValue: eventValue(item.eventType, item.afterValue),
    requestId: item.requestId || null,
    createdAt: item.createdAt,
  };
}

async function persistCaseChanges(row, item, changes, actor, requestId, transaction) {
  const persisted = {};
  const events = [];
  const actorFields = actorFieldsFrom(actor);
  const stamp = new Date();
  const request = requestId ? String(requestId).slice(0, 64) : null;
  if (Object.prototype.hasOwnProperty.call(changes, 'status') && changes.status !== item.status) {
    persisted.status = changes.status;
    persisted.closedAt = Object.prototype.hasOwnProperty.call(changes, 'closedAt') ? changes.closedAt : null;
    events.push({
      feedbackId: item.id,
      eventType: 'STATUS_CHANGED',
      visibility: 'staff',
      ...actorFields,
      beforeValue: { status: item.status || 'open' },
      afterValue: { status: changes.status },
      requestId: request,
      createdAt: stamp,
    });
  }
  if (
    Object.prototype.hasOwnProperty.call(changes, 'assignedTeacherId')
    && !sameId(changes.assignedTeacherId, item.assignedTeacherId)
  ) {
    persisted.assignedTeacherId = changes.assignedTeacherId;
    events.push({
      feedbackId: item.id,
      eventType: 'ASSIGNEE_CHANGED',
      visibility: 'staff',
      ...actorFields,
      beforeValue: { assignedTeacherId: item.assignedTeacherId || null },
      afterValue: { assignedTeacherId: changes.assignedTeacherId },
      requestId: request,
      createdAt: stamp,
    });
  }
  if (
    Object.prototype.hasOwnProperty.call(changes, 'priority')
    && !samePriority(changes.priority, item.priority)
  ) {
    persisted.priority = changes.priority;
    events.push({
      feedbackId: item.id,
      eventType: 'PRIORITY_CHANGED',
      visibility: 'staff',
      ...actorFields,
      beforeValue: { priority: item.priority || null },
      afterValue: { priority: changes.priority },
      requestId: request,
      createdAt: stamp,
    });
  }
  if (!events.length) return false;
  await row.update(persisted, { transaction });
  await StudentFeedbackEvent.bulkCreate(events, { transaction });
  return true;
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
    priority: item.priority || null,
    priorityLabel: priorityLabel(item.priority),
    closedAt: item.closedAt || null,
    updatedAt: item.updatedAt || null,
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
      caseId: row.id,
      adminUrl: adminFeedbackUrl(),
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

async function findMessageIds(term, { publicOnly = false } = {}) {
  const where = { body: { [Op.like]: term } };
  if (publicOnly) where.visibility = 'public';
  const rows = await StudentFeedbackMessage.findAll({
    where,
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
  if (filters.priority) {
    if (filters.priority === 'unset') where.priority = null;
    else if (!PRIORITY_LABELS[filters.priority]) throw invalid('優先級不正確');
    else where.priority = filters.priority;
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

const SORT_FIELDS = Object.freeze({
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  id: 'id',
  priority: 'priority',
});
const PRIORITY_NULLS_LAST = literal('CASE WHEN `StudentFeedback`.`priority` IS NULL THEN 1 ELSE 0 END');

function parseSort(sortBy, sortOrder) {
  const field = sortBy === undefined || sortBy === null || sortBy === '' ? 'createdAt' : String(sortBy);
  const direction = sortOrder === undefined || sortOrder === null || sortOrder === ''
    ? 'desc'
    : String(sortOrder).toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(SORT_FIELDS, field)) throw invalid('排序欄位不正確');
  if (direction !== 'asc' && direction !== 'desc') throw invalid('排序方向不正確');
  const primary = [SORT_FIELDS[field], direction.toUpperCase()];
  if (field === 'id') return [primary];
  if (field === 'priority') return [[PRIORITY_NULLS_LAST, 'ASC'], primary, ['id', 'DESC']];
  return [primary, ['id', 'DESC']];
}

async function summarizeStudentFeedback() {
  const rows = await StudentFeedback.findAll({
    attributes: ['status', [fn('COUNT', col('StudentFeedback.id')), 'n']],
    group: ['status'],
    raw: true,
  });
  const known = { open: 0, in_progress: 0, closed: 0 };
  let total = 0;
  (rows || []).forEach((row) => {
    const count = Number(row.n) || 0;
    total += count;
    if (Object.prototype.hasOwnProperty.call(known, row.status)) known[row.status] = count;
  });
  return {
    total,
    open: known.open,
    inProgress: known.in_progress,
    closed: known.closed,
    unresolved: known.open + known.in_progress,
  };
}

async function listStudentFeedback(filters = {}) {
  const page = parsePage(filters.page);
  const pageSize = parsePageSize(filters.pageSize);
  const term = likeTerm(filters.q);
  const messageIds = term ? await findMessageIds(term, { publicOnly: filters.includeInternal !== true }) : [];
  const where = buildAdminWhere(filters, messageIds);
  const order = parseSort(filters.sortBy, filters.sortOrder);
  const result = await StudentFeedback.findAndCountAll({
    where,
    include: [{ model: Teacher, as: 'assignee', attributes: ['id', 'name'], required: false }],
    order,
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

async function loadCaseLocked(id, transaction) {
  const row = await StudentFeedback.findByPk(parseId(id), {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!row) throw new StudentFeedbackError(404, 'STUDENT_FEEDBACK_NOT_FOUND', '找不到這筆回報');
  return row;
}

async function getStudentFeedback(id, options = {}) {
  const includeInternal = options.includeInternal === true;
  const row = await loadCase(id);
  const item = plain(row);
  const messages = await loadMessages(item.id, { publicOnly: !includeInternal });
  const visible = includeInternal
    ? messages
    : messages.filter((entry) => entry.visibility === 'public');
  return presentStaff(item, visible);
}

async function listStudentFeedbackEvents(id, options = {}) {
  const row = await loadCase(id);
  const page = parsePage(options.page);
  const pageSize = parsePageSize(options.pageSize);
  const where = { feedbackId: plain(row).id };
  if (options.includeInternal !== true) where.visibility = 'staff';
  const result = await StudentFeedbackEvent.findAndCountAll({
    where,
    order: [['createdAt', 'ASC'], ['id', 'ASC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return {
    items: (result.rows || []).map((entry) => presentEvent(plain(entry))),
    page,
    pageSize,
    total: result.count || 0,
  };
}

async function hasPublicStaffReply(feedbackId, transaction) {
  const count = await StudentFeedbackMessage.count({
    where: { feedbackId, authorType: 'staff', visibility: 'public' },
    transaction,
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

async function addStaffReply({ id, teacher, message, requestId }) {
  const text = assertNote(message, '請寫下回覆內容');
  const saved = await withTransaction(async (transaction) => {
    const row = await loadCaseLocked(id, transaction);
    const item = plain(row);
    const created = await StudentFeedbackMessage.create({
      feedbackId: item.id,
      authorType: 'staff',
      visibility: 'public',
      body: text,
      teacherId: teacher && teacher.id ? teacher.id : null,
      emailStatus: 'pending',
    }, { transaction });
    const nextStatus = item.status === 'closed' || item.status === 'open' ? 'in_progress' : item.status;
    if (nextStatus !== item.status) {
      await persistCaseChanges(row, item, {
        status: nextStatus || 'in_progress',
        closedAt: null,
      }, teacher, requestId, transaction);
    }
    return { created, item };
  });
  const { created, item } = saved;

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
    item: await getStudentFeedback(item.id, { includeInternal: true }),
    emailStatus,
    notice: emailStatus === 'sent'
      ? '已回覆，並寄信通知學生。'
      : '已回覆。通知信沒有寄出，學生仍可在我的帳號看到。',
  };
}

async function addStaffNote({ id, teacher, message, requestId }) {
  const text = assertNote(message, '請寫下備註');
  const caseId = await withTransaction(async (transaction) => {
    const row = await loadCaseLocked(id, transaction);
    const item = plain(row);
    await StudentFeedbackMessage.create({
      feedbackId: item.id,
      authorType: 'staff',
      visibility: 'internal',
      body: text,
      teacherId: teacher && teacher.id ? teacher.id : null,
    }, { transaction });
    if (item.status === 'open') {
      await persistCaseChanges(row, item, {
        status: 'in_progress',
        closedAt: null,
      }, teacher, requestId, transaction);
    }
    return item.id;
  });
  return getStudentFeedback(caseId, { includeInternal: true });
}

async function updateStudentFeedbackCase({ id, patch = {}, actor, requestId } = {}) {
  const hasStatus = Object.prototype.hasOwnProperty.call(patch, 'status') && patch.status != null && patch.status !== '';
  const hasAssignee = Object.prototype.hasOwnProperty.call(patch, 'assignedTeacherId');
  const hasPriority = Object.prototype.hasOwnProperty.call(patch, 'priority');
  if (!hasStatus && !hasAssignee && !hasPriority) throw invalid('沒有要更新的內容');
  if (hasStatus && (!STATUS_LABELS[patch.status] || patch.status === 'open')) throw invalid('狀態不正確');

  let nextPriority;
  if (hasPriority) {
    if (patch.priority == null || patch.priority === '' || patch.priority === 'unset') {
      nextPriority = null;
    } else if (!PRIORITY_LABELS[patch.priority]) {
      throw invalid('優先級不正確');
    } else {
      nextPriority = patch.priority;
    }
  }

  let nextAssignee;
  if (hasAssignee) {
    if (patch.assignedTeacherId == null || patch.assignedTeacherId === '') {
      nextAssignee = null;
    } else {
      const teacherId = Number(patch.assignedTeacherId);
      if (!Number.isInteger(teacherId) || teacherId <= 0) throw invalid('承辦人不正確');
      const assignee = await Teacher.findByPk(teacherId);
      const teacher = plain(assignee);
      if (!isAssignable(teacher)) throw invalid('這位同仁目前不能承接');
      nextAssignee = teacher.id;
    }
  }

  const caseId = await withTransaction(async (transaction) => {
    const row = await loadCaseLocked(id, transaction);
    const item = plain(row);
    const changes = {};

    if (hasAssignee && !sameId(nextAssignee, item.assignedTeacherId)) {
      changes.assignedTeacherId = nextAssignee;
      if (item.status === 'open' && !hasStatus) {
        changes.status = 'in_progress';
        changes.closedAt = null;
      }
    }

    if (hasPriority) changes.priority = nextPriority;

    if (hasStatus) {
      if (patch.status === 'closed') {
        const wantsReply = item.replyRequested !== false;
        if (wantsReply && !(await hasPublicStaffReply(item.id, transaction))) {
          throw new StudentFeedbackError(
            409,
            'STUDENT_FEEDBACK_REPLY_REQUIRED',
            '這位學生希望得到回覆。請先寫一則學生看得到的回覆，再結案。',
          );
        }
        if (item.status !== 'closed') {
          changes.status = 'closed';
          changes.closedAt = new Date();
        }
      } else if (item.status !== 'in_progress') {
        changes.status = 'in_progress';
        changes.closedAt = null;
      }
    }

    await persistCaseChanges(row, item, changes, actor, requestId, transaction);
    return item.id;
  });
  return getStudentFeedback(caseId, { includeInternal: true });
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

async function addStudentFollowUp({ account, id, message, requestId }) {
  assertActivated(account);
  const text = assertNote(message, '請寫下要補充的內容');
  assertUnderLimit(await countRecentStudentWrites(account.studentId));
  const caseId = await withTransaction(async (transaction) => {
    const row = await loadCaseLocked(id, transaction);
    const item = plain(row);
    if (!item || item.studentId !== account.studentId) {
      throw new StudentFeedbackError(404, 'STUDENT_FEEDBACK_NOT_FOUND', '找不到這筆回報');
    }
    await StudentFeedbackMessage.create({
      feedbackId: item.id,
      authorType: 'student',
      visibility: 'public',
      body: text,
      studentId: account.studentId,
    }, { transaction });
    if (item.status === 'closed') {
      await persistCaseChanges(row, item, {
        status: 'in_progress',
        closedAt: null,
      }, account, requestId, transaction);
    }
    return item.id;
  });
  return getMyStudentFeedback({ account, id: caseId });
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
  summarizeStudentFeedback,
  listStudentFeedback,
  getStudentFeedback,
  listStudentFeedbackEvents,
  addStaffReply,
  addStaffNote,
  updateStudentFeedbackCase,
  listFeedbackAssignees,
  listMyStudentFeedback,
  getMyStudentFeedback,
  addStudentFollowUp,
};
