import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LISTENING_LADDER_DURATION_SECONDS,
  LISTENING_LADDER_LEVELS,
} from '../constants/learningContentTypes';
import {
  pickQuestion,
  buildSoundMatchOptions,
  maxLevel,
} from '../data/learningContent/listeningLadderBank';
import {
  scoreForCorrect,
  adjustLevel,
  computeAccuracy,
  LADDER_UP_STREAK,
  LADDER_DOWN_STREAK,
} from '../data/learningContent/listeningLadderScoring';
import { cancelSpeech, speakWord, speakTestSample, preloadSpeechVoices } from '../utils/speech/speakWord';
import { saveBestScore, saveSession as saveLadderSession } from '../services/listeningLadder/sessionRepository';
import { createMicroLearningTraceId } from '../utils/microLearningTraceId';

export const PHASE = {
  IDLE: 'idle',
  READY: 'ready',
  PLAYING: 'playing',
  FEEDBACK: 'feedback',
  COMPLETED: 'completed',
  ERROR: 'error',
};

const FEEDBACK_MS = 700;

function createInitialState() {
  return {
    phase: PHASE.IDLE,
    secondsLeft: LISTENING_LADDER_DURATION_SECONDS,
    currentLevel: 'A1',
    highestLevelReached: 'A1',
    score: 0,
    streak: 0,
    bestStreak: 0,
    correctCount: 0,
    totalAnswered: 0,
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    currentQuestion: null,
    options: [],
    lastFeedback: null,
    wordsHeard: [],
    usedQuestionIds: [],
    answerLog: [],
    speechError: null,
    startedAt: null,
    traceId: '',
    sessionSummary: null,
  };
}

