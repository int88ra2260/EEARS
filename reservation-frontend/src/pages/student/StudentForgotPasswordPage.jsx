import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  confirmStudentPasswordReset,
  sendStudentPasswordReset,
} from '../../services/studentAuthApi';
import useCampusSso from '../../hooks/useCampusSso';
import { clearStudentSession, safeStudentNext } from '../../utils/studentSession';

export default function StudentForgotPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeStudentNext(params.get('next') || '/my-reservations');
  const [studentId, setStudentId] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const campusSso = useCampusSso();

  useEffect(() => {
    if (cooldownSec <= 0) return undefined;
    const timer = setTimeout(() => setCooldownSec((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldownSec]);

  const handleSend = async (event) => {
    event.preventDefault();
    setSending(true);
    setError('');
    setMessage('');
    try {
      const { ok, data } = await sendStudentPasswordReset(studentId.trim());
      if (!ok) {
        setError(data?.message || '無法寄送驗證碼');
        return;
      }
      setSent(true);
      setCode('');
      setMessage(data?.message || '若此學號已有可登入的帳號，驗證碼已寄到註冊信箱。');
      setCooldownSec(60);
    } catch {
      setError('與伺服器連線發生錯誤');
    } finally {
      setSending(false);
    }
  };

  const handleConfirm = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { ok, data } = await confirmStudentPasswordReset({
        studentId: studentId.trim(),
        code: code.trim(),
        newPassword,
        newPasswordConfirm,
      });
      if (!ok) {
        setError(data?.message || '無法更新密碼');
        return;
      }
      clearStudentSession();
      navigate(`/student/login?notice=password-reset&next=${encodeURIComponent(next)}`, { replace: true });
    } catch {
      setError('與伺服器連線發生錯誤');
    } finally {
      setSubmitting(false);
    }
  };

  if (campusSso) {
    return (
      <div className="d-flex justify-content-center">
        <div className="card p-4" style={{ width: '100%', maxWidth: 440 }}>
          <h1 className="h4 mb-2">忘記密碼</h1>
          <p className="text-muted small">登入密碼就是中山單一入口的密碼，不是以前在這個網站自設的密碼。請到單一入口重設，再回到這裡登入。</p>
          <a className="btn btn-primary" href="https://sso.nsysu.edu.tw">前往單一入口</a>
          <p className="small mt-3 mb-0">
            <Link to={`/student/login?next=${encodeURIComponent(next)}`}>返回登入</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex justify-content-center">
      <div className="card p-4" style={{ width: '100%', maxWidth: 440 }}>
        <h1 className="h4 mb-2">忘記密碼</h1>
        <p className="text-muted small">
          輸入學號後，驗證碼會寄到註冊時的信箱。尚未核准的申請不會收到信；若還在確認中且忘記當初的密碼，請重新建立帳號。
        </p>
        <form onSubmit={handleSend}>
          <div className="mb-3">
            <label className="form-label" htmlFor="student-reset-id">學號</label>
            <input
              id="student-reset-id"
              className="form-control"
              value={studentId}
              autoComplete="username"
              onChange={(event) => {
                setStudentId(event.target.value);
                setSent(false);
                setCode('');
              }}
              required
            />
          </div>
          <button className="btn btn-outline-primary" type="submit" disabled={sending || cooldownSec > 0}>
            {sending ? '寄送中…' : cooldownSec > 0 ? `重新寄送（${cooldownSec} 秒）` : sent ? '重新寄送驗證碼' : '寄送驗證碼'}
          </button>
        </form>
        {sent ? (
          <form className="mt-4" onSubmit={handleConfirm}>
            <div className="mb-3">
              <label className="form-label" htmlFor="student-reset-code">驗證碼</label>
              <input
                id="student-reset-code"
                className="form-control"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="student-reset-password">新密碼</label>
              <input
                id="student-reset-password"
                className="form-control"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
              <p className="form-text mb-0">8 到 72 個字元，且不能與學號或信箱相同。</p>
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="student-reset-password-2">再輸入一次新密碼</label>
              <input
                id="student-reset-password-2"
                className="form-control"
                type="password"
                autoComplete="new-password"
                value={newPasswordConfirm}
                onChange={(event) => setNewPasswordConfirm(event.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting || code.length !== 6}>
              {submitting ? '更新中…' : '更新密碼'}
            </button>
          </form>
        ) : null}
        {message ? <p className="text-success small mt-3 mb-0">{message}</p> : null}
        {error ? <p className="text-danger small mt-3 mb-0">{error}</p> : null}
        <p className="small mt-3 mb-0">
          <Link to={`/student/login?next=${encodeURIComponent(next)}`}>回到登入</Link>
        </p>
      </div>
    </div>
  );
}
