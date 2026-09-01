import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import PageHeader from '../components/layout/PageHeader';
import WordBridgeGame from '../components/activities/WordBridgeGame';
import './ActivitiesPage.css';
import '../components/activities/WordBridgeGame.css';

export default function WordBridgePage() {
  const { t } = useLanguage();
  const [gamePhase, setGamePhase] = useState('intro');

  const breadcrumbs = [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.learningResources'), path: '/learning-resources' },
    { label: t('wordBridge.title') },
  ];

  const isPlaying = gamePhase === 'playing';

  return (
    <div className={`activities-page word-bridge-page${isPlaying ? ' word-bridge-page--playing' : ''}`}>
      {!isPlaying && (
        <PageHeader
          breadcrumbs={breadcrumbs}
          title={t('wordBridge.pageTitle')}
          lead={t('wordBridge.pageLead')}
        />
      )}
      <WordBridgeGame onPhaseChange={setGamePhase} />
    </div>
  );
}