export default function useListeningLadderGame() {
  const [state, setState] = useState(createInitialState);
  const stateRef = useRef(state);
  const feedbackTimerRef = useRef(null);
  const timerRef = useRef(null);
  const lastAutoPlayedIdRef = useRef(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const loadNextQuestion = useCallback((level, usedIds) => {
    const item = pickQuestion({ level, excludeIds: usedIds });
    if (!item) return null;
    return {
      item,
      options: buildSoundMatchOptions(item),
    };
  }, []);

  const endGame = useCallback(() => {
    cancelSpeech();
    if (timerRef.current) clearInterval(timerRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);

    setState((prev) => {
      const accuracy = computeAccuracy(prev.correctCount, prev.totalAnswered);
      const durationMs = prev.startedAt ? Date.now() - prev.startedAt : 0;
      const sessionSummary = {
        traceId: prev.traceId,
        score: prev.score,
        accuracy,
        highestLevelReached: prev.highestLevelReached,
        correctCount: prev.correctCount,
        totalAnswered: prev.totalAnswered,
        bestStreak: prev.bestStreak,
        wordsHeard: prev.wordsHeard,
        answerLog: prev.answerLog,
        durationMs,
      };
      void saveBestScore({
        score: sessionSummary.score,
        accuracy: sessionSummary.accuracy,
        highestLevelReached: sessionSummary.highestLevelReached,
      });
      void saveLadderSession(sessionSummary);
      return {
        ...prev,
        phase: PHASE.COMPLETED,
        ...sessionSummary,
        sessionSummary,
      };
    });
  }, []);

  const playTestSound = useCallback(async () => {
    if (stateRef.current.phase !== PHASE.READY) return;
    try {
      await speakTestSample();
      setState((s) => ({ ...s, speechError: null }));
    } catch (err) {
      setState((s) => ({
        ...s,
        speechError: err?.message || 'SPEECH_PLAYBACK_FAILED',
      }));
    }
  }, []);

  const playCurrentWord = useCallback(async () => {
    const { currentQuestion, phase } = stateRef.current;
    if (!currentQuestion || (phase !== PHASE.PLAYING && phase !== PHASE.READY)) return;
    try {
      await speakWord(currentQuestion.audioText || currentQuestion.word);
      setState((s) => ({ ...s, speechError: null }));
    } catch (err) {
      setState((s) => ({
        ...s,
        speechError: err?.message || 'SPEECH_PLAYBACK_FAILED',
      }));
    }
  }, []);

  const advanceAfterFeedback = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== PHASE.FEEDBACK) return prev;
      if (prev.secondsLeft <= 0) return prev;
      const next = loadNextQuestion(prev.currentLevel, prev.usedQuestionIds);
      if (!next) return prev;
      return {
        ...prev,
        phase: PHASE.PLAYING,
        currentQuestion: next.item,
        options: next.options,
        lastFeedback: null,
        usedQuestionIds: [...prev.usedQuestionIds, next.item.id],
        wordsHeard: [...prev.wordsHeard, next.item.word],
      };
    });
  }, [loadNextQuestion]);

  const goReady = useCallback(() => {
    preloadSpeechVoices();
    setState((prev) => ({ ...prev, phase: PHASE.READY, speechError: null }));
  }, []);

  const startGame = useCallback(() => {
    cancelSpeech();
    lastAutoPlayedIdRef.current = null;
    const first = loadNextQuestion('A1', []);
    if (!first) {
      setState((prev) => ({ ...prev, phase: PHASE.ERROR, speechError: 'NO_QUESTIONS' }));
      return;
    }

    setState({
      ...createInitialState(),
      phase: PHASE.PLAYING,
      currentQuestion: first.item,
      options: first.options,
      usedQuestionIds: [first.item.id],
      wordsHeard: [first.item.word],
      startedAt: Date.now(),
      traceId: createMicroLearningTraceId('ll_'),
    });
  }, [loadNextQuestion]);

  const replayWord = useCallback(() => {
    if (stateRef.current.phase !== PHASE.PLAYING) return;
    playCurrentWord();
  }, [playCurrentWord]);

  const selectOption = useCallback((optionId) => {
    const prev = stateRef.current;
    if (prev.phase !== PHASE.PLAYING) return;

    const selected = prev.options.find((o) => o.id === optionId);
    if (!selected) return;

    const isCorrect = selected.isCorrect;
    let newLevel = prev.currentLevel;
    let consecutiveCorrect = isCorrect ? prev.consecutiveCorrect + 1 : 0;
    let consecutiveWrong = isCorrect ? 0 : prev.consecutiveWrong + 1;

    if (isCorrect && consecutiveCorrect >= LADDER_UP_STREAK) {
      newLevel = adjustLevel(prev.currentLevel, 'up');
      consecutiveCorrect = 0;
    } else if (!isCorrect && consecutiveWrong >= LADDER_DOWN_STREAK) {
      newLevel = adjustLevel(prev.currentLevel, 'down');
      consecutiveWrong = 0;
    }

    const newStreak = isCorrect ? prev.streak + 1 : 0;
    const points = isCorrect ? scoreForCorrect(prev.currentLevel, newStreak) : 0;

    setState({
      ...prev,
      phase: PHASE.FEEDBACK,
      currentLevel: newLevel,
      highestLevelReached: maxLevel(newLevel, prev.highestLevelReached),
      score: prev.score + points,
      streak: newStreak,
      bestStreak: Math.max(prev.bestStreak, newStreak),
      correctCount: prev.correctCount + (isCorrect ? 1 : 0),
      totalAnswered: prev.totalAnswered + 1,
      consecutiveCorrect,
      consecutiveWrong,
      lastFeedback: {
        isCorrect,
        correctWord: prev.currentQuestion?.word || '',
        selectedText: selected.text,
      },
      answerLog: [
        ...prev.answerLog,
        {
          word: prev.currentQuestion?.word || '',
          translationZh: prev.currentQuestion?.translationZh || '',
          selectedText: selected.text,
          isCorrect,
          level: prev.currentLevel,
        },
      ],
    });

    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      const current = stateRef.current;
      if (current.secondsLeft <= 0) {
        endGame();
        return;
      }
      advanceAfterFeedback();
    }, FEEDBACK_MS);
  }, [advanceAfterFeedback, endGame]);

  const resetGame = useCallback(() => {
    cancelSpeech();
    lastAutoPlayedIdRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setState(createInitialState());
  }, []);

  useEffect(() => {
    if (state.phase !== PHASE.PLAYING || !state.currentQuestion) return;
    const questionId = state.currentQuestion.id;
    if (lastAutoPlayedIdRef.current === questionId) return;
    lastAutoPlayedIdRef.current = questionId;
    playCurrentWord();
  }, [state.phase, state.currentQuestion, playCurrentWord]);

  useEffect(() => {
    if (state.phase !== PHASE.PLAYING && state.phase !== PHASE.FEEDBACK) {
      if (timerRef.current) clearInterval(timerRef.current);
      return undefined;
    }

    timerRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.secondsLeft <= 1) {
          return { ...prev, secondsLeft: 0 };
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.phase]);

  useEffect(() => {
    if (state.secondsLeft === 0 && (state.phase === PHASE.PLAYING || state.phase === PHASE.FEEDBACK)) {
      endGame();
    }
  }, [state.secondsLeft, state.phase, endGame]);

  useEffect(() => () => {
    cancelSpeech();
    if (timerRef.current) clearInterval(timerRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
  }, []);

  return {
    ...state,
    levels: LISTENING_LADDER_LEVELS,
    accuracy: computeAccuracy(state.correctCount, state.totalAnswered),
    goReady,
    startGame,
    selectOption,
    replayWord,
    playCurrentWord,
    playTestSound,
    resetGame,
    isTimerUrgent: state.secondsLeft <= 10 && state.secondsLeft > 0,
  };
}
