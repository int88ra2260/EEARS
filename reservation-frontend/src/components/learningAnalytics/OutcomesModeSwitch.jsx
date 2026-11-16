import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { scopeSearchPath } from './learningAnalyticsFilterConstants';

export default function OutcomesModeSwitch() {
  const { search } = useLocation();
  return (
    <nav className="outcomes-mode" aria-label="成效閱讀模式">
      <NavLink to={scopeSearchPath('/admin/learning-analytics/overview', search)} end>
        能力分布
      </NavLink>
      <NavLink to={scopeSearchPath('/admin/learning-analytics/kpi-report', search)}>
        學期 B2 KPI
      </NavLink>
    </nav>
  );
}
