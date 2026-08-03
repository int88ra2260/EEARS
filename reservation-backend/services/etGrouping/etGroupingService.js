'use strict';

const {
  Event,
  Reservation,
  EtGroupBandConfig,
  EtEventGroupPlan,
  EtEventGroupAssignment,
  Teacher,
  sequelize,
} = require('../../models');
const { getGseSnapshotsForStudents } = require('./etGseSnapshotService');
const { normalizeCefrKey } = require('../learningAnalytics/learningAnalyticsCefrUtils');
const { resolveLegacyGroupCount } = require('../../utils/eventCapacity');
const {
  normalizeAbilityGroupSlots,
  buildMixedPhysicalAssignments,
  summarizePhysicalSlots,
} = require('./etPhysicalGroupAssignment');
const { listGroupLeaders } = require('./etLeaderService');
const { buildBandTableAssignments, countBandTables } = require('./etBandTableAssignmentService');

const ALGORITHM_VERSION = 'v1';
const UNK_BAND_CODE = 'ET-UNK';

function serializeBand(band) {
  return {
    id: band.id,
    semesterId: band.semesterId,
    code: band.code,
    label: band.label,
    gseMin: band.gseMin,
    gseMax: band.gseMax,
    cefrMin: band.cefrMin,
    cefrMax: band.cefrMax,
    maxPerTable: band.maxPerTable,
    tableCount: band.tableCount,
    sortOrder: band.sortOrder,
    isActive: band.isActive,
  };
}

async function listActiveBands(semesterId = null) {
  const where = { isActive: true };
  if (semesterId != null) {
    where.semesterId = semesterId;
  } else {
    where.semesterId = null;
  }
  let bands = await EtGroupBandConfig.findAll({
    where,
    order: [['sortOrder', 'ASC'], ['id', 'ASC']],
  });
  if (!bands.length && semesterId != null) {
    bands = await EtGroupBandConfig.findAll({
      where: { isActive: true, semesterId: null },
      order: [['sortOrder', 'ASC'], ['id', 'ASC']],
    });
  }
  return bands;
}

async function listBands({ semesterId = null } = {}) {
  const bands = await listActiveBands(semesterId);
  return bands.map(serializeBand);
}

