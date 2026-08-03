// ===== LoginPage.js（後台登入） =====
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as loginApi } from '../services/authApi';

function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { ok, status, data } = await loginApi(username, password);
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.info(`[Login] HTTP ${status} ${ok ? 'success' : 'failure'}`);
      }
      if (ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('userRole', data.role);
        localStorage.setItem('username', username);
        localStorage.setItem('mustResetPassword', data.mustResetPassword ? 'true' : 'false');
        let teacherName = null;
        if (data.teacher && data.teacher.name) {
          teacherName = data.teacher.name;
          localStorage.setItem('teacherName', teacherName);
        }
        onLoginSuccess(data.token, data.role, username, teacherName, data.mustResetPassword);
        const teacherLevel = data.teacherLevel || data.teacher?.teacherLevel || 'regular';
        if (data.role === 'teacher' && teacherLevel !== 'executive') {
          navigate('/admin/classes');
        } else if (data.role === 'office_staff') {
          navigate('/admin/operations');
        } else {
          navigate('/admin');
        }
      } else if (data.code === 'LOGIN_COOLDOWN') {
        const minutes = data.retryAfterSeconds
          ? Math.max(1, Math.ceil(Number(data.retryAfterSeconds) / 60))
          : null;
        const cooldownMsg = data.message || data.error || '登入失敗次數過多，請稍後再試。';
        setError(minutes ? `${cooldownMsg}（約 ${minutes} 分鐘後可再試）` : cooldownMsg);
      } else {
        setError(data.error || data.message || '登入失敗');
      }
    } catch (err) {
      setError('與伺服器連線發生錯誤');
    }
  };

  return (
    <div className="container d-flex justify-content-center mt-5">
      <div className="card p-4" style={{ width: '400px' }}>
        <h2 className="card-title mb-4">後台登入</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">帳號：</label>
            <input className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="mb-3">
            <label className="form-label">密碼：</label>
            <input className="form-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn btn-primary w-100" type="submit">登入</button>
        </form>
        {error && <p className="text-danger mt-3">{error}</p>}
      </div>
    </div>
  );
}

export default LoginPage;
