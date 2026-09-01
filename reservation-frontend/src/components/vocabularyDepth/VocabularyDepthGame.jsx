import React, { useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import useVocabularyDepthGame, { PHASE } from '../../hooks/useVocabularyDepthGame';
import { submitLearningTrace } from '../../services/learningTraceApi';
import {
  buildMiniGameStartPayload,
  buildVocabularyDepthCompletePayload,
} from '../../utils/learningEventPayload';
import { saveSession } from '../../services/vocabularyDepth/sessionRepository';
import VocabularyDepthIntro from './VocabularyDepthIntro';
import VocabularyDepthQuestion from './VocabularyDepthQuestion';
import VocabularyDepthResult from './VocabularyDepthResult';
import './VocabularyDepthGame.css';

function formatMessage(t, key, vars = {}) {
  const tpl = t(key);
  if (typeof tpl !== 'string' || tpl === key) return String(vars.default ?? '');
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
}

export default function VocabularyDepthGame({ onPhaseChange }) {
  const { t, lang } = useLanguage();
  const game = useVocabularyDepthGame();
  const startTraceSentRef = useRef(false);
  const completeTraceSentRef = useRef(false);

  useEffect(() => {
    onPhaseChange?.(
      game.phase === PHASE.PLAYING || game.phase === PHASE.FEEDBACK ? 'playing' : game.phase,
    );
    if (game.phase === PHASE.INTRO) {
      startTraceSentRef.current = false;
      completeTraceSentRef.current = false;
    }
  }, [game.phase, onPhaseChange]);

  useEffect(() => {
    if (game.phase !== PHASE.PLAYING || !game.traceId || startTraceSentRef.current) return;
    startTraceSentRef.current = true;
    submitLearningTrace(buildMiniGameStartPayload('vocabulary_depth', {
      traceId: game.traceId,
      startLevel: 'A1',
    }));
  }, [game.phase, game.traceId]);

  useEffect(() => {
    if (game.phase !== PHASE.RESULTS || !game.sessionSummary || !game.result) return;
    if (completeTraceSentRef.current) return;
    completeTraceSentRef.current = true;

    const payload = buildVocabularyDepthCompletePayload(game.result, game.sessionSummary);
    if (payload.traceId) {
      submitLearningTrace(payload);
    }

    saveSession({
      traceId: game.sessionSummary.traceId,
      estimatedLevel: game.result.estimatedLevel,
      accuracy: game.result.accuracy,
      durationMs: game.sessionSummary.durationMs,
      completedAt: new Date().toISOString(),
      result: game.result,
    });
  }, [game.phase, game.sessionSummary, game.result]);

  if (game.phase === PHASE.INTRO) {
    return (
      <div className="vocabulary-depth">
        <VocabularyDepthIntro t={t} onStart={game.startGame} />
      </div>
    );
  }

  if (game.phase === PHASE.RESULTS && game.result) {
    return (
      <div className="vocabulary-depth">
        <VocabularyDepthResult
          t={(key, vars) => (vars ? formatMessage(t, key, vars) : t(key))}
          result={game.result}
          onPlayAgain={game.resetGame}
        />
      </div>
    );
  }

  if ((game.phase === PHASE.PLAYING || game.phase === PHASE.FEEDBACK) && game.currentQuestion) {
    return (
      <div className="vocabulary-depth">
        <VocabularyDepthQuestion
          t={(key, vars) => (vars ? formatMessage(t, key, vars) : t(key))}
          lang={lang}
          question={game.currentQuestion}
          progress={game.progress}
          lastFeedback={game.lastFeedback}
          onSelect={game.selectOption}
          disabled={game.phase === PHASE.FEEDBACK}
        />
      </div>
    );
  }

  return null;
}
