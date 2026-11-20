import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

function renderPage() {
  return render(
    <MemoryRouter>
      <ImportCenterPage />
    </MemoryRouter>,
  );
}

describe('匯入中心任務入口', () => {
  test('首屏只顯示實際在用的四個任務 hub，廢棄入口不出現', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole('heading', { name: '資料匯入中心' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '常用任務' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '前往學習歷程匯入' })).toHaveAttribute(
      'href',
      '/admin/learning-journey/import',
    );
    expect(screen.getByRole('button', { name: '前往培力成績匯入' })).toHaveAttribute(
      'href',
      '/admin/english-test/import',
    );
    expect(screen.getByRole('button', { name: '報名核對名單' })).toHaveAttribute(
      'href',
      '/admin/english-test?tab=roster',
    );
    expect(screen.getByRole('button', { name: '前往活動列表' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '前往 EWL 同步' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看匯入紀錄' })).toHaveAttribute(
      'href',
      '/admin/import-center/runs',
    );

    expect(screen.getByText('三種名冊不要混用')).toBeInTheDocument();
    expect(screen.getByText('學期在學名冊')).toBeInTheDocument();
    expect(screen.queryByText('全校學生主檔匯入')).not.toBeInTheDocument();
    expect(screen.queryByText('活動資料匯入')).not.toBeInTheDocument();
    expect(screen.queryByText('問卷資料匯出')).not.toBeInTheDocument();

    const more = screen.getByText('例外與維運').closest('details');
    expect(more).toBeTruthy();
    expect(more.open).toBe(false);

    await user.click(within(more).getByText('例外與維運'));
    expect(more.open).toBe(true);
    expect(within(more).getByText('班級名冊（例外補丁）')).toBeInTheDocument();
    expect(within(more).getByText('學習歷程同步與維運')).toBeInTheDocument();
    expect(within(more).queryByRole('button', { name: '前往匯出' })).not.toBeInTheDocument();
  });
});
