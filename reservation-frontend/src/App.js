import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  useParams
} from 'react-router-dom';
import usePageMeta from './hooks/usePageMeta';
import { useLanguage } from './context/LanguageContext';
import PublicLayout from './components/layout/PublicLayout';
import ErrorBoundary from './components/system/ErrorBoundary';
import ScrollToTop from './components/system/ScrollToTop';

import HomePage from './pages/HomePage';
import EventsPage from './pages/EventsPage';
import ActivitiesPage from './pages/ActivitiesPage';
import WordBridgePage from './pages/WordBridgePage';
import ListeningLadderPage from './pages/ListeningLadderPage';
import ActivityPhrasebookPage from './pages/ActivityPhrasebookPage';
import WeeklyPage from './pages/WeeklyPage';
import WeeklyPreviewPage from './pages/WeeklyPreviewPage';
import ActivityDetailPage from './pages/ActivityDetailPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import AnnouncementDetailPage from './pages/AnnouncementDetailPage';
import MyReservationsPage from './pages/MyReservationsPage';
import NotificationPage from './pages/NotificationPage';
import FAQPage from './pages/FAQPage';
import AboutPage from './pages/AboutPage';
import CourseGuidePage from './pages/CourseGuidePage';
import HomeImmersiveTestPage from './pages/HomeImmersiveTestPage';
import ContactPage from './pages/ContactPage';
import LearningResourcesPage from './pages/LearningResourcesPage';
import RegulationsFormsPage from './pages/RegulationsFormsPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import ForbiddenPage from './pages/ForbiddenPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminLayout from './components/AdminLayout';
import LoginPage from './components/LoginPage';
import RouteLoading from './components/ui/RouteLoading';
import { fetchClient } from './utils/fetchClient';
import { buildAccessProfile } from './utils/accessControl';
import { getAdminRouteDeniedReason } from './constants/adminRouteAccess';
import AdminAccessDenied from './components/system/AdminAccessDenied';
import ToastProvider from './components/ui/ToastProvider';
import WeeklyHomeModal from './components/modals/WeeklyHomeModal';
import { fetchCurrentWeeklyReport } from './services/weeklyReportApi';
import { HOME_SW_DISMISSED_KEY } from './pages/HomePage';

