'use strict';

const {
  TripCount,
  TripCountMember,
  TripCountExpense,
  TripCountShare,
  sequelize,
} = require('../models');
const { allocateEqualShares, settleTrip } = require('./tripCountSettlement');

const MAX_AMOUNT_CENTS = 100_000_000 * 100;

function fail(status, code, error) {
  const err = new Error(error);
  err.status = status;
  err.code = code;
  throw err;
}

function text(value, max) {
  const next = String(value || '').trim();
  if (!next || next.length > max) return null;
  return next;
}

function asCents(value) {
  const cents = Number(value);
  if (!Number.isInteger(cents) || cents <= 0 || cents > MAX_AMOUNT_CENTS) return null;
  return cents;
}

async function getOwnedTrip(tripId, userId) {
  const trip = await TripCount.findByPk(tripId);
  if (!trip || Number(trip.ownerUserId) !== Number(userId)) {
    fail(404, 'TRIP_NOT_FOUND', '找不到這趟旅程');
  }
  return trip;
}

function resolvedShares(expense, shareRows, members) {
  const memberOrder = new Map(members.map((member) => [Number(member.id), Number(member.sortOrder || 0)]));
  const rows = [...shareRows].sort((a, b) => {
    const order = (memberOrder.get(Number(a.memberId)) || 0) - (memberOrder.get(Number(b.memberId)) || 0);
    if (order !== 0) return order;
    return Number(a.memberId) - Number(b.memberId);
  });
  if (expense.splitMode === 'equal') {
    return allocateEqualShares(Number(expense.amountCents), rows.map((row) => Number(row.memberId)));
  }
  return rows.map((row) => ({
    memberId: Number(row.memberId),
    shareCents: Number(row.shareCents || 0),
  }));
}

async function buildDetail(trip) {
  const members = await TripCountMember.findAll({
    where: { tripId: trip.id },
    order: [['sortOrder', 'ASC'], ['id', 'ASC']],
  });
  const expenses = await TripCountExpense.findAll({
    where: { tripId: trip.id },
    order: [['id', 'ASC']],
  });
  const expenseIds = expenses.map((expense) => expense.id);
  const shareRows = expenseIds.length
    ? await TripCountShare.findAll({ where: { expenseId: expenseIds } })
    : [];
  const sharesByExpense = new Map();
  shareRows.forEach((row) => {
    const key = Number(row.expenseId);
    if (!sharesByExpense.has(key)) sharesByExpense.set(key, []);
    sharesByExpense.get(key).push(row);
  });
  const memberName = new Map(members.map((member) => [Number(member.id), member.name]));
  const expenseViews = expenses.map((expense) => {
    const shares = resolvedShares(expense, sharesByExpense.get(Number(expense.id)) || [], members);
    return {
      id: expense.id,
      title: expense.title,
      amountCents: Number(expense.amountCents),
      payerMemberId: Number(expense.payerMemberId),
      payerName: memberName.get(Number(expense.payerMemberId)) || '',
      splitMode: expense.splitMode,
      note: expense.note || '',
      shares: shares.map((share) => ({
        memberId: share.memberId,
        name: memberName.get(share.memberId) || '',
        shareCents: share.shareCents,
      })),
    };
  });
  const settlement = settleTrip(
    members.map((member) => ({ id: member.id, name: member.name, sortOrder: member.sortOrder })),
    expenseViews.map((expense) => ({
      amountCents: expense.amountCents,
      payerMemberId: expense.payerMemberId,
      shares: expense.shares,
    })),
  );
  return {
    trip: {
      id: trip.id,
      title: trip.title,
      note: trip.note || '',
      currency: 'TWD',
    },
    members: members.map((member) => ({
      id: member.id,
      name: member.name,
      sortOrder: member.sortOrder,
    })),
    expenses: expenseViews,
    settlement,
  };
}

async function listTrips(userId) {
  const rows = await TripCount.findAll({
    where: { ownerUserId: userId },
    order: [['updatedAt', 'DESC'], ['id', 'DESC']],
  });
  return rows.map((trip) => ({
    id: trip.id,
    title: trip.title,
    note: trip.note || '',
    updatedAt: trip.updatedAt,
  }));
}

async function createTrip(userId, input) {
  const title = text(input.title, 80);
  if (!title) fail(400, 'TRIP_TITLE_REQUIRED', '請填旅程名稱');
  const note = input.note == null ? null : text(input.note, 500);
  if (input.note && !note) fail(400, 'TRIP_NOTE_INVALID', '備註過長');
  const trip = await TripCount.create({
    ownerUserId: userId,
    title,
    note,
  });
  return buildDetail(trip);
}

async function updateTrip(userId, tripId, input) {
  const trip = await getOwnedTrip(tripId, userId);
  const title = text(input.title, 80);
  if (!title) fail(400, 'TRIP_TITLE_REQUIRED', '請填旅程名稱');
  const note = input.note == null || String(input.note).trim() === '' ? null : text(input.note, 500);
  if (input.note && String(input.note).trim() && !note) fail(400, 'TRIP_NOTE_INVALID', '備註過長');
  await trip.update({ title, note });
  return buildDetail(trip);
}

async function deleteTrip(userId, tripId) {
  const trip = await getOwnedTrip(tripId, userId);
  await trip.destroy();
}

