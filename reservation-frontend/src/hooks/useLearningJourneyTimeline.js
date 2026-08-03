import { useCallback, useEffect, useState } from 'react';
import { getLearningJourneyV3StudentTimeline } from '../services/learningJourneyV3Api';

export default function useLearningJourneyTimeline(token, studentId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const sid = String(studentId || '').trim();
    if (!token || !sid) return;
    setLoading(true);
    setError('');
    try {
      const result = await getLearningJourneyV3StudentTimeline(token, sid);
      setData(result);
    } catch (err) {
      setError(err?.message || '時間軸載入失敗');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, studentId]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
