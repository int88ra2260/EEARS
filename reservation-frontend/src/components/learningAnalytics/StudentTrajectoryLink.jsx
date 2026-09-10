import React from 'react';
import { Link } from 'react-router-dom';
import {
  pushRecentStudent,
  studentTrajectoryPath,
} from '../../utils/learningAnalyticsRecentStudents';

/**
 * 學習成效分析：學號 → 個人軌跡，並寫入最近查詢。
 */
export default function StudentTrajectoryLink({
  studentId,
  name = null,
  children,
  className = 'font-monospace',
  title = '開啟個人軌跡',
  from = null,
}) {
  const sid = String(studentId || '').trim().toUpperCase();
  if (!sid) return <span className="text-muted">—</span>;

  const to = from
    ? `${studentTrajectoryPath(sid)}?from=${encodeURIComponent(from)}`
    : studentTrajectoryPath(sid);

  return (
    <Link
      to={to}
      className={className}
      title={title}
      onClick={() => pushRecentStudent({ studentId: sid, name })}
    >
      {children != null ? children : sid}
    </Link>
  );
}
