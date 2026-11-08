import React from 'react';
import Button from 'react-bootstrap/Button';
import { Link } from 'react-router-dom';
import { formatCount } from './learningAnalyticsFormat';
import { useLearningAnalyticsWorkingSet } from '../../utils/learningAnalyticsWorkingSet';

const HOPS = [
  { id: 'kpi', label: 'B2 達標', path: '/admin/learning-analytics/kpi-report' },
  { id: 'export', label: '匯出', path: '/admin/learning-analytics/raw-data' },
  { id: 'explore', label: '學生探索', path: '/admin/learning-analytics/explore' },
];

const SUSPEND_COPY = {
  snapshot: '資料版本已與選出這批人時不同。',
  semester: '學期已與選出這批人時不同。',
};

export default function LearningAnalyticsWorkingSetBanner({ here = '', scope = null }) {
  const workingSet = useLearningAnalyticsWorkingSet(scope || undefined);
  if (!workingSet.active) return null;

  const count = formatCount(workingSet.studentIds.length);
  const extra = workingSet.truncated && workingSet.total > workingSet.studentIds.length
    ? `原本 ${formatCount(workingSet.total)} 人，這次只帶前 ${count} 人。`
    : '';
  const paused = Boolean(workingSet.suspendedReason);

  return (
    <div className={`la-working-set${paused ? ' is-paused' : ''}`} role="status" data-testid="la-working-set">
      <div className="la-working-set-copy">
        <strong>目前正在分析特定學生群體</strong>
        <span className="la-working-set-note">
          {paused
            ? `${workingSet.label}（${count} 人）。${SUSPEND_COPY[workingSet.suspendedReason] || '目前條件已變更。'}尚未套用這份固定名單，畫面是全體資料。`
            : `${workingSet.label}（${count} 人）。固定名單：沿用當初的學號，沒有依這頁條件重篩。`}
        </span>
        {extra ? <span className="la-working-set-note">{extra}</span> : null}
      </div>
      <div className="la-working-set-actions">
        {paused ? (
          <Button type="button" size="sm" variant="primary" onClick={workingSet.rebind}>
            沿用這份固定名單
          </Button>
        ) : HOPS.filter((item) => item.id !== here).map((item) => (
          <Link key={item.id} className="btn btn-sm btn-outline-primary" to={item.path}>
            {item.label}
          </Link>
        ))}
        <Button type="button" size="sm" variant="outline-secondary" onClick={workingSet.clear}>
          清除群體篩選
        </Button>
      </div>
    </div>
  );
}
