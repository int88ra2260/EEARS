import React, { useState, useEffect, useRef } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  useParams
} from 'react-router-dom';
import useMediaQuery from './hooks/useMediaQuery';
import usePageMeta from './hooks/usePageMeta';
import { useLanguage } from './context/LanguageContext';
import PublicLayout from './components/layout/PublicLayout';
import ErrorBoundary from './components/system/ErrorBoundary';

import HomePage from './pages/HomePage';
import EventsPage from './pages/EventsPage';
import ActivitiesPage from './pages/ActivitiesPage';
import ActivityDetailPage from './pages/ActivityDetailPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import AnnouncementDetailPage from './pages/AnnouncementDetailPage';
import MyReservationsPage from './pages/MyReservationsPage';
import NotificationPage from './pages/NotificationPage';
import FAQPage from './pages/FAQPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import ForbiddenPage from './pages/ForbiddenPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminLayout from './components/AdminLayout';
import AdminHome from './components/AdminHome';
import ClassOverview from './components/ClassOverview';
import ViolationManagement from './components/ViolationManagement';
import LoginPage from './components/LoginPage';
import SurveyPage from './components/SurveyPage';
import SurveyChoicePage from './components/SurveyChoicePage';
import ClassDetail from './components/ClassDetail';
import AccountManagement from './components/AccountManagement';
import ForceResetPassword from './components/ForceResetPassword';
import EnglishTestManagement from './components/EnglishTestManagement';
import EnglishTestRegistrationPage from './components/EnglishTestRegistrationPage';
import LearningPartnerRegistrationPage from './components/LearningPartnerRegistrationPage';
import LearningPartnerStatusPage from './components/LearningPartnerStatusPage';
import LearningPartnerApprovePage from './components/LearningPartnerApprovePage';
import ClassBestepOverview from './components/ClassBestepOverview';
import StudentProfilePage from './pages/admin/StudentProfilePage';
import StudentLearningProfileSearchPage from './components/StudentLearningProfileSearchPage';
import TeacherDashboardPage from './components/TeacherDashboardPage';
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';
import RiskDetectionPage from './components/RiskDetectionPage';
import TrendDashboardPage from './components/TrendDashboardPage';
import ReportPage from './components/ReportPage';
import TeacherImpactPage from './components/TeacherImpactPage';
import WeeklyReportsPage from './pages/admin/WeeklyReportsPage';
import AnnouncementManagementPage from './pages/admin/AnnouncementManagementPage';
import AdminAuditLogsPage from './pages/admin/AdminAuditLogsPage';
import SurveyAdminModulePage from './pages/admin/SurveyAdminModulePage';
import SurveyAdminResponsesPage from './pages/admin/SurveyAdminResponsesPage';
import SurveyAdminStatsPage from './pages/admin/SurveyAdminStatsPage';
import AdminSurveyCenterPage from './pages/admin/AdminSurveyCenterPage';
import AdminSurveyRulesPage from './pages/admin/AdminSurveyRulesPage';
import AdminSurveyResponsesPage from './pages/admin/AdminSurveyResponsesPage';
import AdminSurveyAnalyticsPage from './pages/admin/AdminSurveyAnalyticsPage';
import AdminSurveyDataHealthPage from './pages/admin/AdminSurveyDataHealthPage';
import AdminSurveyAnswerMappingPage from './pages/admin/AdminSurveyAnswerMappingPage';
import AdminDashboardProduct from './pages/admin/AdminDashboardProduct';
import SystemSettingsPage from './pages/admin/SystemSettingsPage';
import InternalDiagnosticsPage from './pages/admin/InternalDiagnosticsPage';
import AdminEventDetailPage from './pages/admin/AdminEventDetailPage';
import AdminEventParticipationStatsPage from './pages/admin/AdminEventParticipationStatsPage';
import EnglishTestImportHubPage from './pages/admin/EnglishTestImportHubPage';
import LearningJourneyDashboardPage from './pages/admin/LearningJourneyDashboardPage';
import LearningJourneyStudentProfilePage from './pages/admin/LearningJourneyStudentProfilePage';
import { fetchClient } from './utils/fetchClient';
import ToastProvider from './components/ui/ToastProvider';

