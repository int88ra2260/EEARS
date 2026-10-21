const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { secretKey } = require('../config/jwtSecret');
const {
  SpeakingHost,
  SpeakingCheckSet,
  SpeakingCheckItem,
  SpeakingCheckParticipant,
  SpeakingCheckResponse,
  sequelize,
} = require('../models');
const { buildAutomatedAnalysis } = require('./speakingDiagnosticService');
const {
  fail,
  assertPublishableSet,
  normalizeJoinCode,
  normalizeDisplayName,
  normalizeSetTitle,
} = require('./speakingCheckSetValidation');

const HOST_TOKEN_TYP = 'speaking-host';

function signHostToken(host) {
  return jwt.sign({
    typ: HOST_TOKEN_TYP,
    hostId: Number(host.id),
    username: host.username,
  }, secretKey, { expiresIn: '12h' });
}

function readHostToken(header) {
  const token = String(header || '').startsWith('Bearer ') ? String(header).slice(7).trim() : '';
  if (!token) throw fail(401, 'HOST_AUTH_REQUIRED', '請先登入');
  try {
    const decoded = jwt.verify(token, secretKey);
    if (decoded.typ !== HOST_TOKEN_TYP || !decoded.hostId) {
      throw fail(401, 'HOST_AUTH_REQUIRED', '請用口說題組帳號登入');
    }
    return decoded;
  } catch (error) {
    if (error.code === 'HOST_AUTH_REQUIRED') throw error;
    throw fail(401, 'HOST_AUTH_REQUIRED', '登入已過期，請重新登入');
  }
}

function percentOrNull(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function itemDto(item) {
  return {
    id: Number(item.id),
    position: item.position,
    title: item.title,
    targetText: item.targetText,
  };
}

function setDto(row, extras = {}) {
  const dto = {
    id: Number(row.id),
    title: row.title,
    status: row.status,
    joinCode: row.joinCode || null,
    publishedAt: row.publishedAt || null,
    updatedAt: row.updatedAt,
    itemCount: extras.itemCount ?? (row.items ? row.items.length : 0),
    participantCount: extras.participantCount ?? (row.participants ? row.participants.length : 0),
  };
  if (extras.includeItems && row.items) {
    dto.items = [...row.items].sort((a, b) => a.position - b.position).map(itemDto);
  }
  return dto;
}

async function loadOwnedSet(hostId, setId) {
  const row = await SpeakingCheckSet.findOne({
    where: { id: setId, hostId },
    include: [{ model: SpeakingCheckItem, as: 'items' }],
  });
  if (!row) throw fail(404, 'SET_NOT_FOUND', '找不到這個題組');
  return row;
}

async function replaceItems(setId, items, transaction) {
  await SpeakingCheckItem.destroy({ where: { setId }, transaction });
  await SpeakingCheckItem.bulkCreate(items.map((item, index) => ({
    setId,
    position: index + 1,
    title: item.title || `第 ${index + 1} 題`,
    targetText: item.targetText,
  })), { transaction });
}

async function loginHost({ username, password }) {
  const name = String(username || '').trim().toLowerCase();
  const host = name ? await SpeakingHost.findOne({ where: { username: name } }) : null;
  const matches = host ? await bcrypt.compare(String(password || ''), host.passwordHash) : false;
  if (!host || !matches) throw fail(401, 'HOST_LOGIN_FAILED', '帳號或密碼錯誤');
  return {
    token: signHostToken(host),
    host: { id: Number(host.id), username: host.username, displayName: host.displayName },
  };
}

async function listSets(hostId) {
  const rows = await SpeakingCheckSet.findAll({
    where: { hostId },
    order: [['updatedAt', 'DESC']],
  });
  if (!rows.length) return [];
  const setIds = rows.map((row) => row.id);
  const [itemRows, participantRows] = await Promise.all([
    SpeakingCheckItem.findAll({
      attributes: ['setId', [sequelize.fn('COUNT', sequelize.col('id')), 'itemCount']],
      where: { setId: setIds },
      group: ['setId'],
      raw: true,
    }),
    SpeakingCheckParticipant.findAll({
      attributes: ['setId', [sequelize.fn('COUNT', sequelize.col('id')), 'participantCount']],
      where: { setId: setIds },
      group: ['setId'],
      raw: true,
    }),
  ]);
  const itemCountBySet = new Map(itemRows.map((row) => [Number(row.setId), Number(row.itemCount)]));
  const participantCountBySet = new Map(participantRows.map((row) => [Number(row.setId), Number(row.participantCount)]));
  return rows.map((row) => setDto(row, {
    itemCount: itemCountBySet.get(Number(row.id)) || 0,
    participantCount: participantCountBySet.get(Number(row.id)) || 0,
  }));
}

async function createSet(hostId, body = {}) {
  const items = assertPublishableSet(body.items);
  const title = normalizeSetTitle(body.title);
  const created = await sequelize.transaction(async (transaction) => {
    const row = await SpeakingCheckSet.create({
      hostId,
      title,
      status: 'draft',
    }, { transaction });
    await replaceItems(row.id, items, transaction);
    return row.id;
  });
  return getSet(hostId, created);
}

async function updateSet(hostId, setId, body = {}) {
  const row = await loadOwnedSet(hostId, setId);
  if (row.status !== 'draft') throw fail(409, 'SET_LOCKED', '已公布的題組不能再改題目');
  const items = assertPublishableSet(body.items);
  await sequelize.transaction(async (transaction) => {
    await row.update({ title: normalizeSetTitle(body.title) }, { transaction });
    await replaceItems(row.id, items, transaction);
  });
  return getSet(hostId, setId);
}

async function getSet(hostId, setId) {
  const row = await loadOwnedSet(hostId, setId);
  const participantCount = await SpeakingCheckParticipant.count({ where: { setId: row.id } });
  return setDto(row, { participantCount, includeItems: true });
}

async function nextJoinCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    if (code === '000000') continue;
    const taken = await SpeakingCheckSet.findOne({ where: { joinCode: code } });
    if (!taken) return code;
  }
  throw fail(500, 'JOIN_CODE_EXHAUSTED', '暫時無法產生加入代碼，請再試一次');
}