async function addMember(userId, tripId, input) {
  const trip = await getOwnedTrip(tripId, userId);
  const name = text(input.name, 40);
  if (!name) fail(400, 'MEMBER_NAME_REQUIRED', '請填成員名稱');
  const last = await TripCountMember.findOne({
    where: { tripId: trip.id },
    order: [['sortOrder', 'DESC'], ['id', 'DESC']],
  });
  await TripCountMember.create({
    tripId: trip.id,
    name,
    sortOrder: last ? Number(last.sortOrder) + 1 : 0,
  });
  await trip.changed('updatedAt', true);
  await trip.save();
  return buildDetail(trip);
}

async function renameMember(userId, tripId, memberId, input) {
  const trip = await getOwnedTrip(tripId, userId);
  const member = await TripCountMember.findOne({ where: { id: memberId, tripId: trip.id } });
  if (!member) fail(404, 'MEMBER_NOT_FOUND', '找不到這位成員');
  const name = text(input.name, 40);
  if (!name) fail(400, 'MEMBER_NAME_REQUIRED', '請填成員名稱');
  await member.update({ name });
  return buildDetail(trip);
}

async function removeMember(userId, tripId, memberId) {
  const trip = await getOwnedTrip(tripId, userId);
  const member = await TripCountMember.findOne({ where: { id: memberId, tripId: trip.id } });
  if (!member) fail(404, 'MEMBER_NOT_FOUND', '找不到這位成員');
  const used = await TripCountExpense.count({ where: { payerMemberId: member.id } })
    + await TripCountShare.count({ where: { memberId: member.id } });
  if (used) fail(409, 'MEMBER_IN_USE', '這位成員已經出現在帳目裡，請先刪除相關帳目');
  await member.destroy();
  return buildDetail(trip);
}

function normalizeShareInput(members, input) {
  const memberIds = new Set(members.map((member) => Number(member.id)));
  const payerMemberId = Number(input.payerMemberId);
  if (!memberIds.has(payerMemberId)) fail(400, 'PAYER_REQUIRED', '請選擇先付錢的人');
  const amountCents = asCents(input.amountCents);
  if (!amountCents) fail(400, 'AMOUNT_INVALID', '金額需大於 0，且最多到分');
  const splitMode = input.splitMode === 'custom' ? 'custom' : input.splitMode === 'equal' ? 'equal' : null;
  if (!splitMode) fail(400, 'SPLIT_MODE_INVALID', '請選擇均分或指定金額');

  let shares;
  if (splitMode === 'equal') {
    const ids = [...new Set((Array.isArray(input.memberIds) ? input.memberIds : []).map((id) => Number(id)))]
      .filter((id) => memberIds.has(id));
    if (!ids.length) fail(400, 'SHARE_REQUIRED', '請至少選一位分攤的人');
    shares = ids.map((memberId) => ({ memberId, shareCents: null }));
  } else {
    const rows = Array.isArray(input.shares) ? input.shares : [];
    const seen = new Set();
    shares = [];
    let sum = 0;
    for (const row of rows) {
      const memberId = Number(row.memberId);
      const shareCents = asCents(row.shareCents);
      if (!memberIds.has(memberId) || !shareCents || seen.has(memberId)) {
        fail(400, 'SHARE_INVALID', '指定金額裡有不存在的成員或無效金額');
      }
      seen.add(memberId);
      shares.push({ memberId, shareCents });
      sum += shareCents;
    }
    if (!shares.length || sum !== amountCents) {
      fail(400, 'SHARE_SUM_MISMATCH', '指定金額加總必須等於這一筆的金額');
    }
  }

  return {
    title: text(input.title, 80),
    amountCents,
    payerMemberId,
    splitMode,
    note: input.note == null || String(input.note).trim() === '' ? null : text(input.note, 200),
    shares,
  };
}

async function addExpense(userId, tripId, input) {
  const trip = await getOwnedTrip(tripId, userId);
  const members = await TripCountMember.findAll({ where: { tripId: trip.id } });
  const payload = normalizeShareInput(members, input);
  if (!payload.title) fail(400, 'EXPENSE_TITLE_REQUIRED', '請填項目名稱');
  if (input.note && String(input.note).trim() && !payload.note) fail(400, 'EXPENSE_NOTE_INVALID', '備註過長');

  await sequelize.transaction(async (transaction) => {
    const expense = await TripCountExpense.create({
      tripId: trip.id,
      title: payload.title,
      amountCents: payload.amountCents,
      payerMemberId: payload.payerMemberId,
      splitMode: payload.splitMode,
      note: payload.note,
    }, { transaction });
    await TripCountShare.bulkCreate(payload.shares.map((share) => ({
      expenseId: expense.id,
      memberId: share.memberId,
      shareCents: share.shareCents,
    })), { transaction });
  });
  return buildDetail(trip);
}

async function removeExpense(userId, tripId, expenseId) {
  const trip = await getOwnedTrip(tripId, userId);
  const expense = await TripCountExpense.findOne({ where: { id: expenseId, tripId: trip.id } });
  if (!expense) fail(404, 'EXPENSE_NOT_FOUND', '找不到這筆帳');
  await sequelize.transaction(async (transaction) => {
    await TripCountShare.destroy({ where: { expenseId: expense.id }, transaction });
    await expense.destroy({ transaction });
  });
  return buildDetail(trip);
}

module.exports = {
  listTrips,
  createTrip,
  updateTrip,
  deleteTrip,
  addMember,
  renameMember,
  removeMember,
  addExpense,
  removeExpense,
  buildDetail,
  getOwnedTrip,
};
