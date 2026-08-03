import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import ActivityRecommendationList from './ActivityRecommendationList';
import { computeWordBridgeResult } from '../../data/wordBridgePuzzles';
import { getWordBridgeSummary } from '../../services/wordBridgeSessionStore';
import './ActivityStepOneTools.css';

function formatMessage(t, key, vars = {}) {
  const tpl = t(key);
  if (typeof tpl !== 'string' || tpl === key) return String(vars.default ?? '');
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
}

/**
 * Step 01 下方：語彙連橋推薦（學習型態僅在 Modal 內完成）
 */
export default function ActivityStepOneTools() {
  const { t } = useLanguage();
  const [summarySnapshot, setSummarySnapshot] = useState(() => getWordBridgeSummary());

  useEffect(() => {
    const refresh = () => setSummarySnapshot(getWordBridgeSummary());
    window.addEventListener('focus', refresh);
    window.addEventListener('eears:word-bridge-summary-updated', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('eears:word-bridge-summary-updated', refresh);
    };
  }, []);

  const wordBridgeResult = useMemo(
    () => (summarySnapshot ? computeWordBridgeResult(summarySnapshot) : null),
    [summarySnapshot],
  );

  if (!wordBridgeResult) return null;

  return (
    <div className="activity-step1-tools" aria-labelledby="activity-step1-tools-title">
      <p id="activity-step1-tools-title" className="activity-step1-tools__eyebrow">
        {t('activitiesPage.step1ToolsKicker')}
      </p>

      <div className="activity-step1-tools__grid activity-step1-tools__grid--single">
        <article className="activity-step1-tool activity-step1-tool--bridge">
          <h3 className="activity-step1-tool__title">{t('activitiesPage.wordBridgeToolTitle')}</h3>
          <p className="activity-step1-tool__lead">{t('activitiesPage.wordBridgeToolLead')}</p>
          <p className="activity-step1-tool__meta">
            {formatMessage(t, 'activitiesPage.wordBridgeToolLevel', {
              level: wordBridgeResult.estimatedLevel,
            })}
          </p>
          <p className="activity-step1-tool__rec-label">{t('activitiesPage.recommendedActivities')}</p>
          <ActivityRecommendationList
            activities={wordBridgeResult.activities}
            t={t}
            compact
          />
        </article>
      </div>
    </div>
  );
}
