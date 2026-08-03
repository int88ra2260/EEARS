import React from 'react';

export function formatShortUpdatedAt(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('zh-TW', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function SurveyRuleSummary({ isEnabled, isRequired }) {
  if (isEnabled == null && isRequired == null) return '—';
  return (
    <span className="small">
      <span className="text-muted">啟用</span> {isEnabled ? '是' : '否'}
      <span className="text-muted mx-1">·</span>
      <span className="text-muted">必填</span> {isRequired ? '是' : '否'}
    </span>
  );
}

/** 避免 table overflow 裁切；搭配 overflow:visible 的表格外層 */
export const SURVEY_ACTION_MENU_POPPER = {
  strategy: 'fixed',
  modifiers: [
    { name: 'offset', options: { offset: [0, 6] } },
    { name: 'preventOverflow', options: { padding: 12, rootBoundary: 'viewport' } },
    {
      name: 'flip',
      options: {
        fallbackPlacements: ['bottom-end', 'top-end', 'top-start', 'left-start', 'left-end'],
      },
    },
  ],
};
