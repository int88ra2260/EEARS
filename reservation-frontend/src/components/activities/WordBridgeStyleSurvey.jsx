import React from 'react';
import { DEFAULT_WORD_BRIDGE_PREFERENCES } from '../../utils/wordBridgeRecommendations';

/**
 * @param {{
 *   t: (key: string) => string,
 *   embedded?: boolean,
 *   value?: { density: string, focus: string },
 *   onChange?: (prefs: { density: string, focus: string }) => void,
 *   onSubmit?: (prefs: object) => void,
 *   onBack?: () => void,
 * }} props
 */
export default function WordBridgeStyleSurvey({
  t,
  embedded = false,
  value,
  onChange,
  onSubmit,
  onBack,
}) {
  const prefs = value || DEFAULT_WORD_BRIDGE_PREFERENCES;

  const update = (patch) => {
    onChange?.({ ...prefs, ...patch });
  };

  const fields = (
    <>
      <fieldset className="word-bridge-survey-field">
        <legend>{t('wordBridge.surveyDensityLegend')}</legend>
        {['high', 'balanced', 'low'].map((option) => (
          <label key={option} className="word-bridge-survey-option">
            <input
              type="radio"
              name="wb-density"
              value={option}
              checked={prefs.density === option}
              onChange={() => update({ density: option })}
            />
            <span>{t(`wordBridge.surveyDensity.${option}`)}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="word-bridge-survey-field">
        <legend>{t('wordBridge.surveyFocusLegend')}</legend>
        {['speaking', 'balanced', 'writing'].map((option) => (
          <label key={option} className="word-bridge-survey-option">
            <input
              type="radio"
              name="wb-focus"
              value={option}
              checked={prefs.focus === option}
              onChange={() => update({ focus: option })}
            />
            <span>{t(`wordBridge.surveyFocus.${option}`)}</span>
          </label>
        ))}
      </fieldset>
    </>
  );

  if (embedded) {
    return (
      <div className="word-bridge-survey-fields">
        {fields}
        <p className="word-bridge-disclaimer word-bridge-disclaimer--inline">
          {t('wordBridge.surveyDisclaimer')}
        </p>
      </div>
    );
  }

  return (
    <div className="word-bridge-panel word-bridge-panel--survey">
      <p className="word-bridge-kicker">{t('wordBridge.surveyKicker')}</p>
      <h3 className="word-bridge-title">{t('wordBridge.surveyTitle')}</h3>
      <p className="word-bridge-lead">{t('wordBridge.surveyLead')}</p>
      {fields}
      <div className="word-bridge-survey-actions">
        {onBack ? (
          <button type="button" className="btn btn-outline-secondary" onClick={onBack}>
            {t('wordBridge.surveyBack')}
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-primary word-bridge-primary-btn"
          onClick={() => onSubmit?.(prefs)}
        >
          {t('wordBridge.surveyContinue')}
        </button>
      </div>
      <p className="word-bridge-disclaimer">{t('wordBridge.surveyDisclaimer')}</p>
    </div>
  );
}