const AdminHome = lazy(() => import('./components/AdminHome'));
const ClassOverview = lazy(() => import('./components/ClassOverview'));
const ViolationManagement = lazy(() => import('./components/ViolationManagement'));
const SurveyPage = lazy(() => import('./components/SurveyPage'));
const SurveyChoicePage = lazy(() => import('./components/SurveyChoicePage'));
const ClassDetail = lazy(() => import('./components/ClassDetail'));
const AccountManagement = lazy(() => import('./components/AccountManagement'));
const ForceResetPassword = lazy(() => import('./components/ForceResetPassword'));
const EnglishTestManagement = lazy(() => import('./components/EnglishTestManagement'));
const EnglishTestRegistrationPage = lazy(() => import('./components/EnglishTestRegistrationPage'));
const LearningPartnerRegistrationPage = lazy(() => import('./components/LearningPartnerRegistrationPage'));
const LearningPartnerStatusPage = lazy(() => import('./components/LearningPartnerStatusPage'));
const LearningPartnerApprovePage = lazy(() => import('./components/LearningPartnerApprovePage'));
const ClassBestepOverview = lazy(() => import('./components/ClassBestepOverview'));
const StudentLearningProfileSearchPage = lazy(() => import('./components/StudentLearningProfileSearchPage'));
const TeacherDashboardPage = lazy(() => import('./components/TeacherDashboardPage'));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage'));
const RiskDetectionPage = lazy(() => import('./components/RiskDetectionPage'));
const TrendDashboardPage = lazy(() => import('./components/TrendDashboardPage'));
const ReportPage = lazy(() => import('./components/ReportPage'));
const TeacherImpactPage = lazy(() => import('./components/TeacherImpactPage'));
const AnnouncementManagementPage = lazy(() => import('./pages/admin/AnnouncementManagementPage'));
const AdminWeeklyReportPage = lazy(() => import('./pages/admin/AdminWeeklyReportPage'));
const AdminWeeklyReportEditorPage = lazy(() => import('./pages/admin/AdminWeeklyReportEditorPage'));
const SiteContentManagementPage = lazy(() => import('./pages/admin/SiteContentManagementPage'));
const PageContentManagementPage = lazy(() => import('./pages/admin/PageContentManagementPage'));
const AdminAuditLogsPage = lazy(() => import('./pages/admin/AdminAuditLogsPage'));
const SurveyAdminModulePage = lazy(() => import('./pages/admin/SurveyAdminModulePage'));
const SurveyAdminResponsesPage = lazy(() => import('./pages/admin/SurveyAdminResponsesPage'));
const SurveyAdminStatsPage = lazy(() => import('./pages/admin/SurveyAdminStatsPage'));
const AdminSurveyCenterPage = lazy(() => import('./pages/admin/AdminSurveyCenterPage'));
const AdminSurveyRulesPage = lazy(() => import('./pages/admin/AdminSurveyRulesPage'));
const AdminSurveyResponsesPage = lazy(() => import('./pages/admin/AdminSurveyResponsesPage'));
const AdminSurveyAnalyticsPage = lazy(() => import('./pages/admin/AdminSurveyAnalyticsPage'));
const AdminSurveyDataHealthPage = lazy(() => import('./pages/admin/AdminSurveyDataHealthPage'));
const AdminSurveyAnswerMappingPage = lazy(() => import('./pages/admin/AdminSurveyAnswerMappingPage'));
const AdminDashboardProduct = lazy(() => import('./pages/admin/AdminDashboardProduct'));
const SystemSettingsPage = lazy(() => import('./pages/admin/SystemSettingsPage'));
const InternalDiagnosticsPage = lazy(() => import('./pages/admin/InternalDiagnosticsPage'));
const AdminEventDetailPage = lazy(() => import('./pages/admin/AdminEventDetailPage'));
const AdminEtTaskTemplatesPage = lazy(() => import('./pages/admin/AdminEtTaskTemplatesPage'));
const AdminEtGroupingSettingsPage = lazy(() => import('./pages/admin/AdminEtGroupingSettingsPage'));
const AdminEtGroupingReportsPage = lazy(() => import('./pages/admin/AdminEtGroupingReportsPage'));
const AdminEtStudentTrendsPage = lazy(() => import('./pages/admin/AdminEtStudentTrendsPage'));
const AdminEtLeaderSessionsPage = lazy(() => import('./pages/admin/AdminEtLeaderSessionsPage'));
const AdminEventParticipationStatsPage = lazy(() => import('./pages/admin/AdminEventParticipationStatsPage'));
const EnglishTestImportHubPage = lazy(() => import('./pages/admin/EnglishTestImportHubPage'));
const LearningJourneyDashboardPage = lazy(() => import('./pages/admin/LearningJourneyDashboardPage'));
const LearningJourneyImportHubPage = lazy(() => import('./pages/admin/LearningJourneyImportHubPage'));
const AdminEwlSyncPage = lazy(() => import('./pages/admin/AdminEwlSyncPage'));
const EnglishLearningPassportPage = lazy(() => import('./pages/student/EnglishLearningPassportPage'));
const EnglishLearningPassportSubmissionPage = lazy(() => import('./pages/student/EnglishLearningPassportSubmissionPage'));
const EnglishLearningPassportCertificationPage = lazy(() => import('./pages/student/EnglishLearningPassportCertificationPage'));
const EnglishLearningPassportsAdminPage = lazy(() => import('./pages/admin/EnglishLearningPassportsAdminPage'));
const EnglishLearningPassportDetailPage = lazy(() => import('./pages/admin/EnglishLearningPassportDetailPage'));
const LearningJourneyOperationsPage = lazy(() => import('./pages/admin/LearningJourneyOperationsPage'));
const LearningJourneyStudentProfilePage = lazy(() => import('./pages/admin/LearningJourneyStudentProfilePage'));
const LearningAnalyticsLayout = lazy(() => import('./pages/admin/LearningAnalyticsLayout'));
const LearningAnalyticsOverviewPage = lazy(() => import('./pages/admin/LearningAnalyticsOverviewPage'));
const LearningAnalyticsCohortsPage = lazy(() => import('./pages/admin/LearningAnalyticsCohortsPage'));
const LearningAnalyticsResourcesPage = lazy(() => import('./pages/admin/LearningAnalyticsResourcesPage'));
const LearningAnalyticsSkillsPage = lazy(() => import('./pages/admin/LearningAnalyticsSkillsPage'));
const LearningAnalyticsStudentJourneyPage = lazy(() => import('./pages/admin/LearningAnalyticsStudentJourneyPage'));
const LearningAnalyticsStudentDetailPage = lazy(() => import('./pages/admin/LearningAnalyticsStudentDetailPage'));
const LearningAnalyticsRawDataPage = lazy(() => import('./pages/admin/LearningAnalyticsRawDataPage'));
const LearningAnalyticsSettingsPage = lazy(() => import('./pages/admin/LearningAnalyticsSettingsPage'));
const LearningAnalyticsInsightsPage = lazy(() => import('./pages/admin/LearningAnalyticsInsightsPage'));
const LearningAnalyticsModelRunsPage = lazy(() => import('./pages/admin/LearningAnalyticsModelRunsPage'));
const ImportCenterPage = lazy(() => import('./pages/admin/ImportCenterPage'));
const ImportRunHistoryPage = lazy(() => import('./pages/admin/ImportRunHistoryPage'));

