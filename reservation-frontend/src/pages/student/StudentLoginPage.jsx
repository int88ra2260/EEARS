import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { loginStudentAccount } from '../../services/studentAuthApi';
import { safeStudentNext, saveStudentSession } from '../../utils/studentSession';
import useStudentSession from '../../hooks/useStudentSession';

export default function StudentLoginPage() {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const session = useStudentSession();
  const next = safeStudentNext(params.get('next') || '/my-reservations');

  if (session) {
    return <Navigate to={next} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { ok, data } = await loginStudentAccount(studentId, password);
      if (!ok || !data?.token || !data?.student) {
        setError(data?.message || '登入失敗');
        return;
      }
      saveStudentSession({ token: data.token, student: data.student });
      navigate(next, { replace: true });
    } catch {
      setError('與伺服器連線發生錯誤');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="d-flex justify-content-center">
      <div className="card p-4" style={{ width: '100%', maxWidth: 440 }}>
        <h1 className="h4 mb-2">登入</h1>
        <p className="text-muted small">
          登入後可以預約，以及查看我的紀錄、口說紀錄、課堂加分配置與培力報名。
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label" htmlFor="student-login-id">學號</label>
            <input
              id="student-login-id"
              className="form-control"
              value={studentId}
              autoComplete="username"
              onChange={(e) => setStudentId(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="student-login-password">密碼</label>
            <input
              id="student-login-password"
              className="form-control"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary w-100" type="submit" disabled={submitting}>
            {submitting ? '登入中…' : '登入'}
          </button>
        </form>
        {error ? <p className="text-danger mt-3 mb-0">{error}</p> : null}
        <p className="small mt-3 mb-0">
          還沒有帳號？
          {' '}
          <Link to={`/student/register?next=${encodeURIComponent(next)}`}>建立帳號</Link>
        </p>
      </div>
    </div>
  );
}
