import React from 'react';
import UnreadAttentionDot from './UnreadAttentionDot';

export default function LearningPartnerAdminTabs({
  adminView,
  onViewChange,
  showFunnelAttention = false,
}) {
  return (
    <ul className="nav nav-pills mb-4 gap-2" role="tablist">
      <li className="nav-item" role="presentation">
        <button
          type="button"
          className={`nav-link ${adminView === 'teams' ? 'active' : ''}`}
          onClick={() => onViewChange('teams')}
          role="tab"
          aria-selected={adminView === 'teams'}
        >
          團體列表
        </button>
      </li>
      <li className="nav-item" role="presentation">
        <button
          type="button"
          className={`nav-link d-inline-flex align-items-center ${adminView === 'funnel' ? 'active' : ''}`}
          onClick={() => onViewChange('funnel')}
          role="tab"
          aria-selected={adminView === 'funnel'}
        >
          營運成效
          {showFunnelAttention ? (
            <UnreadAttentionDot className="lp-ops-attention-dot--inline" label="請查看營運成效" />
          ) : null}
        </button>
      </li>
      <li className="nav-item" role="presentation">
        <button
          type="button"
          className={`nav-link ${adminView === 'ranking' ? 'active' : ''}`}
          onClick={() => onViewChange('ranking')}
          role="tab"
          aria-selected={adminView === 'ranking'}
        >
          團體名次
        </button>
      </li>
    </ul>
  );
}
