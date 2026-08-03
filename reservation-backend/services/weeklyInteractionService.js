const { Op } = require('sequelize');
const { WeeklyReport, WeeklyInteractionEvent } = require('../models');
const weeklyBlockService = require('./weeklyBlockService');

const EVENT_TYPES = {
  POLL_VOTE: 'poll_vote',
  QUIZ_SUBMIT: 'quiz_submit',
  READ_COMPLETE: 'read_complete',
  CHALLENGE_COMPLETE: 'challenge_complete',
};

const PAGE_BLOCK_ID = '__page__';

function normalizeVoterKey(key) {
  const k = String(key || '').trim().slice(0, 64);
  return /^[a-zA-Z0-9_-]{8,64}$/.test(k) ? k : null;
}

async function getPublishedReportBySlug(slug) {
  const key = String(slug || '').trim();
  if (!key) return null;
  const row = await WeeklyReport.findOne({
    where: {
      status: 'published',
      [Op.or]: [{ issueKey: key }, { slug: key.toLowerCase() }],
    },
  });
  if (!row) return null;
  const now = new Date();
  if (row.publishedAt && new Date(row.publishedAt) > now) return null;
  return row;
}

function findBlock(report, blockId, expectedType) {
  const blocks = weeklyBlockService.normalizeBlocks(report.blocks, report);
  const block = blocks.find((b) => b.id === blockId);
  if (!block || block.type !== expectedType) return null;
  return block;
}

function gradeQuiz(block, answers) {
  const questions = Array.isArray(block.props?.questions) ? block.props.questions : [];
  const answerMap = new Map(
    (Array.isArray(answers) ? answers : []).map((a) => [String(a.questionId), String(a.value ?? '').trim()])
  );
  let correct = 0;
  const results = questions.map((q) => {
    const given = answerMap.get(String(q.id)) || '';
    const expected = String(q.correctAnswer || '').trim();
    let isCorrect = false;
    if (q.type === 'fill') {
      isCorrect = given.toLowerCase() === expected.toLowerCase();
    } else {
      isCorrect = given === expected;
    }
    if (isCorrect) correct += 1;
    return {
      questionId: q.id,
      correct: isCorrect,
      explanation: q.explanation || '',
    };
  });
  return { correct, total: questions.length, results };
}

