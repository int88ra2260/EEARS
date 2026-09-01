import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import PageHeader from '../components/layout/PageHeader';
import VocabularyDepthGame from '../components/vocabularyDepth/VocabularyDepthGame';
import './ActivitiesPage.css';
import '../components/vocabularyDepth/VocabularyDepthGame.css';

export default function VocabularyDepthPage() {
  const { t } = useLanguage();
  const [gamePhase, setGamePhase] = useState('intro');
  const isPlaying = gamePhase === 'playing';

  const breadcrumbs = [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.learningResources'), path: '/learning-resources' },
    { label: t('vocabularyDepth.title') },
  ];

  return (
    <div className={`activities-page vocabulary-depth-page${isPlaying ? ' vocabulary-depth-page--playing' : ''}`}>
      {!isPlaying && (
        <PageHeader
          breadcrumbs={breadcrumbs}
          title={t('vocabularyDepth.pageTitle')}
          lead={t('vocabularyDepth.pageLead')}
        />
      )}
      <VocabularyDepthGame onPhaseChange={setGamePhase} />
    </div>
  );
}
