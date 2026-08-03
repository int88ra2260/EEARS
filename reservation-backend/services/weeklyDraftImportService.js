const fs = require('fs');
const path = require('path');

const { Op } = require('sequelize');
const { Event, WeeklyReport } = require('../models');
const weeklyReportService = require('./weeklyReportService');

function pickEventIdsInRange(events, weekStart, weekEnd, limit = 6) {
  const start = String(weekStart || '').trim();
  const end = String(weekEnd || '').trim();
  if (!start || !end) return [];

  const inRange = events
    .filter((evt) => {
      const d = String(evt.date || '').trim();
      return d >= start && d <= end;
    })
    .sort((a, b) => {
      const dateCmp = String(a.date).localeCompare(String(b.date));
      if (dateCmp !== 0) return dateCmp;
      return String(a.startTime || '').localeCompare(String(b.startTime || ''));
    });

  return inRange.slice(0, limit).map((evt) => evt.id);
}

function injectEventIds(blocks, eventIds) {
  if (!Array.isArray(blocks) || !eventIds.length) return blocks;
  return blocks.map((block) => {
    if (block?.type !== 'eventsHighlight') return block;
    const current = Array.isArray(block.props?.eventIds) ? block.props.eventIds : [];
    if (current.length) return block;
    return {
      ...block,
      props: {
        ...block.props,
        eventIds: [...eventIds],
      },
    };
  });
}

function loadDraftFromFile(filePath) {
  const abs = path.resolve(filePath);
  const raw = fs.readFileSync(abs, 'utf8');
  const data = JSON.parse(raw);
  if (!data.issueKey || !data.slug || !data.blocks) {
    const err = new Error('草稿 JSON 須含 issueKey、slug、blocks');
    err.status = 400;
    throw err;
  }
  return data;
}

async function fetchEventsForWeek(weekStart, weekEnd) {
  const start = String(weekStart || '').trim();
  const end = String(weekEnd || '').trim();
  if (!start || !end) return [];

  return Event.findAll({
    where: {
      date: {
        [Op.gte]: start,
        [Op.lte]: end,
      },
    },
    attributes: ['id', 'name', 'date', 'startTime', 'eventType'],
    order: [['date', 'ASC'], ['startTime', 'ASC']],
  });
}

async function importWeeklyDraft({
  filePath,
  fillEvents = false,
  update = false,
  dryRun = false,
  actorId = null,
} = {}) {
  const draft = loadDraftFromFile(filePath);
  let blocks = Array.isArray(draft.blocks) ? draft.blocks : [];
  let filledEventIds = [];

  if (fillEvents) {
    const events = await fetchEventsForWeek(draft.weekStart, draft.weekEnd);
    filledEventIds = pickEventIdsInRange(events, draft.weekStart, draft.weekEnd);
    blocks = injectEventIds(blocks, filledEventIds);
  }

  const payload = {
    issueKey: draft.issueKey,
    slug: draft.slug,
    title: draft.title,
    weekStart: draft.weekStart,
    weekEnd: draft.weekEnd,
    status: draft.status === 'published' ? 'published' : 'draft',
    blocks,
    blocksVersion: draft.blocksVersion || 1,
  };

  const existing = await WeeklyReport.findOne({ where: { issueKey: payload.issueKey } });

  if (dryRun) {
    return {
      dryRun: true,
      action: existing ? (update ? 'update' : 'skip-existing') : 'create',
      issueKey: payload.issueKey,
      slug: payload.slug,
      blockCount: blocks.length,
      filledEventIds,
      existingId: existing?.id || null,
    };
  }

  if (existing && !update) {
    const err = new Error(`期數 ${payload.issueKey} 已存在（id=${existing.id}）。加 --update 覆寫草稿。`);
    err.status = 409;
    throw err;
  }

  if (existing) {
    const row = await weeklyReportService.updateWeeklyReport(existing.id, payload, actorId);
    return {
      action: 'updated',
      id: row.id,
      issueKey: row.issueKey,
      slug: row.slug,
      filledEventIds,
      editUrl: `/admin/weekly-reports/${row.id}/edit`,
    };
  }

  const row = await weeklyReportService.createWeeklyReport(payload, actorId);
  return {
    action: 'created',
    id: row.id,
    issueKey: row.issueKey,
    slug: row.slug,
    filledEventIds,
    editUrl: `/admin/weekly-reports/${row.id}/edit`,
  };
}

module.exports = {
  pickEventIdsInRange,
  injectEventIds,
  loadDraftFromFile,
  fetchEventsForWeek,
  importWeeklyDraft,
};
