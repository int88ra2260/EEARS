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

export default function LearningAnalyticsWorkingSetBanner({ here = '' }) {
  const workingSet = useLearningAnalyticsWorkingSet();
  if (!workingSet.active) return null;

  const extra = workingSet.truncated && workingSet.total > workingSet.studentIds.length
    ? `原本 ${formatCount(workingSet.total)} 人，這次只帶前 ${formatCount(workingSet.studentIds.length)} 人。`
    : '';

  return (
    <div className="la-working-set" role="status">
      <div className="la-working-set-copy">
        <strong>這批人：</strong>
        {workingSet.label}
        {`（${formatCount(workingSet.studentIds.length)} 人）`}
        {extra ? <span className="la-working-set-note">{extra}</span> : null}
      </div>
      <div className="la-working-set-actions">
        {HOPS.filter((item) => item.id !== here).map((item) => (
          <Link key={item.id} className="btn btn-sm btn-outline-primary" to={item.path}>
            {item.label}
          </Link>
        ))}
        <Button type="button" size="sm" variant="outline-secondary" onClick={workingSet.clear}>
          看全部
        </Button>
      </div>
    </div>
  );
}
