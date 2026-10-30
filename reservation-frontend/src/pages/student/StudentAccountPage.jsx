import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StudentAccountEmailVerification from '../../components/student/StudentAccountEmailVerification';
import {
  changeStudentNotificationEmail,
  changeStudentPassword,
} from '../../services/studentAuthApi';
import { saveStudentSession } from '../../utils/studentSession';
import useCampusSso from '../../hooks/useCampusSso';
import useStudentSession from '../../hooks/useStudentSession';
import '../../components/student/StudentRecordShell.css';

const SHORTCUTS = [
  { to: '/my-reservations', title: '我的預約', detail: '查看、取消即將參加的活動' },
  { to: '/student/progress', title: '我的紀錄', detail: '出席與學習紀錄' },
  { to: '/student/speaking-portfolio', title: '口說紀錄', detail: '口說練習與回饋' },
  { to: '/student/class-credit-allocation', title: '課堂加分', detail: '課堂加分配置' },
  { to: '/register/english-test', title: '培力英檢報名', detail: '用登入身分帶入可填欄位' },
  { to: '/student/english-learning-passport', title: '英語實踐歷程檔案', detail: '申請與通知使用這個帳號信箱' },
];

export default function StudentAccountPage() {
  const navigate = useNavigate();
  const session = useStudentSession();
  const student = session?.student;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const campusSso = useCampusSso();
  const [editingEmail, setEditingEmail] = useState(false);
  const [mailbox, setMailbox] = useState(student?.email || '');
  const [emailVerificationToken, setEmailVerificationToken] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailNotice, setEmailNotice] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    setEmailSubmitting(true);
    setEmailError('');
    setEmailNotice('');
    try {
      const { ok, data } = await changeStudentNotificationEmail({
        email: mailbox,
        emailVerificationToken,
      });
      if (!ok || !data?.token || !data?.student) {
        setEmailError(data?.message || '無法更新信箱');
        return;
      }
      saveStudentSession({ token: data.token, student: data.student });
      setMailbox(data.student.email);
      setEmailVerificationToken('');
      setVerifiedEmail('');
      setEditingEmail(false);
      setEmailNotice('收信信箱已更新。之後的通知會寄到這個信箱。');
    } catch {
      setEmailError('與伺服器連線發生錯誤');
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { ok, data } = await changeStudentPassword({
        currentPassword,
        newPassword,
        newPasswordConfirm,
      });
      if (!ok) {
        setError(data?.message || '無法更新密碼');
        return;
      }
      navigate('/student/login?notice=password-updated&next=%2Fstudent%2Faccount', { replace: true });
    } catch {
      setError('與伺服器連線發生錯誤');
    } finally {
      setSubmitting(false);
    }
  };

  if (!student) return null;

  return (
    <div className="student-account">
      <header className="student-workspace-identity">
        <div>
          <h1 className="student-workspace-identity__name h4 mb-0">{student.name}</h1>
          <p className="student-workspace-identity__id mb-0">{student.studentId}</p>
        </div>
        <p className="student-account__mailbox mb-0">{student.email}</p>
      </header>

      <section className="student-account__section">
        <h2 className="h6">我可以做的事</h2>
        <div className="student-account__grid">
          {SHORTCUTS.map((item) => (
            <Link key={item.to} to={item.to} className="student-account__shortcut">
              <span className="student-account__shortcut-title">{item.title}</span>
              <span className="student-account__shortcut-detail">{item.detail}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="student-account__section">
        <h2 className="h6">通知信箱</h2>
        <p className="text-muted small mb-2">
          {campusSso
            ? '預約、培力與歷程檔案的通知寄到這個信箱。它可以和單一入口的信箱不同。'
            : '預約、培力與歷程檔案的通知寄到這個信箱。'}
        </p>
        {emailNotice ? <p className="text-success small">{emailNotice}</p> : null}
        {editingEmail ? (
          <form onSubmit={handleEmailSubmit}>
            <label className="form-label" htmlFor="student-mailbox">新的信箱</label>
            <input
              id="student-mailbox"
              className="form-control mb-3"
              type="email"
              value={mailbox}
              onChange={(e) => setMailbox(e.target.value)}
              autoComplete="email"
              required
            />
            <StudentAccountEmailVerification
              email={mailbox}
              studentId={student.studentId}
              emailVerificationToken={emailVerificationToken}
              verifiedEmail={verifiedEmail}
              onVerified={({ token, verifiedEmail: nextEmail }) => {
                setEmailVerificationToken(token || '');
                setVerifiedEmail(nextEmail || '');
              }}
            />
            <div className="d-flex gap-2 mt-3">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={emailSubmitting || !emailVerificationToken || verifiedEmail !== mailbox.trim().toLowerCase()}
              >
                {emailSubmitting ? '更新中…' : '更新收信信箱'}
              </button>
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => {
                  setEditingEmail(false);
                  setMailbox(student.email);
                  setEmailError('');
                }}
              >
                取消
              </button>
            </div>
            {emailError ? <p className="text-danger mt-3 mb-0">{emailError}</p> : null}
          </form>
        ) : (
          <button className="btn btn-outline-primary" type="button" onClick={() => setEditingEmail(true)}>
            更換收信信箱
          </button>
        )}
      </section>

      <section className="student-account__section">
        <h2 className="h6">登入方式</h2>
        {campusSso ? (
          <>
            <p className="text-muted small">登入密碼是中山單一入口的密碼。學號與姓名也來自單一入口。</p>
            <a className="btn btn-outline-primary" href="https://sso.nsysu.edu.tw">到單一入口改密碼</a>
          </>
        ) : (
          <>
            <p className="text-muted small">更新後會登出，請用新密碼重新登入。</p>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label" htmlFor="student-current-password">目前密碼</label>
                <input id="student-current-password" className="form-control" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="student-new-password">新密碼</label>
                <input id="student-new-password" className="form-control" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="student-new-password-2">再輸入一次新密碼</label>
                <input id="student-new-password-2" className="form-control" type="password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} autoComplete="new-password" required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? '更新中…' : '更新密碼'}
              </button>
            </form>
            {error ? <p className="text-danger mt-3 mb-0">{error}</p> : null}
          </>
        )}
      </section>
    </div>
  );
}
