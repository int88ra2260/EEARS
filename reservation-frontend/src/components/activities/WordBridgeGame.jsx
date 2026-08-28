import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import useWordBridgeGame from '../../hooks/useWordBridgeGame';
import useWordBridgeMatch from '../../hooks/useWordBridgeMatch';
import { buildMistakeWordRows } from '../../data/wordBridgeGlossary';
import { buildB1PlusMistakeWords, canStartWordBridgeMatch } from '../../data/wordBridgeMatch';
import { formatGameDuration, buildWordBridgeSharePayload, shareWordBridgeResult } from '../../utils/wordBridgeShare';
import { MAX_MISTAKES } from '../../data/wordBridgePuzzles';
import WordBridgeMatchPanel from './WordBridgeMatchPanel';
import { getEventsCalendarPath } from '../../utils/eventTypeQuery';
import { scrollToPageTop } from '../../utils/scrollToPageTop';
import {
  getExternalRecommendationUrl,
  isExternalRecommendation,
  WRITING_WORKSHOP_KEY,
} from '../../utils/wordBridgeRecommendations';
import { CEFR_LEVELS } from '../../data/wordBridgePuzzles';
import { saveWordBridgeSummary } from '../../services/wordBridgeSessionStore';
import { buildMiniGameCompletePayload, buildMiniGameStartPayload } from '../../utils/learningEventPayload';
import { submitLearningTrace } from '../../services/learningTraceApi';
import {
  buildActivityFunnelPayload,
  createRecommendationBatchId,
} from '../../utils/learningFunnelPayload';
import './WordBridgeGame.css';

const ACTIVITY_META = {
  'english-table': { tone: 'blue', titleKey: 'activities.englishTable', slug: 'english-table' },
  'english-club': { tone: 'green', titleKey: 'activities.englishClub', slug: 'english-club' },
  'international-forum': { tone: 'yellow', titleKey: 'activities.internationalForum', slug: 'international-forum' },
  'job-talk': { tone: 'red', titleKey: 'activities.jobTalk', slug: 'job-talk' },
  [WRITING_WORKSHOP_KEY]: {
    tone: 'purple',
    titleKey: 'activities.writingWorkshop',
    external: true,
  },
};

function formatMessage(t, key, vars = {}) {
  const tpl = t(key);
  if (typeof tpl !== 'string' || tpl === key) {
    return vars.default || key.split('.').pop() || key;
  }
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
}

function SolvedGroupBar({ group, t }) {
  const themeLabel = (() => {
    const key = `wordBridge.theme.${group.theme}`;
    const label = t(key);
    return label !== key ? label : group.theme;
  })();

  return (
    <div className={`word-bridge-solved word-bridge-solved--${group.level.toLowerCase()}`} role="status">
      <span className="word-bridge-solved__badge">{group.level}</span>
      <span className="word-bridge-solved__label">{themeLabel}</span>
      <div className="word-bridge-solved__words">
        {group.words.map((word) => (
          <span key={word}>{word}</span>
        ))}
      </div>
    </div>
  );
}

