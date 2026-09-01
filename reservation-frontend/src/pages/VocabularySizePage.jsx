import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import PageHeader from '../components/layout/PageHeader';
import VocabularySizeGame from '../components/vocabularySize/VocabularySizeGame';
import './ActivitiesPage.css';
import '../components/vocabularySize/VocabularySizeGame.css';

export default function VocabularySizePage() {
  const { t } = useLanguage();
  const [gamePhase, setGamePhase] = useState('intro');
  const isPlaying = gamePhase === 'playing';

  const breadcrumbs = [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.learningResources'), path: '/learning-resources' },
    { label: t('vocabularySize.title') },
  ];

  return (
    <div className={`activities-page vocabulary-size-page${isPlaying ? ' vocabulary-size-page--playing' : ''}`}>
      {!isPlaying && (
        <PageHeader
          breadcrumbs={breadcrumbs}
          title={t('vocabularySize.pageTitle')}
          lead={t('vocabularySize.pageLead')}
        />
      )}
      <VocabularySizeGame onPhaseChange={setGamePhase} />
    </div>
  );
}
