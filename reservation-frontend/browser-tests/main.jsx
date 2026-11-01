import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../src/index.css';
import '../src/styles/design-system.css';
import AdminAnalyticsPage from '../src/pages/admin/AdminAnalyticsPage.jsx';
import AnalyticsHubPage from '../src/pages/admin/AnalyticsHubPage.jsx';
import ClassOverview from '../src/components/ClassOverview';
import ClassBestepOverview from '../src/components/ClassBestepOverview';
import LearningAnalyticsResourcesPage from '../src/pages/admin/LearningAnalyticsResourcesPage.jsx';
import LearningAnalyticsSkillsPage from '../src/pages/admin/LearningAnalyticsSkillsPage.jsx';

const params = new URLSearchParams(window.location.search);
const requestedRoute = params.get('route');
const entry = requestedRoute === '/admin/analytics'
  || requestedRoute === '/admin/analytics/overview'
  || (requestedRoute && requestedRoute.startsWith('/admin/classes'))
  || (requestedRoute && requestedRoute.startsWith('/admin/learning-analytics'))
  ? requestedRoute
  : '';

function harnessToken() {
  if (!entry) return 'analytics-browser-harness';
  const profile = params.get('profile') || 'admin';
  const payload = profile === 'teacher'
    ? { role: 'teacher', teacherLevel: 'regular' }
    : profile === 'learning'
    ? {
      role: 'teacher',
      teacherLevel: 'regular',
      permissions: {
        can_view_analytics: false,
        can_view_classes: false,
        can_view_learning_analytics: true,
      },
    }
    : profile === 'none'
      ? { role: 'office_staff', staffLevel: 'event_lead' }
      : { role: 'admin' };
  const body = btoa(JSON.stringify(payload))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `e30.${body}.sig`;
}

function HarnessLayout() {
  return <Outlet context={{ token: harnessToken() }} />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MemoryRouter initialEntries={[entry || '/analytics-browser-harness']}>
      <Routes>
        <Route element={<HarnessLayout />}>
          <Route path="/analytics-browser-harness" element={<AdminAnalyticsPage />} />
          <Route path="/admin/analytics" element={<AnalyticsHubPage />} />
          <Route path="/admin/analytics/overview" element={<AdminAnalyticsPage />} />
          <Route path="/admin/operations" element={<h1>活動列表</h1>} />
          <Route path="/admin/classes" element={<ClassOverview />} />
          <Route path="/admin/classes/:classId/bestep" element={<ClassBestepOverview />} />
          <Route path="/admin/learning-analytics/resources" element={<LearningAnalyticsResourcesPage />} />
          <Route path="/admin/learning-analytics/skills" element={<LearningAnalyticsSkillsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  </React.StrictMode>
);
