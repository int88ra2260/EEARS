'use strict';

const { Op } = require('sequelize');
const {
  TripCount,
  TripCountMember,
  TripCountExpense,
  TripCountShare,
  sequelize,
} = require('../models');
const { allocateEqualShares, allocateWeightedShares, settleTrip } = require('./tripCountSettlement');
const { normalizeTripCountCategory } = require('../constants/tripCountCategories');

const MAX_AMOUNT_CENTS = 100_000_000 * 100;
const MAX_SHARE_WEIGHT = 99;

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

function normalizeSpentOn(value) {
  if (value == null || String(value).trim() === '') return null;
  const next = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) fail(400, 'SPENT_ON_INVALID', '日期格式需為 YYYY-MM-DD');
  const date = new Date(`${next}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) fail(400, 'SPENT_ON_INVALID', '日期無效');
  return next;
}

function normalizeCategory(value) {
  const category = normalizeTripCountCategory(value);
  if (category === undefined) fail(400, 'CATEGORY_INVALID', '分類無效');
  return category;
}

async function touchTrip(trip, transaction) {
  await trip.changed('updatedAt', true);
  await trip.save({ transaction });
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
    return allocateEqualShares(Number(expense.amountCents), rows.map((row) => Number(row.memberId)))
      .map((share) => ({ ...share, weight: null }));
  }
  if (expense.splitMode === 'weights') {
    const weighted = rows.map((row) => ({
      memberId: Number(row.memberId),
      // 相容尚未 migration 的舊資料：曾把份數存在 share_cents
      weight: Number(row.weight != null ? row.weight : row.shareCents || 0),
    }));
    return allocateWeightedShares(Number(expense.amountCents), weighted).map((share, index) => ({
      ...share,
      weight: weighted[index].weight,
    }));
  }
  return rows.map((row) => ({
    memberId: Number(row.memberId),
    shareCents: Number(row.shareCents || 0),
    weight: null,
  }));
}

async function buildDetail(trip) {
  const members = await TripCountMember.findAll({
    where: { tripId: trip.id },
    order: [['sortOrder', 'ASC'], ['id', 'ASC']],
  });
  const expenses = await TripCountExpense.findAll({
    where: { tripId: trip.id },
    order: [
      [sequelize.literal('(spent_on IS NULL)'), 'ASC'],
      ['spentOn', 'ASC'],
      ['id', 'ASC'],
    ],
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
      category: expense.category || null,
      spentOn: expense.spentOn || null,
      note: expense.note || '',
      shares: shares.map((share) => ({
        memberId: share.memberId,
        name: memberName.get(share.memberId) || '',
        shareCents: share.shareCents,
        weight: share.weight,
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
    order: [['updated_at', 'DESC'], ['id', 'DESC']],
  });
  if (!rows.length) return [];

  const tripIds = rows.map((trip) => trip.id);
  const [memberRows, expenseRows] = await Promise.all([
    TripCountMember.findAll({
      attributes: [
        'tripId',
        [sequelize.fn('COUNT', sequelize.col('id')), 'memberCount'],
      ],
      where: { tripId: { [Op.in]: tripIds } },
      group: ['tripId'],
      raw: true,
    }),
    TripCountExpense.findAll({
      attributes: [
        'tripId',
        [sequelize.fn('COUNT', sequelize.col('id')), 'expenseCount'],
        [sequelize.fn('SUM', sequelize.col('amount_cents')), 'totalCents'],
      ],
      where: { tripId: { [Op.in]: tripIds } },
      group: ['tripId'],
      raw: true,
    }),
  ]);

  const memberCountByTrip = new Map(
    memberRows.map((row) => [Number(row.tripId), Number(row.memberCount) || 0]),
  );
  const expenseStatsByTrip = new Map(
    expenseRows.map((row) => [Number(row.tripId), {
      expenseCount: Number(row.expenseCount) || 0,
      totalCents: Number(row.totalCents) || 0,
    }]),
  );

  return rows.map((trip) => {
    const stats = expenseStatsByTrip.get(Number(trip.id)) || { expenseCount: 0, totalCents: 0 };
    return {
      id: trip.id,
      title: trip.title,
      note: trip.note || '',
      updatedAt: trip.updatedAt,
      memberCount: memberCountByTrip.get(Number(trip.id)) || 0,
      expenseCount: stats.expenseCount,
      totalCents: stats.totalCents,
    };
  });
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
  await touchTrip(trip);
  return buildDetail(trip);
}

async function renameMember(userId, tripId, memberId, input) {
  const trip = await getOwnedTrip(tripId, userId);
  const member = await TripCountMember.findOne({ where: { id: memberId, tripId: trip.id } });
  if (!member) fail(404, 'MEMBER_NOT_FOUND', '找不到這位成員');
  const name = text(input.name, 40);
  if (!name) fail(400, 'MEMBER_NAME_REQUIRED', '請填成員名稱');
  await member.update({ name });
  await touchTrip(trip);
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
  await touchTrip(trip);
  return buildDetail(trip);
}

function normalizeShareInput(members, input) {
  const memberIds = new Set(members.map((member) => Number(member.id)));
  const payerMemberId = Number(input.payerMemberId);
  if (!memberIds.has(payerMemberId)) fail(400, 'PAYER_REQUIRED', '請選擇先付錢的人');
  const amountCents = asCents(input.amountCents);
  if (!amountCents) fail(400, 'AMOUNT_INVALID', '金額需大於 0，且最多到分');
  const splitMode = input.splitMode === 'custom'
    ? 'custom'
    : input.splitMode === 'weights'
      ? 'weights'
      : input.splitMode === 'equal'
        ? 'equal'
        : null;
  if (!splitMode) fail(400, 'SPLIT_MODE_INVALID', '請選擇均分、依份數或指定金額');

  let shares;
  if (splitMode === 'equal') {
    const ids = [...new Set((Array.isArray(input.memberIds) ? input.memberIds : []).map((id) => Number(id)))]
      .filter((id) => memberIds.has(id));
    if (!ids.length) fail(400, 'SHARE_REQUIRED', '請至少選一位分攤的人');
    shares = ids.map((memberId) => ({ memberId, shareCents: null, weight: null }));
  } else if (splitMode === 'weights') {
    const rows = Array.isArray(input.shares) ? input.shares : [];
    const seen = new Set();
    shares = [];
    for (const row of rows) {
      const memberId = Number(row.memberId);
      const weight = Number(row.weight);
      if (
        !memberIds.has(memberId)
        || !Number.isInteger(weight)
        || weight < 1
        || weight > MAX_SHARE_WEIGHT
        || seen.has(memberId)
      ) {
        fail(400, 'SHARE_WEIGHT_INVALID', '份數需為 1–99 的整數，且每位成員只能填一次');
      }
      seen.add(memberId);
      shares.push({ memberId, shareCents: null, weight });
    }
    if (!shares.length) fail(400, 'SHARE_REQUIRED', '請至少為一位成員設定份數');
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
      shares.push({ memberId, shareCents, weight: null });
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
    category: normalizeCategory(input.category),
    spentOn: normalizeSpentOn(input.spentOn),
    note: input.note == null || String(input.note).trim() === '' ? null : text(input.note, 200),
    shares,
  };
}

async function replaceExpenseShares(expenseId, shares, transaction) {
  await TripCountShare.destroy({ where: { expenseId }, transaction });
  await TripCountShare.bulkCreate(shares.map((share) => ({
    expenseId,
    memberId: share.memberId,
    shareCents: share.shareCents,
    weight: share.weight,
  })), { transaction });
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
      category: payload.category,
      spentOn: payload.spentOn,
      note: payload.note,
    }, { transaction });
    await replaceExpenseShares(expense.id, payload.shares, transaction);
    await touchTrip(trip, transaction);
  });
  return buildDetail(trip);
}

async function updateExpense(userId, tripId, expenseId, input) {
  const trip = await getOwnedTrip(tripId, userId);
  const expense = await TripCountExpense.findOne({ where: { id: expenseId, tripId: trip.id } });
  if (!expense) fail(404, 'EXPENSE_NOT_FOUND', '找不到這筆帳');
  const members = await TripCountMember.findAll({ where: { tripId: trip.id } });
  const payload = normalizeShareInput(members, input);
  if (!payload.title) fail(400, 'EXPENSE_TITLE_REQUIRED', '請填項目名稱');
  if (input.note && String(input.note).trim() && !payload.note) fail(400, 'EXPENSE_NOTE_INVALID', '備註過長');

  await sequelize.transaction(async (transaction) => {
    await expense.update({
      title: payload.title,
      amountCents: payload.amountCents,
      payerMemberId: payload.payerMemberId,
      splitMode: payload.splitMode,
      category: payload.category,
      spentOn: payload.spentOn,
      note: payload.note,
    }, { transaction });
    await replaceExpenseShares(expense.id, payload.shares, transaction);
    await touchTrip(trip, transaction);
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
    await touchTrip(trip, transaction);
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
  updateExpense,
  removeExpense,
  buildDetail,
  getOwnedTrip,
};
