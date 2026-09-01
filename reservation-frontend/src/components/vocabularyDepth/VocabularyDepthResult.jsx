import React from 'react';
import { Link } from 'react-router-dom';
import GameCefrDisclaimer from '../activities/shared/GameCefrDisclaimer';
import { getRecommendedActivitiesForLevel } from '../../utils/wordBridgeRecommendations';

export default function VocabularyDepthResult({
  t,
  result,
  onPlayAgain,
}) {
  const activities = getRecommendedActivitiesForLevel(result.estimatedLevel);

  return (
    <div className="vocabulary-depth-result">
      <h2 className="vocabulary-depth-result__title">{t('vocabularyDepth.resultTitle')}</h2>
      <p className="vocabulary-depth-result__level">
        {t('vocabularyDepth.estimatedLevel', { level: result.estimatedLevel })}
      </p>
      {result.accuracy != null && (
        <p className="vocabulary-depth-result__meta">
          {t('vocabularyDepth.accuracy', { pct: Math.round(result.accuracy * 100) })}
        </p>
      )}

      {activities.length > 0 && (
        <div className="vocabulary-depth-result__activities">
          <h3 className="h6">{t('vocabularyDepth.recommendedActivities')}</h3>
          <ul>
            {activities.map((act) => (
              <li key={act.key}>{t(act.labelKey)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="vocabulary-depth-result__actions">
        <button type="button" className="btn btn-primary" onClick={onPlayAgain}>
          {t('vocabularyDepth.playAgain')}
        </button>
        <Link to="/practice/listening-ladder" className="btn btn-outline-primary">
          {t('vocabularyDepth.listeningCta')}
        </Link>
        <Link to="/practice/word-bridge" className="btn btn-outline-secondary">
          {t('vocabularyDepth.wordBridgeCta')}
        </Link>
        <Link to="/events" className="btn btn-outline-secondary">
          {t('vocabularyDepth.bookActivityCta')}
        </Link>
      </div>

      <GameCefrDisclaimer text={t('vocabularyDepth.cefrDisclaimer')} />
    </div>
  );
}
