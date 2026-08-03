import React from 'react';

function formatMessage(t, key, vars = {}) {
  const tpl = t(key);
  if (typeof tpl !== 'string' || tpl === key) {
    return vars.default || key.split('.').pop() || key;
  }
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
}

export default function WordBridgeMatchPanel({
  t,
  match,
}) {
  const {
    active,
    cards,
    selectedId,
    shake,
    sessionComplete,
    masteredCount,
    totalCount,
    progressLabel,
    startMatch,
    exitMatch,
    onCardClick,
  } = match;

  const progressPercent = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0;

  if (!active) {
    return (
      <div className="word-bridge-match-intro">
        <p className="word-bridge-match-intro__lead">{t('wordBridge.matchIntroLead')}</p>
        <button type="button" className="btn btn-primary word-bridge-match-intro__btn" onClick={startMatch}>
          {t('wordBridge.matchStart')}
        </button>
      </div>
    );
  }

  if (sessionComplete) {
    return (
      <div className="word-bridge-match-complete">
        <p className="word-bridge-match-complete__title">{t('wordBridge.matchCompleteTitle')}</p>
        <p className="word-bridge-match-complete__lead">
          {formatMessage(t, 'wordBridge.matchCompleteLead', {
            mastered: masteredCount,
            total: totalCount,
          })}
        </p>
        <div className="word-bridge-match-actions word-bridge-match-actions--stack">
          <button type="button" className="btn btn-primary" onClick={startMatch}>
            {t('wordBridge.matchPlayAgain')}
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={exitMatch}>
            {t('wordBridge.matchBackToList')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="word-bridge-match">
      <div className="word-bridge-match__status">
        <span className="word-bridge-match__status-item">
          {formatMessage(t, 'wordBridge.matchProgress', {
            mastered: progressLabel.mastered,
            total: progressLabel.total,
          })}
        </span>
        <span className="word-bridge-match__status-item word-bridge-match__status-item--round">
          {formatMessage(t, 'wordBridge.matchRound', { round: progressLabel.round })}
        </span>
      </div>
      <div
        className="word-bridge-match__progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        aria-label={formatMessage(t, 'wordBridge.matchProgress', {
          mastered: progressLabel.mastered,
          total: progressLabel.total,
        })}
      >
        <span className="word-bridge-match__progress-bar" style={{ width: `${progressPercent}%` }} />
      </div>
      <div
        className={`word-bridge-match-grid${shake ? ' is-shake' : ''}`}
        role="group"
        aria-label={t('wordBridge.matchGridAria')}
      >
        {cards.map((card) => {
          if (card.isMatched) {
            return (
              <div
                key={card.id}
                className="word-bridge-match-card word-bridge-match-card--matched"
                aria-hidden="true"
              />
            );
          }

          const isSelected = selectedId === card.id;
          return (
            <button
              key={card.id}
              type="button"
              className={[
                'word-bridge-match-card',
                `word-bridge-match-card--${card.side}`,
                isSelected ? 'is-selected' : '',
                card.isReview ? 'is-review' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onCardClick(card)}
              aria-pressed={isSelected}
            >
              <span className="word-bridge-match-card__side" aria-hidden="true">
                {card.side === 'en' ? 'EN' : '中'}
              </span>
              <span className="word-bridge-match-card__text">{card.text}</span>
              {card.isReview && (
                <span className="word-bridge-match-card__tag">{t('wordBridge.matchReviewTag')}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="word-bridge-match-actions word-bridge-match-actions--sticky">
        <button type="button" className="btn btn-outline-secondary" onClick={exitMatch}>
          {t('wordBridge.matchExit')}
        </button>
      </div>
    </div>
  );
}
