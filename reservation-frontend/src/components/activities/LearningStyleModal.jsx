import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../context/LanguageContext';
import WordBridgeStyleSurvey from './WordBridgeStyleSurvey';
import ActivityRecommendationList from './ActivityRecommendationList';
import {
  buildPreferenceRecommendations,
  DEFAULT_WORD_BRIDGE_PREFERENCES,
} from '../../utils/wordBridgeRecommendations';
import './LearningStyleModal.css';

/**
 * 學習型態問卷：桌機 Modal、手機底部 Drawer
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   initialPrefs?: { density: string, focus: string } | null,
 *   onComplete: (prefs: { density: string, focus: string }) => void,
 * }} props
 */
export default function LearningStyleModal({
  open,
  onClose,
  initialPrefs,
  onComplete,
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(
    () => initialPrefs || DEFAULT_WORD_BRIDGE_PREFERENCES,
  );

  useEffect(() => {
    if (open) {
      setDraft(initialPrefs || DEFAULT_WORD_BRIDGE_PREFERENCES);
    }
  }, [open, initialPrefs]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  const recommendations = useMemo(
    () => buildPreferenceRecommendations(draft),
    [draft],
  );

  const handleComplete = useCallback(() => {
    onComplete(draft);
    onClose();
  }, [draft, onComplete, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="learning-style-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="learning-style-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="learning-style-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="learning-style-modal__header">
          <div>
            <p className="learning-style-modal__kicker">{t('activitiesPage.styleToolTitle')}</p>
            <h2 id="learning-style-modal-title" className="learning-style-modal__title">
              {t('wordBridge.surveyTitle')}
            </h2>
          </div>
          <button
            type="button"
            className="learning-style-modal__close"
            onClick={onClose}
            aria-label={t('learningStyleModal.close')}
          >
            ×
          </button>
        </div>

        <div className="learning-style-modal__body">
          <p className="learning-style-modal__lead">{t('activitiesPage.styleToolLead')}</p>

          <WordBridgeStyleSurvey
            embedded
            t={t}
            value={draft}
            onChange={setDraft}
          />

          <p className="learning-style-modal__rec-label">{t('activitiesPage.recommendedActivities')}</p>
          <ActivityRecommendationList
            activities={recommendations.activities}
            t={t}
            compact
            reasonPrefix="wordBridge.preferenceReason"
          />
        </div>

        <div className="learning-style-modal__footer">
          <button
            type="button"
            className="learning-style-modal__done"
            onClick={handleComplete}
          >
            {t('learningStyleModal.done')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
