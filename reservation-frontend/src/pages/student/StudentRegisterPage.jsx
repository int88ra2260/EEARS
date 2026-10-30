import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import StudentAccountEmailVerification from '../../components/student/StudentAccountEmailVerification';
import { registerStudentAccount } from '../../services/studentAuthApi';
import { DEFAULT_STUDENT_NEXT, safeStudentNext, saveStudentSession } from '../../utils/studentSession';
import useCampusSso from '../../hooks/useCampusSso';
import useStudentSession from '../../hooks/useStudentSession';

export default function StudentRegisterPage() {
  const [form, setForm] = useState({
    studentId: '',
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailVerificationToken, setEmailVerificationToken] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const campusSso = useCampusSso();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const session = useStudentSession();
  const next = safeStudentNext(params.get('next') || DEFAULT_STUDENT_NEXT);

  if (session) {
    return <Navigate to={next} replace />;
  }

  const setField = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const { ok, data } = await registerStudentAccount({
        ...form,
        emailVerificationToken,
      });
      if (data?.pending) {
        setNotice(data.message || '申請已送出，確認完成前不會建立帳號。');
        return;
      }
      if (!ok || !data?.token || !data?.student) {
        setError(data?.message || '無法建立帳號');
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
      <div className="card p-4" style={{ width: '100%', maxWidth: 480 }}>
        <h1 className="h4 mb-2">建立帳號</h1>
        {campusSso ? (
          <>
            <p className="text-muted small">
              登入使用中山單一入口的學號與密碼。第一次登入成功就會開通，不必在這裡另外設定密碼。若你以前在這個網站自設過密碼，請改從登入頁使用單一入口的密碼。
            </p>
            <Link className="btn btn-primary" to={`/student/login?next=${encodeURIComponent(next)}`}>前往登入</Link>
          </>
        ) : (
        <>
        <p className="text-muted small">
          請使用學號，以及你常收信的信箱。我們會寄驗證碼，確認這個信箱是你本人的。學號與姓名會與名冊核對。
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label" htmlFor="student-register-id">學號</label>
            <input id="student-register-id" className="form-control" value={form.studentId} onChange={setField('studentId')} autoComplete="username" required />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="student-register-name">姓名</label>
            <input id="student-register-name" className="form-control" value={form.name} onChange={setField('name')} autoComplete="name" required />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="student-register-email">信箱</label>
            <input id="student-register-email" className="form-control" type="email" value={form.email} onChange={setField('email')} autoComplete="email" required />
          </div>
          <StudentAccountEmailVerification
            email={form.email}
            studentId={form.studentId}
            emailVerificationToken={emailVerificationToken}
            verifiedEmail={verifiedEmail}
            onVerified={({ token, verifiedEmail: nextEmail }) => {
              setEmailVerificationToken(token || '');
              setVerifiedEmail(nextEmail || '');
            }}
          />
          <div className="mb-3">
            <label className="form-label" htmlFor="student-register-password">密碼</label>
            <input id="student-register-password" className="form-control" type="password" value={form.password} onChange={setField('password')} autoComplete="new-password" required />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="student-register-password-2">再輸入一次密碼</label>
            <input id="student-register-password-2" className="form-control" type="password" value={form.passwordConfirm} onChange={setField('passwordConfirm')} autoComplete="new-password" required />
          </div>
          <button
            className="btn btn-primary w-100"
            type="submit"
            disabled={submitting || !emailVerificationToken || verifiedEmail !== form.email.trim().toLowerCase()}
          >
            {submitting ? '建立中…' : '建立帳號並登入'}
          </button>
        </form>
        {notice ? <p className="text-success mt-3 mb-0">{notice}</p> : null}
        {error ? <p className="text-danger mt-3 mb-0">{error}</p> : null}
        <p className="small mt-3 mb-0">
          已有帳號？
          {' '}
          <Link to={`/student/login?next=${encodeURIComponent(next)}`}>登入</Link>
        </p>
        </>
        )}
      </div>
    </div>
  );
}
