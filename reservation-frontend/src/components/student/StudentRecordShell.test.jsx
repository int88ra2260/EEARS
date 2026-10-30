import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import StudentRecordShell from './StudentRecordShell';

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: (key) => key }),
}));

vi.mock('../../hooks/useStudentSession', () => ({
  default: () => ({
    student: { name: '王小明', studentId: 'B123456789', email: 'student@example.com' },
  }),
}));

describe('StudentRecordShell', () => {
  test('不顯示舊分頁，改提供回到我的帳號', () => {
    render(
      <MemoryRouter>
        <StudentRecordShell lead="說明">內容</StudentRecordShell>
      </MemoryRouter>,
    );

    const back = screen.getByRole('link', { name: 'nav.backToStudentAccount' });
    expect(back).toHaveAttribute('href', '/student/account');
    expect(screen.queryByRole('link', { name: 'nav.myReservations' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'nav.myProgress' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'nav.speakingPortfolio' })).not.toBeInTheDocument();
    expect(screen.getByText('內容')).toBeInTheDocument();
  });
});
