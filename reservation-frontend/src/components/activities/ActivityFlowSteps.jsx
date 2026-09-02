import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ContentText from '../siteContent/ContentText';
import LearningStyleModal from './LearningStyleModal';
import {
  getWordBridgePreferences,
  saveWordBridgePreferences,
} from '../../services/wordBridgeSessionStore';
import './ActivityFlowSteps.css';

const STEPS = [
  { key: 'homePage.step1', hasToolLinks: true },
  { key: 'homePage.step2' },
  {
    key: 'homePage.step3',
    link: { to: '/events', labelKey: 'activitiesPage.bookFromCalendar' },
  },
  { key: 'homePage.step4' },
];

/**
 * Maven 式四步驟預約流程導覽（活動總覽頁）
 */
export default function ActivityFlowSteps() {
  const [styleModalOpen, setStyleModalOpen] = useState(false);
  const [stylePrefs, setStylePrefs] = useState(() => getWordBridgePreferences());

  useEffect(() => {
    const refreshPrefs = () => setStylePrefs(getWordBridgePreferences());
    window.addEventListener('eears:word-bridge-prefs-updated', refreshPrefs);
    return () => window.removeEventListener('eears:word-bridge-prefs-updated', refreshPrefs);
  }, []);

  const openStyleModal = useCallback(() => setStyleModalOpen(true), []);
  const closeStyleModal = useCallback(() => setStyleModalOpen(false), []);

  const handleStyleComplete = useCallback((next) => {
    saveWordBridgePreferences(next);
    setStylePrefs(next);
  }, []);

  return (
    <section className="activity-flow-steps" aria-labelledby="activities-flow-title">
      <div className="activities-section-heading">
        <ContentText k="homePage.stepsKicker" as="p" className="activities-eyebrow" />
        <ContentText k="homePage.stepsTitle" as="h2" id="activities-flow-title" />
        <ContentText k="activitiesPage.flowLead" as="p" />
      </div>

      <div className="activity-flow-steps__track" aria-hidden="true">
        <div className="activity-flow-steps__track-fill" />
      </div>

      <ol className="activity-flow-steps__list">
        {STEPS.map((step, index) => (
          <li key={step.key} className="activity-flow-steps__item">
            <div className="activity-flow-steps__marker" aria-hidden="true">
              <span className="activity-flow-steps__dot">{String(index + 1).padStart(2, '0')}</span>
              {index < STEPS.length - 1 ? (
                <span className="activity-flow-steps__connector" />
              ) : null}
            </div>
            <div className="activity-flow-steps__body">
              <ContentText k={step.key} as="p" className="activity-flow-steps__label" />
              {step.hasToolLinks ? (
                <div className="activity-flow-steps__tool-links">
                  <button
                    type="button"
                    className="activity-flow-steps__link"
                    onClick={openStyleModal}
                  >
                    <ContentText k="activitiesPage.styleToolCta" />
                  </button>
                </div>
              ) : null}
              {step.link ? (
                <Link to={step.link.to} className="activity-flow-steps__link">
                  <ContentText k={step.link.labelKey} />
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <LearningStyleModal
        open={styleModalOpen}
        onClose={closeStyleModal}
        initialPrefs={stylePrefs}
        onComplete={handleStyleComplete}
      />
    </section>
  );
}