async function publishSet(hostId, setId) {
  const row = await loadOwnedSet(hostId, setId);
  assertPublishableSet(row.items.map((item) => ({ title: item.title, targetText: item.targetText })));
  if (row.status === 'closed') throw fail(409, 'SET_CLOSED', '這個題組已結束');
  if (row.status === 'published' && row.joinCode) return getSet(hostId, setId);
  const joinCode = row.joinCode || await nextJoinCode();
  await row.update({ status: 'published', joinCode, publishedAt: row.publishedAt || new Date() });
  return getSet(hostId, setId);
}

async function closeSet(hostId, setId) {
  const row = await loadOwnedSet(hostId, setId);
  if (row.status === 'draft') throw fail(409, 'SET_NOT_PUBLISHED', '請先公布題組');
  await row.update({ status: 'closed' });
  return getSet(hostId, setId);
}

function responseDto(row) {
  return {
    itemId: Number(row.itemId),
    transcript: row.transcript || '',
    fluencyPercent: row.fluencyPercent,
    completionPercent: row.completionPercent,
    pronunciationPercent: row.pronunciationPercent,
    wordResults: row.wordResults || [],
    submittedAt: row.submittedAt,
  };
}

function sessionDto(participant, setRow) {
  const items = [...(setRow.items || [])].sort((a, b) => a.position - b.position);
  const responses = participant.responses || [];
  const answered = new Set(responses.map((row) => Number(row.itemId)));
  return {
    participantUid: participant.participantUid,
    displayName: participant.displayName,
    set: {
      id: Number(setRow.id),
      title: setRow.title,
      status: setRow.status,
      joinCode: setRow.joinCode,
    },
    items: items.map((item) => ({ ...itemDto(item), answered: answered.has(Number(item.id)) })),
    responses: responses.map(responseDto),
  };
}

async function joinSet(body = {}) {
  const joinCode = normalizeJoinCode(body.joinCode);
  if (joinCode.length !== 6) throw fail(400, 'JOIN_CODE_INVALID', '請輸入 6 位數加入代碼');
  const displayName = normalizeDisplayName(body.displayName);
  const clientSessionId = String(body.clientSessionId || '').trim();
  if (!/^[a-zA-Z0-9_-]{4,64}$/.test(clientSessionId)) {
    throw fail(400, 'INVALID_CLIENT_SESSION_ID', '無法建立作答階段，請重新整理頁面');
  }
  const setRow = await SpeakingCheckSet.findOne({
    where: { joinCode, status: 'published' },
    include: [{ model: SpeakingCheckItem, as: 'items' }],
  });
  if (!setRow) throw fail(404, 'SET_NOT_FOUND', '找不到這個代碼，或題組已經結束');
  const [participant] = await SpeakingCheckParticipant.findOrCreate({
    where: { setId: setRow.id, clientSessionId },
    defaults: {
      participantUid: crypto.randomUUID(),
      setId: setRow.id,
      displayName,
      clientSessionId,
      joinedAt: new Date(),
    },
  });
  if (participant.displayName !== displayName) await participant.update({ displayName });
  const withResponses = await SpeakingCheckParticipant.findByPk(participant.id, {
    include: [{ model: SpeakingCheckResponse, as: 'responses' }],
  });
  return sessionDto(withResponses, setRow);
}

