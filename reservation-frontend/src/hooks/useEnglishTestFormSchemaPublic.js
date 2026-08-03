import { useCallback, useEffect, useState } from 'react';
import { fetchPublicEnglishTestFormSchema } from '../services/englishTestFormSchemaApi';

/**
 * 學生端載入已發布報名表單 schema（失敗時回傳 null，沿用硬編碼 fallback）。
 */
export function useEnglishTestFormSchemaPublic() {
  const [schemaPayload, setSchemaPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPublicEnglishTestFormSchema();
      setSchemaPayload(data);
    } catch (err) {
      setError(err);
      setSchemaPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const schema = schemaPayload?.schema || null;
  const meta = schemaPayload?.meta || null;
  const customQuestions = (schema?.questions || []).filter((q) => !q.system && q.visible !== false);

  return {
    loading,
    error,
    schema,
    meta,
    version: schemaPayload?.version,
    customQuestions,
    reload,
  };
}
