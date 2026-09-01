import React from 'react';

export default function VocabularySizeWord({
  t,
  item,
  progress,
  onKnow,
  onDontKnow,
}) {
  return (
    <div className="vocabulary-size-board">
      <div className="vocabulary-size-progress" aria-live="polite">
        <span>{t('vocabularySize.wordProgress', { current: progress.current, total: progress.total })}</span>
        <span className="vocabulary-size-progress__band">
          {t('vocabularySize.bandLabel', { band: item.band })}
        </span>
      </div>

      <div className="vocabulary-size-word-card">
        <p className="vocabulary-size-word-card__hint">{t('vocabularySize.prompt')}</p>
        <h2 className="vocabulary-size-word-card__word">{item.word}</h2>
      </div>

      <div className="vocabulary-size-responses">
        <button
          type="button"
          className="btn btn-lg vocabulary-size-responses__know"
          onClick={() => onKnow(true)}
        >
          {t('vocabularySize.know')}
        </button>
        <button
          type="button"
          className="btn btn-lg vocabulary-size-responses__unknown"
          onClick={() => onDontKnow(false)}
        >
          {t('vocabularySize.dontKnow')}
        </button>
      </div>
    </div>
  );
}
