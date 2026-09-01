import React, { useCallback, useEffect, useRef } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import useListeningLadderGame, { PHASE } from '../../../hooks/useListeningLadderGame';
import { submitLearningTrace } from '../../../services/learningTraceApi';
import {
  buildMiniGameStartPayload,
  buildListeningLadderCompletePayload,
} from '../../../utils/learningEventPayload';
import GameHero from '../shared/GameHero';
import GameHowToPlay from '../shared/GameHowToPlay';
import ListeningLadderProgress from './ListeningLadderProgress';
import ListeningLadderQuestionCard, { ListeningLadderOptions } from './ListeningLadderQuestionCard';
import ListeningLadderResultSummary from './ListeningLadderResultSummary';
import { isSpeechSupported } from '../../../utils/speech/speakWord';
import './ListeningLadderGame.css';

function formatMessage(t, key, vars = {}) {
  const tpl = t(key);
  if (typeof tpl !== 'string' || tpl === key) return String(vars.default ?? '');
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
}

export default function ListeningLadderGame({ onPhaseChange }) {
  const { t } = useLanguage();
  const game = useListeningLadderGame();
  const startTraceSentRef = useRef(false);
  const completeTraceSentRef = useRef(false);

  useEffect(() => {
    if (onPhaseChange) {
      const isPlaying = game.phase === PHASE.PLAYING || game.phase === PHASE.FEEDBACK;
      onPhaseChange(isPlaying ? 'playing' : game.phase);
    }
    if (game.phase === PHASE.IDLE || game.phase === PHASE.READY) {
      startTraceSentRef.current = false;
      completeTraceSentRef.current = false;
    }
  }, [game.phase, onPhaseChange]);

  useEffect(() => {
    if (game.phase !== PHASE.PLAYING || !game.traceId || startTraceSentRef.current) return;
    startTraceSentRef.current = true;
    submitLearningTrace(buildMiniGameStartPayload('listening_ladder', {
      traceId: game.traceId,
      startLevel: 'A1',
    }));
  }, [game.phase, game.traceId]);

  useEffect(() => {
    if (game.phase !== PHASE.COMPLETED || !game.sessionSummary) return;
    if (completeTraceSentRef.current) return;
    completeTraceSentRef.current = true;
    const payload = buildListeningLadderCompletePayload(game.sessionSummary);
    if (payload.traceId) {
      submitLearningTrace(payload);
    }
  }, [game.phase, game.sessionSummary]);

  const handleKeyDown = useCallback((event) => {
    if (game.phase !== PHASE.PLAYING || !game.options?.length) return;
    const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3 };
    const idx = keyMap[event.key];
    if (idx !== undefined && game.options[idx]) {
      game.selectOption(game.options[idx].id);
    }
  }, [game]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const rules = [
    t('listeningLadder.rule1'),
    t('listeningLadder.rule2'),
    t('listeningLadder.rule3'),
    t('listeningLadder.rule4'),
  ];

  const speechErrorText = game.speechError === 'SPEECH_NOT_SUPPORTED'
    ? t('listeningLadder.speechUnsupported')
    : t('listeningLadder.speechFailed');

  if (game.phase === PHASE.COMPLETED) {
    return (
      <div className="listening-ladder">
        <ListeningLadderResultSummary
          t={(key, vars) => (vars ? formatMessage(t, key, vars) : t(key))}
          result={game}
          onPlayAgain={game.resetGame}
        />
      </div>
    );
  }

  return (
    <div className="listening-ladder">
      {(game.phase === PHASE.IDLE || game.phase === PHASE.READY) && (
        <>
          <GameHero
            kicker={t('listeningLadder.kicker')}
            title={t('listeningLadder.title')}
            lead={t('listeningLadder.introLead')}
          />
          <GameHowToPlay title={t('listeningLadder.howToPlay')} rules={rules} />
          {!isSpeechSupported() ? (
            <p className="listening-ladder-speech-error" role="alert">{t('listeningLadder.speechUnsupported')}</p>
          ) : null}
          {game.phase === PHASE.READY ? (
            <div className="listening-ladder-ready">
              <p className="listening-ladder-ready__hint">{t('listeningLadder.volumeHint')}</p>
              <button type="button" className="btn btn-outline-secondary" onClick={game.playTestSound}>
                {t('listeningLadder.testSound')}
              </button>
            </div>
          ) : null}
          <div className="listening-ladder-actions">
            {game.phase === PHASE.IDLE ? (
              <button type="button" className="btn btn-primary btn-lg" onClick={game.goReady}>
                {t('listeningLadder.getReady')}
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-lg" onClick={game.startGame}>
                {t('listeningLadder.start')}
              </button>
            )}
          </div>
        </>
      )}

      {(game.phase === PHASE.PLAYING || game.phase === PHASE.FEEDBACK) && (
        <div className="listening-ladder-board">
          <ListeningLadderProgress
            currentLevel={game.currentLevel}
            highestLevelReached={game.highestLevelReached}
            streak={game.streak}
            secondsLeft={game.secondsLeft}
            timerLabel={t('listeningLadder.timerLabel')}
            timerAria={formatMessage(t, 'listeningLadder.timerAria', { seconds: game.secondsLeft })}
            urgent={game.isTimerUrgent}
            levelLabel={t('listeningLadder.currentLevel')}
            streakLabel={t('listeningLadder.streak')}
            highestLabel={t('listeningLadder.highest')}
          />

          <ListeningLadderQuestionCard
            onReplay={game.replayWord}
            replayLabel={t('listeningLadder.replay')}
            speechError={game.speechError}
            speechErrorText={speechErrorText}
            feedback={game.lastFeedback}
            correctLabel={t('listeningLadder.feedbackCorrect')}
            incorrectLabel={t('listeningLadder.feedbackIncorrect')}
          >
            <ListeningLadderOptions
              options={game.options}
              onSelect={game.selectOption}
              disabled={game.phase === PHASE.FEEDBACK}
            />
          </ListeningLadderQuestionCard>

          <p className="listening-ladder-score-line">
            {t('listeningLadder.score')}: <strong>{game.score}</strong>
          </p>
        </div>
      )}

      {game.phase === PHASE.ERROR && (
        <p className="listening-ladder-speech-error" role="alert">{t('listeningLadder.loadError')}</p>
      )}
    </div>
  );
}
