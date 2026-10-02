'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  EnglishTestRegistration,
  EnglishTestMailTemplate,
  EnglishTestMailSend,
  EnglishTestMailBin,
  EnglishTestMailBinMember,
} = require('../models');
const { EMAIL_TEMPLATE_CATALOG } = require('./emailTemplateCatalog');
const {
  buildMailOptions,
  enrichMailVars,
  interpolateTemplate,
} = require('./emailTemplateService');
const { sendRawMail } = require('../config/email');
const {
  looksLikeHtml,
  sanitizeEmailHtml,
  htmlToPlainText,
  wrapEmailDocument,
} = require('../utils/emailTemplateHtml');
const logger = require('../utils/logger');

const MAX_BATCH = 200;
const MAX_TEMPLATES = 100;
const MAX_BINS = 10;
const MAX_BIN_MEMBERS = 200;
const DEFAULT_BIN_NAMES = ['寄件區1', '寄件區2', '寄件區3'];
/** 自訂／貼上內容走培力英檢寄件帳號，不對應郵件設定裡的某一封 */
const MANUAL_TRANSPORT_KEY = 'englishTestManualSend';

const EXCLUDED_CATALOG_KEYS = new Set([
  'englishTestEmailVerification',
  'englishTestRegistrationUpdated',
]);

function fail(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code || 'BAD_REQUEST';
  return err;
}

function clip(value, max) {
  if (value == null) return null;
  const text = String(value);
  return text.length > max ? text.slice(0, max) : text;
}

function listSelectableCatalogTemplates() {
  return EMAIL_TEMPLATE_CATALOG
    .filter((entry) => entry.category === 'english_test' && !EXCLUDED_CATALOG_KEYS.has(entry.key))
    .map((entry) => ({
      key: entry.key,
      name: entry.name,
      description: entry.description || '',
    }));
}

function serializeTemplate(row) {
  return {
    id: row.id,
    name: row.name,
    subjectTemplate: row.subjectTemplate,
    bodyTemplate: row.bodyTemplate,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
  };
}

function serializeSend(row) {
  return {
    id: row.id,
    batchId: row.batchId,
    registrationId: row.registrationId,
    studentId: row.studentId,
    studentName: row.studentName,
    email: row.email,
    sourceType: row.sourceType,
    versionLabel: row.versionLabel,
    templateKey: row.templateKey,
    customTemplateId: row.customTemplateId,
    subject: row.subject,
    status: row.status,
    errorMessage: row.errorMessage,
    sentByUserId: row.sentByUserId,
    sentAt: row.sentAt,
  };
}

function parseIds(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw fail(400, '請選擇至少一位學生', 'IDS_REQUIRED');
  }
  if (raw.length > MAX_BATCH) {
    throw fail(400, `一次最多寄給 ${MAX_BATCH} 人`, 'TOO_MANY_IDS');
  }
  const ids = [];
  const seen = new Set();
  for (const item of raw) {
    const n = Number(item);
    if (!Number.isInteger(n) || n <= 0) {
      throw fail(400, '報名編號不正確', 'INVALID_ID');
    }
    if (seen.has(n)) continue;
    seen.add(n);
    ids.push(n);
  }
  return ids;
}

function assertTemplateFields({ name, subjectTemplate, bodyTemplate }) {
  const nextName = String(name || '').trim();
  const subject = String(subjectTemplate || '').trim();
  const body = String(bodyTemplate || '').trim();
  if (!nextName || nextName.length > 80) {
    throw fail(400, '請填寫範本名稱（80 字以內）', 'INVALID_TEMPLATE_NAME');
  }
  if (!subject || subject.length > 200) {
    throw fail(400, '請填寫主旨（200 字以內）', 'INVALID_SUBJECT');
  }
  if (!body || body.length > 20000) {
    throw fail(400, '請填寫內文（20000 字以內）', 'INVALID_BODY');
  }
  return { name: nextName, subjectTemplate: subject, bodyTemplate: body };
}

function registrationMailData(reg) {
  return {
    studentId: reg.studentId,
    studentName: reg.name,
    studentNameZh: reg.studentNameZh || reg.name,
    lastNameEn: reg.lastNameEn || '',
    firstNameEn: reg.firstNameEn || '',
    name: reg.name,
    idNumber: reg.idNumber || reg.nationalId,
    nationalId: reg.nationalId || reg.idNumber,
    email: reg.email,
    studentEmail: reg.email,
    phone: reg.phone || '',
    registrationId: reg.id,
    registrationDate: reg.createdAt,
    status: reg.status,
    examType: reg.examType,
    hasCEFRB2: reg.hasCEFRB2 || '否',
    listeningExamType: reg.listeningExamType,
    listeningScore: reg.listeningScore,
    readingExamType: reg.readingExamType,
    readingScore: reg.readingScore,
    speakingExamType: reg.speakingExamType,
    speakingScore: reg.speakingScore,
    writingExamType: reg.writingExamType,
    writingScore: reg.writingScore,
    rejectionReasons: reg.rejectionReasons,
    rejectionOther: reg.rejectionOther,
    registrationShortLink: process.env.BESTEP_GROUP_REGISTRATION_LINK
      || 'http://emieears-siwan.nsysu.edu.tw/register/english-test/group',
  };
}

