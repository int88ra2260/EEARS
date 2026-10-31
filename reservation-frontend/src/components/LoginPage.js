// ===== LoginPage.js（後台登入） =====
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login as loginApi, loginSso as loginSsoApi, getLoginInfo } from '../services/authApi';
import { getAdminRoleHomePath } from '../constants/adminNavigation';

function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState('local'); // 'local' or 'sso'
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const navigate = useNavigate();

  // 檢查 SSO 是否可用
  useEffect(() => {
    getLoginInfo().then(info => {
      if (info?.ssoEnabled) {
        setSsoEnabled(true);
        setLoginMode('sso'); // 預設使用 SSO
      }
    }).catch(() => {
      // 忽略錯誤，保持預設
    });
  }, []);

  const handleLoginSuccess = (data, usernameUsed) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('userRole', data.role);
    localStorage.setItem('username', usernameUsed);
    localStorage.setItem('mustResetPassword', data.mustResetPassword ? 'true' : 'false');
    let teacherName = null;
    if (data.teacher && data.teacher.name) {
      teacherName = data.teacher.name;
      localStorage.setItem('teacherName', teacherName);
    }
    onLoginSuccess(data.token, data.role, usernameUsed, teacherName, data.mustResetPassword);
    const teacherLevel = data.teacherLevel || data.teacher?.teacherLevel || 'regular';
    navigate(getAdminRoleHomePath({ role: data.role, teacherLevel }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loginFn = loginMode === 'sso' ? loginSsoApi : loginApi;
      const { ok, status, data } = await loginFn(username, password);
      
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.info(`[Login] ${loginMode} HTTP ${status} ${ok ? 'success' : 'failure'}`);
      }

      if (ok) {
        handleLoginSuccess(data, username);
      } else if (data.code === 'LOGIN_COOLDOWN') {
        const minutes = data.retryAfterSeconds
          ? Math.max(1, Math.ceil(Number(data.retryAfterSeconds) / 60))
          : null;
        const cooldownMsg = data.message || data.error || '登入失敗次數過多，請稍後再試。';
        setError(minutes ? `${cooldownMsg}（約 ${minutes} 分鐘後可再試）` : cooldownMsg);
      } else if (data.code === 'PASSWORD_CHANGE_REQUIRED' && data.redirectUrl) {
        setError(`${data.error || '請先變更密碼'}。將導向單一入口...`);
        setTimeout(() => {
          window.open(data.redirectUrl, '_blank');
        }, 1500);
      } else if (data.code === 'ACCOUNT_NOT_FOUND') {
        setError('您的員工編號尚未在系統中建立帳號，請聯繫管理員');
      } else {
        setError(data.error || data.message || '登入失敗');
      }
    } catch (err) {
      setError('與伺服器連線發生錯誤');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container d-flex justify-content-center mt-5">
      <div className="card p-4" style={{ width: '420px' }}>
        <h2 className="card-title mb-4">後台登入</h2>
        
        {/* 登入方式切換 */}
        {ssoEnabled && (
          <div className="btn-group w-100 mb-4" role="group" aria-label="登入方式">
            <button
              type="button"
              className={`btn ${loginMode === 'sso' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => { setLoginMode('sso'); setError(''); }}
            >
              中山單一入口
            </button>
            <button
              type="button"
              className={`btn ${loginMode === 'local' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => { setLoginMode('local'); setError(''); }}
            >
              本地帳號
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label" htmlFor="staff-login-username">
              {loginMode === 'sso' ? '員工編號：' : '帳號：'}
            </label>
            <input
              id="staff-login-username"
              className="form-control"
              type="text"
              name="username"
              autoComplete="username"
              placeholder={loginMode === 'sso' ? '例如: A1234567' : ''}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'staff-login-error' : undefined}
              disabled={loading}
            />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="staff-login-password">
              {loginMode === 'sso' ? '單一入口密碼：' : '密碼：'}
            </label>
            <input
              id="staff-login-password"
              className="form-control"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'staff-login-error' : undefined}
              disabled={loading}
            />
          </div>
          <button 
            className="btn btn-primary w-100" 
            type="submit"
            disabled={loading}
          >
            {loading ? '登入中...' : '登入'}
          </button>
        </form>

        {loginMode === 'sso' && (
          <p className="text-muted small mt-3 mb-0">
            使用與 <a href="https://sso.nsysu.edu.tw" target="_blank" rel="noopener noreferrer">sso.nsysu.edu.tw</a> 相同的密碼
          </p>
        )}

        {error && <p id="staff-login-error" className="text-danger mt-3" role="alert">{error}</p>}
        
        <hr className="my-3" />
        <p className="text-muted small mb-0 text-center">
          <Link to="/">返回首頁</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
