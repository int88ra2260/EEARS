import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../src/index.css';
import '../src/styles/design-system.css';
import ToastProvider from '../src/components/ui/ToastProvider';
import AdminLayout from '../src/components/AdminLayout';
import AdminHome from '../src/components/AdminHome';
import ClassOverview from '../src/components/ClassOverview';
import ClassBestepOverview from '../src/components/ClassBestepOverview';
import AnalyticsHubPage from '../src/pages/admin/AnalyticsHubPage';
import AdminAnalyticsPage from '../src/pages/admin/AdminAnalyticsPage';
import RiskDetectionPage from '../src/components/RiskDetectionPage';
import ReportPage from '../src/components/ReportPage';
import LearningAnalyticsLayout from '../src/pages/admin/LearningAnalyticsLayout';
import LearningAnalyticsOverviewPage from '../src/pages/admin/LearningAnalyticsOverviewPage';
import LearningJourneyDashboardPage from '../src/pages/admin/LearningJourneyDashboardPage';
import LearningAnalyticsB1PlusPage from '../src/pages/admin/LearningAnalyticsB1PlusPage';
import LearningAnalyticsKpiReportPage from '../src/pages/admin/LearningAnalyticsKpiReportPage';
import LearningAnalyticsRawDataPage from '../src/pages/admin/LearningAnalyticsRawDataPage';
import LearningAnalyticsResourcesPage from '../src/pages/admin/LearningAnalyticsResourcesPage';
import LearningAnalyticsOfferingsPage from '../src/pages/admin/LearningAnalyticsOfferingsPage';
import LearningAnalyticsCohortsPage from '../src/pages/admin/LearningAnalyticsCohortsPage';
import LearningAnalyticsSkillsPage from '../src/pages/admin/LearningAnalyticsSkillsPage';
import LearningAnalyticsStudentDetailPage from '../src/pages/admin/LearningAnalyticsStudentDetailPage';
import LearningAnalyticsStudentExplorerPage from '../src/pages/admin/LearningAnalyticsStudentExplorerPage';
import LearningAnalyticsStudentJourneyPage from '../src/pages/admin/LearningAnalyticsStudentJourneyPage';
import LearningAnalyticsTrackingCohortsPage from '../src/pages/admin/LearningAnalyticsTrackingCohortsPage';
import EnglishTestManagement from '../src/components/EnglishTestManagement';
import LoginPage from '../src/components/LoginPage';
import { staffLoginPath } from '../src/utils/staffLoginNext';
import { applyHarnessAuth } from './appAuth';

const params = new URLSearchParams(window.location.search);
const profile = params.get('profile') || 'admin';
const boot = applyHarnessAuth(profile);

function HarnessStudentRedirect() {
  const { studentId } = useParams();
  return <Navigate to={`/admin/learning-journey/students/${encodeURIComponent(studentId || '')}`} replace />;
}

function AdminShell({ auth, onLogout }) {
  const location = useLocation();
  if (!auth.token) {
    return <Navigate to={staffLoginPath(`${location.pathname}${location.search}`)} replace />;
  }
  return (
    <AdminLayout
      token={auth.token}
      userRole={auth.userRole}
      username={auth.username}
      mustResetPassword={false}
      setMustResetPassword={() => {}}
      onLogout={onLogout}
    />
  );
}

function AppHarness() {
  const [auth, setAuth] = useState(boot);
  const logout = useMemo(
    () => () => {
      localStorage.removeItem('token');
      localStorage.removeItem('userRole');
      localStorage.removeItem('username');
      localStorage.removeItem('teacherName');
      setAuth({ token: '', userRole: '', username: '' });
    },
    [],
  );

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={(
              <LoginPage
                onLoginSuccess={() => {
                  /* 本 harness 不用真實登入；未登入只確認會被導到登入頁 */
                }}
              />
            )}
          />
          <Route path="/admin" element={<AdminShell auth={auth} onLogout={logout} />}>
            <Route path="analytics" element={<AnalyticsHubPage />} />
            <Route path="analytics/overview" element={<AdminAnalyticsPage />} />
            <Route path="analytics/risk" element={<RiskDetectionPage />} />
            <Route path="analytics/trends" element={<Navigate to="/admin/analytics/overview" replace />} />
            <Route path="analytics/teacher-impact" element={<Navigate to="/admin/analytics/overview" replace />} />
            <Route path="analytics/student/:studentId" element={<HarnessStudentRedirect />} />
            <Route path="reports" element={<ReportPage />} />
            <Route path="operations" element={<AdminHome />} />
            <Route path="classes" element={<ClassOverview />} />
            <Route path="classes/:classId/bestep" element={<ClassBestepOverview />} />
            <Route path="english-test" element={<EnglishTestManagement />} />
            <Route path="learning-journey" element={<LearningJourneyDashboardPage />} />
            <Route path="learning-analytics" element={<LearningAnalyticsLayout />}>
              <Route path="overview" element={<LearningAnalyticsOverviewPage />} />
              <Route path="resources" element={<LearningAnalyticsResourcesPage />} />
              <Route path="offerings" element={<LearningAnalyticsOfferingsPage />} />
              <Route path="cohorts" element={<LearningAnalyticsCohortsPage />} />
              <Route path="skills" element={<LearningAnalyticsSkillsPage />} />
              <Route path="kpi-report" element={<LearningAnalyticsKpiReportPage />} />
              <Route path="raw-data" element={<LearningAnalyticsRawDataPage />} />
              <Route path="explore" element={<LearningAnalyticsStudentExplorerPage />} />
              <Route path="b1-plus" element={<LearningAnalyticsB1PlusPage />} />
              <Route path="tracking-cohorts" element={<LearningAnalyticsTrackingCohortsPage />} />
              <Route path="tracking-cohorts/:id" element={<LearningAnalyticsTrackingCohortsPage />} />
              <Route path="students" element={<LearningAnalyticsStudentJourneyPage />} />
              <Route path="students/:studentId" element={<LearningAnalyticsStudentDetailPage />} />
            </Route>
          </Route>
          <Route path="*" element={<p>harness-not-found</p>} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppHarness />
  </React.StrictMode>,
);