/** 舊版班級明細 URL → Phase 1 新 path（納入 AdminLayout） */
function LegacyClassDetailRedirect({ token }) {
  const { classId } = useParams();
  if (!token) return <Navigate to="/login" replace />;
  return <Navigate to={`/admin/classes/${classId}`} replace />;
}

function LegacyEnglishTestStudentRedirect() {
  const { studentId } = useParams();
  return <Navigate to={`/admin/learning-journey/students/${studentId}`} replace />;
}

function LegacyArchiveNotice({ title, replacementPath, replacementLabel, note }) {
  return (
    <div className="container py-4">
      <div className="card border-warning">
        <div className="card-header bg-warning-subtle fw-semibold">{title}</div>
        <div className="card-body">
          <p className="mb-2">
            此 legacy 入口已封存，不再作為正式維運頁使用。
          </p>
          {note ? <p className="text-muted mb-3">{note}</p> : null}
          <a className="btn btn-primary btn-sm" href={replacementPath}>
            前往{replacementLabel}
          </a>
        </div>
      </div>
    </div>
  );
}

// 內部組件，用於使用 useLocation hook
function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isSmallMobile = useMediaQuery('(max-width: 576px)');
  const { t, lang } = useLanguage();
  usePageMeta(location.pathname, lang);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || '');
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [mustResetPassword, setMustResetPassword] = useState(localStorage.getItem('mustResetPassword') === 'true');
  const [showModal, setShowModal] = useState(true);
  const [, setRegistrationEnabled] = useState(true);

  // 載入報名按鈕開關狀態
  useEffect(() => {
    const loadRegistrationSetting = async () => {
      try {
        const response = await fetchClient('/api/settings/english-test-registration-enabled');
        if (response.ok) {
          const data = await response.json();
          setRegistrationEnabled(data.enabled !== false); // 預設為 true
        }
      } catch (error) {
        console.error('載入報名開關設定錯誤:', error);
        // 發生錯誤時保持預設值（啟用）
      }
    };
    loadRegistrationSetting();
  }, []);

  useEffect(() => {
    const onAccessStale = () => {
      try {
        window.dispatchEvent(new CustomEvent('eears:toast', { detail: { message: '你的權限已更新，請重新登入', variant: 'warning' } }));
      } catch (_) {
        // ignore
      }
      handleLogout();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    };
    window.addEventListener('eears:access-stale', onAccessStale);
    return () => window.removeEventListener('eears:access-stale', onAccessStale);
  }, []);

  // 舊首頁 hash 錨點相容：/#announcements → /announcements，/#faq → /faq，/#contact → /contact
  useEffect(() => {
    const h = location.hash?.replace('#', '').toLowerCase();
    if (location.pathname !== '/' || !h) return;
    const map = { announcements: '/announcements', faq: '/faq', contact: '/contact' };
    if (map[h]) navigate(map[h], { replace: true });
  }, [location.pathname, location.hash, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    localStorage.removeItem('teacherName');
    localStorage.removeItem('mustResetPassword');
    setToken('');
    setUserRole('');
    setUsername('');
    setMustResetPassword(false);
  };

  // 判斷是否應該顯示使用說明彈窗
  const shouldShowModal = showModal && location.pathname === '/';
  const usageModalRef = useRef(null);
  const usageModalButtonRef = useRef(null);

  // Phase 3 無障礙：彈窗開啟時焦點移至按鈕、Esc 關閉、焦點陷阱
  useEffect(() => {
    if (!shouldShowModal) return;
    const prevActive = document.activeElement;
    usageModalButtonRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowModal(false);
      if (e.key !== 'Tab') return;
      const dialog = usageModalRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (typeof prevActive?.focus === 'function') prevActive.focus();
    };
  }, [shouldShowModal]);

  return (
    <>
      {/* Phase 3 無障礙：跳過連結（鍵盤第一個可聚焦元素） */}
      <a href="#main-content" className="skip-link">
        {t('a11y.skipToContent')}
      </a>
      {/* 自定義滾動條樣式 */}
      <style>
        {`
          .scrollable-content::-webkit-scrollbar {
            width: 6px;
          }
          .scrollable-content::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
          }
          .scrollable-content::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 10px;
          }
          .scrollable-content::-webkit-scrollbar-thumb:hover {
            background: #555;
          }
          @media (max-width: 480px) {
            .scrollable-content {
              padding-right: 0.25rem;
            }
          }
        `}
      </style>
      <div
        className="app-wrapper"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundImage: 'url("/images/bg-pattern2.png")',
          backgroundRepeat: 'repeat',
          backgroundSize: 'auto',
          backgroundAttachment: 'fixed',
        }}
      >
        {/* 使用說明彈窗 */}
        {shouldShowModal && (
          <div
            className="modal-backdrop d-flex justify-content-center align-items-center"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9999,
              padding: isSmallMobile ? '0.5rem' : '1rem',
            }}
            role="presentation"
          >
            <div
              ref={usageModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="usage-modal-title"
              className="bg-white rounded-lg shadow-lg d-flex flex-column"
              style={{
                zIndex: 10000,
                maxWidth: isSmallMobile ? '95%' : isMobile ? '90%' : '400px',
                width: '100%',
                maxHeight: '80vh',
                padding: isSmallMobile ? '1rem' : isMobile ? '1.125rem' : '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: isSmallMobile ? '8px' : '12px',
              }}
            >
              <h2
                id="usage-modal-title"
                className="text-center text-primary mb-3"
                style={{
                  fontSize: isSmallMobile ? '1.1rem' : isMobile ? '1.2rem' : 'clamp(1.1rem, 4vw, 1.3rem)',
                  fontWeight: 'bold',
                  flexShrink: 0,
                }}
              >
                {t('home.usageTitle')}
              </h2>
              
              <div
                style={{
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  flex: '1 1 auto',
                  minHeight: 0,
                  marginBottom: '1rem',
                  paddingRight: '0.5rem',
                }}
                className="scrollable-content"
              >
                <div 
                  className="alert alert-info mb-3" 
                  role="alert" 
                  style={{ 
                    fontSize: isSmallMobile ? '0.813rem' : isMobile ? '0.875rem' : 'clamp(0.875rem, 3vw, 1rem)', 
                    padding: isSmallMobile ? '0.625rem' : '0.75rem' 
                  }}
                >
                  <i className="fas fa-info-circle me-2"></i>
                  <strong>📋 {t('home.usageRule')}</strong>
                  <br />
                  <span style={{ fontSize: isSmallMobile ? '0.75rem' : isMobile ? '0.813rem' : 'clamp(0.813rem, 2.8vw, 0.938rem)' }}>
                    {t('home.ruleNoStamp')}
                  </span>
                </div>
                
                <ul className="list-unstyled" style={{ margin: 0 }}>
                  <li className="mb-3" style={{ fontSize: isSmallMobile ? '0.75rem' : isMobile ? '0.813rem' : 'clamp(0.813rem, 2.8vw, 0.938rem)' }}>
                    <span style={{ fontWeight: 'bold' }}>
                      {t('home.usageBlacklist')}<br />
                      {t('home.usageViolations')}<br />
                      - {t('home.usageV1')}<br />
                      - {t('home.usageV2')}<br />
                      - {t('home.usageV3')}
                    </span>
                  </li>
                  <li className="mb-3" style={{ fontSize: isSmallMobile ? '0.75rem' : isMobile ? '0.813rem' : 'clamp(0.813rem, 2.8vw, 0.938rem)' }}>
                    <span style={{ fontWeight: 'bold' }}>{t('home.usageCancel')}</span>
                  </li>
                </ul>
              </div>
              
              <button
                ref={usageModalButtonRef}
                type="button"
                className="btn btn-primary w-100"
                onClick={() => setShowModal(false)}
                style={{
                  fontWeight: 'bold',
                  fontSize: isSmallMobile ? '0.875rem' : isMobile ? '0.938rem' : 'clamp(0.938rem, 3.5vw, 1.063rem)',
                  padding: isSmallMobile ? '0.5rem' : '0.625rem',
                  flexShrink: 0,
                  borderRadius: '8px',
                }}
              >
                {t('home.gotIt')} {t('home.noted')}
              </button>
            </div>
          </div>
        )}

        <PublicLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/activities" element={<ActivitiesPage />} />
            <Route path="/activities/:slug" element={<ActivityDetailPage />} />
            <Route path="/my-reservations" element={<MyReservationsPage />} />
            <Route path="/announcements" element={<AnnouncementsPage />} />
            <Route path="/announcements/:idOrSlug" element={<AnnouncementDetailPage />} />
            <Route path="/notifications" element={<NotificationPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/survey" element={<Navigate to="/survey/choice" replace />} />
            <Route path="/rules" element={<Navigate to="/faq" replace />} />
            <Route path="/403" element={<ForbiddenPage />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route
              path="/login"
              element={
                <LoginPage
                  onLoginSuccess={(newToken, role, user, teacherName, needReset) => {
                    setToken(newToken);
                    setUserRole(role);
                    setUsername(user);
                    setMustResetPassword(!!needReset);
                    localStorage.setItem('token', newToken);
                    localStorage.setItem('userRole', role);
                    localStorage.setItem('username', user);
                    if (teacherName) {
                      localStorage.setItem('teacherName', teacherName);
                    }
                    localStorage.setItem('mustResetPassword', needReset ? 'true' : 'false');
                  }}
                />
              }
            />
            <Route
              path="/admin"
              element={
                token ? (
                  <AdminLayout 
                    token={token} 
                    userRole={userRole} 
                    username={username} 
                      mustResetPassword={mustResetPassword}
                      setMustResetPassword={setMustResetPassword}
                    onLogout={handleLogout} 
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            >
              <Route index element={<AdminDashboardProduct />} />
              <Route path="dashboard" element={<AdminDashboardProduct />} />
              {/* Phase 1：IA 別名，導向既有頁面 */}
              <Route path="events" element={<Navigate to="/admin/operations" replace />} />
              <Route path="surveys/settings" element={<Navigate to="/admin/survey-settings" replace />} />
              <Route path="accounts" element={<Navigate to="/admin/account" replace />} />
              <Route path="system/settings" element={<Navigate to="/admin/settings/system" replace />} />
              <Route path="english-tests/tracking" element={<Navigate to="/admin/learning-journey" replace />} />
              <Route path="english-tests" element={<Navigate to="/admin/english-test" replace />} />
              <Route path="operations/participation" element={<AdminEventParticipationStatsPage />} />
              <Route path="operations/:eventId" element={<AdminEventDetailPage />} />
              <Route path="operations" element={<AdminHome />} />
              <Route path="classes/:classId/bestep" element={<ClassBestepOverview />} />
              <Route path="classes/:classId" element={<ClassDetail />} />
              <Route path="classes" element={<ClassOverview />} />
            <Route path="teachers/dashboard" element={<TeacherDashboardPage />} />
              <Route path="bestep/import" element={<Navigate to="/admin/english-test/import" replace />} />
              <Route path="violations" element={<ViolationManagement />} />
              <Route path="survey-module/:surveyId/responses" element={<SurveyAdminResponsesPage />} />
              <Route path="survey-module/:surveyId/stats" element={<SurveyAdminStatsPage />} />
              <Route path="survey-module" element={<SurveyAdminModulePage />} />
              <Route path="survey-center" element={<AdminSurveyCenterPage />} />
              <Route path="survey-rules" element={<AdminSurveyRulesPage />} />
              <Route path="survey-responses/:surveyId" element={<AdminSurveyResponsesPage />} />
              <Route path="survey-analytics/:surveyId" element={<AdminSurveyAnalyticsPage />} />
              <Route path="survey-health" element={<AdminSurveyDataHealthPage />} />
              <Route path="survey-answer-mappings" element={<AdminSurveyAnswerMappingPage />} />
              <Route
                path="surveys"
                element={(
                  <LegacyArchiveNotice
                    title="Legacy 問卷管理已封存"
                    replacementPath="/admin/survey-center"
                    replacementLabel="問卷中心"
                    note="舊問卷管理頁僅保留歷史資料脈絡；正式問卷請使用問卷中心、問卷規則與作答管理。"
                  />
                )}
              />
              <Route
                path="survey-settings"
                element={(
                  <LegacyArchiveNotice
                    title="Legacy 問卷設定已封存"
                    replacementPath="/admin/survey-rules"
                    replacementLabel="問卷規則"
                    note="新規則不得只寫 legacy SurveySettings；請改用產品化問卷規則。"
                  />
                )}
              />
              <Route path="announcements" element={<AnnouncementManagementPage />} />
              <Route path="logs" element={<AdminAuditLogsPage />} />
              <Route path="settings/system" element={<SystemSettingsPage />} />
              <Route path="diagnostics" element={<InternalDiagnosticsPage />} />
              <Route path="english-test" element={<EnglishTestManagement />} />
              {/* legacy route (redirect only)
                  kept for backward compatibility
                  DO NOT use for new features */}
              <Route path="english-test-tracking" element={<Navigate to="/admin/learning-journey" replace />} />
              <Route path="english-test-tracking-v2" element={<Navigate to="/admin/learning-journey" replace />} />
              <Route path="learning-journey-center" element={<Navigate to="/admin/learning-journey" replace />} />
              {/* legacy route (redirect only)
                  kept for backward compatibility
                  DO NOT use for new features */}
              <Route path="english-test-v2" element={<Navigate to="/admin/learning-journey" replace />} />
              <Route path="english-test-v2/students" element={<Navigate to="/admin/learning-journey" replace />} />
              <Route path="english-test-v2/students/:studentId" element={<LegacyEnglishTestStudentRedirect />} />
              <Route path="english-test-tracking/students" element={<Navigate to="/admin/learning-journey" replace />} />
              <Route path="english-test-tracking/students/:studentId" element={<LegacyEnglishTestStudentRedirect />} />
              <Route path="english-test-tracking/student-timeline/:studentId" element={<LegacyEnglishTestStudentRedirect />} />
              <Route path="english-test-tracking/*" element={<Navigate to="/admin/learning-journey" replace />} />
              <Route path="english-test-v2/*" element={<Navigate to="/admin/learning-journey" replace />} />
              <Route path="learning-journey-center/*" element={<Navigate to="/admin/learning-journey" replace />} />
              <Route path="english-test/import" element={<EnglishTestImportHubPage />} />
              <Route path="learning-journey" element={<LearningJourneyDashboardPage />} />
              <Route path="learning-journey/students/:studentId" element={<LearningJourneyStudentProfilePage />} />
              <Route path="analytics/student/:studentId" element={<StudentProfilePage />} />
              <Route path="analytics/students" element={<StudentLearningProfileSearchPage />} />
            <Route path="analytics/overview" element={<AdminAnalyticsPage />} />
            <Route path="analytics/risk" element={<RiskDetectionPage />} />
              <Route path="analytics/trends" element={<TrendDashboardPage />} />
              <Route path="reports" element={<ReportPage />} />
              <Route path="weekly-reports" element={<WeeklyReportsPage />} />
              <Route path="analytics/teacher-impact" element={<TeacherImpactPage />} />
              <Route path="account" element={<AccountManagement />} />
              <Route path="account/reset" element={<ForceResetPassword />} />
            </Route>
            <Route path="/survey/choice" element={<SurveyChoicePage />} />
            <Route path="/survey/:surveyId" element={<SurveyPage />} />
            <Route path="/register/english-test" element={<EnglishTestRegistrationPage />} />
            <Route path="/register/english-test/group" element={<LearningPartnerRegistrationPage />} />
            <Route path="/register/english-test/group/status/:teamId" element={<LearningPartnerStatusPage />} />
            <Route path="/register/english-test/group/approve" element={<LearningPartnerApprovePage />} />
            <Route
              path="/admin/classes/:classId/detail"
              element={<LegacyClassDetailRedirect token={token} />}
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </PublicLayout>
      </div>
    </>
  );
}

// 主要的 App 組件
function AppInner() {
  return (
    <Router>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </Router>
  );
}

// 依需求：在 App.js 內掛全域 Provider（不影響既有路由/功能）
export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
