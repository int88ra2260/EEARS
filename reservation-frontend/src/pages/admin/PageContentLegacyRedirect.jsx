import React, { useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

const TAB_TO_AREA = {
  learning: 'resources',
  regulations: 'regulations',
  courseGuide: 'course-guide',
  'course-guide': 'course-guide',
  scrollWorld: 'scroll-world',
  'scroll-world': 'scroll-world',
};

/** 舊 /admin/page-content?tab=… 導向學生端內容中心 */
export default function PageContentLegacyRedirect() {
  const [params] = useSearchParams();
  const area = useMemo(() => TAB_TO_AREA[params.get('tab')] || 'resources', [params]);
  return <Navigate to={`/admin/student-content?area=${area}`} replace />;
}
