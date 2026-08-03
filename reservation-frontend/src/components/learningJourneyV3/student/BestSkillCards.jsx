import React from 'react';
import { getEmptyReasonText } from './emptyStateUtils';

const ITEMS = [
  { key: 'listening', label: '聽力' },
  { key: 'reading', label: '閱讀' },
  { key: 'speaking', label: '口說' },
  { key: 'writing', label: '寫作' },
];

export default function BestSkillCards({ bestSkills, emptyReason }) {
  const hasAnySkill = ITEMS.some((item) => {
    const cell = bestSkills?.[item.key];
    return !!(cell && (cell.cefr || Number(cell.rank || 0) > 0));
  });
  return (
    <div className="row g-3">
      {!hasAnySkill ? (
        <div className="col-12">
          <div className="alert alert-secondary mb-0">{getEmptyReasonText(emptyReason, '此學生目前沒有英檢成績紀錄')}</div>
        </div>
      ) : null}
      {ITEMS.map((item) => {
        const cell = bestSkills?.[item.key] || null;
        const rank = Number(cell?.rank || 0);
        const isB2Plus = rank >= 4;
        return (
          <div className="col-lg-3 col-md-6" key={item.key}>
            <div className="card h-100">
              <div className="card-body">
                <div className="text-muted small">{item.label}</div>
                <div className="h4 mb-1">{cell?.cefr || '—'}</div>
                <div className={`small ${isB2Plus ? 'text-success' : 'text-muted'}`}>
                  {cell ? (isB2Plus ? 'B2+ 達標' : '未達 B2') : '尚無紀錄'}
                </div>
                <div className="small text-muted mt-2">
                  來源：{cell?.sourceExamType || '—'} / {cell?.sourceExamDate || '—'}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
