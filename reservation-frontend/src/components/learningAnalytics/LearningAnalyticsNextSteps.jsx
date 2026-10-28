import React, { useMemo } from 'react';
import Button from 'react-bootstrap/Button';
import { useNavigate } from 'react-router-dom';
import { formatCount } from './learningAnalyticsFormat';
import { normalizeStudentIds, saveWorkingSet } from '../../utils/learningAnalyticsWorkingSet';

const DESTINATIONS = [
  { id: 'kpi', label: '看這批人的 B2 達標', path: '/admin/learning-analytics/kpi-report', variant: 'primary' },
  { id: 'export', label: '匯出這批人的資料', path: '/admin/learning-analytics/raw-data', variant: 'outline-primary' },
  { id: 'explore', label: '在學生探索打開', path: '/admin/learning-analytics/explore', variant: 'outline-secondary' },
];

export default function LearningAnalyticsNextSteps({
  label,
  studentIds,
  total = 0,
  truncated = false,
  note = '',
  source = '',
  sourcePath = '',
  hide = [],
}) {
  const navigate = useNavigate();
  const ids = useMemo(() => normalizeStudentIds(studentIds), [studentIds]);
  if (!ids.length) return null;

  const shownTotal = total || ids.length;
  const countText = truncated && shownTotal > ids.length
    ? `${formatCount(ids.length)} / ${formatCount(shownTotal)} 人`
    : `${formatCount(ids.length)} 人`;
  const actions = DESTINATIONS.filter((item) => !hide.includes(item.id));

  const go = (path) => {
    saveWorkingSet({
      label,
      studentIds: ids,
      total: shownTotal,
      truncated,
      note,
      source,
      sourcePath,
    });
    navigate(path);
  };

  return (
    <div className="la-next">
      <div className="la-next-copy">
        <div className="la-next-title">接下來看這批人</div>
        <p className="la-next-note mb-0">
          {label}，{countText}
          {note ? `。${note}` : '。'}
          {truncated && shownTotal > ids.length ? ' 超過 2000 人時只帶前面的學號。' : ''}
        </p>
      </div>
      <div className="la-next-actions">
        {actions.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={item.variant}
            onClick={() => go(item.path)}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
