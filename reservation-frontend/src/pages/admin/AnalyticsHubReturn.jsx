import React from 'react';
import { Link } from 'react-router-dom';
import { canAccessAdminRoute } from '../../constants/adminRouteAccess';
import { ANALYTICS_HUB_PATH } from './analyticsHubModel';

/** 只在對方真的進得了成效分析中心時顯示。不帶篩選，也不改瀏覽器歷史。 */
export default function AnalyticsHubReturn({ accessProfile }) {
  if (!canAccessAdminRoute(accessProfile, ANALYTICS_HUB_PATH)) return null;
  return (
    <p className="small mb-3">
      <Link to={ANALYTICS_HUB_PATH}>返回成效分析中心</Link>
    </p>
  );
}
