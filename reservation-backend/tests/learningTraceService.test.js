'use strict';

const {
  validateTraceInput,
  recordLearningTrace,
  getMicroLearningEngagementSummary,
  getRecommendationFunnelSummary,
  summarizeVocabularyDepthItemStats,
  assessVocabularyDepthItemHealth,
} = require('../services/learningTraceService');
const { generateRegulatoryFocusFeedback } = require('../services/learningTrace/learningFeedbackService');
const { getStudentGamificationProfile, BADGE_DEFS } = require('../services/learningTrace/learningGamificationService');

jest.mock('../models', () => ({
  LearningTraceEvent: {
    findOne: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
  },
  LjStudentEvent: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  Reservation: {
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
  Event: {},
  LjAnalyticStudent: {
    findAll: jest.fn(),
  },
  EnglishLearningPassport: {
    findOne: jest.fn(),
  },
}));

const { LearningTraceEvent, LjStudentEvent } = require('../models');

describe('learningTraceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateTraceInput', () => {
    it('accepts funnel impression events', () => {
      const input = validateTraceInput({
        traceId: 'af_english_table01',
        gameId: 'activity_recommendation',
        eventType: 'funnel_impression',
        clientSessionId: 'ls_123456',
        payload: { activityKey: 'english-table' },
      });
      expect(input.eventType).toBe('funnel_impression');
    });

    it('accepts a valid word_bridge session_complete payload', () => {
      const input = validateTraceInput({
        traceId: 'wb_testtrace001',
        gameId: 'word_bridge',
        eventType: 'session_complete',
        clientSessionId: 'ls_123456',
        durationMs: 120000,
        cefrLevel: 'B1',
        skillTags: ['vocabulary'],
        payload: { endReason: 'mistakes', passedLevels: ['A1', 'A2'] },
      });

      expect(input.gameId).toBe('word_bridge');
      expect(input.cefrLevel).toBe('B1');
    });

    it('accepts listening_ladder and vocabulary_depth gameIds', () => {
      const ll = validateTraceInput({
        traceId: 'll_testtrace001',
        gameId: 'listening_ladder',
        eventType: 'session_complete',
        clientSessionId: 'ls_123456',
        cefrLevel: 'B1',
        payload: { endReason: 'time_up' },
      });
      const vd = validateTraceInput({
        traceId: 'vd_testtrace001',
        gameId: 'vocabulary_depth',
        eventType: 'session_complete',
        clientSessionId: 'ls_123456',
        cefrLevel: 'A2',
        payload: { endReason: 'level_failed' },
      });
      expect(ll.gameId).toBe('listening_ladder');
      expect(vd.gameId).toBe('vocabulary_depth');
    });
  });

  describe('recordLearningTrace', () => {
    it('creates a new trace when traceId+eventType is unseen', async () => {
      LearningTraceEvent.findOne.mockResolvedValue(null);
      LearningTraceEvent.create.mockResolvedValue({
        id: 1,
        traceId: 'wb_newtrace01',
        eventType: 'session_complete',
        studentId: null,
        payload: {},
      });

      const result = await recordLearningTrace({
        traceId: 'wb_newtrace01',
        gameId: 'word_bridge',
        eventType: 'session_complete',
        clientSessionId: 'ls_abc123',
        durationMs: 90000,
        payload: { endReason: 'cleared_c1' },
      });

      expect(result.created).toBe(true);
      expect(LearningTraceEvent.create).toHaveBeenCalledTimes(1);
    });

    it('allows session_start and session_complete with same traceId', async () => {
      LearningTraceEvent.findOne.mockResolvedValue(null);
      LearningTraceEvent.create.mockResolvedValue({ id: 2, traceId: 'wb_same01', eventType: 'session_start' });

      await recordLearningTrace({
        traceId: 'wb_same01',
        gameId: 'word_bridge',
        eventType: 'session_start',
        clientSessionId: 'ls_abc123',
      });

      expect(LearningTraceEvent.findOne).toHaveBeenCalledWith({
        where: { traceId: 'wb_same01', eventType: 'session_start' },
      });
    });

    it('projects to LJ when studentId present on session_complete', async () => {
      LearningTraceEvent.findOne.mockResolvedValue(null);
      LearningTraceEvent.create.mockResolvedValue({
        id: 3,
        traceId: 'wb_proj001',
        eventType: 'session_complete',
        studentId: '12345678',
        gameId: 'word_bridge',
        occurredAt: new Date(),
        cefrLevel: 'B1',
        durationMs: 60000,
        score: 2,
        payload: {},
      });
      LjStudentEvent.findOne.mockResolvedValue(null);
      LjStudentEvent.create.mockResolvedValue({ id: 99 });

      const result = await recordLearningTrace({
        traceId: 'wb_proj001',
        gameId: 'word_bridge',
        eventType: 'session_complete',
        clientSessionId: 'ls_abc123',
        studentId: '12345678',
      });

      expect(result.projected).toBe(true);
      expect(LjStudentEvent.create).toHaveBeenCalled();
    });
  });

  describe('getRecommendationFunnelSummary', () => {
    it('aggregates funnel steps', async () => {
      LearningTraceEvent.findAll.mockResolvedValue([
        { eventType: 'funnel_impression', clientSessionId: 'ls1', payload: { activityKey: 'english-table' } },
        { eventType: 'funnel_click', clientSessionId: 'ls1', payload: { activityKey: 'english-table' } },
        { eventType: 'funnel_book_attempt', clientSessionId: 'ls1', payload: { activityKey: 'english-table' } },
      ]);

      const summary = await getRecommendationFunnelSummary({ days: 30 });
      expect(summary.funnel.impressions).toBe(1);
      expect(summary.funnel.clicks).toBe(1);
      expect(summary.funnel.bookAttempts).toBe(1);
    });
  });

  describe('getMicroLearningEngagementSummary', () => {
    it('aggregates completed sessions', async () => {
      LearningTraceEvent.findAll.mockResolvedValue([
        {
          traceId: 'wb_a',
          clientSessionId: 'ls_1',
          studentId: null,
          occurredAt: new Date('2026-08-27T10:00:00Z'),
          durationMs: 60000,
          cefrLevel: 'A2',
          payload: { endReason: 'mistakes', totalMistakes: 3 },
        },
      ]);

      const summary = await getMicroLearningEngagementSummary({ days: 30, gameId: 'word_bridge' });
      expect(summary.totals.completedSessions).toBe(1);
      expect(summary.gameId).toBe('word_bridge');
    });

    it('returns overview when gameId=all', async () => {
      LearningTraceEvent.findAll
        .mockResolvedValueOnce([{ clientSessionId: 'a', occurredAt: new Date(), durationMs: 1000, payload: {} }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const summary = await getMicroLearningEngagementSummary({ days: 30, gameId: 'all' });
      expect(summary.gameId).toBe('all');
      expect(summary.perGame).toHaveLength(4);
      expect(summary.totals.completedSessions).toBe(1);
    });

    it('summarizes vocabulary_depth item-level response stats', async () => {
      LearningTraceEvent.findAll.mockResolvedValue([
        {
          traceId: 'vd_a',
          clientSessionId: 'ls_1',
          studentId: null,
          occurredAt: new Date('2026-08-27T10:00:00Z'),
          durationMs: 60000,
          cefrLevel: 'B1',
          payload: {
            endReason: 'level_failed',
            answerLog: [
              {
                itemId: 'vd_b1_01',
                questionId: 'vd_b1_01',
                level: 'B1',
                cefrLevel: 'B1',
                word: 'clarify',
                itemType: 'synonym',
                skillDimension: 'vocabulary_depth',
                componentProcess: 'synonym_discrimination',
                activityTags: ['english_table'],
                source: 'manual_seed',
                reviewStatus: 'reviewed',
                isCorrect: true,
                responseMs: 2000,
              },
              {
                itemId: 'vd_b1_01',
                questionId: 'vd_b1_01',
                level: 'B1',
                isCorrect: false,
                responseMs: 4000,
              },
            ],
          },
        },
      ]);

      const summary = await getMicroLearningEngagementSummary({ days: 30, gameId: 'vocabulary_depth' });
      expect(summary.itemStats).toHaveLength(1);
      expect(summary.itemStats[0]).toMatchObject({
        itemId: 'vd_b1_01',
        exposureCount: 2,
        correctCount: 1,
        correctRate: 0.5,
        avgResponseMs: 3000,
        health: {
          status: 'insufficient_data',
          label: '資料不足',
        },
      });
    });
  });
});

describe('summarizeVocabularyDepthItemStats', () => {
  it('returns an empty array when answerLog is missing', () => {
    expect(summarizeVocabularyDepthItemStats([{ payload: {} }])).toEqual([]);
  });

  it('computes ability group rates and discrimination hints', () => {
    const makeAnswers = (count, isCorrect) => Array.from({ length: count }, () => ({
      itemId: 'vd_b1_02',
      questionId: 'vd_b1_02',
      level: 'B1',
      word: 'participate',
      itemType: 'synonym',
      skillDimension: 'vocabulary_depth',
      componentProcess: 'synonym_discrimination',
      activityTags: [],
      source: 'manual_seed',
      reviewStatus: 'reviewed',
      isCorrect,
      responseMs: 3000,
    }));

    const stats = summarizeVocabularyDepthItemStats([
      { cefrLevel: 'A1', payload: { answerLog: makeAnswers(3, false) } },
      { cefrLevel: 'B2', payload: { answerLog: makeAnswers(3, true) } },
    ]);

    expect(stats[0].abilityGroupStats).toEqual([
      { level: 'A1', exposureCount: 3, correctCount: 0, correctRate: 0 },
      { level: 'B2', exposureCount: 3, correctCount: 3, correctRate: 1 },
    ]);
    expect(stats[0].discrimination).toMatchObject({
      status: 'observable',
      spread: 1,
    });
    expect(stats[0].metadataSuggestion).toMatchObject({
      status: 'needs_human_review',
      source: 'llm_pending',
      needsHumanReview: true,
    });
  });
});

describe('assessVocabularyDepthItemHealth', () => {
  it('marks low-exposure items as insufficient data', () => {
    expect(assessVocabularyDepthItemHealth({
      exposureCount: 3,
      correctRate: 1,
      avgResponseMs: 1000,
    })).toMatchObject({
      status: 'insufficient_data',
      severity: 'muted',
    });
  });

  it('marks stable items as observable', () => {
    expect(assessVocabularyDepthItemHealth({
      exposureCount: 12,
      correctRate: 0.65,
      avgResponseMs: 4000,
    })).toMatchObject({
      status: 'observable',
      severity: 'ok',
    });
  });

  it('flags items that may need review', () => {
    const health = assessVocabularyDepthItemHealth({
      exposureCount: 14,
      correctRate: 0.2,
      avgResponseMs: 15000,
    });
    expect(health.status).toBe('review_suggested');
    expect(health.reasons).toEqual(
      expect.arrayContaining([
        '答對率偏低，可能太難或題目需檢查',
        '平均反應時間偏長',
      ]),
    );
  });

  it('flags low discrimination when group spread is small', () => {
    const health = assessVocabularyDepthItemHealth({
      exposureCount: 14,
      correctRate: 0.6,
      avgResponseMs: 3000,
      discrimination: { status: 'low_discrimination' },
    });
    expect(health.status).toBe('review_suggested');
    expect(health.reasons).toContain('高低估計程度答對率差異偏小，疑似鑑別度不足');
  });
});

describe('learningFeedbackService', () => {
  it('generates promotion-focused feedback by default', async () => {
    const feedback = await generateRegulatoryFocusFeedback({
      weakSkills: ['speaking'],
      estimatedLevel: 'B1',
    }, {});
    expect(feedback.regulatoryFocus).toBe('promotion');
    expect(feedback.actionItems.length).toBeGreaterThan(0);
  });

  it('generates prevention-focused feedback when requested', async () => {
    const feedback = await generateRegulatoryFocusFeedback({}, { regulatoryFocus: 'prevention' });
    expect(feedback.regulatoryFocus).toBe('prevention');
  });
});

describe('learningGamificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defines badge catalog', () => {
    expect(BADGE_DEFS.length).toBeGreaterThan(3);
  });

  it('computes gamification profile', async () => {
    const { LearningTraceEvent, Reservation, EnglishLearningPassport } = require('../models');
    LearningTraceEvent.findAll.mockResolvedValue([
      { occurredAt: new Date(), gameId: 'word_bridge', cefrLevel: 'A2' },
    ]);
    Reservation.findAll.mockResolvedValue([]);
    EnglishLearningPassport.findOne.mockResolvedValue({ totalApprovedPoints: 0 });

    const profile = await getStudentGamificationProfile('12345678');
    expect(profile.badges.some((badge) => badge.id === 'first_word_bridge' && badge.earned)).toBe(true);
  });
});
