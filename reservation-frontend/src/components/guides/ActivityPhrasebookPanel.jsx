import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { getPhrasebookItems, getQuickPrepItems } from '../../data/learningContent/phrasebookItems';
import PhraseScenarioCard from './PhraseScenarioCard';
import './ActivityPhrasebook.css';

const SLUG_BY_ACTIVITY = {
  'English Table': 'english-table',
  'English Club': 'english-club',
  'International Forum': 'international-forum',
  'Job Talk': 'job-talk',
};

export default function ActivityPhrasebookPanel({
  activityType,
  maxItems = 3,
  showViewAllLink = true,
  compact = false,
}) {
  const { t } = useLanguage();

  const items = useMemo(
    () => getQuickPrepItems(activityType, maxItems),
    [activityType, maxItems],
  );

  if (!items.length) return null;

  const slug = SLUG_BY_ACTIVITY[activityType];
  const viewAllPath = slug
    ? `/guides/activity-phrasebook/${slug}`
    : '/guides/activity-phrasebook';

  return (
    <section className={`phrasebook-panel${compact ? ' phrasebook-panel--compact' : ''}`} aria-labelledby="phrasebook-panel-title">
      <div className="phrasebook-panel__head">
        <div>
          <p className="phrasebook-kicker">{t('phrasebook.panelKicker')}</p>
          <h2 id="phrasebook-panel-title" className="phrasebook-panel__title">
            {t('phrasebook.panelTitle')}
          </h2>
          <p className="phrasebook-panel__lead">{t('phrasebook.panelLead')}</p>
        </div>
        {showViewAllLink ? (
          <Link to={viewAllPath} className="btn btn-outline-secondary btn-sm phrasebook-panel__link">
            {t('phrasebook.viewAll')}
          </Link>
        ) : null}
      </div>
      <div className="phrasebook-panel__list">
        {items.map((item, index) => (
          <PhraseScenarioCard key={item.id} item={item} defaultOpen={index === 0 && !compact} />
        ))}
      </div>
    </section>
  );
}

export function PhrasebookQuickPrepSection({ activityType }) {
  const { t } = useLanguage();
  const items = useMemo(() => getQuickPrepItems(activityType, 3), [activityType]);

  if (!items.length) return null;

  return (
    <section className="phrasebook-quick-prep" aria-labelledby="phrasebook-quick-prep-title">
      <h2 id="phrasebook-quick-prep-title" className="phrasebook-quick-prep__title">
        {t('phrasebook.quickPrepTitle')}
      </h2>
      <p className="phrasebook-quick-prep__lead">{t('phrasebook.quickPrepLead')}</p>
      <div className="phrasebook-quick-prep__list">
        {items.map((item) => (
          <PhraseScenarioCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

export function PhrasebookFullList({ activityType }) {
  const items = useMemo(
    () => getPhrasebookItems(activityType ? { activityType } : {}),
    [activityType],
  );

  return (
    <div className="phrasebook-list">
      {items.map((item) => (
        <PhraseScenarioCard key={item.id} item={item} />
      ))}
    </div>
  );
}
