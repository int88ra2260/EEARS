import React from 'react';
import MicroLearningProgress from '../activities/shared/MicroLearningProgress';
import '../activities/shared/MicroLearningProgress.css';

export default function VocabularySizeWord({
  t,
  item,
  progress,
  onKnow,
  onDontKnow,
}) {
  return (
    <div className="vocabulary-size-board">
      {/* 優化的進度指示器 */}
      <MicroLearningProgress
        current={progress.current}
        total={progress.total}
        level={item.band}
        levelLabel={t('vocabularySize.bandLabel', { band: item.band })}
        showBar={true}
        showCount={true}
        tone="yellow"
        size="normal"
        className="vocabulary-size-progress-bar"
      />

      <div className="vocabulary-size-word-card">
        <p className="vocabulary-size-word-card__hint">{t('vocabularySize.prompt')}</p>
        <h2 className="vocabulary-size-word-card__word">{item.word}</h2>
      </div>

      <div className="vocabulary-size-responses">
        <button
          type="button"
          className="btn btn-lg vocabulary-size-responses__know"
          onClick={() => onKnow(true)}
          aria-label={t('vocabularySize.know')}
        >
          <span className="vocabulary-size-responses__icon" aria-hidden="true">✓</span>
          <span>{t('vocabularySize.know')}</span>
        </button>
        <button
          type="button"
          className="btn btn-lg vocabulary-size-responses__unknown"
          onClick={() => onDontKnow(false)}
          aria-label={t('vocabularySize.dontKnow')}
        >
          <span className="vocabulary-size-responses__icon" aria-hidden="true">?</span>
          <span>{t('vocabularySize.dontKnow')}</span>
        </button>
      </div>
    </div>
  );
}
