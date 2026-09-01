import { useCallback, useMemo, useRef, useState } from 'react';
import {
  VOCABULARY_DEPTH_LEVELS,
  QUESTIONS_PER_LEVEL,
  getQuestionsForLevel,
  computeVocabularyDepthResult,
  didPassLevel,
  nextLevel,
} from '../data/learningContent/vocabularyDepth';
import { createMicroLearningTraceId } from '../utils/microLearningTraceId';

export const PHASE = {
  INTRO: 'intro',
  PLAYING: 'playing',
  FEEDBACK: 'feedback',
  RESULTS: 'results',
};

const FEEDBACK_MS = 900;

function createInitialState() {
  return {
    phase: PHASE.INTRO,
    currentLevel: 'A1',
    levelIndex: 0,
    questionIndex: 0,
    questions: [],
    currentQuestion: null,
    levelCorrect: 0,
    levelStats: [],
    answerLog: [],
    totalCorrect: 0,
    totalAnswered: 0,
    lastFeedback: null,
    passedLevels: [],
    failLevel: null,
    endReason: null,
    traceId: '',
    startedAt: null,
    durationMs: 0,
    sessionSummary: null,
    result: null,
  };
}

export default function useVocabularyDepthGame() {
  const [state, setState] = useState(createInitialState);
  const stateRef = useRef(state);
  const feedbackTimerRef = useRef(null);
  stateRef.current = state;

  const clearFeedbackTimer = useCallback(() => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  }, []);

  const finishSession = useCallback((partial) => {
    clearFeedbackTimer();
    setState((prev) => {
      const durationMs = prev.startedAt ? Date.now() - prev.startedAt : 0;
      const sessionSummary = {
        traceId: prev.traceId,
        durationMs,
        passedLevels: partial.passedLevels ?? prev.passedLevels,
        failLevel: partial.failLevel ?? prev.failLevel,
        endReason: partial.endReason,
        levelStats: partial.levelStats ?? prev.levelStats,
        answerLog: prev.answerLog,
        totalCorrect: prev.totalCorrect,
        totalAnswered: prev.totalAnswered,
      };
      const result = computeVocabularyDepthResult(sessionSummary);
      return {
        ...prev,
        ...partial,
        phase: PHASE.RESULTS,
        durationMs,
        sessionSummary,
        result,
      };
    });
  }, [clearFeedbackTimer]);

  const beginLevel = useCallback((level) => {
    const questions = getQuestionsForLevel(level, QUESTIONS_PER_LEVEL);
    if (!questions.length) {
      finishSession({
        endReason: 'no_questions',
        failLevel: level,
      });
      return null;
    }
    return {
      currentLevel: level,
      questions,
      questionIndex: 0,
      levelCorrect: 0,
      currentQuestion: questions[0],
    };
  }, [finishSession]);

  const startGame = useCallback(() => {
    clearFeedbackTimer();
    const traceId = createMicroLearningTraceId('vd_');
    const levelStart = beginLevel('A1');
    if (!levelStart) return;

    setState({
      ...createInitialState(),
      phase: PHASE.PLAYING,
      traceId,
      startedAt: Date.now(),
      ...levelStart,
      levelIndex: 0,
    });
  }, [beginLevel, clearFeedbackTimer]);

  const advanceAfterLevel = useCallback((levelStat, passedLevels) => {
    const current = stateRef.current.currentLevel;
    if (!levelStat.passed) {
      finishSession({
        passedLevels,
        failLevel: current,
        endReason: 'level_failed',
        levelStats: [...stateRef.current.levelStats, levelStat],
      });
      return;
    }

    const upcoming = nextLevel(current);
    if (!upcoming) {
      finishSession({
        passedLevels: [...passedLevels, current],
        failLevel: null,
        endReason: 'cleared_c1',
        levelStats: [...stateRef.current.levelStats, levelStat],
      });
      return;
    }

    const levelStart = beginLevel(upcoming);
    if (!levelStart) return;

    setState((prev) => ({
      ...prev,
      phase: PHASE.PLAYING,
      passedLevels: [...passedLevels, current],
      levelStats: [...prev.levelStats, levelStat],
      levelIndex: prev.levelIndex + 1,
      questionIndex: 0,
      ...levelStart,
      lastFeedback: null,
    }));
  }, [beginLevel, finishSession]);

  const selectOption = useCallback((optionId) => {
    const prev = stateRef.current;
    if (prev.phase !== PHASE.PLAYING || !prev.currentQuestion) return;

    const question = prev.currentQuestion;
    const isCorrect = optionId === question.correctOptionId;
    const levelCorrect = prev.levelCorrect + (isCorrect ? 1 : 0);
    const totalCorrect = prev.totalCorrect + (isCorrect ? 1 : 0);
    const totalAnswered = prev.totalAnswered + 1;
    const selected = question.options.find((o) => o.id === optionId);

    const answerEntry = {
      questionId: question.id,
      level: question.level,
      word: question.word,
      isCorrect,
      selectedOptionId: optionId,
    };

    setState({
      ...prev,
      phase: PHASE.FEEDBACK,
      levelCorrect,
      totalCorrect,
      totalAnswered,
      answerLog: [...prev.answerLog, answerEntry],
      lastFeedback: {
        isCorrect,
        question,
        selectedText: selected?.text || '',
        selectedOptionId: optionId,
        correctOptionId: question.correctOptionId,
      },
    });

    clearFeedbackTimer();
    feedbackTimerRef.current = setTimeout(() => {
      const current = stateRef.current;
      if (current.phase !== PHASE.FEEDBACK) return;

      const nextIndex = current.questionIndex + 1;
      if (nextIndex < current.questions.length) {
        setState((s) => ({
          ...s,
          phase: PHASE.PLAYING,
          questionIndex: nextIndex,
          currentQuestion: s.questions[nextIndex],
          lastFeedback: null,
        }));
        return;
      }

      const snap = stateRef.current;
      const levelStat = {
        level: snap.currentLevel,
        correct: snap.levelCorrect,
        total: snap.questions.length,
        passed: didPassLevel(snap.currentLevel, snap.levelCorrect, snap.questions.length),
      };

      advanceAfterLevel(levelStat, snap.passedLevels);
    }, FEEDBACK_MS);
  }, [advanceAfterLevel, clearFeedbackTimer]);

  const resetGame = useCallback(() => {
    clearFeedbackTimer();
    setState(createInitialState());
  }, [clearFeedbackTimer]);

  const progress = useMemo(() => {
    if (!state.questions.length) {
      return { current: 0, total: QUESTIONS_PER_LEVEL, levelLabel: state.currentLevel };
    }
    return {
      current: state.questionIndex + 1,
      total: state.questions.length,
      levelLabel: state.currentLevel,
    };
  }, [state.questionIndex, state.questions.length, state.currentLevel]);

  return {
    ...state,
    levels: VOCABULARY_DEPTH_LEVELS,
    progress,
    startGame,
    selectOption,
    resetGame,
  };
}
