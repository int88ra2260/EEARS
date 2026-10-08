'use strict';

const { buildAutomatedAnalysis, resolveAttemptTranscript } = require('../services/speakingDiagnosticService');

const TARGET = 'The library is open until eight';

const readAloudTask = {
  taskType: 'read_aloud',
  targetText: TARGET,
  targetWords: 6,
  prompt: 'Read the sentence aloud.',
};

const opinionTask = {
  taskType: 'opinion_response',
  targetText: '',
  targetWords: 20,
  prompt: 'Should the library stay open late for students who work?',
  targetVocabulary: ['library', 'students'],
  focusTags: [],
  teacherGoal: '',
};

function alignmentFor(text) {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  return {
    status: 'aligned',
    engine: 'mfa_align_one_resident_v1',
    words: words.map((word, index) => ({
      word,
      startMs: index * 400,
      endMs: index * 400 + 380,
      durationMs: 380,
      status: 'aligned',
    })),
    phones: [],
    metrics: { speechMs: words.length * 380 },
    warnings: [],
  };
}

function analyzeReadAloud({ transcript, durationMs, clientFeatures, alignment }) {
  return buildAutomatedAnalysis({
    task: readAloudTask,
    transcript,
    durationMs,
    clientFeatures: clientFeatures || {},
    alignment: alignment === undefined ? alignmentFor(TARGET) : alignment,
  });
}

describe('speaking diagnostic transcript source', () => {
  test('keeps a browser transcript ahead of the server transcript', () => {
    expect(resolveAttemptTranscript('the library is open', 'something else', 'faster-whisper:small.en'))
      .toEqual({ transcript: 'the library is open', transcriptSource: 'browser' });
  });

  test('uses the server transcript when the browser heard nothing', () => {
    expect(resolveAttemptTranscript('', 'The library is open until eight.', 'faster-whisper:small.en'))
      .toEqual({
        transcript: 'The library is open until eight.',
        transcriptSource: 'faster-whisper:small.en',
      });
  });

  test('leaves the transcript empty when neither source heard words', () => {
    expect(resolveAttemptTranscript('  ', '')).toEqual({ transcript: null, transcriptSource: null });
  });
});

