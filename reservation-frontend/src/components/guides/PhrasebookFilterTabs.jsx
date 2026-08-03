import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import './ActivityPhrasebook.css';

export default function PhrasebookFilterTabs({ tabs, activeTabKey, onChange }) {
  const { t } = useLanguage();

  return (
    <div className="phrasebook-tabs" role="tablist" aria-label={t('phrasebook.filterLabel')}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={activeTabKey === tab.key}
          className={`phrasebook-tabs__btn${activeTabKey === tab.key ? ' is-active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {t(`phrasebook.tab.${tab.key}`)}
        </button>
      ))}
    </div>
  );
}
