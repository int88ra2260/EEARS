import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import useWordBridgeWeekly from '../../hooks/useWordBridgeWeekly';
import { buildChallengeShareText } from '../../hooks/useWeeklyReadProgress';
import { getWeeklyVoterId } from '../../utils/weeklyVoter';
import { recordWeeklyEngagement } from '../../services/weeklyInteractionApi';import '../activities/WordBridgeGame.css';
import './WordBridgeWeeklyChallenge.css';

function formatMessage(t, key, vars = {}) {
  const tpl = t(key);
  if (typeof tpl !== 'string' || tpl === key) return vars.default || key;
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
}

function SolvedBar({ group, t }) {
  const themeKey = `wordBridge.theme.${group.theme}`;
  const themeLabel = t(themeKey) !== themeKey ? t(themeKey) : group.theme;
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

export default function WordBridgeWeeklyChallenge({
  level,
  themeIds,
  blockId,
  weeklySlug,
  issueKey,
}) {
  const { t } = useLanguage();
  const game = useWordBridgeWeekly({ level, themeIds });
  const [shareToast, setShareToast] = useState('');

  useEffect(() => {
    if (game.phase !== game.PHASE.WON || !weeklySlug || !blockId) return;
    recordWeeklyEngagement({
      slug: weeklySlug,
      eventType: 'challenge_complete',
      blockId,
      voterKey: getWeeklyVoterId(),
      payload: { mistakes: game.stats.mistakes },
    }).catch(() => {});
  }, [game.phase, game.PHASE.WON, weeklySlug, blockId, game.stats.mistakes]);

  const onShare = async () => {
    const text = buildChallengeShareText({
      issueKey: issueKey || weeklySlug,
      slug: weeklySlug,
      solvedGroups: game.solvedGroups,
      mistakes: game.stats.mistakes,
      origin: window.location.origin,
    });
    try {
      if (navigator.share) {
        await navigator.share({ text, title: 'EEARS Weekly' });
      } else {
        await navigator.clipboard.writeText(text);
        setShareToast(t('weekly.shareCopied'));
      }
    } catch {
      // user cancelled share
    }
  };

  if (!level || !themeIds?.length) {
    return <p className="text-muted small mb-0">{t('weekly.challengeUnavailable')}</p>;
  }

  if (game.phase === game.PHASE.INTRO) {
    return (
      <div className="word-bridge-weekly">
        <p className="word-bridge-weekly__lead">{t('weekly.challengeIntro')}</p>
        <button type="button" className="btn btn-primary" onClick={game.start}>
          {t('weekly.challengeStart')}
        </button>
      </div>
    );
  }

  if (game.phase === game.PHASE.WON) {
    return (
      <div className="word-bridge-weekly word-bridge-weekly--result">
        <p className="word-bridge-weekly__result-title">{t('weekly.challengeWon')}</p>
        <p className="word-bridge-weekly__result-meta">
          {formatMessage(t, 'weekly.challengeStats', {
            mistakes: game.stats.mistakes,
            default: `Mistakes: ${game.stats.mistakes}`,
          })}
        </p>
        <div className="word-bridge-weekly__actions">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onShare}>
            {t('weekly.shareResult')}
          </button>
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={game.retry}>
            {t('weekly.challengeRetry')}
          </button>
          <Link to="/events" className="btn btn-primary btn-sm">
            {t('weekly.challengeBook')}
          </Link>
        </div>
        {shareToast ? <p className="text-success small mt-2 mb-0">{shareToast}</p> : null}
      </div>
    );
  }

  if (game.phase === game.PHASE.LOST) {
    return (
      <div className="word-bridge-weekly word-bridge-weekly--result">
        <p className="word-bridge-weekly__result-title">{t('weekly.challengeLost')}</p>
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={game.retry}>
          {t('weekly.challengeRetry')}
        </button>
      </div>
    );
  }

  const timerRatio = game.secondsLeft / game.roundSeconds;

  return (
    <div className={`word-bridge-weekly word-bridge-panel${game.shake ? ' is-shaking' : ''}`}>
      <div className="word-bridge-status word-bridge-weekly__status">
        <div>
          <p className="word-bridge-kicker">{t('weekly.challengeKicker')}</p>
          <span className={`word-bridge-level-pill word-bridge-level-pill--${game.level.toLowerCase()}`}>
            {game.level}
          </span>
          <p className="word-bridge-status__hint">
            {formatMessage(t, 'wordBridge.groupProgress', {
              solved: game.stats.solved,
              total: game.stats.total,
            })}
          </p>
        </div>
        <div className="word-bridge-status__metrics">
          <div
            className={`word-bridge-timer${game.secondsLeft <= 10 ? ' is-urgent' : ''}`}
            role="timer"
            aria-live="polite"
          >
            <span className="word-bridge-timer__value">{game.secondsLeft}</span>
            <span className="word-bridge-timer__track" aria-hidden="true">
              <span className="word-bridge-timer__bar" style={{ width: `${timerRatio * 100}%` }} />
            </span>
          </div>
          <div className="word-bridge-mistakes">
            {Array.from({ length: game.maxMistakes }, (_, i) => (
              <span
                key={i}
                className={`word-bridge-mistakes__pip${i < game.maxMistakes - game.mistakes ? '' : ' is-used'}`}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </div>

      {game.solvedGroups.map((group) => (
        <SolvedBar key={group.quartetId} group={group} t={t} />
      ))}

      <div className="word-bridge-grid" role="group" aria-label={t('weekly.challengeGridAria')}>
        {game.tiles.map((tile) => {
          const selected = game.selectedIds.includes(tile.id);
          return (
            <button
              key={tile.id}
              type="button"
              className={`word-bridge-tile${selected ? ' is-selected' : ''}`}
              onClick={() => game.toggleTile(tile.id)}
              aria-pressed={selected}
            >
              {tile.word}
            </button>
          );
        })}
      </div>

      <div className="word-bridge-weekly__toolbar">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!game.canSubmit}
          onClick={game.submitSelection}
        >
          {t('wordBridge.submit')}
        </button>
      </div>
    </div>
  );
}