async function upsertBands(bands = [], { semesterId = null } = {}) {
  if (!Array.isArray(bands) || !bands.length) {
    throw new Error('請提供至少一筆分組帶設定');
  }
  const transaction = await sequelize.transaction();
  try {
    for (const item of bands) {
      const code = String(item.code || '').trim();
      if (!code) throw new Error('分組帶代碼不可為空');
      const payload = {
        semesterId,
        code,
        label: String(item.label || code).trim(),
        gseMin: item.gseMin != null ? Number(item.gseMin) : null,
        gseMax: item.gseMax != null ? Number(item.gseMax) : null,
        cefrMin: item.cefrMin || null,
        cefrMax: item.cefrMax || null,
        maxPerTable: Math.max(1, Number(item.maxPerTable) || 12),
        tableCount: Math.max(1, Number(item.tableCount) || 1),
        sortOrder: Number(item.sortOrder) || 0,
        isActive: item.isActive !== false,
      };
      const existing = await EtGroupBandConfig.findOne({
        where: { semesterId, code },
        transaction,
      });
      if (existing) {
        await existing.update(payload, { transaction });
      } else {
        await EtGroupBandConfig.create(payload, { transaction });
      }
    }
    await transaction.commit();
    return listBands({ semesterId });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

function findUnkBand(bands) {
  return bands.find((b) => b.code === UNK_BAND_CODE) || bands[bands.length - 1];
}

function matchBandForSnapshot(snapshot, bands) {
  const unk = findUnkBand(bands);
  if (!snapshot || snapshot.dataQuality === 'missing') return unk;

  const gse = snapshot.gse;
  if (gse != null) {
    for (const band of bands) {
      if (band.code === UNK_BAND_CODE) continue;
      const min = band.gseMin;
      const max = band.gseMax;
      if (min != null && max != null && gse >= min && gse <= max) return band;
    }
  }

  const cefrKey = normalizeCefrKey(snapshot.cefr);
  if (cefrKey) {
    for (const band of bands) {
      if (band.code === UNK_BAND_CODE) continue;
      const minKey = normalizeCefrKey(band.cefrMin);
      const maxKey = normalizeCefrKey(band.cefrMax);
      if (minKey && maxKey) {
        const order = ['BELOW_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        const idx = order.indexOf(cefrKey);
        const minIdx = order.indexOf(minKey);
        const maxIdx = order.indexOf(maxKey);
        if (idx >= minIdx && idx <= maxIdx) return band;
      }
    }
  }

  return unk;
}

function buildGroupLabel(band, tableIndex) {
  const count = band.tableCount || 1;
  if (count <= 1) return band.code;
  return `${band.code}-${tableIndex}`;
}

function assignStudentsToTables(students, band) {
  const tableCount = Math.max(1, band.tableCount || 1);
  const maxPerTable = Math.max(1, band.maxPerTable || 12);
  const tableLoads = Array(tableCount).fill(0);
  const results = [];

  for (const student of students) {
    let placed = false;
    for (let offset = 0; offset < tableCount; offset += 1) {
      const tableIdx = (results.length + offset) % tableCount;
      if (tableLoads[tableIdx] < maxPerTable) {
        tableLoads[tableIdx] += 1;
        results.push({
          ...student,
          bandCode: band.code,
          groupLabel: buildGroupLabel(band, tableIdx + 1),
        });
        placed = true;
        break;
      }
    }
    if (!placed) {
      results.push({
        ...student,
        bandCode: band.code,
        groupLabel: `${band.code}-overflow`,
      });
    }
  }
  return results;
}

async function ensurePlan(eventId, { transaction } = {}) {
  const [plan] = await EtEventGroupPlan.findOrCreate({
    where: { eventId },
    defaults: {
      eventId,
      status: 'draft',
      algorithmVersion: ALGORITHM_VERSION,
    },
    transaction,
  });
  return plan;
}

async function generateGrouping(eventId, {
  force = false,
  groupSlots = null,
  groupingLayout = 'physical_slots',
  userId: _userId,
} = {}) {
  const event = await Event.findByPk(eventId, {
    include: [{ model: Reservation, order: [['id', 'ASC']] }],
  });
  if (!event) throw Object.assign(new Error('活動不存在'), { status: 404 });
  if ((event.eventType || 'English Table') !== 'English Table') {
    throw Object.assign(new Error('僅 English Table 活動支援能力分組'), { status: 400 });
  }

  const plan = await EtEventGroupPlan.findOne({ where: { eventId } });
  if (plan?.status === 'published' && !force) {
    throw Object.assign(new Error('分組已發布，請先確認是否要覆寫'), { status: 409, code: 'GROUPING_ALREADY_PUBLISHED' });
  }

  const bands = await listActiveBands(event.semesterId);
  if (!bands.length) throw Object.assign(new Error('尚未設定分組帶'), { status: 400 });

  const groupCount = resolveLegacyGroupCount(event);
  const perGroupCapacity = Math.max(1, Number(event.perGroupCapacity) || Math.ceil((event.maxCapacity || 36) / groupCount));
  const layout = groupingLayout === 'band_tables' ? 'band_tables' : 'physical_slots';
  const slotConfig = layout === 'physical_slots'
    ? normalizeAbilityGroupSlots(groupSlots, groupCount)
    : null;

  const reservations = event.Reservations || [];
  const snapshots = await getGseSnapshotsForStudents(reservations.map((r) => r.studentId));

  const students = reservations.map((reservation) => {
    const snapshot = snapshots.get(String(reservation.studentId)) || {
      studentId: reservation.studentId,
      gse: null,
      cefr: null,
      dataQuality: 'missing',
    };
    const band = matchBandForSnapshot(snapshot, bands);
    return { reservation, snapshot, band };
  });

  let assignmentRows;
  if (layout === 'band_tables') {
    const tableCount = countBandTables(bands);
    if (tableCount > groupCount) {
      throw Object.assign(
        new Error(`能力帶桌數（${tableCount}）超過活動組數（${groupCount}），請調整分組帶設定或活動組數`),
        { status: 400, code: 'BAND_TABLES_EXCEED_GROUP_COUNT' }
      );
    }
    assignmentRows = buildBandTableAssignments({ eventId, students, bands });
  } else {
    assignmentRows = buildMixedPhysicalAssignments({
      eventId,
      students,
      abilitySlots: slotConfig.abilitySlots,
      legacySlots: slotConfig.legacySlots,
      perGroupCapacity,
    });
  }

  const transaction = await sequelize.transaction();
  try {
    const nextPlan = await ensurePlan(eventId, { transaction });
    if (nextPlan.status === 'published' && force) {
      await nextPlan.update({ status: 'draft', publishedAt: null, publishedBy: null }, { transaction });
    }
    await EtEventGroupAssignment.destroy({ where: { eventId }, transaction });
    if (assignmentRows.length) {
      await EtEventGroupAssignment.bulkCreate(assignmentRows, { transaction });
    }
    await nextPlan.update({
      status: 'draft',
      algorithmVersion: ALGORITHM_VERSION,
      generatedAt: new Date(),
      groupingLayout: layout,
      abilityGroupSlots: layout === 'physical_slots' ? slotConfig.abilitySlots : null,
    }, { transaction });

    await transaction.commit();
    return getEventGrouping(eventId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function getEventGrouping(eventId) {
  const event = await Event.findByPk(eventId, {
    attributes: ['id', 'name', 'eventType', 'date', 'semesterId', 'groupingMode', 'groupCount', 'perGroupCapacity', 'maxCapacity'],
    include: [
      { model: Reservation, order: [['id', 'ASC']] },
      { model: EtEventGroupPlan, as: 'groupPlan', required: false },
      {
        model: EtEventGroupAssignment,
        as: 'groupAssignments',
        required: false,
        include: [{ model: Teacher, as: 'leader', attributes: ['id', 'name'], required: false }],
      },
    ],
  });
  if (!event) throw Object.assign(new Error('活動不存在'), { status: 404 });

  const groupCount = resolveLegacyGroupCount(event);
  const perGroupCapacity = Math.max(
    1,
    Number(event.perGroupCapacity) || Math.ceil((event.maxCapacity || 36) / groupCount)
  );
  const abilityGroupSlots = event.groupPlan?.abilityGroupSlots
    || Array.from({ length: groupCount }, (_, index) => index + 1);
  const groupingLayout = event.groupPlan?.groupingLayout || 'physical_slots';
  const slotConfig = groupingLayout === 'band_tables'
    ? { abilitySlots: [], legacySlots: [], allAbility: true }
    : normalizeAbilityGroupSlots(abilityGroupSlots, groupCount);

  const assignmentByReservation = new Map(
    (event.groupAssignments || []).map((a) => [a.reservationId, a])
  );

  const bands = await listBands({ semesterId: event.semesterId });
  const groupLeaders = await listGroupLeaders(eventId);
  const leaderByGroup = new Map(groupLeaders.map((row) => [row.groupLabel, row]));

  const students = (event.Reservations || []).map((r) => {
    const assignment = assignmentByReservation.get(r.id);
    return {
      reservationId: r.id,
      studentId: r.studentId,
      studentName: r.studentName,
      studentEmail: r.studentEmail,
      checkinStatus: r.checkinStatus || '未簽到',
      currentGroup: r.group,
      assignment: assignment
        ? {
            id: assignment.id,
            bandCode: assignment.bandCode,
            groupLabel: assignment.groupLabel,
            gseSnapshot: assignment.gseSnapshot,
            cefrSnapshot: assignment.cefrSnapshot,
            dataQuality: assignment.dataQuality,
            source: assignment.source,
            leaderTeacherId: assignment.leaderTeacherId,
            leaderName: assignment.leader?.name || null,
            adjustedBy: assignment.adjustedBy,
            adjustedAt: assignment.adjustedAt,
            adjustReason: assignment.adjustReason,
          }
        : null,
    };
  });

  const groupSummary = {};
  for (const student of students) {
    const label = student.assignment?.groupLabel || '未分組';
    if (!groupSummary[label]) {
      groupSummary[label] = { groupLabel: label, count: 0, bandCode: student.assignment?.bandCode || null };
    }
    groupSummary[label].count += 1;
  }

  const slotSummary = groupingLayout === 'band_tables'
    ? {
      slots: Object.values(groupSummary).map((row) => ({
        groupNumber: null,
        groupLabel: row.groupLabel,
        mode: 'ability',
        count: row.count,
        leaderTeacherId: leaderByGroup.get(row.groupLabel)?.leaderTeacherId || null,
        leaderName: leaderByGroup.get(row.groupLabel)?.leaderName || null,
      })),
      abilitySlots: [],
      legacySlots: [],
      allAbility: true,
    }
    : summarizePhysicalSlots({
      groupCount,
      abilitySlots: slotConfig.abilitySlots,
      legacySlots: slotConfig.legacySlots,
      assignments: event.groupAssignments || [],
    });
  const slotsWithLeaders = groupingLayout === 'band_tables'
    ? slotSummary.slots
    : slotSummary.slots.map((slot) => {
      const leader = leaderByGroup.get(slot.groupLabel);
      return {
        ...slot,
        leaderTeacherId: leader?.leaderTeacherId || null,
        leaderName: leader?.leaderName || null,
      };
    });

  return {
    event: {
      id: event.id,
      name: event.name,
      eventType: event.eventType,
      date: event.date,
      semesterId: event.semesterId,
      groupingMode: event.groupingMode || 'legacy_sequential',
      groupCount,
      perGroupCapacity,
      maxCapacity: event.maxCapacity,
    },
    plan: event.groupPlan
      ? {
          id: event.groupPlan.id,
          status: event.groupPlan.status,
          algorithmVersion: event.groupPlan.algorithmVersion,
          generatedAt: event.groupPlan.generatedAt,
          publishedAt: event.groupPlan.publishedAt,
          publishedBy: event.groupPlan.publishedBy,
          abilityGroupSlots: event.groupPlan.abilityGroupSlots || slotConfig.abilitySlots,
          groupingLayout: event.groupPlan.groupingLayout || groupingLayout,
        }
      : null,
    slotConfig: {
      ...slotSummary,
      slots: slotsWithLeaders,
    },
    groupLeaders,
    bands,
    students,
    groupSummary: Object.values(groupSummary).sort((a, b) => String(a.groupLabel).localeCompare(String(b.groupLabel))),
  };
}

async function patchAssignments(eventId, patches = [], { userId } = {}) {
  if (!Array.isArray(patches) || !patches.length) {
    throw new Error('請提供至少一筆調整');
  }
  const event = await Event.findByPk(eventId);
  if (!event) throw Object.assign(new Error('活動不存在'), { status: 404 });

  const plan = await ensurePlan(eventId);
  if (plan.status === 'published') {
    await plan.update({ status: 'draft', publishedAt: null, publishedBy: null });
  }

  const transaction = await sequelize.transaction();
  try {
    for (const patch of patches) {
      const reservationId = Number(patch.reservationId);
      if (!reservationId) continue;

      const reservation = await Reservation.findOne({
        where: { id: reservationId, eventId },
        transaction,
      });
      if (!reservation) continue;

      const [assignment] = await EtEventGroupAssignment.findOrCreate({
        where: { eventId, reservationId },
        defaults: {
          eventId,
          reservationId,
          studentId: reservation.studentId,
          bandCode: patch.bandCode || UNK_BAND_CODE,
          groupLabel: patch.groupLabel || UNK_BAND_CODE,
          source: 'manual',
          dataQuality: patch.dataQuality || 'missing',
        },
        transaction,
      });

      const updates = {
        source: 'manual',
        adjustedBy: userId || null,
        adjustedAt: new Date(),
        adjustReason: patch.reason || patch.adjustReason || null,
      };
      if (patch.bandCode) updates.bandCode = patch.bandCode;
      if (patch.groupLabel) updates.groupLabel = patch.groupLabel;
      if (patch.leaderTeacherId !== undefined) updates.leaderTeacherId = patch.leaderTeacherId || null;
      if (patch.gseSnapshot !== undefined) updates.gseSnapshot = patch.gseSnapshot;
      if (patch.cefrSnapshot !== undefined) updates.cefrSnapshot = patch.cefrSnapshot;
      if (patch.dataQuality) updates.dataQuality = patch.dataQuality;

      await assignment.update(updates, { transaction });
    }
    await transaction.commit();
    return getEventGrouping(eventId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function publishGrouping(eventId, { userId } = {}) {
  const event = await Event.findByPk(eventId, {
    include: [{ model: EtEventGroupAssignment, as: 'groupAssignments' }],
  });
  if (!event) throw Object.assign(new Error('活動不存在'), { status: 404 });
  if ((event.eventType || 'English Table') !== 'English Table') {
    throw Object.assign(new Error('僅 English Table 活動支援能力分組'), { status: 400 });
  }

  const assignments = event.groupAssignments || [];
  if (!assignments.length) {
    throw Object.assign(new Error('尚無分組結果，請先產生分組'), { status: 400 });
  }

  const transaction = await sequelize.transaction();
  try {
    const plan = await ensurePlan(eventId, { transaction });
    for (const assignment of assignments) {
      await Reservation.update(
        { group: assignment.groupLabel },
        { where: { id: assignment.reservationId, eventId }, transaction }
      );
    }
    await plan.update({
      status: 'published',
      publishedAt: new Date(),
      publishedBy: userId || null,
    }, { transaction });
    await event.update({ groupingMode: 'ability' }, { transaction });
    await transaction.commit();
    return getEventGrouping(eventId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function getPublishedAssignmentMap(eventId) {
  const event = await Event.findByPk(eventId, {
    attributes: ['id', 'groupingMode', 'eventType'],
    include: [
      { model: EtEventGroupPlan, as: 'groupPlan', required: false },
      { model: EtEventGroupAssignment, as: 'groupAssignments', required: false },
    ],
  });
  if (!event) return null;
  const isAbility = (event.groupingMode === 'ability')
    && event.groupPlan?.status === 'published';
  if (!isAbility) return null;
  return new Map((event.groupAssignments || []).map((a) => [a.reservationId, a]));
}

module.exports = {
  listBands,
  upsertBands,
  generateGrouping,
  getEventGrouping,
  patchAssignments,
  publishGrouping,
  getPublishedAssignmentMap,
  matchBandForSnapshot,
  assignStudentsToTables,
  ALGORITHM_VERSION,
  UNK_BAND_CODE,
};
