import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { changeStudentPassword } from '../../services/studentAuthApi';
import useStudentSession from '../../hooks/useStudentSession';

export default function StudentAccountPage() {
  const session = useStudentSession();
  const student = session?.student;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
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
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
      setMessage(data?.message || '密碼已更新');
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
          預約與個人紀錄都會使用這個學號和信箱。
        </p>
        <h2 className="h6">變更密碼</h2>
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
        {message ? <p className="text-success mt-3 mb-0">{message}</p> : null}
        {error ? <p className="text-danger mt-3 mb-0">{error}</p> : null}
        <p className="small mt-3 mb-0">
          <Link to="/my-reservations">回到我的預約</Link>
        </p>
      </div>
    </div>
  );
}
