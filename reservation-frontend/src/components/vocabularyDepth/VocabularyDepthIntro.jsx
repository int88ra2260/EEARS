import React from 'react';
import GameHero from '../activities/shared/GameHero';
import GameHowToPlay from '../activities/shared/GameHowToPlay';

export default function VocabularyDepthIntro({ t, onStart }) {
  const rules = [
    t('vocabularyDepth.rule1'),
    t('vocabularyDepth.rule2'),
    t('vocabularyDepth.rule3'),
    t('vocabularyDepth.rule4'),
  ];

  return (
    <>
      <GameHero
        kicker={t('vocabularyDepth.kicker')}
        title={t('vocabularyDepth.title')}
        lead={t('vocabularyDepth.introLead')}
      />
      <GameHowToPlay title={t('vocabularyDepth.howToPlay')} rules={rules} />
      <div className="vocabulary-depth-actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={onStart}>
          {t('vocabularyDepth.start')}
        </button>
      </div>
      <p className="vocabulary-depth-disclaimer">{t('vocabularyDepth.disclaimer')}</p>
    </>
  );
}
