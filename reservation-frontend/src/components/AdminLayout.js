// src/components/AdminLayout.js
// Phase 2：Sidebar 主導覽 + 頁首標題／breadcrumb（業務路由不變）
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import useMediaQuery from '../hooks/useMediaQuery';
import useToast from './ui/useToast';
import AdminSidebar from './admin/AdminSidebar';
import AdminBreadcrumbs from './admin/AdminBreadcrumbs';
import AdminAccessDenied from './system/AdminAccessDenied';
import { getAdminPageTitle } from '../constants/adminNavigation';
import { getAdminRouteDeniedReason } from '../constants/adminRouteAccess';
import { buildAccessProfile, buildNavContextFromAccessProfile } from '../utils/accessControl';
import { parseJwtPayload } from '../utils/jwtPayload';
import RouteLoading from './ui/RouteLoading';
import './admin/adminLayout.css';
import '../styles/admin-minimal.css';

function getRoleDisplayText(role, username) {
  const roleMap = {
    admin: '管理員',
    worker: '工作人員',
    teacher: '老師',
    office_staff: '行政職員',
    leader: '英語桌帶班',
  };

  if (role === 'teacher' || role === 'office_staff' || role === 'leader') {
    const teacherName = localStorage.getItem('teacherName');
    if (teacherName) return teacherName;
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = parseJwtPayload(token);
        if (payload && payload.name) return payload.name;
      }
    } catch (e) {
      console.error('解析 token 失敗:', e);
    }
  }

  return roleMap[role] || role;
}

