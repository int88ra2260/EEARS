import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { P } from '../../constants/permissions';
import {
  ADMIN_NAV_SECTIONS,
  filterVisibleNav,
  getAdminPageMeta,
} from '../../constants/adminNavigation';
import {
  canAccessAdminRoute,
  getAdminRouteAccess,
  getAdminRouteDeniedReason,
} from '../../constants/adminRouteAccess';
import { buildAccessProfile, buildNavContextFromAccessProfile } from '../../utils/accessControl';
import AnalyticsHubPage from './AnalyticsHubPage';
import { buildAnalyticsHub } from './analyticsHubModel';

const appSource = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../App.js'),
  'utf8',
);

function token(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `e30.${body}.sig`;
}

function profile(payload) {
  return buildAccessProfile(token(payload), payload.role || '');
}

const admin = profile({ role: 'admin' });
const executive = profile({ role: 'teacher', teacherLevel: 'executive' });
const etManager = profile({ role: 'teacher', teacherLevel: 'et_manager' });
const ifManager = profile({ role: 'teacher', teacherLevel: 'if_manager' });
const jtManager = profile({ role: 'teacher', teacherLevel: 'jt_manager' });
const regular = profile({ role: 'teacher', teacherLevel: 'regular' });
const office = profile({ role: 'office_staff', staffLevel: 'event_lead' });
const learningOnly = profile({
  role: 'teacher',
  teacherLevel: 'regular',
  permissions: {
    can_view_analytics: false,
    can_view_classes: false,
    can_view_learning_analytics: true,
  },
});
const activityOnly = profile({
  role: 'teacher',
  teacherLevel: 'regular',
  permissions: {
    can_view_learning_analytics: false,
  },
});

function hrefs(model) {
  return model.sections.flatMap((section) => section.links.filter((link) => link.allowed).map((link) => link.to));
}

