import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { scopeSearchPath } from './learningAnalyticsFilterConstants';

export default function ComparisonModeSwitch() {
  const { search } = useLocation();
  return (
    <nav className="outcomes-mode comparison-mode" aria-label="群體與技能比較模式" data-testid="comparison-mode">
      <NavLink to={scopeSearchPath('/admin/learning-analytics/cohorts', search)}>
        群體比較
      </NavLink>
      <NavLink to={scopeSearchPath('/admin/learning-analytics/skills', search)}>
        技能成長
      </NavLink>
    </nav>
  );
}
