import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import PageHeader from '../components/layout/PageHeader';
import PhrasebookFilterTabs from '../components/guides/PhrasebookFilterTabs';
import { PhrasebookFullList } from '../components/guides/ActivityPhrasebookPanel';
import usePhrasebookFilter from '../hooks/usePhrasebookFilter';
import { PHRASEBOOK_ACTIVITY_TABS } from '../data/learningContent/phrasebookItems';
import './ActivitiesPage.css';
import '../components/guides/ActivityPhrasebook.css';

export default function ActivityPhrasebookPage() {
  const { activityType: routeActivityType } = useParams();
  const { t } = useLanguage();

  const initialTab = routeActivityType
    && PHRASEBOOK_ACTIVITY_TABS.some((tab) => tab.key === routeActivityType)
    ? routeActivityType
    : 'all';

  const { activeTabKey, setActiveTabKey, activeTab } = usePhrasebookFilter(initialTab);

  useEffect(() => {
    if (routeActivityType && PHRASEBOOK_ACTIVITY_TABS.some((tab) => tab.key === routeActivityType)) {
      setActiveTabKey(routeActivityType);
    }
  }, [routeActivityType, setActiveTabKey]);

  const breadcrumbs = [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.activities'), path: '/activities' },
    { label: t('phrasebook.title') },
  ];

  return (
    <div className="activities-page phrasebook-page">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={t('phrasebook.pageTitle')}
        lead={t('phrasebook.pageLead')}
      />

      <p className="phrasebook-kicker">{t('phrasebook.kicker')}</p>
      <p className="phrasebook-panel__lead">{t('phrasebook.noScoreNote')}</p>

      <PhrasebookFilterTabs
        tabs={PHRASEBOOK_ACTIVITY_TABS}
        activeTabKey={activeTabKey}
        onChange={setActiveTabKey}
      />

      <PhrasebookFullList activityType={activeTab.activityType} />

      <div className="mt-4">
        <Link to="/activities" className="btn btn-outline-secondary">
          {t('phrasebook.backToActivities')}
        </Link>
      </div>
    </div>
  );
}