function buildCustomMail(subjectTemplate, bodyTemplate, data) {
  const vars = enrichMailVars(data);
  const subject = interpolateTemplate(subjectTemplate, vars);
  const rendered = interpolateTemplate(bodyTemplate, vars);
  const mail = { to: data.email, subject: clip(subject, 500) };
  if (looksLikeHtml(rendered)) {
    const safe = sanitizeEmailHtml(rendered);
    mail.html = wrapEmailDocument(safe);
    mail.text = htmlToPlainText(safe);
  } else {
    mail.text = rendered;
  }
  return mail;
}

async function composeMail(content, data) {
  if (content.sourceType === 'catalog') {
    const mail = await buildMailOptions(content.templateKey, data);
    mail.to = data.email;
    return { transportKey: content.templateKey, mail };
  }
  return {
    transportKey: MANUAL_TRANSPORT_KEY,
    mail: buildCustomMail(content.subjectTemplate, content.bodyTemplate, data),
  };
}

async function resolveContent(input) {
  const source = String(input.source || '').trim();
  if (source === 'catalog') {
    const key = String(input.templateKey || '').trim();
    const entry = listSelectableCatalogTemplates().find((item) => item.key === key);
    if (!entry) {
      throw fail(400, '請選擇郵件設定中的培力英檢信件', 'UNKNOWN_TEMPLATE');
    }
    return {
      sourceType: 'catalog',
      templateKey: key,
      customTemplateId: null,
      versionLabel: `郵件設定：${entry.name}`,
      subjectTemplate: null,
      bodyTemplate: null,
    };
  }
  if (source === 'custom') {
    const id = Number(input.customTemplateId);
    if (!Number.isInteger(id) || id <= 0) {
      throw fail(400, '請選擇自訂範本', 'CUSTOM_TEMPLATE_REQUIRED');
    }
    const row = await EnglishTestMailTemplate.findByPk(id);
    if (!row) {
      throw fail(404, '找不到自訂範本', 'CUSTOM_TEMPLATE_NOT_FOUND');
    }
    return {
      sourceType: 'custom',
      templateKey: null,
      customTemplateId: row.id,
      versionLabel: `自訂範本：${row.name}`,
      subjectTemplate: row.subjectTemplate,
      bodyTemplate: row.bodyTemplate,
    };
  }
  if (source === 'adhoc') {
    const fields = assertTemplateFields({
      name: '本次貼上',
      subjectTemplate: input.subject,
      bodyTemplate: input.body,
    });
    return {
      sourceType: 'adhoc',
      templateKey: null,
      customTemplateId: null,
      versionLabel: '本次貼上',
      subjectTemplate: fields.subjectTemplate,
      bodyTemplate: fields.bodyTemplate,
    };
  }
  throw fail(400, '請選擇信件來源', 'INVALID_SOURCE');
}

async function writeSendLog(payload) {
  try {
    await EnglishTestMailSend.create(payload);
  } catch (error) {
    logger.error('培力英檢指定寄信紀錄寫入失敗', error);
  }
}

async function listCustomTemplates() {
  const rows = await EnglishTestMailTemplate.findAll({
    order: [['updatedAt', 'DESC'], ['id', 'DESC']],
    limit: MAX_TEMPLATES,
  });
  return rows.map(serializeTemplate);
}

async function createCustomTemplate({ name, subjectTemplate, bodyTemplate, userId }) {
  const fields = assertTemplateFields({ name, subjectTemplate, bodyTemplate });
  const row = await EnglishTestMailTemplate.create({
    ...fields,
    updatedByUserId: userId || null,
  });
  return serializeTemplate(row);
}

async function updateCustomTemplate(id, { name, subjectTemplate, bodyTemplate, userId }) {
  const templateId = Number(id);
  const row = await EnglishTestMailTemplate.findByPk(templateId);
  if (!row) throw fail(404, '找不到自訂範本', 'CUSTOM_TEMPLATE_NOT_FOUND');
  const fields = assertTemplateFields({ name, subjectTemplate, bodyTemplate });
  await row.update({
    ...fields,
    updatedByUserId: userId || null,
  });
  return serializeTemplate(row);
}

