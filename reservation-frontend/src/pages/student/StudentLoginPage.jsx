import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import StudentAccountEmailVerification from '../../components/student/StudentAccountEmailVerification';
import {
  completeCampusEmailSetup,
  loginStudentAccount,
} from '../../services/studentAuthApi';
import { clearStudentSession, safeStudentNext, saveStudentSession } from '../../utils/studentSession';
import useCampusSso from '../../hooks/useCampusSso';
import useStudentSession from '../../hooks/useStudentSession';

export default function StudentLoginPage() {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [passwordUpdateUrl, setPasswordUpdateUrl] = useState('');
  const campusSso = useCampusSso();
  const [emailSetup, setEmailSetup] = useState(null);
  const [mailbox, setMailbox] = useState('');
  const [emailVerificationToken, setEmailVerificationToken] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const session = useStudentSession();
  const next = safeStudentNext(params.get('next') || '/my-reservations');
  const notice = params.get('notice');
  const noticeText = notice === 'password-reset'
    ? '密碼已更新，請用新密碼登入'
    : notice === 'password-updated'
      ? '密碼已更新，請重新登入'
      : '';
  const leavingAfterPasswordChange = notice === 'password-reset' || notice === 'password-updated';

  useEffect(() => {
    if (leavingAfterPasswordChange) clearStudentSession();
  }, [leavingAfterPasswordChange]);

  if (session && !leavingAfterPasswordChange) {
    return <Navigate to={next} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setPasswordUpdateUrl('');
    try {
      const { ok, data } = await loginStudentAccount(studentId, password);
      if (data?.code === 'CAMPUS_EMAIL_REQUIRED' && data.setupToken) {
        setEmailSetup({
          setupToken: data.setupToken,
          studentId: data.studentId,
          name: data.name,
        });
        setError('');
        return;
      }
      if (!ok || !data?.token || !data?.student) {
        setError(data?.message || '登入失敗');
        setPasswordUpdateUrl(data?.code === 'CAMPUS_PASSWORD_UPDATE_REQUIRED' ? (data.redirectUrl || '') : '');
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

  const handleCompleteEmail = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { ok, data } = await completeCampusEmailSetup({
        setupToken: emailSetup.setupToken,
        email: mailbox,
        emailVerificationToken,
      });
      if (!ok || !data?.token || !data?.student) {
        setError(data?.message || '無法完成登入');
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

  const mailboxReady = Boolean(
    emailVerificationToken
    && verifiedEmail
    && verifiedEmail === mailbox.trim().toLowerCase(),
  );

  return (
    <div className="d-flex justify-content-center">
      <div className="card p-4" style={{ width: '100%', maxWidth: 440 }}>
        <h1 className="h4 mb-2">登入</h1>
        <p className="text-muted small">
          {campusSso
            ? '使用你在中山單一入口的學號與密碼。不必另外建立帳號，第一次登入成功就會開通。'
            : '登入後可以預約，以及查看我的紀錄、口說紀錄、課堂加分配置與培力報名。'}
          {params.get('next') ? ' 登入後會回到你剛才要使用的頁面。' : ''}
        </p>
        {campusSso ? (
          <ul className="small mb-3 ps-3">
            <li>密碼就是你在 sso.nsysu.edu.tw 使用的那一組。以前在這個網站自設的密碼不能再登入。</li>
            <li>登入後可以預約，以及查看我的紀錄、口說紀錄、課堂加分配置與培力報名。</li>
            <li>預約通知先寄到單一入口的信箱。若那不是你常收的信箱，登入後到「我的帳號」更換並完成驗證。</li>
            <li>忘記密碼、還在用預設密碼，或密碼已到期：先到單一入口處理，再回到這裡登入。</li>
            <li>取消預約時，仍要輸入預約信裡的驗證碼。</li>
          </ul>
        ) : null}
        {noticeText ? <p className="text-success small">{noticeText}</p> : null}
        {emailSetup ? (
          <form onSubmit={handleCompleteEmail}>
            <p className="small">
              {emailSetup.name}（{emailSetup.studentId}）的單一入口沒有可用信箱。驗證一個常收信的信箱後就會完成登入，之後的預約通知會寄到這裡。
            </p>
            <div className="mb-3">
              <label className="form-label" htmlFor="student-login-mailbox">信箱</label>
              <input
                id="student-login-mailbox"
                className="form-control"
                type="email"
                value={mailbox}
                autoComplete="email"
                onChange={(e) => setMailbox(e.target.value)}
                required
              />
            </div>
            <StudentAccountEmailVerification
              email={mailbox}
              studentId={emailSetup.studentId}
              emailVerificationToken={emailVerificationToken}
              verifiedEmail={verifiedEmail}
              onVerified={({ token, verifiedEmail: nextEmail }) => {
                setEmailVerificationToken(token);
                setVerifiedEmail(nextEmail);
              }}
            />
            <button className="btn btn-primary w-100 mt-3" type="submit" disabled={submitting || !mailboxReady}>
              {submitting ? '登入中…' : '完成登入'}
            </button>
          </form>
        ) : (
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
            <label className="form-label" htmlFor="student-login-password">
              {campusSso ? '單一入口密碼' : '密碼'}
            </label>
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
        )}
        {error ? <p className="text-danger mt-3 mb-0">{error}</p> : null}
        {passwordUpdateUrl ? (
          <p className="small mt-2 mb-0">
            <a href={passwordUpdateUrl}>前往單一入口修改密碼</a>
          </p>
        ) : null}
        {campusSso ? (
          <p className="small mt-3 mb-0">
            <a href="https://sso.nsysu.edu.tw">忘記密碼？到單一入口重設</a>
          </p>
        ) : (
          <>
            <p className="small mt-3 mb-0">
              <Link to={`/student/forgot-password?next=${encodeURIComponent(next)}`}>忘記密碼</Link>
            </p>
            <p className="small mt-2 mb-0">
              還沒有帳號？
              {' '}
              <Link to={`/student/register?next=${encodeURIComponent(next)}`}>建立帳號</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
