import { useCallback, useMemo, useRef, useState } from 'react';
import {
  TOTAL_TEST_WORDS,
  buildVocabularySizeDeck,
  computeVocabularySizeResult,
} from '../data/learningContent/vocabularySize';
import { createMicroLearningTraceId } from '../utils/microLearningTraceId';

export const PHASE = {
  INTRO: 'intro',
  PLAYING: 'playing',
  RESULTS: 'results',
};

function createInitialState() {
  return {
    phase: PHASE.INTRO,
    deck: [],
    currentIndex: 0,
    currentItem: null,
    answerLog: [],
    traceId: '',
    startedAt: null,
    durationMs: 0,
    sessionSummary: null,
    result: null,
  };
}

export default function useVocabularySizeGame() {
  const [state, setState] = useState(createInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const finishSession = useCallback((partial) => {
    setState((prev) => {
      const durationMs = prev.startedAt ? Date.now() - prev.startedAt : 0;
      const totalKnown = prev.answerLog.filter((a) => a.known).length;
      const sessionSummary = {
        traceId: prev.traceId,
        durationMs,
        answerLog: prev.answerLog,
        totalKnown,
        totalSampled: prev.answerLog.length,
        ...partial,
      };
      const result = computeVocabularySizeResult(sessionSummary);
      return {
        ...prev,
        ...partial,
        phase: PHASE.RESULTS,
        durationMs,
        sessionSummary,
        result,
      };
    });
  }, []);

  const startGame = useCallback(() => {
    const deck = buildVocabularySizeDeck();
    setState({
      ...createInitialState(),
      phase: PHASE.PLAYING,
      deck,
      currentIndex: 0,
      currentItem: deck[0] || null,
      traceId: createMicroLearningTraceId('vs_'),
      startedAt: Date.now(),
    });
  }, []);

  const respond = useCallback((known) => {
    const prev = stateRef.current;
    if (prev.phase !== PHASE.PLAYING || !prev.currentItem) return;

    const entry = {
      word: prev.currentItem.word,
      band: prev.currentItem.band,
      known: Boolean(known),
    };
    const answerLog = [...prev.answerLog, entry];
    const nextIndex = prev.currentIndex + 1;

    if (nextIndex >= prev.deck.length) {
      finishSession({ answerLog });
      return;
    }

    setState({
      ...prev,
      answerLog,
      currentIndex: nextIndex,
      currentItem: prev.deck[nextIndex],
    });
  }, [finishSession]);

  const resetGame = useCallback(() => {
    setState(createInitialState());
  }, []);

  const progress = useMemo(() => ({
    current: state.currentIndex + 1,
    total: state.deck.length || TOTAL_TEST_WORDS,
  }), [state.currentIndex, state.deck.length]);

  return {
    ...state,
    progress,
    startGame,
    respond,
    resetGame,
  };
}
