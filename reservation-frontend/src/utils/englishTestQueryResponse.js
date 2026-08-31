/**
 * 解析培力英檢公開查詢 API 回應（/english-test/registrations/query）
 */
export function extractEnglishTestQueryResult(apiBody) {
  if (!apiBody || typeof apiBody !== 'object') {
    return {
      found: false,
      registration: null,
      canEdit: false,
      statusMessage: null,
      semester: null,
      legacySemesterInferred: false,
    };
  }

  const inner = apiBody.data && typeof apiBody.data === 'object' ? apiBody.data : apiBody;

  return {
    found: Boolean(apiBody.found),
    registration: inner.registration || null,
    canEdit: inner.canEdit !== false,
    statusMessage: inner.statusMessage || null,
    semester: inner.semester || inner.registration?.semester || null,
    legacySemesterInferred: Boolean(inner.legacySemesterInferred),
  };
}