describe('speaking diagnostic scoring', () => {
  test('read-aloud completion follows the transcript, not MFA coverage', () => {
    const { presentationScores, features, wordResults } = analyzeReadAloud({
      transcript: 'banana banana banana',
      durationMs: 3000,
      clientFeatures: { spokenWordEstimate: 6, pauseCount: 0, averagePauseDurationMs: 0, totalPauseMs: 0 },
    });

    expect(features.alignmentCompletionRate).toBe(1);
    expect(presentationScores.completionPercent).toBe(0);
    expect(presentationScores.overallPercent).toBe(0);
    expect(presentationScores.pronunciationPercent).toBeLessThan(40);
    expect(presentationScores.similarityPercent).toBeLessThan(40);
    expect(wordResults.every((word) => word.status !== 'aligned')).toBe(true);
    expect(wordResults.some((word) => word.status === 'missing')).toBe(true);
    expect(features.speechRateWpm).toBe(60);
  });

  test('a matching read-aloud transcript can still score high', () => {
    const { presentationScores, wordResults } = analyzeReadAloud({
      transcript: TARGET,
      durationMs: 3000,
      clientFeatures: { pauseCount: 0, averagePauseDurationMs: 200, totalPauseMs: 0 },
    });

    expect(presentationScores.completionPercent).toBe(100);
    expect(presentationScores.overallPercent).toBe(100);
    expect(presentationScores.similarityPercent).toBe(100);
    expect(presentationScores.pronunciationPercent).toBeGreaterThanOrEqual(80);
    expect(wordResults.every((word) => word.status === 'matched')).toBe(true);
  });

  test('missing transcript does not invent completion or pronunciation from alignment', () => {
    const { presentationScores, features } = analyzeReadAloud({
      transcript: '',
      durationMs: 3000,
      clientFeatures: { spokenWordEstimate: 6, pauseCount: 0, averagePauseDurationMs: 0, totalPauseMs: 0 },
    });

    expect(presentationScores.completionPercent).toBeNull();
    expect(presentationScores.pronunciationPercent).toBeNull();
    expect(presentationScores.similarityPercent).toBeNull();
    expect(features.speechRateWpm).toBeNull();
    expect(features.wordResults.every((word) => word.status !== 'aligned')).toBe(true);
  });

  test('poor pace and long pauses do not keep fluency at 50%', () => {
    const { presentationScores } = analyzeReadAloud({
      transcript: TARGET,
      durationMs: 20000,
      clientFeatures: { pauseCount: 8, totalPauseMs: 16000, averagePauseDurationMs: 2000 },
    });

    expect(presentationScores.fluencyPercent).toBeLessThan(40);
    expect(presentationScores.overallPercent).toBe(100);
  });

  test('open-response scores do not award a full completion or a free task-achievement floor', () => {
    const offTopic = buildAutomatedAnalysis({
      task: opinionTask,
      transcript: 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango',
      durationMs: 20000,
      clientFeatures: {},
      alignment: { status: 'not_applicable', words: [], phones: [] },
    });
    const onTopic = buildAutomatedAnalysis({
      task: opinionTask,
      transcript: 'The library should stay open late for students who work because they need a quiet place.',
      durationMs: 20000,
      clientFeatures: {},
      alignment: { status: 'not_applicable', words: [], phones: [] },
    });

    expect(offTopic.presentationScores.completionPercent).toBeLessThanOrEqual(30);
    expect(offTopic.presentationScores.overallPercent).toBe(offTopic.presentationScores.completionPercent);
    expect(offTopic.presentationScores.taskAchievementPercent).toBeLessThan(20);
    expect(onTopic.presentationScores.completionPercent).toBeGreaterThan(offTopic.presentationScores.completionPercent);
    expect(onTopic.presentationScores.taskAchievementPercent).toBeGreaterThan(offTopic.presentationScores.taskAchievementPercent);
    expect(offTopic.presentationScores.grammarPercent).toBeNull();
    expect(offTopic.presentationScores.coherencePercent).toBeNull();
  });

  test('a very short final sibilant is not counted as a pronounced plural', () => {
    const target = 'I listen to short English videos';
    const words = target.toLowerCase().split(' ');
    const alignment = {
      status: 'aligned',
      engine: 'mfa_align_one_resident_v1',
      words: words.map((word, index) => ({
        index,
        word,
        startMs: index * 400,
        endMs: index * 400 + 300,
        durationMs: 300,
      })),
      phones: words.flatMap((word, index) => {
        const start = index * 400;
        if (word !== 'videos') {
          return [{ wordIndex: index, phone: 'AH', startMs: start, endMs: start + 180 }];
        }
        return [
          { wordIndex: index, phone: 'V', startMs: start, endMs: start + 80 },
          { wordIndex: index, phone: 'Z', startMs: start + 280, endMs: start + 296 },
        ];
      }),
      metrics: { speechMs: words.length * 400 },
      warnings: [],
    };
    const { presentationScores, wordResults, features } = buildAutomatedAnalysis({
      task: { taskType: 'read_aloud', targetText: target, targetWords: words.length },
      transcript: target,
      durationMs: 4000,
      clientFeatures: {},
      alignment,
    });
    expect(wordResults.find((word) => word.word === 'videos').status).toBe('ending');
    expect(features.weakEndings).toContain('videos');
    expect(presentationScores.completionPercent).toBeLessThan(100);
    expect(presentationScores.overallPercent).toBe(presentationScores.completionPercent);
    expect(presentationScores.similarityPercent).toBeLessThan(100);
  });

  test('a clearly spoken final sibilant still counts as the plural', () => {
    const target = 'I listen to short English videos';
    const words = target.toLowerCase().split(' ');
    const alignment = {
      status: 'aligned',
      engine: 'mfa_align_one_resident_v1',
      words: words.map((word, index) => ({
        index,
        word,
        startMs: index * 400,
        endMs: index * 400 + 300,
        durationMs: 300,
      })),
      phones: [
        { wordIndex: words.length - 1, phone: 'V', startMs: 2000, endMs: 2080 },
        { wordIndex: words.length - 1, phone: 'Z', startMs: 2100, endMs: 2180 },
      ],
      metrics: { speechMs: words.length * 400 },
      warnings: [],
    };
    const { presentationScores, wordResults } = buildAutomatedAnalysis({
      task: { taskType: 'read_aloud', targetText: target, targetWords: words.length },
      transcript: target,
      durationMs: 4000,
      clientFeatures: {},
      alignment,
    });
    expect(wordResults.find((word) => word.word === 'videos').status).toBe('matched');
    expect(presentationScores.completionPercent).toBe(100);
  });
});
