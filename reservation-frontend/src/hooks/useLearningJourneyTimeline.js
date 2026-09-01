import { useCallback, useEffect, useState } from 'react';
import { getLearningJourneyV3StudentTimeline } from '../services/learningJourneyV3Api';

export default function useLearningJourneyTimeline(token, studentId, options = {}) {
  const semesterId = String(options.semesterId || '').trim();
  const includeExcludedCourses = options.includeExcludedCourses !== false;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const sid = String(studentId || '').trim();
    if (!token || !sid) return;
    setLoading(true);
    setError('');
    try {
      const result = await getLearningJourneyV3StudentTimeline(token, sid, {
        includeExcludedCourses: includeExcludedCourses ? 'true' : 'false',
        semesterId: semesterId || undefined,
      });
      setData(result);
    } catch (err) {
      setError(err?.message || '時間軸載入失敗');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, studentId, semesterId, includeExcludedCourses]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
