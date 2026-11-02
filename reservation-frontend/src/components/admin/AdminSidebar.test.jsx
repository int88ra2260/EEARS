import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import AdminSidebar from './AdminSidebar';
import { buildAccessProfile, buildNavContextFromAccessProfile } from '../../utils/accessControl';

function renderSidebar(pathname) {
  const navContext = buildNavContextFromAccessProfile(buildAccessProfile('', 'admin'));
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AdminSidebar pathname={pathname} navContext={navContext} token="" mobileOpen={false} />
    </MemoryRouter>
  );
}

describe('AdminSidebar nested navigation', () => {
  test('expands only the daily menu until another section is opened', () => {
    renderSidebar('/admin/operations');

    expect(screen.getByRole('button', { name: '活動與預約' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: '活動列表' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ET 分組' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: '學習歷程與成果' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: '問卷與回饋' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: '系統與稽核' })).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelectorAll('.admin-sidebar__glyph').length).toBeGreaterThan(6);

    fireEvent.click(screen.getByRole('button', { name: '學習歷程與成果' }));
    const analytics = screen.getByRole('button', { name: '學習成效' });
    expect(analytics).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(analytics);
    expect(analytics).toHaveAttribute('aria-expanded', 'true');
    const compareGroup = screen.getByRole('button', { name: '比較與資料' });
    expect(compareGroup).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(compareGroup);
    expect(screen.getByRole('link', { name: '系所比較' })).toHaveAttribute('href', '/admin/learning-analytics/cohorts');
  });

  test('highlights 找學生 for the old finder urls', () => {
    for (const pathname of [
      '/admin/learning-analytics/explore',
      '/admin/learning-analytics/b1-plus',
      '/admin/learning-analytics/tracking-cohorts',
      '/admin/learning-analytics/students/S100',
    ]) {
      const view = renderSidebar(pathname);
      const entry = screen.getByRole('link', { name: '找學生' });
      expect(entry).toHaveAttribute('href', '/admin/learning-analytics/explore');
      expect(entry).toHaveClass('admin-sidebar__link--active');
      expect(screen.queryByRole('link', { name: '接近 B2' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: '學生探索' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: '追蹤名單' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: '個人軌跡' })).not.toBeInTheDocument();
      view.unmount();
    }
  });

  test('opens the current page section and its subgroup', () => {
    renderSidebar('/admin/learning-analytics/cohorts');

    expect(screen.getByRole('button', { name: '活動與預約' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '學習歷程與成果' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '學習成效' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '問卷與回饋' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: '系所比較' })).toHaveClass('admin-sidebar__link--active');
  });

  test('collapse all and expand all cover nested groups', () => {
    renderSidebar('/admin/operations');

    fireEvent.click(screen.getByRole('button', { name: '全部收合' }));
    expect(screen.getByRole('button', { name: '活動與預約' })).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(screen.getByRole('button', { name: '全部展開' }));
    expect(screen.getByRole('button', { name: '活動與預約' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'ET 分組' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '學習成效' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '設定' })).toHaveAttribute('aria-expanded', 'true');
  });
});
