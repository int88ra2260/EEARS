// ===== LoginPage.js（後台登入） =====
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login as loginApi, loginSso as loginSsoApi, getLoginInfo } from '../services/authApi';
import { getAdminRoleHomePath } from '../constants/adminNavigation';

const LOGIN_MODE_KEY = 'eears.staffLoginMode';
const EMPNO_PATTERN = /^[A-Za-z]\d{5,8}$/;

function readSavedLoginMode() {
  try {
    const saved = localStorage.getItem(LOGIN_MODE_KEY);
    return saved === 'local' || saved === 'sso' ? saved : null;
  } catch {
    return null;
  }
}

function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState('local');
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [optionsReady, setOptionsReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    getLoginInfo().then((info) => {
      if (cancelled) return;
      const enabled = Boolean(info?.ssoEnabled);
      setSsoEnabled(enabled);
      const saved = readSavedLoginMode();
      if (enabled && saved !== 'local') setLoginMode('sso');
      else setLoginMode('local');
    }).catch(() => {
      // 維持本地帳號
    }).finally(() => {
      if (!cancelled) setOptionsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const chooseMode = (mode) => {
    setLoginMode(mode);
    setError('');
    try {
      localStorage.setItem(LOGIN_MODE_KEY, mode);
    } catch {
      // 私密瀏覽可能無法寫入
    }
  };

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
        setError(data.error || '您的帳號尚未由英語中心建立，無法登入。請聯繫管理員開通後再試');
      } else {
        setError(data.error || data.message || '登入失敗');
      }
    } catch (err) {
      setError('與伺服器連線發生錯誤');
    } finally {
      setLoading(false);
    }
  };

  const trimmedUsername = username.trim();
  const showLeaderAccountHint = loginMode === 'sso'
    && trimmedUsername
    && !EMPNO_PATTERN.test(trimmedUsername);
  const modeHintId = 'staff-login-mode-hint';

  return (
    <div className="container d-flex justify-content-center mt-5">
      <div className="card p-4" style={{ width: '420px' }}>
        <h2 className="card-title mb-4">後台登入</h2>

        {!optionsReady ? (
          <p className="text-muted small mb-0">正在確認登入方式…</p>
        ) : (
        <>
        {ssoEnabled && (
          <div className="btn-group w-100 mb-3" role="group" aria-label="登入方式">
            <button
              type="button"
              className={`btn ${loginMode === 'sso' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => chooseMode('sso')}
            >
              中山單一入口
            </button>
            <button
              type="button"
              className={`btn ${loginMode === 'local' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => chooseMode('local')}
            >
              本地帳號
            </button>
          </div>
        )}

        <p id={modeHintId} className="text-muted small">
          {loginMode === 'sso'
            ? '有員工編號的教職員在這裡登入。英語桌帶班請改選本地帳號。'
            : '英語桌帶班與中心自建帳號在這裡登入。這組密碼只給後台。學生預約請用學生登入。'}
        </p>

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
              aria-describedby={[modeHintId, showLeaderAccountHint ? 'staff-login-leader-hint' : '', error ? 'staff-login-error' : ''].filter(Boolean).join(' ')}
              disabled={loading}
            />
          </div>
          {showLeaderAccountHint ? (
            <p id="staff-login-leader-hint" className="small mb-3">
              這個不像員工編號。英語桌帶班請改用本地帳號，密碼是英語中心發給後台的那一組。
              {' '}
              <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => chooseMode('local')}>
                改用本地帳號
              </button>
            </p>
          ) : null}
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

        {loginMode === 'sso' && !showLeaderAccountHint ? (
          <p className="text-muted small mt-3 mb-0">
            密碼與 <a href="https://sso.nsysu.edu.tw" target="_blank" rel="noopener noreferrer">sso.nsysu.edu.tw</a> 相同。
          </p>
        ) : null}

        {error && <p id="staff-login-error" className="text-danger mt-3" role="alert">{error}</p>}
        </>
        )}

        <hr className="my-3" />
        <p className="text-muted small mb-0 text-center">
          <Link to="/">返回首頁</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
