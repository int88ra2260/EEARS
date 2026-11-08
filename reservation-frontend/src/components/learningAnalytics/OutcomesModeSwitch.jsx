import React from 'react';
import { NavLink } from 'react-router-dom';

export default function OutcomesModeSwitch() {
  return (
    <nav className="outcomes-mode" aria-label="成效閱讀模式">
      <NavLink to="/admin/learning-analytics/overview" end>
        能力分布
      </NavLink>
      <NavLink to="/admin/learning-analytics/kpi-report">
        學期 B2 KPI
      </NavLink>
    </nav>
  );
}
