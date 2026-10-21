import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useStudentSession from '../../hooks/useStudentSession';

export default function RequireStudentAuth({ children }) {
  const session = useStudentSession();
  const location = useLocation();
  if (!session) {
    const next = `${location.pathname}${location.search || ''}`;
    return <Navigate to={`/student/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return children;
}
