import React from 'react';
import { Link } from 'react-router-dom';
import GameCefrDisclaimer from '../activities/shared/GameCefrDisclaimer';
import { getRecommendedActivitiesForLevel } from '../../utils/wordBridgeRecommendations';

export default function VocabularySizeResult({
  t,
  result,
  onPlayAgain,
}) {
  const activities = getRecommendedActivitiesForLevel(result.estimatedLevel);
  const recognitionPct = Math.round((result.recognitionRate || 0) * 100);

  return (
    <div className="vocabulary-size-result">
      <h2 className="vocabulary-size-result__title">{t('vocabularySize.resultTitle')}</h2>
      <p className="vocabulary-size-result__size">
        {t('vocabularySize.estimatedWords', { count: result.estimatedWords.toLocaleString() })}
      </p>
      <p className="vocabulary-size-result__level">
        {t('vocabularySize.estimatedLevel', { level: result.estimatedLevel })}
      </p>
      <p className="vocabulary-size-result__meta">
        {t('vocabularySize.recognition', { pct: recognitionPct })}
      </p>
      {result.wordsToNextLevel > 0 && (
        <p className="vocabulary-size-result__next">
          {t('vocabularySize.wordsToNext', { count: result.wordsToNextLevel.toLocaleString() })}
        </p>
      )}

      {activities.length > 0 && (
        <div className="vocabulary-size-result__activities">
          <h3 className="h6">{t('vocabularySize.recommendedActivities')}</h3>
          <ul>
            {activities.map((act) => (
              <li key={act.key}>{t(act.labelKey)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="vocabulary-size-result__actions">
        <button type="button" className="btn btn-primary" onClick={onPlayAgain}>
          {t('vocabularySize.playAgain')}
        </button>
        <Link to="/practice/vocabulary-depth" className="btn btn-outline-primary">
          {t('vocabularySize.depthCta')}
        </Link>
        <Link to="/practice/word-bridge" className="btn btn-outline-secondary">
          {t('vocabularySize.wordBridgeCta')}
        </Link>
        <Link to="/events" className="btn btn-outline-secondary">
          {t('vocabularySize.bookActivityCta')}
        </Link>
      </div>

      <GameCefrDisclaimer text={t('vocabularySize.cefrDisclaimer')} />
    </div>
  );
}
