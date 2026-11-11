import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import ImportCenterPage from './ImportCenterPage';

vi.mock('../../hooks/useScrollReveal', () => ({ default: () => {} }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({ token: '', userRole: '' }),
  };
});

const STATUS_CLASS = {
  已啟用: ['bg-success'],
  僅匯出: ['bg-primary'],
  尚未啟用: ['bg-secondary'],
  待確認: ['bg-warning', 'text-dark'],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ImportCenterPage />
    </MemoryRouter>,
  );
}

function statusBadges(label) {
  return screen.getAllByText(label).filter((el) => el.classList.contains('import-center-card__status'));
}

describe('匯入中心狀態圖例', () => {
  test('圖例與卡片使用同一套粉彩 Badge，類型標籤維持獨立', () => {
    renderPage();
    const legend = screen.getByRole('list', { name: '狀態說明' });

    for (const [label, classes] of Object.entries(STATUS_CLASS)) {
      const legendBadge = within(legend).getByText(label);
      expect(legendBadge.className).toContain('badge');
      expect(legendBadge.className).toContain('import-center-card__status');
      expect(legendBadge.className).not.toContain('status-badge');
      expect(legendBadge.className).not.toContain('import-center-kind');
      for (const className of classes) {
        expect(legendBadge.className).toContain(className);
      }

      const matches = statusBadges(label);
      expect(matches.length).toBeGreaterThan(1);
      for (const el of matches) {
        expect(el.className).toBe(legendBadge.className);
      }
    }

    const kind = screen.getAllByText('匯入').find((el) => el.classList.contains('import-center-kind--import'));
    expect(kind).toBeTruthy();
    expect(kind.className).toContain('import-center-card__kind');
    expect(kind.className).not.toContain('import-center-card__status');
    expect(kind.className).not.toContain('bg-success');

    expect(screen.getByRole('button', { name: '查看匯入紀錄' })).toHaveAttribute('href', '/admin/import-center/runs');
    expect(screen.getAllByRole('button', { name: '前往匯入' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '前往匯出' })).toBeInTheDocument();
    expect(screen.getByText('學習歷程名冊匯入')).toBeInTheDocument();
  });
});
