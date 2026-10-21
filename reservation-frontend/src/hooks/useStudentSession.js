import { useEffect, useState } from 'react';
import { loadStudentSession } from '../utils/studentSession';

export default function useStudentSession() {
  const [session, setSession] = useState(() => loadStudentSession());

  useEffect(() => {
    const sync = () => setSession(loadStudentSession());
    window.addEventListener('eears-student-session', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('eears-student-session', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return session;
}
