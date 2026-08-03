const weeklyInteractionService = require('../services/weeklyInteractionService');

async function votePoll(req, res, next) {
  try {
    const data = await weeklyInteractionService.submitPollVote({
      slug: req.body.slug,
      blockId: req.body.blockId,
      optionIds: req.body.optionIds,
      voterKey: req.body.voterKey,
    });
    return res.json(data);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

async function getPoll(req, res, next) {
  try {
    const data = await weeklyInteractionService.getPollResults({
      slug: req.query.slug,
      blockId: req.params.blockId,
      voterKey: req.query.voterKey,
    });
    if (!data) return res.status(404).json({ error: '找不到投票' });
    return res.json(data);
  } catch (err) {
    next(err);
  }
}

async function submitQuiz(req, res, next) {
  try {
    const data = await weeklyInteractionService.submitQuiz({
      slug: req.body.slug,
      blockId: req.body.blockId,
      answers: req.body.answers,
      voterKey: req.body.voterKey,
    });
    return res.json(data);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

async function recordEvent(req, res, next) {
  try {
    const data = await weeklyInteractionService.recordEngagementEvent({
      slug: req.body.slug,
      eventType: req.body.eventType,
      blockId: req.body.blockId,
      voterKey: req.body.voterKey,
      payload: req.body.payload,
    });
    return res.json(data);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

module.exports = {
  votePoll,
  getPoll,
  submitQuiz,
  recordEvent,
};