async function submitPollVote({ slug, blockId, optionIds, voterKey }) {
  const voter = normalizeVoterKey(voterKey);
  if (!voter) {
    const err = new Error('無效的匿名識別碼');
    err.status = 400;
    throw err;
  }
  const report = await getPublishedReportBySlug(slug);
  if (!report) {
    const err = new Error('找不到週報');
    err.status = 404;
    throw err;
  }
  const block = findBlock(report, blockId, 'poll');
  if (!block) {
    const err = new Error('找不到投票區塊');
    err.status = 404;
    throw err;
  }
  const options = Array.isArray(block.props?.options) ? block.props.options : [];
  const validIds = new Set(options.map((o) => String(o.id)));
  const selected = (Array.isArray(optionIds) ? optionIds : [])
    .map((id) => String(id))
    .filter((id) => validIds.has(id));
  if (!selected.length) {
    const err = new Error('請選擇至少一個選項');
    err.status = 400;
    throw err;
  }
  if (!block.props?.allowMultiple && selected.length > 1) {
    const err = new Error('此投票僅能選擇一項');
    err.status = 400;
    throw err;
  }

  try {
    await WeeklyInteractionEvent.create({
      reportId: report.id,
      blockId,
      eventType: EVENT_TYPES.POLL_VOTE,
      voterKey: voter,
      payload: { optionIds: selected },
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      const dup = new Error('您已投過票');
      dup.status = 409;
      throw dup;
    }
    throw err;
  }

  return getPollResults({ slug, blockId, voterKey: voter });
}

async function getPollResults({ slug, blockId, voterKey }) {
  const report = await getPublishedReportBySlug(slug);
  if (!report) return null;
  const block = findBlock(report, blockId, 'poll');
  if (!block) return null;

  const options = Array.isArray(block.props?.options) ? block.props.options : [];
  const votes = await WeeklyInteractionEvent.findAll({
    where: {
      reportId: report.id,
      blockId,
      eventType: EVENT_TYPES.POLL_VOTE,
    },
    attributes: ['payload'],
  });

  const counts = Object.fromEntries(options.map((o) => [String(o.id), 0]));
  votes.forEach((row) => {
    const ids = row.payload?.optionIds || [];
    ids.forEach((id) => {
      const key = String(id);
      if (counts[key] != null) counts[key] += 1;
    });
  });

  let userVote = null;
  const voter = normalizeVoterKey(voterKey);
  if (voter) {
    const mine = await WeeklyInteractionEvent.findOne({
      where: {
        reportId: report.id,
        blockId,
        eventType: EVENT_TYPES.POLL_VOTE,
        voterKey: voter,
      },
    });
    userVote = mine?.payload?.optionIds || null;
  }

  const totalVotes = votes.length;
  return {
    question: block.props?.question || '',
    options: options.map((o) => ({
      id: o.id,
      label: o.label,
      count: counts[String(o.id)] || 0,
      percent: totalVotes ? Math.round(((counts[String(o.id)] || 0) / totalVotes) * 100) : 0,
    })),
    totalVotes,
    userVote,
    showResults: block.props?.showResults || 'afterVote',
  };
}

async function submitQuiz({ slug, blockId, answers, voterKey }) {
  const voter = normalizeVoterKey(voterKey);
  if (!voter) {
    const err = new Error('無效的匿名識別碼');
    err.status = 400;
    throw err;
  }
  const report = await getPublishedReportBySlug(slug);
  if (!report) {
    const err = new Error('找不到週報');
    err.status = 404;
    throw err;
  }
  const block = findBlock(report, blockId, 'quiz');
  if (!block) {
    const err = new Error('找不到小測驗區塊');
    err.status = 404;
    throw err;
  }

  const graded = gradeQuiz(block, answers);

  try {
    await WeeklyInteractionEvent.create({
      reportId: report.id,
      blockId,
      eventType: EVENT_TYPES.QUIZ_SUBMIT,
      voterKey: voter,
      payload: {
        correct: graded.correct,
        total: graded.total,
      },
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      const dup = new Error('您已提交過此測驗');
      dup.status = 409;
      throw dup;
    }
    throw err;
  }

  return {
    correct: graded.correct,
    total: graded.total,
    results: graded.results,
  };
}

async function recordEngagementEvent({ slug, eventType, blockId, voterKey, payload }) {
  const voter = normalizeVoterKey(voterKey);
  if (!voter) {
    const err = new Error('無效的匿名識別碼');
    err.status = 400;
    throw err;
  }
  const allowed = new Set([
    EVENT_TYPES.READ_COMPLETE,
    EVENT_TYPES.CHALLENGE_COMPLETE,
  ]);
  if (!allowed.has(eventType)) {
    const err = new Error('不支援的事件類型');
    err.status = 400;
    throw err;
  }

  const report = await getPublishedReportBySlug(slug);
  if (!report) {
    const err = new Error('找不到週報');
    err.status = 404;
    throw err;
  }

  const resolvedBlockId = eventType === EVENT_TYPES.READ_COMPLETE
    ? PAGE_BLOCK_ID
    : String(blockId || '').slice(0, 64);

  if (eventType === EVENT_TYPES.CHALLENGE_COMPLETE) {
    const block = findBlock(report, resolvedBlockId, 'wordBridgeChallenge');
    if (!block) {
      const err = new Error('找不到語彙挑戰區塊');
      err.status = 404;
      throw err;
    }
  }

  try {
    await WeeklyInteractionEvent.create({
      reportId: report.id,
      blockId: resolvedBlockId,
      eventType,
      voterKey: voter,
      payload: payload || {},
    });
    return { recorded: true };
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return { recorded: false, duplicate: true };
    }
    throw err;
  }
}

async function getAnalytics(reportId) {
  const report = await WeeklyReport.findByPk(reportId);
  if (!report) return null;

  const blocks = weeklyBlockService.normalizeBlocks(report.blocks, report);
  const rows = await WeeklyInteractionEvent.findAll({
    where: { reportId: report.id },
    attributes: ['blockId', 'eventType', 'payload'],
  });

  const summary = {
    readComplete: 0,
    challengeComplete: 0,
    polls: {},
    quizzes: {},
  };

  rows.forEach((row) => {
    if (row.eventType === EVENT_TYPES.READ_COMPLETE) {
      summary.readComplete += 1;
      return;
    }
    if (row.eventType === EVENT_TYPES.CHALLENGE_COMPLETE) {
      summary.challengeComplete += 1;
      return;
    }
    if (row.eventType === EVENT_TYPES.POLL_VOTE && row.blockId) {
      if (!summary.polls[row.blockId]) {
        summary.polls[row.blockId] = { totalVotes: 0, optionCounts: {} };
      }
      summary.polls[row.blockId].totalVotes += 1;
      (row.payload?.optionIds || []).forEach((optId) => {
        const key = String(optId);
        summary.polls[row.blockId].optionCounts[key] = (summary.polls[row.blockId].optionCounts[key] || 0) + 1;
      });
      return;
    }
    if (row.eventType === EVENT_TYPES.QUIZ_SUBMIT && row.blockId) {
      if (!summary.quizzes[row.blockId]) {
        summary.quizzes[row.blockId] = { submissions: 0, correctSum: 0, totalSum: 0 };
      }
      const q = summary.quizzes[row.blockId];
      q.submissions += 1;
      q.correctSum += Number(row.payload?.correct) || 0;
      q.totalSum += Number(row.payload?.total) || 0;
    }
  });

  const blockMeta = {};
  blocks.forEach((b) => {
    if (b.type === 'poll') {
      blockMeta[b.id] = {
        type: 'poll',
        label: b.props?.question || '投票',
        options: (b.props?.options || []).map((o) => ({ id: o.id, label: o.label })),
      };
    }
    if (b.type === 'quiz') {
      blockMeta[b.id] = {
        type: 'quiz',
        label: b.props?.title || '小測驗',
        questionCount: (b.props?.questions || []).length,
      };
    }
    if (b.type === 'wordBridgeChallenge') {
      blockMeta[b.id] = { type: 'wordBridgeChallenge', label: '語彙挑戰' };
    }
  });

  const polls = Object.entries(summary.polls).map(([blockId, data]) => ({
    blockId,
    ...blockMeta[blockId],
    totalVotes: data.totalVotes,
    optionCounts: data.optionCounts,
  }));

  const quizzes = Object.entries(summary.quizzes).map(([blockId, data]) => ({
    blockId,
    ...blockMeta[blockId],
    submissions: data.submissions,
    avgScore: data.submissions
      ? Math.round((data.correctSum / data.totalSum) * 100)
      : 0,
  }));

  return {
    reportId: report.id,
    issueKey: report.issueKey,
    readComplete: summary.readComplete,
    challengeComplete: summary.challengeComplete,
    polls,
    quizzes,
  };
}

module.exports = {
  EVENT_TYPES,
  PAGE_BLOCK_ID,
  normalizeVoterKey,
  gradeQuiz,
  submitPollVote,
  getPollResults,
  submitQuiz,
  recordEngagementEvent,
  getAnalytics,
};