function renderHub(accessToken) {
  return render(
    <MemoryRouter initialEntries={['/admin/analytics']}>
      <Routes>
        <Route element={<Outlet context={{ token: accessToken }} />}>
          <Route path="/admin/analytics" element={<AnalyticsHubPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('analytics hub routes', () => {
  test('matches the hub without replacing existing analytics routes', () => {
    expect(appSource).toContain('path="analytics" element={<AnalyticsHubPage />}');
    expect(appSource).toContain('path="analytics/overview"');
    expect(appSource).toContain('path="analytics/risk"');
    expect(appSource).toContain('path="learning-analytics"');
    expect(appSource).toContain('path="classes/:classId/bestep"');
    expect(getAdminRouteAccess('/admin/analytics').pattern).toBe('/admin/analytics');
    expect(getAdminRouteAccess('/admin/analytics/overview').pattern).toBe('/admin/analytics/overview');
    expect(getAdminRouteAccess('/admin/analytics/risk').pattern).toBe('/admin/analytics/risk');
    expect(getAdminRouteAccess('/admin/learning-analytics/resources').pattern)
      .toBe('/admin/learning-analytics/resources');
    expect(getAdminRouteAccess('/admin/classes/sample/bestep').pattern)
      .toBe('/admin/classes/:classId/bestep');
  });

  test('keeps overview, risk and the hub as separate sidebar entries', () => {
    const visible = filterVisibleNav(ADMIN_NAV_SECTIONS, buildNavContextFromAccessProfile(admin));
    const section = visible.find((item) => item.id === 'analytics');
    const ids = section.children.map((child) => child.id);
    expect(ids).toEqual(expect.arrayContaining([
      'analytics-hub',
      'analytics-overview',
      'analytics-risk',
      'analytics-reports',
      'analytics-teacher-dash',
    ]));
    expect(new Set(ids).size).toBe(ids.length);
    expect(getAdminPageMeta('/admin/analytics', buildNavContextFromAccessProfile(admin)).pageTitle)
      .toBe('成效分析中心');
    expect(getAdminPageMeta('/admin/analytics/overview', buildNavContextFromAccessProfile(admin)).pageTitle)
      .toBe('活動營運總覽');
  });
});

describe('analytics hub permissions', () => {
  test('admin and executive can open the hub and the center operations pages', () => {
    for (const current of [admin, executive]) {
      expect(getAdminRouteDeniedReason(current, '/admin/analytics')).toBeNull();
      expect(canAccessAdminRoute(current, '/admin/analytics/overview')).toBe(true);
      expect(canAccessAdminRoute(current, '/admin/learning-analytics/overview')).toBe(true);
      expect(hrefs(buildAnalyticsHub(current))).toEqual(expect.arrayContaining([
        '/admin/analytics/overview',
        '/admin/analytics/risk',
        '/admin/classes',
        '/admin/learning-analytics/resources',
      ]));
    }
  });

  test('managers and regular teachers reach classes but not the center overview', () => {
    for (const current of [etManager, ifManager, jtManager, regular]) {
      expect(canAccessAdminRoute(current, '/admin/analytics')).toBe(true);
      expect(canAccessAdminRoute(current, '/admin/analytics/overview')).toBe(false);
      expect(canAccessAdminRoute(current, '/admin/classes')).toBe(true);
      const links = hrefs(buildAnalyticsHub(current));
      expect(links).toContain('/admin/classes');
      expect(links).not.toContain('/admin/analytics/overview');
    }
  });

  test('learning analytics without activity analytics hides the operations links', () => {
    expect(learningOnly.permissionSet.has(P.CAN_VIEW_LEARNING_ANALYTICS)).toBe(true);
    expect(learningOnly.permissionSet.has(P.CAN_VIEW_ANALYTICS)).toBe(false);
    expect(canAccessAdminRoute(learningOnly, '/admin/analytics')).toBe(true);
    const links = hrefs(buildAnalyticsHub(learningOnly));
    expect(links).toContain('/admin/learning-analytics/resources');
    expect(links).not.toContain('/admin/analytics/overview');
    expect(links).not.toContain('/admin/classes');
  });

  test('activity analytics without learning analytics hides learning links', () => {
    expect(activityOnly.permissionSet.has(P.CAN_VIEW_ANALYTICS)).toBe(true);
    expect(activityOnly.permissionSet.has(P.CAN_VIEW_LEARNING_ANALYTICS)).toBe(false);
    const links = hrefs(buildAnalyticsHub(activityOnly));
    expect(links).toContain('/admin/classes');
    expect(links).not.toContain('/admin/learning-analytics/overview');
    expect(links).not.toContain('/admin/analytics/overview');
  });

  test('office staff without an analytics permission cannot enter', () => {
    expect(canAccessAdminRoute(office, '/admin/analytics')).toBe(false);
    expect(getAdminRouteDeniedReason(office, '/admin/analytics')).toMatchObject({ code: 'forbidden' });
    const visible = filterVisibleNav(ADMIN_NAV_SECTIONS, buildNavContextFromAccessProfile(office));
    expect(visible.map((section) => section.id)).not.toContain('analytics');
  });

  test('a profile without a role is unauthenticated', () => {
    expect(getAdminRouteDeniedReason({}, '/admin/analytics')).toMatchObject({ code: 'unauthenticated' });
    expect(getAdminRouteDeniedReason(null, '/admin/analytics')).toMatchObject({ code: 'unauthenticated' });
  });
});

describe('analytics hub page', () => {
  test('renders four sections and only permitted destinations', () => {
    renderHub(token({ role: 'admin' }));
    expect(screen.getByRole('heading', { level: 1, name: '成效分析中心' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '中心營運分析' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'BESTEP 測驗分析' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '學習參與與歷程' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '資料品質與使用限制' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '活動營運總覽' }).getAttribute('href')).toBe('/admin/analytics/overview');
    expect(screen.getByRole('link', { name: '班級列表' }).getAttribute('href')).toBe('/admin/classes');
    expect(screen.getByRole('link', { name: '資源覆蓋' }).getAttribute('href')).toBe('/admin/learning-analytics/resources');
    const destinations = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(destinations.some((href) => href.includes('/bestep'))).toBe(false);
    expect(screen.getByText(/B2 標記不是活動造成的語言能力提升/)).toBeTruthy();
    expect(screen.getByText(/不能解讀成某個活動造成了進步/)).toBeTruthy();
    expect(screen.getByText(/三個 Shadow 預設關閉/)).toBeTruthy();
    expect(screen.getByText(/政策待決，不是系統故障/)).toBeTruthy();
    expect(screen.queryByText(/即時診斷結果/)).toBeTruthy();
    expect(screen.queryByText(/品質分數/)).toBeTruthy();
  });

  test('does not link BESTEP or operations for a learning-only profile', () => {
    renderHub(token({
      role: 'teacher',
      teacherLevel: 'regular',
      permissions: {
        can_view_analytics: false,
        can_view_classes: false,
        can_view_learning_analytics: true,
      },
    }));
    expect(screen.getByRole('link', { name: '資源覆蓋' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: '活動營運總覽' })).toBeNull();
    expect(screen.queryByRole('link', { name: '班級列表' })).toBeNull();
    expect(screen.getAllByText(/沒有權限/).length).toBeGreaterThan(0);
  });
});
