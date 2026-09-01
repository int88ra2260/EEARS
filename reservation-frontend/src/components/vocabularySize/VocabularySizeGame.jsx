import React, { useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import useVocabularySizeGame, { PHASE } from '../../hooks/useVocabularySizeGame';
import { submitLearningTrace } from '../../services/learningTraceApi';
import {
  buildMiniGameStartPayload,
  buildVocabularySizeCompletePayload,
} from '../../utils/learningEventPayload';
import { saveSession } from '../../services/vocabularySize/sessionRepository';
import VocabularySizeIntro from './VocabularySizeIntro';
import VocabularySizeWord from './VocabularySizeWord';
import VocabularySizeResult from './VocabularySizeResult';
import './VocabularySizeGame.css';

function formatMessage(t, key, vars = {}) {
  const tpl = t(key);
  if (typeof tpl !== 'string' || tpl === key) return String(vars.default ?? '');
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
}

export default function VocabularySizeGame({ onPhaseChange }) {
  const { t } = useLanguage();
  const game = useVocabularySizeGame();
  const startTraceSentRef = useRef(false);
  const completeTraceSentRef = useRef(false);

  useEffect(() => {
    onPhaseChange?.(game.phase === PHASE.PLAYING ? 'playing' : game.phase);
    if (game.phase === PHASE.INTRO) {
      startTraceSentRef.current = false;
      completeTraceSentRef.current = false;
    }
  }, [game.phase, onPhaseChange]);

  useEffect(() => {
    if (game.phase !== PHASE.PLAYING || !game.traceId || startTraceSentRef.current) return;
    startTraceSentRef.current = true;
    submitLearningTrace(buildMiniGameStartPayload('vocabulary_size', {
      traceId: game.traceId,
    }));
  }, [game.phase, game.traceId]);

  useEffect(() => {
    if (game.phase !== PHASE.RESULTS || !game.sessionSummary || !game.result) return;
    if (completeTraceSentRef.current) return;
    completeTraceSentRef.current = true;

    const payload = buildVocabularySizeCompletePayload(game.result, game.sessionSummary);
    if (payload.traceId) {
      submitLearningTrace(payload);
    }

    saveSession({
      traceId: game.sessionSummary.traceId,
      estimatedWords: game.result.estimatedWords,
      estimatedLevel: game.result.estimatedLevel,
      recognitionRate: game.result.recognitionRate,
      durationMs: game.sessionSummary.durationMs,
      completedAt: new Date().toISOString(),
      result: game.result,
    });
  }, [game.phase, game.sessionSummary, game.result]);

  if (game.phase === PHASE.INTRO) {
    return (
      <div className="vocabulary-size">
        <VocabularySizeIntro t={t} onStart={game.startGame} />
      </div>
    );
  }

  if (game.phase === PHASE.RESULTS && game.result) {
    return (
      <div className="vocabulary-size">
        <VocabularySizeResult
          t={(key, vars) => (vars ? formatMessage(t, key, vars) : t(key))}
          result={game.result}
          onPlayAgain={game.resetGame}
        />
      </div>
    );
  }

  if (game.phase === PHASE.PLAYING && game.currentItem) {
    return (
      <div className="vocabulary-size">
        <VocabularySizeWord
          t={(key, vars) => (vars ? formatMessage(t, key, vars) : t(key))}
          item={game.currentItem}
          progress={game.progress}
          onKnow={game.respond}
          onDontKnow={game.respond}
        />
      </div>
    );
  }

  return null;
}