async function getSession(participantUid) {
  const participant = await SpeakingCheckParticipant.findOne({
    where: { participantUid: String(participantUid || '') },
    include: [{ model: SpeakingCheckResponse, as: 'responses' }],
  });
  if (!participant) throw fail(404, 'SESSION_NOT_FOUND', '找不到這次作答，請重新加入');
  const setRow = await SpeakingCheckSet.findByPk(participant.setId, {
    include: [{ model: SpeakingCheckItem, as: 'items' }],
  });
  if (!setRow || setRow.status === 'draft') throw fail(404, 'SET_NOT_FOUND', '這個題組目前不能作答');
  return sessionDto(participant, setRow);
}

async function submitResponse(participantUid, body = {}) {
  const session = await getSession(participantUid);
  if (session.set.status !== 'published') throw fail(409, 'SET_CLOSED', '這個題組已結束，不能再送出');
  const itemId = Number(body.itemId);
  const item = session.items.find((entry) => entry.id === itemId);
  if (!item) throw fail(404, 'ITEM_NOT_FOUND', '找不到這一題');
  const participant = await SpeakingCheckParticipant.findOne({ where: { participantUid } });
  const durationMs = Number(body.durationMs);
  const transcript = String(body.transcript || '').trim().slice(0, 4000);
  const analysis = buildAutomatedAnalysis({
    task: { taskType: 'read_aloud', targetText: item.targetText, level: 'B1', prompt: 'Read aloud.' },
    transcript,
    durationMs: Number.isFinite(durationMs) ? durationMs : null,
    clientFeatures: body.clientFeatures && typeof body.clientFeatures === 'object' ? body.clientFeatures : {},
    alignment: null,
  });
  const scores = analysis.presentationScores || {};
  const payload = {
    transcript,
    durationMs: Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : null,
    fluencyPercent: percentOrNull(scores.fluencyPercent),
    completionPercent: percentOrNull(scores.completionPercent),
    pronunciationPercent: percentOrNull(scores.pronunciationPercent),
    wordResults: analysis.wordResults || [],
    submittedAt: new Date(),
  };
  const existing = await SpeakingCheckResponse.findOne({
    where: { participantId: participant.id, itemId },
  });
  if (existing) await existing.update(payload);
  else await SpeakingCheckResponse.create({ ...payload, participantId: participant.id, itemId });
  return {
    ...payload,
    itemId,
    wordResults: payload.wordResults,
  };
}

async function getResults(hostId, setId) {
  const setRow = await loadOwnedSet(hostId, setId);
  const participants = await SpeakingCheckParticipant.findAll({
    where: { setId: setRow.id },
    include: [{ model: SpeakingCheckResponse, as: 'responses' }],
    order: [['joinedAt', 'ASC']],
  });
  const items = [...setRow.items].sort((a, b) => a.position - b.position).map(itemDto);
  const rows = participants.map((participant) => {
    const byItem = new Map((participant.responses || []).map((row) => [Number(row.itemId), responseDto(row)]));
    return {
      id: Number(participant.id),
      displayName: participant.displayName,
      joinedAt: participant.joinedAt,
      completedCount: byItem.size,
      responses: items.map((item) => byItem.get(item.id) || null),
    };
  });
  return {
    set: setDto(setRow, { participantCount: rows.length, itemCount: items.length }),
    items,
    summary: {
      participantCount: rows.length,
      completedCount: rows.filter((row) => row.completedCount >= items.length && items.length > 0).length,
    },
    participants: rows,
  };
}

module.exports = {
  HOST_TOKEN_TYP,
  readHostToken,
  loginHost,
  listSets,
  createSet,
  updateSet,
  getSet,
  publishSet,
  closeSet,
  joinSet,
  getSession,
  submitResponse,
  getResults,
};