function AdminLayout({ token, userRole, username, mustResetPassword, setMustResetPassword, onLogout }) {
  const [tokenExpired, setTokenExpired] = useState(false);
  const [showTokenWarning, setShowTokenWarning] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pageMetaOverride, setPageMetaOverride] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const isMobileNav = useMediaQuery('(max-width: 991.98px)');

  const actualUserRole = userRole || 'worker';

  const accessProfile = useMemo(
    () => buildAccessProfile(token || '', actualUserRole),
    [token, actualUserRole]
  );
  const teacherLevel = accessProfile.teacherLevel || 'regular';

  const navContext = useMemo(
    () => buildNavContextFromAccessProfile(accessProfile),
    [accessProfile]
  );

  const pageTitle = useMemo(() => {
    if (pageMetaOverride?.pageTitle) return pageMetaOverride.pageTitle;
    return getAdminPageTitle(location.pathname, navContext);
  }, [location.pathname, navContext, pageMetaOverride]);

  const breadcrumbLeafOverride = pageMetaOverride?.breadcrumbLeaf;

  useEffect(() => {
    setPageMetaOverride(null);
  }, [location.pathname]);

  useEffect(() => {
    const from = location.state?.adminMigratedFrom;
    if (!from) return;
    toast.info(`此頁面網址已更新。您已從「${from}」導向至現行入口。`, { duration: 8000 });
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: null }
    );
  }, [location.key, location.pathname, location.search, location.hash, location.state, navigate, toast]);

  const routeDenied = useMemo(
    () => getAdminRouteDeniedReason(accessProfile, location.pathname),
    [accessProfile, location.pathname]
  );

  useEffect(() => {
    if (mustResetPassword && location.pathname !== '/admin/account/reset') {
      navigate('/admin/account/reset', { replace: true });
    }
  }, [mustResetPassword, location.pathname, navigate]);

  useEffect(() => {
    if (accessProfile.role !== 'leader') return;
    if (location.pathname === '/admin' || location.pathname === '/admin/dashboard') {
      navigate('/admin/et-grouping/my-sessions', { replace: true });
    }
  }, [accessProfile.role, location.pathname, navigate]);

  useEffect(() => {
    if (accessProfile.role !== 'teacher' || accessProfile.teacherLevel !== 'regular') return;
    if (location.pathname === '/admin' || location.pathname === '/admin/dashboard') {
      navigate('/admin/classes', { replace: true });
    }
  }, [accessProfile.role, accessProfile.teacherLevel, location.pathname, navigate]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleTokenExpired = useCallback(() => {
    setTokenExpired(true);
    setTimeout(() => {
      toast.warning('登入已過期，請重新登入');
      onLogout();
      window.location.href = '/login';
    }, 1000);
  }, [onLogout, toast]);

  useEffect(() => {
    if (!token) return;
    try {
      const payload = parseJwtPayload(token);
      if (!payload || typeof payload.exp !== 'number') return;
      const exp = payload.exp * 1000;
      const now = Date.now();
      const timeLeft = exp - now;
      if (timeLeft < 15 * 60 * 1000 && timeLeft > 0) {
        setShowTokenWarning(true);
      }
      if (timeLeft <= 0) {
        handleTokenExpired();
      }
    } catch (error) {
      console.error('解析令牌失敗:', error);
    }
  }, [token, handleTokenExpired]);

  if (process.env.NODE_ENV === 'development') {
    console.log('AdminLayout', location.pathname, navContext);
    if (routeDenied?.code === 'missing_rule') {
      console.warn('[EEARS] Missing admin route access rule:', location.pathname);
    }
  }

  if (tokenExpired) {
    return (
      <div className="container mt-5">
        <div className="alert alert-warning text-center">
          <h4>登入已過期</h4>
          <p>正在重新導向到登入頁面...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout-root">
      {isMobileNav && mobileMenuOpen && (
        <div
          className="admin-sidebar-backdrop"
          role="presentation"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <AdminSidebar
        pathname={location.pathname}
        navContext={navContext}
        mobileOpen={!isMobileNav || mobileMenuOpen}
        onNavigate={() => isMobileNav && setMobileMenuOpen(false)}
      />

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="d-flex align-items-center flex-wrap gap-2">
            {isMobileNav && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm admin-sidebar-toggle"
                aria-expanded={mobileMenuOpen}
                aria-controls="admin-sidebar-nav"
                onClick={() => setMobileMenuOpen((o) => !o)}
              >
                選單
              </button>
            )}
            <h1 className="admin-topbar__title mb-0">後台管理</h1>
          </div>
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <span className="admin-badge admin-badge--role">{getRoleDisplayText(actualUserRole, username)}</span>
            {accessProfile.isDemo && (
              <span className="admin-badge admin-badge--warn">DEMO</span>
            )}
            {mustResetPassword && (
              <span className="admin-badge admin-badge--warn">需更改密碼</span>
            )}
            <button type="button" className="btn btn-outline-secondary" onClick={onLogout}>
              登出
            </button>
          </div>
        </header>

        {showTokenWarning && (
          <div className="alert alert-warning alert-dismissible fade show mx-3 mt-2 mb-0" role="alert">
            <i className="fas fa-exclamation-triangle me-2"></i>
            您的登入即將在15分鐘內過期，請及時儲存工作並重新登入。
            <button type="button" className="btn-close" onClick={() => setShowTokenWarning(false)}></button>
          </div>
        )}

        {accessProfile.isDemo && (
          <div className="alert alert-info mx-3 mt-2 mb-0" role="alert">
            此為 DEMO 帳號：可瀏覽後台功能介面，不會顯示真實資料，且無法新增／修改／刪除。
          </div>
        )}

        {mustResetPassword && (
          <div className="alert alert-warning mx-3 mt-2 mb-0" role="alert">
            為保障帳號安全，請先前往「變更密碼」完成密碼更新後再繼續操作。
          </div>
        )}

        <div className="admin-page-header">
          <h2 className="admin-page-header__title">{pageTitle}</h2>
          <AdminBreadcrumbs
            pathname={location.pathname}
            navContext={navContext}
            leafOverride={breadcrumbLeafOverride}
          />
        </div>

        <div className="admin-layout__content">
          {mustResetPassword && location.pathname !== '/admin/account/reset' ? null : routeDenied ? (
            <AdminAccessDenied
              route={routeDenied.route}
              rule={routeDenied.rule}
              missingRule={routeDenied.code === 'missing_rule'}
              accessProfile={accessProfile}
            />
          ) : (
            <Suspense fallback={<RouteLoading />}>
              <Outlet
                context={{
                  token,
                  userRole: actualUserRole,
                  teacherLevel,
                  username,
                  mustResetPassword,
                  setMustResetPassword,
                  accessProfile,
                  navContext,
                  setAdminPageMeta: setPageMetaOverride,
                }}
              />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminLayout;