function LazyPublicRoute({ children }) {
  return <Suspense fallback={<RouteLoading />}>{children}</Suspense>;
}

/** 舊版班級明細 URL → Phase 1 新 path（納入 AdminLayout） */
function LegacyClassDetailRedirect({ token }) {
  const { classId } = useParams();
  if (!token) return <Navigate to="/login" replace />;
  const route = `/admin/classes/${classId}/detail`;
  const accessProfile = buildAccessProfile(token || '', localStorage.getItem('userRole') || '');
  const denied = getAdminRouteDeniedReason(accessProfile, route);
  if (denied) {
    return (
      <AdminAccessDenied
        route={denied.route}
        rule={denied.rule}
        missingRule={denied.code === 'missing_rule'}
      />
    );
  }
  return <Navigate to={`/admin/classes/${classId}`} replace />;
}

function LegacyEnglishTestStudentRedirect() {
  const { studentId } = useParams();
  return <Navigate to={`/admin/learning-journey/students/${studentId}`} replace />;
}

function AnalyticsStudentProfileRedirect() {
  const { studentId } = useParams();
  const location = useLocation();
  const source = new URLSearchParams(location.search);
  const target = new URLSearchParams();
  const semesterId = source.get('semesterId') || source.get('semester') || source.get('toSemester') || source.get('fromSemester');
  if (semesterId) target.set('semesterId', semesterId);
  const query = target.toString() ? `?${target.toString()}` : '';
  return <Navigate to={`/admin/learning-journey/students/${encodeURIComponent(studentId)}${query}`} replace />;
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
  const { t, lang } = useLanguage();
  usePageMeta(location.pathname, lang);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || '');
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [mustResetPassword, setMustResetPassword] = useState(localStorage.getItem('mustResetPassword') === 'true');
  const [weeklyIssue, setWeeklyIssue] = useState(null);
  const [weeklyModalOpen, setWeeklyModalOpen] = useState(false);
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
    if (location.pathname !== '/') return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCurrentWeeklyReport();
        if (cancelled || !data) return;
        setWeeklyIssue(data);
        setWeeklyModalOpen(true);
      } catch {
        if (!cancelled) {
          setWeeklyIssue(null);
          setWeeklyModalOpen(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  useEffect(() => {
    const onAccessStale = () => {
      try {
        window.dispatchEvent(
          new CustomEvent('eears:toast', {
            detail: { message: '您的帳號權限已更新，請重新登入。', variant: 'warning' },
          })
        );
      } catch (_) {
        // ignore
      }
      handleLogout();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    };
    const onAccountDisabled = () => {
      try {
        window.dispatchEvent(
          new CustomEvent('eears:toast', {
            detail: { message: '此帳號已停用，請聯絡管理員。', variant: 'danger' },
          })
        );
      } catch (_) {
        // ignore
      }
      handleLogout();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    };
    window.addEventListener('eears:access-stale', onAccessStale);
    window.addEventListener('eears:account-disabled', onAccountDisabled);
    return () => {
      window.removeEventListener('eears:access-stale', onAccessStale);
      window.removeEventListener('eears:account-disabled', onAccountDisabled);
    };
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

  const showWeeklyHomeModal = weeklyModalOpen && location.pathname === '/' && weeklyIssue;
  const isAdminLikePage =
    location.pathname.startsWith('/admin') ||
    location.pathname === '/login' ||
    location.pathname === '/forbidden';
  const isScrollWorldPage = location.pathname === '/scrollworldtest';
  const [homeSwDismissed, setHomeSwDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem(HOME_SW_DISMISSED_KEY) === '1';
    } catch (_) {
      return false;
    }
  });
  const [isDesktopHome, setIsDesktopHome] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 861px)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 861px)');
    const onChange = () => setIsDesktopHome(mq.matches);
    onChange();
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  useEffect(() => {
    const onClosed = () => setHomeSwDismissed(true);
    window.addEventListener('eears-sw-overlay-closed', onClosed);
    return () => window.removeEventListener('eears-sw-overlay-closed', onClosed);
  }, []);

  // 桌面沉浸式蓋層開啟時先不跳週報；關閉後／手機才顯示
  const allowWeeklyModal = !isDesktopHome || homeSwDismissed;
  const showWeekly =
    showWeeklyHomeModal && allowWeeklyModal;

  const publicShellBackground = isScrollWorldPage
    ? { background: '#f5ede0' }
    : {
        background:
          'radial-gradient(circle at top left, rgba(212, 86, 74, 0.05), transparent 30rem), linear-gradient(180deg, #fbfbfa 0%, #f7f3ed 100%)',
      };

  return (
    <>
      <ScrollToTop />
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
        className={`app-wrapper${location.pathname === '/' || location.pathname === '/hometest' ? ' app-wrapper--home' : ''}${location.pathname === '/about' ? ' app-wrapper--about' : ''}${location.pathname === '/scrollworldtest' ? ' app-wrapper--scrollworld' : ''}`}
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          ...(isAdminLikePage ? {
            backgroundImage: 'url("/images/bg-pattern2.png")',
            backgroundRepeat: 'repeat',
            backgroundSize: 'auto',
            backgroundAttachment: 'fixed',
          } : publicShellBackground),
        }}
      >
        <WeeklyHomeModal
          show={Boolean(showWeekly)}
          weekly={weeklyIssue}
          onClose={() => setWeeklyModalOpen(false)}
        />

        <PublicLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/hometest" element={<HomeImmersiveTestPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/weekly/preview/:token" element={<WeeklyPreviewPage />} />
            <Route path="/weekly" element={<WeeklyPage />} />
            <Route path="/weekly/:issueKey" element={<WeeklyPage />} />
            <Route path="/activities" element={<ActivitiesPage />} />
            <Route path="/activities/word-bridge" element={<WordBridgePage />} />
            <Route path="/activities/games/listening-ladder" element={<ListeningLadderPage />} />
            <Route path="/guides/activity-phrasebook" element={<ActivityPhrasebookPage />} />
            <Route path="/guides/activity-phrasebook/:activityType" element={<ActivityPhrasebookPage />} />
            <Route path="/activities/:slug" element={<ActivityDetailPage />} />
            <Route path="/my-reservations" element={<MyReservationsPage />} />
            <Route path="/announcements" element={<AnnouncementsPage />} />
            <Route path="/announcements/:idOrSlug" element={<AnnouncementDetailPage />} />
            <Route path="/notifications" element={<NotificationPage />} />
            <Route path="/learning-resources" element={<LearningResourcesPage />} />
            <Route path="/regulations-forms" element={<RegulationsFormsPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/scrollworldtest" element={<Navigate to="/" replace />} />
            <Route path="/course-guide" element={<CourseGuidePage />} />
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
              <Route path="surveys/settings" element={<Navigate to="/admin/survey-rules" replace />} />
              <Route path="accounts" element={<Navigate to="/admin/account" replace />} />
              <Route path="system/settings" element={<Navigate to="/admin/settings/system" replace />} />
              <Route path="english-tests/tracking" element={<Navigate to="/admin/learning-journey" replace />} />
              <Route path="english-tests" element={<Navigate to="/admin/english-test" replace />} />
              <Route path="operations/participation" element={<AdminEventParticipationStatsPage />} />
              <Route path="operations/:eventId" element={<AdminEventDetailPage />} />
              <Route path="et-grouping/settings" element={<AdminEtGroupingSettingsPage />} />
              <Route path="et-grouping/tasks" element={<AdminEtTaskTemplatesPage />} />
              <Route path="et-grouping/reports" element={<AdminEtGroupingReportsPage />} />
              <Route path="et-grouping/student-trends" element={<AdminEtStudentTrendsPage />} />
              <Route path="et-grouping/my-sessions" element={<AdminEtLeaderSessionsPage />} />
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
              <Route path="survey-settings" element={<Navigate to="/admin/survey-rules" replace />} />
              <Route path="announcements" element={<AnnouncementManagementPage />} />
              <Route path="weekly-reports" element={<AdminWeeklyReportPage />} />
              <Route path="weekly-reports/:id/edit" element={<AdminWeeklyReportEditorPage />} />
              <Route path="site-content" element={<SiteContentManagementPage />} />
              <Route path="page-content" element={<PageContentManagementPage />} />
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
              <Route path="import-center" element={<ImportCenterPage />} />
              <Route path="import-center/runs" element={<ImportRunHistoryPage />} />
              <Route path="learning-journey/import" element={<LearningJourneyImportHubPage />} />
              <Route path="learning-journey/ewl-sync" element={<AdminEwlSyncPage />} />
              <Route path="learning-journey" element={<LearningJourneyDashboardPage />} />
              <Route path="learning-journey/operations" element={<LearningJourneyOperationsPage />} />
              <Route path="learning-journey/students/:studentId" element={<LearningJourneyStudentProfilePage />} />
              <Route path="learning-analytics" element={<LearningAnalyticsLayout />}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<LearningAnalyticsOverviewPage />} />
                <Route path="cohorts" element={<LearningAnalyticsCohortsPage />} />
                <Route path="resources" element={<LearningAnalyticsResourcesPage />} />
                <Route path="skills" element={<LearningAnalyticsSkillsPage />} />
                <Route path="skills/:studentId" element={<LearningAnalyticsStudentDetailPage focus="skills" />} />
                <Route path="students" element={<LearningAnalyticsStudentJourneyPage />} />
                <Route path="students/:studentId" element={<LearningAnalyticsStudentDetailPage />} />
                <Route path="raw-data" element={<LearningAnalyticsRawDataPage />} />
                <Route path="insights" element={<LearningAnalyticsInsightsPage />} />
                <Route path="model-runs" element={<LearningAnalyticsModelRunsPage />} />
                <Route path="settings" element={<LearningAnalyticsSettingsPage token={token} />} />
              </Route>
              <Route path="english-learning-passports" element={<EnglishLearningPassportsAdminPage />} />
              <Route path="english-learning-passports/:id" element={<EnglishLearningPassportDetailPage />} />
              <Route path="analytics/student/:studentId" element={<AnalyticsStudentProfileRedirect />} />
              <Route path="analytics/students" element={<StudentLearningProfileSearchPage />} />
            <Route path="analytics/overview" element={<AdminAnalyticsPage />} />
            <Route path="analytics/risk" element={<RiskDetectionPage />} />
              <Route path="analytics/trends" element={<TrendDashboardPage />} />
              <Route path="reports" element={<ReportPage />} />
              <Route path="analytics/teacher-impact" element={<TeacherImpactPage />} />
              <Route path="account" element={<AccountManagement />} />
              <Route path="account/reset" element={<ForceResetPassword />} />
            </Route>
            <Route path="/survey/choice" element={<LazyPublicRoute><SurveyChoicePage /></LazyPublicRoute>} />
            <Route path="/survey/:surveyId" element={<LazyPublicRoute><SurveyPage /></LazyPublicRoute>} />
            <Route path="/register/english-test" element={<LazyPublicRoute><EnglishTestRegistrationPage /></LazyPublicRoute>} />
            <Route path="/register/english-test/group" element={<LazyPublicRoute><LearningPartnerRegistrationPage /></LazyPublicRoute>} />
            <Route path="/register/english-test/group/status/:teamId" element={<LazyPublicRoute><LearningPartnerStatusPage /></LazyPublicRoute>} />
            <Route path="/register/english-test/group/approve" element={<LazyPublicRoute><LearningPartnerApprovePage /></LazyPublicRoute>} />
            <Route path="/student/english-learning-passport" element={<LazyPublicRoute><EnglishLearningPassportPage /></LazyPublicRoute>} />
            <Route path="/student/english-learning-passport/submissions/:id" element={<LazyPublicRoute><EnglishLearningPassportSubmissionPage /></LazyPublicRoute>} />
            <Route path="/student/english-learning-passport/certification" element={<LazyPublicRoute><EnglishLearningPassportCertificationPage /></LazyPublicRoute>} />
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
