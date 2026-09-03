/**
 * 頁頂固定規則說明：補蓋章、不開放候補兩條 Alert
 * 供 EventList 使用；實際區塊由 eventsContentConfig.RULES_NOTICES 驅動
 */
import React from 'react';
import { RULES_NOTICES } from '../../constants/eventsContentConfig';

export default function EventRulesNotice({ t }) {
  return (
    <>
      {RULES_NOTICES.map((rule) => (
        <div
          key={rule.id}
          className={`alert alert-${rule.variant} alert-dismissible fade show mb-3`}
          role="alert"
        >
          <div className="d-flex align-items-center">
            <i className={`${rule.iconClass} me-3`} />
            <div className="flex-grow-1">
              <strong>📋 {t(rule.titleKey)}</strong>
              <span className="ms-2">{t(rule.textKey)}</span>
            </div>
            <button type="button" className="btn-close" data-bs-dismiss="alert" aria-label="Close" />
          </div>
        </div>
      ))}
    </>
  );
}
