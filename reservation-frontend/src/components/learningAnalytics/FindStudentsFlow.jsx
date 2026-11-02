import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

export const FIND_STUDENT_MODES = [
  {
    id: 'explore',
    label: '條件探索',
    to: '/admin/learning-analytics/explore',
    population: '依學生探索的篩選查分析快照。這份結果不是接近 B2，也不是已儲存的追蹤名單。',
  },
  {
    id: 'b1-plus',
    label: '接近 B2',
    to: '/admin/learning-analytics/b1-plus',
    population: '只含尚未達 B2、且目前最佳 GSE 在 51–58 的人。這是另一支查詢，不能當成學生探索的篩選結果。',
  },
  {
    id: 'tracking',
    label: '追蹤名單',
    to: '/admin/learning-analytics/tracking-cohorts',
    population: '打開已儲存的固定學號，用最新快照對照當時的數字。不會依探索條件重篩，也不套用「這批人」。',
  },
  {
    id: 'student',
    label: '學號',
    to: '/admin/learning-analytics/students',
    population: '直接用學號開個人軌跡。不套用探索條件，也不套用接近 B2 條件。',
  },
];

export function findStudentMode(pathname) {
  if (pathname.includes('/b1-plus')) return 'b1-plus';
  if (pathname.includes('/tracking-cohorts')) return 'tracking';
  if (pathname.includes('/students')) return 'student';
  return 'explore';
}

export default function FindStudentsFlow({ mode = '', population = '' }) {
  const location = useLocation();
  const current = mode || findStudentMode(location.pathname);
  const spec = FIND_STUDENT_MODES.find((item) => item.id === current) || FIND_STUDENT_MODES[0];

  return (
    <nav className="la-find-flow" aria-label="找學生">
      <div className="la-find-flow__modes">
        {FIND_STUDENT_MODES.map((item) => (
          <NavLink
            key={item.id}
            to={item.to}
            end={item.id === 'explore' || item.id === 'b1-plus'}
            className={item.id === current ? 'active' : undefined}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
      <p className="la-find-flow__population">{population || spec.population}</p>
    </nav>
  );
}