function IntroPanel({
  levels,
  selectedLevel,
  onSelectLevel,
  onStart,
  t,
}) {
  return (
    <div className="word-bridge-panel word-bridge-panel--intro">
      <div className="word-bridge-intro-grid">
        <div>
          <p className="word-bridge-kicker">{t('wordBridge.kicker')}</p>
          <h3 id="wb-game-intro-title" className="word-bridge-title">{t('wordBridge.title')}</h3>
          <p className="word-bridge-lead">{t('wordBridge.introLead')}</p>
        </div>
        <ol className="word-bridge-rules">
          <li>{t('wordBridge.rule1')}</li>
          <li>{t('wordBridge.rule2')}</li>
          <li>{t('wordBridge.rule3')}</li>
        </ol>
      </div>
      <fieldset className="word-bridge-level-picker">
        <legend>{t('wordBridge.startLevelLegend')}</legend>
        <div className="word-bridge-level-picker__options" role="radiogroup" aria-label={t('wordBridge.startLevelLegend')}>
          {levels.map((level) => (
            <label
              key={level}
              className={`word-bridge-level-picker__option${selectedLevel === level ? ' is-selected' : ''}`}
            >
              <input
                type="radio"
                name="wb-start-level"
                value={level}
                checked={selectedLevel === level}
                onChange={() => onSelectLevel(level)}
              />
              <span className="word-bridge-level-picker__badge">{level}</span>
              <span className="word-bridge-level-picker__hint">{t(`wordBridge.level${level}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <button type="button" className="btn btn-primary word-bridge-primary-btn" onClick={onStart}>
        {t('wordBridge.startChallenge')}
      </button>
      <p className="word-bridge-disclaimer">{t('wordBridge.disclaimer')}</p>
    </div>
  );
}

function PlayingPanel({
  t,
  currentLevel,
  passedLevels,
  levelNotice,
  groupsRequired,
  solvedGroups,
  tiles,
  selectedIds,
  shake,
  onToggle,
  onShuffle,
  onSwap,
  swapAvailable,
  onSubmit,
  canSubmit,
  mistakesLeft,
  maxMistakes,
  secondsLeft,
  roundSeconds,
}) {
  const timerRatio = secondsLeft / roundSeconds;
  const timerUrgent = secondsLeft <= 10;

  return (
    <div className="word-bridge-panel word-bridge-panel--playing">
      <div className="word-bridge-status">
        <div>
          <p className="word-bridge-kicker">{t('wordBridge.levelKicker')}</p>
          <div className="word-bridge-level-row">
            <span className={`word-bridge-level-pill word-bridge-level-pill--${currentLevel.toLowerCase()}`}>
              {currentLevel}
            </span>
            {passedLevels.length > 0 && (
              <span className="word-bridge-level-passed">
                {formatMessage(t, 'wordBridge.passedLevels', { levels: passedLevels.join(' · ') })}
              </span>
            )}
          </div>
          <p className="word-bridge-status__hint">
            {formatMessage(t, 'wordBridge.groupProgress', {
              solved: solvedGroups.length,
              total: groupsRequired,
            })}
            {' · '}
            {t('wordBridge.playingHint')}
          </p>
          {levelNotice && (
            <p className="word-bridge-level-notice" role="status">
              {formatMessage(t, 'wordBridge.levelUp', { level: levelNotice })}
            </p>
          )}
        </div>
        <div className="word-bridge-status__metrics">
          <div
            className={`word-bridge-timer${timerUrgent ? ' is-urgent' : ''}`}
            role="timer"
            aria-live="polite"
            aria-label={formatMessage(t, 'wordBridge.timerAria', { seconds: secondsLeft })}
          >
            <span className="word-bridge-timer__value">{secondsLeft}</span>
            <span className="word-bridge-timer__label">{t('wordBridge.timerLabel')}</span>
            <span className="word-bridge-timer__track" aria-hidden="true">
              <span className="word-bridge-timer__bar" style={{ width: `${timerRatio * 100}%` }} />
            </span>
          </div>
          <div className="word-bridge-mistakes" aria-label={formatMessage(t, 'wordBridge.mistakesAria', { left: mistakesLeft, max: maxMistakes })}>
            {Array.from({ length: maxMistakes }, (_, i) => (
              <span
                key={i}
                className={`word-bridge-mistakes__pip${i < maxMistakes - mistakesLeft ? ' is-used' : ''}`}
                aria-hidden="true"
              />
            ))}
            <span className="word-bridge-mistakes__text">
              {formatMessage(t, 'wordBridge.mistakesLeft', { count: mistakesLeft })}
            </span>
          </div>
        </div>
      </div>

      {solvedGroups.length > 0 && (
        <div className="word-bridge-solved-list">
          {solvedGroups.map((group) => (
            <SolvedGroupBar key={group.quartetId} group={group} t={t} />
          ))}
        </div>
      )}

      <div className={`word-bridge-grid${shake ? ' is-shake' : ''}`} role="group" aria-label={t('wordBridge.gridAria')}>
        {tiles.map((tile, index) => {
          const isSelected = selectedIds.includes(tile.id);
          return (
            <button
              key={tile.id}
              type="button"
              className={`word-bridge-tile${isSelected ? ' is-selected' : ''}`}
              style={{ '--tile-index': index }}
              onClick={() => onToggle(tile.id)}
              aria-pressed={isSelected}
            >
              {tile.word}
            </button>
          );
        })}
      </div>

      <div className="word-bridge-actions">
        <button type="button" className="btn btn-outline-secondary" onClick={onShuffle}>
          {t('wordBridge.shuffle')}
        </button>
        {swapAvailable && (
          <button
            type="button"
            className="btn btn-outline-secondary word-bridge-swap-btn"
            onClick={onSwap}
          >
            {t('wordBridge.swapQuestions')}
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSubmit}
          disabled={!canSubmit}
        >
          {t('wordBridge.submitGroup')}
        </button>
      </div>
    </div>
  );
}

function MistakeWordsModal({ t, rows, matchPool, canMatch, onClose }) {
  const [view, setView] = useState('list');
  const match = useWordBridgeMatch(matchPool);

  const handleClose = () => {
    match.exitMatch();
    onClose();
  };

  return (
    <div
      className={`word-bridge-modal-backdrop${view === 'match' ? ' word-bridge-modal-backdrop--match' : ''}`}
      onClick={handleClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') handleClose();
      }}
      role="presentation"
    >
      <div
        className={`word-bridge-modal${view === 'match' ? ' word-bridge-modal--match' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="word-bridge-mistake-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="word-bridge-modal__header">
          <h4 id="word-bridge-mistake-title" className="word-bridge-modal__title">
            {view === 'match' ? t('wordBridge.matchTitle') : t('wordBridge.mistakeWordsTitle')}
          </h4>
          <button
            type="button"
            className="word-bridge-modal__close"
            onClick={handleClose}
            aria-label={t('wordBridge.mistakeWordsClose')}
          >
            ×
          </button>
        </div>

        {view === 'list' && canMatch && (
          <div className="word-bridge-modal__tabs">
            <button type="button" className="word-bridge-modal__tab is-active" aria-current="page">
              {t('wordBridge.mistakeTabList')}
            </button>
            <button
              type="button"
              className="word-bridge-modal__tab"
              onClick={() => {
                setView('match');
                match.startMatch();
              }}
            >
              {t('wordBridge.matchStart')}
            </button>
          </div>
        )}

        {view === 'match' && (
          <div className="word-bridge-modal__tabs">
            <button
              type="button"
              className="word-bridge-modal__tab"
              onClick={() => {
                match.exitMatch();
                setView('list');
              }}
            >
              {t('wordBridge.mistakeTabList')}
            </button>
            <button type="button" className="word-bridge-modal__tab is-active" aria-current="page">
              {t('wordBridge.matchTitle')}
            </button>
          </div>
        )}

        {view === 'list' ? (
          <div className="word-bridge-modal__body">
            <p className="word-bridge-modal__lead">{t('wordBridge.mistakeWordsLead')}</p>
            {canMatch && (
              <p className="word-bridge-modal__hint">{t('wordBridge.matchEligibleHint')}</p>
            )}
            <ul className="word-bridge-mistake-list">
              {rows.map((row) => (
                <li key={row.en} className="word-bridge-mistake-list__item">
                  <span className="word-bridge-mistake-list__en">{row.en}</span>
                  <span className="word-bridge-mistake-list__zh">{row.zh || '—'}</span>
                  <span className={`word-bridge-mistake-list__level word-bridge-level-pill word-bridge-level-pill--${row.level.toLowerCase()}`}>
                    {row.level}
                  </span>
                </li>
              ))}
            </ul>
            {canMatch && (
              <div className="word-bridge-modal__footer">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setView('match');
                    match.startMatch();
                  }}
                >
                  {t('wordBridge.matchStart')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="word-bridge-modal__body word-bridge-modal__body--match">
            <WordBridgeMatchPanel t={t} match={match} />
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityRecommendationCards({ activities, t, batchId, estimatedLevel }) {
  React.useEffect(() => {
    if (!batchId || !activities?.length) return;
    activities.forEach((activityKey) => {
      submitLearningTrace(buildActivityFunnelPayload({
        eventType: 'funnel_impression',
        activityKey,
        batchId,
        estimatedLevel,
      }));
    });
  }, [activities, batchId, estimatedLevel]);

  const trackClick = (activityKey, eventType = 'funnel_click') => {
    submitLearningTrace(buildActivityFunnelPayload({
      eventType,
      activityKey,
      batchId,
      estimatedLevel,
    }));
  };

  return (
    <div className="word-bridge-recommendations">
      {activities.map((activityKey) => {
        const meta = ACTIVITY_META[activityKey];
        if (!meta) return null;
        const external = isExternalRecommendation(activityKey);
        const externalUrl = getExternalRecommendationUrl(activityKey);
        const reasonKey = `wordBridge.activityReason.${activityKey}`;
        return (
          <article
            key={activityKey}
            className={`word-bridge-rec word-bridge-rec--${meta.tone}`}
          >
            <span className="word-bridge-rec__tag">
              {t(`wordBridge.activityTag.${activityKey}`)}
            </span>
            <h4>{t(meta.titleKey)}</h4>
            <p>{t(reasonKey)}</p>
            {external && externalUrl ? (
              <a
                href={externalUrl}
                className="word-bridge-rec__link"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackClick(activityKey, 'funnel_click')}
              >
                {t('wordBridge.visitExternalSite')}
              </a>
            ) : (
              <Link
                to={getEventsCalendarPath(meta.slug)}
                className="word-bridge-rec__link"
                onClick={() => trackClick(activityKey, 'funnel_book_attempt')}
              >
                {t('wordBridge.bookActivity')}
              </Link>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ResultsPanel({ t, lang, result, mistakeLog, onPlayAgain }) {
  const confidenceKey = `wordBridge.confidence.${result.confidence}`;
  const recommendationBatchId = React.useMemo(() => createRecommendationBatchId(), []);
  const [showMistakeWords, setShowMistakeWords] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const mistakeWordRows = useMemo(() => buildMistakeWordRows(mistakeLog), [mistakeLog]);
  const matchPool = useMemo(() => buildB1PlusMistakeWords(mistakeLog), [mistakeLog]);
  const canMatch = canStartWordBridgeMatch(matchPool);
  const hasMistakeWords = mistakeWordRows.length > 0;

  const durationLabel = formatGameDuration(result.stats.durationMs, lang);
  const mistakes = result.stats.totalMistakes ?? 0;
  const maxMistakes = result.stats.maxMistakes ?? MAX_MISTAKES;

  const handleShare = async () => {
    try {
      const payload = buildWordBridgeSharePayload({
        result,
        lang,
        t,
        origin: window.location.origin,
      });
      const status = await shareWordBridgeResult(payload);
      setShareNotice(t(status === 'shared' ? 'wordBridge.shareDone' : 'wordBridge.shareCopied'));
      window.setTimeout(() => setShareNotice(null), 2600);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setShareNotice(t('wordBridge.shareFailed'));
      window.setTimeout(() => setShareNotice(null), 2600);
    }
  };

  return (
    <div className="word-bridge-panel word-bridge-panel--results">
      <p className="word-bridge-kicker">{t('wordBridge.resultsKicker')}</p>
      <h3 className="word-bridge-title">{t('wordBridge.resultsTitle')}</h3>

      <div className="word-bridge-result-hero">
        <p className="word-bridge-result-hero__label">{t('wordBridge.estimatedLevel')}</p>
        <p className="word-bridge-result-hero__level">{result.estimatedLevel}</p>
        <p className="word-bridge-result-hero__stats">
          {formatMessage(t, 'wordBridge.resultSessionStats', {
            duration: durationLabel,
            mistakes,
            max: maxMistakes,
          })}
        </p>
        <p className="word-bridge-result-hero__confidence">{t(confidenceKey)}</p>
      </div>

      {shareNotice && (
        <p className="word-bridge-share-notice" role="status">
          {shareNotice}
        </p>
      )}

      <p className="word-bridge-lead">{t('wordBridge.resultsLevelLead')}</p>

      <section className="word-bridge-results-section" aria-labelledby="wb-results-level-title">
        <h4 id="wb-results-level-title" className="word-bridge-results-section__title">
          {t('wordBridge.resultsLevelSection')}
        </h4>
        <ActivityRecommendationCards
          activities={result.activities}
          t={t}
          batchId={recommendationBatchId}
          estimatedLevel={result.estimatedLevel}
        />
      </section>

      <p className="word-bridge-results-style-hint">{t('wordBridge.resultsStyleHint')}</p>

      <div className="word-bridge-actions">
        <button type="button" className="btn btn-outline-secondary" onClick={handleShare}>
          {t('wordBridge.shareResult')}
        </button>
        {hasMistakeWords && (
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => setShowMistakeWords(true)}
          >
            {t('wordBridge.viewMistakeWords')}
          </button>
        )}
        <button type="button" className="btn btn-outline-secondary" onClick={onPlayAgain}>
          {t('wordBridge.playAgain')}
        </button>
        <Link to="/practice/listening-ladder" className="btn btn-outline-secondary">
          {t('listeningLadder.title')}
        </Link>
        <Link to="/events" className="btn btn-primary">
          {t('wordBridge.goCalendar')}
        </Link>
      </div>

      {showMistakeWords && (
        <MistakeWordsModal
          t={t}
          rows={mistakeWordRows}
          matchPool={matchPool}
          canMatch={canMatch}
          onClose={() => setShowMistakeWords(false)}
        />
      )}

      <p className="word-bridge-disclaimer">{t('wordBridge.disclaimer')}</p>
    </div>
  );
}

export default function WordBridgeGame({ onPhaseChange }) {
  const { t, lang } = useLanguage();
  const game = useWordBridgeGame();
  const [selectedLevel, setSelectedLevel] = useState('A1');

  const startTraceSentRef = React.useRef(false);

  useEffect(() => {
    onPhaseChange?.(game.phase);
    if (game.phase !== 'playing') {
      startTraceSentRef.current = false;
    }
  }, [game.phase, onPhaseChange]);

  useEffect(() => {
    if (game.phase !== 'playing' || !game.activeTraceId || startTraceSentRef.current) return;
    startTraceSentRef.current = true;
    submitLearningTrace(buildMiniGameStartPayload('word_bridge', {
      traceId: game.activeTraceId,
      startLevel: selectedLevel,
    }));
  }, [game.phase, game.activeTraceId, selectedLevel]);

  useEffect(() => {
    if (game.phase !== 'results' || !game.gameSummary || !game.result) return;
    saveWordBridgeSummary(game.gameSummary);
    const payload = buildMiniGameCompletePayload('word_bridge', game.result, game.gameSummary);
    if (payload.traceId) {
      submitLearningTrace(payload);
    }
  }, [game.phase, game.gameSummary, game.result]);

  useEffect(() => {
    if (game.phase !== 'playing' && game.phase !== 'results') return;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToPageTop());
    });
    return () => cancelAnimationFrame(frame);
  }, [game.phase]);

  const handlePlayAgain = () => {
    setSelectedLevel('A1');
    game.resetGame();
  };

  const handleStart = () => {
    game.startGame(selectedLevel);
  };

  return (
    <div className={`word-bridge word-bridge--${game.phase}`} aria-live="polite">
      {game.phase === 'intro' && (
        <IntroPanel
          levels={game.levels || CEFR_LEVELS}
          selectedLevel={selectedLevel}
          onSelectLevel={setSelectedLevel}
          onStart={handleStart}
          t={t}
        />
      )}
      {game.phase === 'playing' && (
        <PlayingPanel
          t={t}
          currentLevel={game.currentLevel}
          passedLevels={game.passedLevels}
          levelNotice={game.levelNotice}
          groupsRequired={game.groupsRequired}
          mistakesLeft={game.mistakesLeft}
          maxMistakes={game.maxMistakes}
          secondsLeft={game.secondsLeft}
          roundSeconds={game.roundSeconds}
          solvedGroups={game.solvedGroups}
          tiles={game.tiles}
          selectedIds={game.selectedIds}
          shake={game.shake}
          onToggle={game.toggleTile}
          onShuffle={game.shuffleRemaining}
          onSwap={game.swapQuestions}
          swapAvailable={game.swapAvailable}
          onSubmit={game.submitSelection}
          canSubmit={game.selectedTiles.length === 4}
        />
      )}
      {game.phase === 'results' && game.result && (
        <ResultsPanel
          t={t}
          lang={lang}
          result={game.result}
          mistakeLog={game.mistakeLog}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}