async function deleteCustomTemplate(id) {
  const templateId = Number(id);
  const row = await EnglishTestMailTemplate.findByPk(templateId);
  if (!row) throw fail(404, '找不到自訂範本', 'CUSTOM_TEMPLATE_NOT_FOUND');
  await row.destroy();
  return { ok: true };
}

async function listSendLogs({ page = 1, limit = 30, studentId, registrationId } = {}) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 30));
  const where = {};
  const sid = String(studentId || '').trim();
  if (sid) where.studentId = { [Op.like]: `%${sid.replace(/[%_]/g, '')}%` };
  const regId = Number(registrationId);
  if (Number.isInteger(regId) && regId > 0) where.registrationId = regId;

  const { rows, count } = await EnglishTestMailSend.findAndCountAll({
    where,
    order: [['sentAt', 'DESC'], ['id', 'DESC']],
    limit: limitNum,
    offset: (pageNum - 1) * limitNum,
  });

  return {
    data: rows.map(serializeSend),
    page: pageNum,
    limit: limitNum,
    total: count,
  };
}

async function sendToSelected({
  ids,
  source,
  templateKey,
  customTemplateId,
  subject,
  body,
  userId,
  requestId,
}) {
  const registrationIds = parseIds(ids);
  const content = await resolveContent({ source, templateKey, customTemplateId, subject, body });
  const rows = await EnglishTestRegistration.findAll({
    where: { id: registrationIds },
  });
  const byId = new Map(rows.map((row) => [Number(row.id), row]));
  const batchId = crypto.randomUUID();
  const sentAt = new Date();
  let sent = 0;
  let failed = 0;

  for (const id of registrationIds) {
    const reg = byId.get(id);
    const baseLog = {
      batchId,
      registrationId: id,
      studentId: clip(reg?.studentId, 32),
      studentName: clip(reg?.studentNameZh || reg?.name, 120),
      email: clip(reg?.email, 255),
      sourceType: content.sourceType,
      versionLabel: clip(content.versionLabel, 160),
      templateKey: content.templateKey,
      customTemplateId: content.customTemplateId,
      sentByUserId: userId || null,
      sentAt,
    };

    if (!reg) {
      failed += 1;
      await writeSendLog({
        ...baseLog,
        subject: null,
        status: 'failed',
        errorMessage: '找不到報名資料',
      });
      continue;
    }

    const recipient = String(reg.email || '').trim();
    if (!recipient.includes('@')) {
      failed += 1;
      await writeSendLog({
        ...baseLog,
        email: clip(recipient, 255),
        subject: null,
        status: 'failed',
        errorMessage: '沒有可用的信箱',
      });
      continue;
    }

    try {
      const data = registrationMailData(reg);
      data.email = recipient;
      data.studentEmail = recipient;
      const { transportKey, mail } = await composeMail(content, data);
      mail.to = recipient;
      await sendRawMail(transportKey, mail);
      sent += 1;
      await writeSendLog({
        ...baseLog,
        email: recipient,
        subject: clip(mail.subject, 500),
        status: 'success',
        errorMessage: null,
      });
    } catch (error) {
      failed += 1;
      const message = error && error.code === 'EMAIL_TEMPLATE_DISABLED'
        ? '此郵件設定範本已停用'
        : clip(error && error.message ? error.message : '寄送失敗', 500);
      logger.error(`培力英檢指定寄信失敗 (registrationId: ${id}, requestId: ${requestId || ''})`);
      await writeSendLog({
        ...baseLog,
        email: recipient,
        subject: null,
        status: 'failed',
        errorMessage: message,
      });
    }
  }

  return {
    message: `已寄出 ${sent} 封${failed > 0 ? `，失敗 ${failed} 封` : ''}`,
    sent,
    failed,
    total: registrationIds.length,
    batchId,
    sourceType: content.sourceType,
    versionLabel: content.versionLabel,
  };
}

async function ensureDefaultMailBins() {
  const count = await EnglishTestMailBin.count();
  if (count > 0) return;
  await EnglishTestMailBin.bulkCreate(DEFAULT_BIN_NAMES.map((name, index) => ({
    name,
    sortOrder: index + 1,
  })));
}

