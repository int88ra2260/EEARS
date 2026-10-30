import { useEffect, useState } from 'react';
import { fetchStudentLoginOptions } from '../services/studentAuthApi';

export default function useCampusSso() {
  const [campusSso, setCampusSso] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchStudentLoginOptions()
      .then(({ ok, data }) => {
        if (!cancelled && ok) setCampusSso(Boolean(data?.campusSso));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return campusSso;
}
