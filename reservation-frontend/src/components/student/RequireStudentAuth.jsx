import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import useStudentSession from '../../hooks/useStudentSession';
import StudentAuthGate from './StudentAuthGate';

export default function RequireStudentAuth({ children }) {
  const session = useStudentSession();
  const location = useLocation();
  if (!session) return <StudentAuthGate />;
  const onAccountPage = location.pathname === '/student/account';
  if (!session.student.emailVerifiedAt && !onAccountPage) {
    return (
      <div className="d-flex justify-content-center py-4">
        <div className="card p-4" style={{ width: '100%', maxWidth: 520 }} role="status">
          <h1 className="h4 mb-2">請先啟動帳號</h1>
          <p className="mb-2">收信信箱還沒確認，所以還不能使用這項功能。</p>
          <p className="text-muted small mb-3">
            單一入口帶入的信箱不一定是你平常會看的信箱。請到「我的帳號」確認或改成你會收的信箱，再輸入信裡的驗證碼。
          </p>
          <Link className="btn btn-primary" to="/student/account">前往我的帳號</Link>
        </div>
      </div>
    );
  }
  return children;
}
