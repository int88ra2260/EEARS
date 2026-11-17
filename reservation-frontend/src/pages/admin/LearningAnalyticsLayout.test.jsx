import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test } from 'vitest';
import LearningAnalyticsLayout from './LearningAnalyticsLayout';

function tokenFor(payload) {
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `e.${body}.s`;
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/learning-analytics" element={<LearningAnalyticsLayout />}>
          <Route path="overview" element={<h1>概況內容</h1>} />
          <Route path="skills" element={<h1>技能內容</h1>} />
          <Route path="skills/:studentId" element={<h1>技能學生</h1>} />
          <Route path="offerings" element={<h1>開課內容</h1>} />
          <Route path="explore" element={<h1>找學生內容</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('learning analytics page nav', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('uses the page title on every learning analytics page', () => {
    localStorage.setItem('token', tokenFor({ role: 'admin' }));
    renderAt('/admin/learning-analytics/overview?snapshot_version=v9&cohort=113&semester=115-1');

    const nav = screen.getByRole('navigation', { name: '學習成效頁面' });
    expect(nav).toBeTruthy();
    expect(screen.getByRole('link', { name: '學習成效概況' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '學期 B2 KPI' })).toHaveAttribute(
      'href',
      '/admin/learning-analytics/kpi-report?snapshot_version=v9&cohort=113'
    );
    expect(screen.getByRole('link', { name: '資源與開課分析' })).toHaveAttribute(
      'href',
      '/admin/learning-analytics/resources?snapshot_version=v9&cohort=113'
    );
    expect(screen.getByRole('link', { name: '群體與技能比較' })).toHaveAttribute(
      'href',
      '/admin/learning-analytics/cohorts?snapshot_version=v9&cohort=113'
    );
    expect(screen.getByRole('link', { name: '資料匯出' })).toHaveAttribute(
      'href',
      '/admin/learning-analytics/raw-data?snapshot_version=v9&cohort=113'
    );
    expect(screen.getByRole('link', { name: '分析設定' })).toHaveAttribute(
      'href',
      '/admin/learning-analytics/settings?snapshot_version=v9&cohort=113'
    );
    expect(screen.queryByRole('link', { name: '能力分布' })).toBeNull();
    expect(screen.queryByRole('link', { name: '上呈' })).toBeNull();
  });

  test('hides settings without the manage permission', () => {
    renderAt('/admin/learning-analytics/explore');
    expect(screen.getByRole('navigation', { name: '學習成效頁面' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: '分析設定' })).toBeNull();
    expect(screen.getByRole('heading', { name: '找學生內容' })).toBeTruthy();
  });

  test('marks the shared page name on either view of that page', () => {
    localStorage.setItem('token', tokenFor({ role: 'teacher', teacherLevel: 'regular' }));
    const skills = renderAt('/admin/learning-analytics/skills');
    expect(screen.getByRole('link', { name: '群體與技能比較' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '學習成效概況' })).not.toHaveAttribute('aria-current');
    skills.unmount();

    const student = renderAt('/admin/learning-analytics/skills/S100');
    expect(screen.getByRole('link', { name: '群體與技能比較' })).toHaveAttribute('aria-current', 'page');
    student.unmount();

    renderAt('/admin/learning-analytics/offerings');
    expect(screen.getByRole('link', { name: '資源與開課分析' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '群體與技能比較' })).not.toHaveAttribute('aria-current');
  });
});
