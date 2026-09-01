import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import PageHeader from '../components/layout/PageHeader';
import ListeningLadderGame from '../components/activities/listeningLadder/ListeningLadderGame';
import './ActivitiesPage.css';
import '../components/activities/listeningLadder/ListeningLadderGame.css';

export default function ListeningLadderPage() {
  const { t } = useLanguage();
  const [gamePhase, setGamePhase] = useState('idle');
  const isPlaying = gamePhase === 'playing';

  const breadcrumbs = [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.learningResources'), path: '/learning-resources' },
    { label: t('listeningLadder.title') },
  ];

  return (
    <div className={`activities-page listening-ladder-page${isPlaying ? ' listening-ladder-page--playing' : ''}`}>
      {!isPlaying && (
        <PageHeader
          breadcrumbs={breadcrumbs}
          title={t('listeningLadder.pageTitle')}
          lead={t('listeningLadder.pageLead')}
        />
      )}
      <ListeningLadderGame onPhaseChange={setGamePhase} />
    </div>
  );
}
