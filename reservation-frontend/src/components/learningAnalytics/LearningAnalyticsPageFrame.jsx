import React from 'react';
import LaFold from './LaFold';
import LearningAnalyticsWorkingSetBanner from './LearningAnalyticsWorkingSetBanner';

/**
 * 成效分析各頁共用頁首：頁名、這頁回答什麼、數字範圍、主動作、「怎麼讀」。
 */
export default function LearningAnalyticsPageFrame({
  title,
  question,
  scope = null,
  actions = null,
  howToRead = null,
  children,
  showWorkingSet = false,
  workingSetHere = '',
}) {
  return (
    <div className="la-page-body">
      <header className="la-frame-header">
        <div className="la-frame-header__main">
          <div className="la-frame-lead">
            <h1>{title}</h1>
            <p>{question}</p>
          </div>
          {scope || howToRead ? (
            <LaFold label="怎麼讀這頁" className="mt-2">
              {scope ? <p className="mb-2">{scope}</p> : null}
              {howToRead}
            </LaFold>
          ) : null}
        </div>
        {actions ? <div className="la-frame-actions">{actions}</div> : null}
      </header>
      {showWorkingSet ? <LearningAnalyticsWorkingSetBanner here={workingSetHere} /> : null}
      {children}
    </div>
  );
}
