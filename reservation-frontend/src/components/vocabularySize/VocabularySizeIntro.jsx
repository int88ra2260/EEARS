import React from 'react';
import GameHero from '../activities/shared/GameHero';
import GameHowToPlay from '../activities/shared/GameHowToPlay';

export default function VocabularySizeIntro({ t, onStart }) {
  const rules = [
    t('vocabularySize.rule1'),
    t('vocabularySize.rule2'),
    t('vocabularySize.rule3'),
    t('vocabularySize.rule4'),
  ];

  return (
    <>
      <GameHero
        kicker={t('vocabularySize.kicker')}
        title={t('vocabularySize.title')}
        lead={t('vocabularySize.introLead')}
      />
      <GameHowToPlay title={t('vocabularySize.howToPlay')} rules={rules} />
      <div className="vocabulary-size-actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={onStart}>
          {t('vocabularySize.start')}
        </button>
      </div>
      <p className="vocabulary-size-disclaimer">{t('vocabularySize.disclaimer')}</p>
    </>
  );
}