async function listMailBins() {
  await ensureDefaultMailBins();
  const bins = await EnglishTestMailBin.findAll({
    order: [['sortOrder', 'ASC'], ['id', 'ASC']],
  });
  const binIds = bins.map((bin) => bin.id);
  const members = binIds.length
    ? await EnglishTestMailBinMember.findAll({
      where: { binId: binIds },
      order: [['id', 'ASC']],
    })
    : [];
  const registrationIds = [...new Set(members.map((member) => Number(member.registrationId)))];
  const registrations = registrationIds.length
    ? await EnglishTestRegistration.findAll({
      where: { id: registrationIds },
      attributes: ['id', 'studentId', 'name', 'studentNameZh', 'email'],
    })
    : [];
  const registrationById = new Map(registrations.map((row) => [Number(row.id), row]));
  const membersByBin = new Map();
  for (const member of members) {
    const list = membersByBin.get(member.binId) || [];
    const registration = registrationById.get(Number(member.registrationId));
    list.push({
      registrationId: member.registrationId,
      studentId: registration?.studentId || null,
      studentName: registration ? (registration.studentNameZh || registration.name || '') : null,
      email: registration?.email || null,
      missing: !registration,
    });
    membersByBin.set(member.binId, list);
  }
  return bins.map((bin) => ({
    id: bin.id,
    name: bin.name,
    sortOrder: bin.sortOrder,
    members: membersByBin.get(bin.id) || [],
  }));
}

async function createMailBin(name) {
  const nextName = String(name || '').trim();
  if (!nextName || nextName.length > 40) {
    throw fail(400, '請填寫寄件區名稱（40 字以內）', 'INVALID_BIN_NAME');
  }
  const count = await EnglishTestMailBin.count();
  if (count >= MAX_BINS) {
    throw fail(400, `最多 ${MAX_BINS} 個寄件區`, 'TOO_MANY_BINS');
  }
  const duplicate = await EnglishTestMailBin.findOne({ where: { name: nextName } });
  if (duplicate) {
    throw fail(400, '已有同名寄件區', 'DUPLICATE_BIN_NAME');
  }
  const row = await EnglishTestMailBin.create({
    name: nextName,
    sortOrder: count + 1,
  });
  return { id: row.id, name: row.name, sortOrder: row.sortOrder, members: [] };
}

async function deleteMailBin(binId) {
  const bin = await EnglishTestMailBin.findByPk(Number(binId));
  if (!bin) throw fail(404, '找不到寄件區', 'MAIL_BIN_NOT_FOUND');
  await EnglishTestMailBinMember.destroy({ where: { binId: bin.id } });
  await bin.destroy();
  return { ok: true };
}

async function addMailBinMembers(binId, ids) {
  const registrationIds = parseIds(ids);
  const bin = await EnglishTestMailBin.findByPk(Number(binId));
  if (!bin) throw fail(404, '找不到寄件區', 'MAIL_BIN_NOT_FOUND');
  const existing = await EnglishTestMailBinMember.findAll({
    where: { binId: bin.id },
    attributes: ['registrationId'],
  });
  const existingIds = new Set(existing.map((row) => Number(row.registrationId)));
  const found = await EnglishTestRegistration.findAll({
    where: { id: registrationIds },
    attributes: ['id'],
  });
  const foundIds = new Set(found.map((row) => Number(row.id)));
  if (registrationIds.some((id) => !foundIds.has(id))) {
    throw fail(400, '有勾選的報名不存在', 'REGISTRATION_NOT_FOUND');
  }
  const toAdd = registrationIds.filter((id) => !existingIds.has(id));
  if (existingIds.size + toAdd.length > MAX_BIN_MEMBERS) {
    throw fail(400, `每個寄件區最多 ${MAX_BIN_MEMBERS} 人`, 'BIN_FULL');
  }
  if (toAdd.length) {
    await EnglishTestMailBinMember.bulkCreate(toAdd.map((registrationId) => ({
      binId: bin.id,
      registrationId,
    })));
  }
  return {
    added: toAdd.length,
    skipped: registrationIds.length - toAdd.length,
    total: existingIds.size + toAdd.length,
  };
}

async function removeMailBinMembers(binId, ids) {
  const registrationIds = parseIds(ids);
  const bin = await EnglishTestMailBin.findByPk(Number(binId));
  if (!bin) throw fail(404, '找不到寄件區', 'MAIL_BIN_NOT_FOUND');
  const removed = await EnglishTestMailBinMember.destroy({
    where: { binId: bin.id, registrationId: registrationIds },
  });
  return { removed };
}

module.exports = {
  MANUAL_TRANSPORT_KEY,
  listSelectableCatalogTemplates,
  listCustomTemplates,
  createCustomTemplate,
  updateCustomTemplate,
  deleteCustomTemplate,
  listSendLogs,
  sendToSelected,
  listMailBins,
  createMailBin,
  deleteMailBin,
  addMailBinMembers,
  removeMailBinMembers,
};
