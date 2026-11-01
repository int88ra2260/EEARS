import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
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
import LearningAnalyticsLayout from '../src/pages/admin/LearningAnalyticsLayout';
import LearningAnalyticsResourcesPage from '../src/pages/admin/LearningAnalyticsResourcesPage';
import LearningAnalyticsSkillsPage from '../src/pages/admin/LearningAnalyticsSkillsPage';
import LoginPage from '../src/components/LoginPage';
import { staffLoginPath } from '../src/utils/staffLoginNext';
import { applyHarnessAuth } from './appAuth';

const params = new URLSearchParams(window.location.search);
const profile = params.get('profile') || 'admin';
const boot = applyHarnessAuth(profile);

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
            <Route path="operations" element={<AdminHome />} />
            <Route path="classes" element={<ClassOverview />} />
            <Route path="classes/:classId/bestep" element={<ClassBestepOverview />} />
            <Route path="learning-analytics" element={<LearningAnalyticsLayout />}>
              <Route path="resources" element={<LearningAnalyticsResourcesPage />} />
              <Route path="skills" element={<LearningAnalyticsSkillsPage />} />
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
