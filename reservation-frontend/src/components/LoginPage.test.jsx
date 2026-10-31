import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import LoginPage from './LoginPage';
import { getLoginInfo, login as loginApi } from '../services/authApi';

vi.mock('../services/authApi', () => ({
  login: vi.fn(),
  loginSso: vi.fn(),
  getLoginInfo: vi.fn(() => Promise.resolve({ ssoEnabled: false })),
}));

vi.mock('../constants/adminNavigation', () => ({
  getAdminRoleHomePath: () => '/admin/dashboard',
}));

function renderLogin() {
  const onLoginSuccess = vi.fn();
  render(
    <MemoryRouter>
      <LoginPage onLoginSuccess={onLoginSuccess} />
    </MemoryRouter>
  );
  return { onLoginSuccess };
}

describe('staff login fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  test('account and password inputs have accessible names', async () => {
    renderLogin();
    const account = await screen.findByLabelText('帳號：');
    const password = screen.getByLabelText('密碼：');

    expect(account).toHaveAttribute('id', 'staff-login-username');
    expect(account).toHaveAttribute('autocomplete', 'username');
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
  });

  test('each label is wired to its input', async () => {
    renderLogin();
    await screen.findByLabelText('帳號：');
    const accountLabel = screen.getByText('帳號：').closest('label');
    const passwordLabel = screen.getByText('密碼：').closest('label');
    expect(accountLabel.control).toBe(screen.getByLabelText('帳號：'));
    expect(passwordLabel.control).toBe(screen.getByLabelText('密碼：'));
    accountLabel.control.focus();
    expect(accountLabel.control).toHaveFocus();
    passwordLabel.control.focus();
    expect(passwordLabel.control).toHaveFocus();
  });

  test('failed login shows the existing error and does not store a token', async () => {
    loginApi.mockResolvedValue({ ok: false, status: 401, data: { error: '帳號或密碼錯誤' } });
    renderLogin();
    fireEvent.change(await screen.findByLabelText('帳號：'), { target: { value: 'staff' } });
    fireEvent.change(screen.getByLabelText('密碼：'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: '登入' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('帳號或密碼錯誤');
    expect(localStorage.getItem('token')).toBeNull();
    expect(loginApi).toHaveBeenCalledWith('staff', 'secret');
  });

  test('successful login still stores the token and calls the existing callback', async () => {
    loginApi.mockResolvedValue({
      ok: true,
      status: 200,
      data: { token: 'staff-token', role: 'admin', mustResetPassword: false, teacher: { name: 'Ada' } },
    });
    const { onLoginSuccess } = renderLogin();
    fireEvent.change(await screen.findByLabelText('帳號：'), { target: { value: 'ada' } });
    fireEvent.change(screen.getByLabelText('密碼：'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: '登入' }));

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBe('staff-token');
    });
    expect(onLoginSuccess).toHaveBeenCalledWith('staff-token', 'admin', 'ada', 'Ada', false);
  });

  test('a non-employee username on SSO points leaders to the local account', async () => {
    getLoginInfo.mockResolvedValueOnce({ ssoEnabled: true });
    renderLogin();
    fireEvent.change(await screen.findByLabelText('員工編號：'), { target: { value: 'et-angelique' } });
    fireEvent.click(screen.getByRole('button', { name: '改用本地帳號' }));
    expect(await screen.findByLabelText('帳號：')).toHaveValue('et-angelique');
    expect(localStorage.getItem('eears.staffLoginMode')).toBe('local');
  });

  test('returns to the check-in link after login', async () => {
    loginApi.mockResolvedValue({
      ok: true,
      status: 200,
      data: { token: 'staff-token', role: 'leader', mustResetPassword: false },
    });
    render(
      <MemoryRouter initialEntries={['/login?next=%2Fadmin%2Fet-grouping%2Fmy-sessions%3FeventId%3D3%26checkInToken%3Dabc']}>
        <Routes>
          <Route path="/login" element={<LoginPage onLoginSuccess={vi.fn()} />} />
          <Route path="/admin/et-grouping/my-sessions" element={<div>帶班簽到</div>} />
          <Route path="/admin/dashboard" element={<div>後台首頁</div>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(await screen.findByLabelText('帳號：'), { target: { value: 'et-angelique' } });
    fireEvent.change(screen.getByLabelText('密碼：'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: '登入' }));
    expect(await screen.findByText('帶班簽到')).toBeInTheDocument();
  });
});
