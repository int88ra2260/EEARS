import React from 'react';
import { NavLink } from 'react-router-dom';

export default function ComparisonModeSwitch() {
  return (
    <nav className="outcomes-mode comparison-mode" aria-label="群體與技能比較模式" data-testid="comparison-mode">
      <NavLink to="/admin/learning-analytics/cohorts">
        群體比較
      </NavLink>
      <NavLink to="/admin/learning-analytics/skills">
        技能成長
      </NavLink>
    </nav>
  );
}
