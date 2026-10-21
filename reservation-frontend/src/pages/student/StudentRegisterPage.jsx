import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { registerStudentAccount } from '../../services/studentAuthApi';
import { safeStudentNext, saveStudentSession } from '../../utils/studentSession';
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
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const session = useStudentSession();
  const next = safeStudentNext(params.get('next') || '/my-reservations');

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
    try {
      const { ok, data } = await registerStudentAccount(form);
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
        <h1 className="h4 mb-2">建立學生帳號</h1>
        <p className="text-muted small">
          請使用學號與中山大學信箱。之後若改接校園單一入口，仍會沿用這個學號。
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
          <div className="mb-3">
            <label className="form-label" htmlFor="student-register-password">密碼</label>
            <input id="student-register-password" className="form-control" type="password" value={form.password} onChange={setField('password')} autoComplete="new-password" required />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="student-register-password-2">再輸入一次密碼</label>
            <input id="student-register-password-2" className="form-control" type="password" value={form.passwordConfirm} onChange={setField('passwordConfirm')} autoComplete="new-password" required />
          </div>
          <button className="btn btn-primary w-100" type="submit" disabled={submitting}>
            {submitting ? '建立中…' : '建立帳號並登入'}
          </button>
        </form>
        {error ? <p className="text-danger mt-3 mb-0">{error}</p> : null}
        <p className="small mt-3 mb-0">
          已有帳號？
          {' '}
          <Link to={`/student/login?next=${encodeURIComponent(next)}`}>學生登入</Link>
        </p>
      </div>
    </div>
  );
}
