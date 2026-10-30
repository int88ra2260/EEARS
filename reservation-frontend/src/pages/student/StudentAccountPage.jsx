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
      setEmailNotice('收信信箱已更新。之後的預約通知會寄到這個信箱。');
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
    <div className="d-flex justify-content-center">
      <div className="card p-4" style={{ width: '100%', maxWidth: 480 }}>
        <h1 className="h4 mb-3">我的帳號</h1>
        <dl className="row mb-4">
          <dt className="col-4">學號</dt>
          <dd className="col-8">{student.studentId}</dd>
          <dt className="col-4">姓名</dt>
          <dd className="col-8">{student.name}</dd>
          <dt className="col-4">信箱</dt>
          <dd className="col-8">{student.email}</dd>
        </dl>
        <p className="text-muted small">
          {campusSso
            ? '學號與姓名來自中山單一入口，這裡不能改。下面的信箱只用來收這個網站的通知，可以和單一入口的信箱不同。預約與個人紀錄都使用這個學號。'
            : '預約與個人紀錄都會使用這個學號。通知信寄到下面的信箱。'}
        </p>
        <h2 className="h6">收信信箱</h2>
        <form onSubmit={handleEmailSubmit}>
          <div className="mb-3">
            <label className="form-label" htmlFor="student-mailbox">信箱</label>
            <input id="student-mailbox" className="form-control" type="email" value={mailbox} onChange={(e) => setMailbox(e.target.value)} autoComplete="email" required />
          </div>
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
          <button
            className="btn btn-primary mt-3"
            type="submit"
            disabled={emailSubmitting || !emailVerificationToken || verifiedEmail !== mailbox.trim().toLowerCase()}
          >
            {emailSubmitting ? '更新中…' : '更新收信信箱'}
          </button>
        </form>
        {emailNotice ? <p className="text-success mt-3 mb-0">{emailNotice}</p> : null}
        {emailError ? <p className="text-danger mt-3 mb-0">{emailError}</p> : null}
        <h2 className="h6 mt-4">登入密碼</h2>
        {campusSso ? (
          <>
            <p className="text-muted small">登入密碼就是中山單一入口的密碼。請到單一入口修改，這裡不能改。</p>
            <a className="btn btn-outline-primary" href="https://sso.nsysu.edu.tw">前往單一入口</a>
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
        <p className="small mt-3 mb-0">
          <Link to="/my-reservations">回到我的預約</Link>
        </p>
      </div>
    </div>
  );
}
