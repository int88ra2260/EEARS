import React from 'react';
import useStudentSession from '../../hooks/useStudentSession';
import StudentAuthGate from './StudentAuthGate';

export default function RequireStudentAuth({ children }) {
  const session = useStudentSession();
  if (!session) return <StudentAuthGate />;
  return children;
}
