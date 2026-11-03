import React from 'react';
import { NavLink } from 'react-router-dom';

export default function ResourcesModeSwitch() {
  return (
    <nav className="outcomes-mode resources-mode" aria-label="資源與開課分析模式">
      <NavLink to="/admin/learning-analytics/resources">
        參與與覆蓋
      </NavLink>
      <NavLink to="/admin/learning-analytics/offerings">
        課程與活動觀察
      </NavLink>
    </nav>
  );
}
