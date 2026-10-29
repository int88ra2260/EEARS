import { fetchClient } from '../utils/fetchClient';
import { presentLearningAnalyticsError } from '../utils/learningAnalyticsError';

const BASE_URL = '/api/admin/learning-analytics';

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function parseEnvelope(res) {
  const json = await res.json().catch(() => ({}));
  const requestId = json.requestId || res.headers.get('x-request-id') || '';
  if (!res.ok || json.success === false) {
    const msg = presentLearningAnalyticsError({
      status: res.status,
      message: json.error || json.message,
      code: json.code,
    });
    const err = new Error(msg);
    err.requestId = requestId;
    err.status = res.status;
    err.code = json.code;
    throw err;
  }
  return json.data != null ? json.data : json;
}

function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const query = qs.toString();
  return query ? `?${query}` : '';
}

function splitStudentIds(params = {}) {
  const { studentIds, ...rest } = params;
  const ids = Array.isArray(studentIds) ? studentIds.filter(Boolean) : [];
  return { rest, ids };
}

async function fetchAnalytics(token, path, params = {}, options = {}) {
  const { rest, ids } = splitStudentIds(params);
  const res = ids.length
    ? await fetchClient(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rest, studentIds: ids }),
      signal: options.signal,
    })
    : await fetchClient(`${BASE_URL}${path}${buildQuery(rest)}`, {
      headers: authHeaders(token),
      signal: options.signal,
    });
  return parseEnvelope(res);
}

async function fetchAnalyticsBlob(token, path, params, options, fallbackName, forbiddenMessage) {
  const { rest, ids } = splitStudentIds(params);
  const res = ids.length
    ? await fetchClient(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rest, studentIds: ids }),
      signal: options.signal,
    })
    : await fetchClient(`${BASE_URL}${path}${buildQuery(rest)}`, {
      headers: authHeaders(token),
      signal: options.signal,
    });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    const msg = presentLearningAnalyticsError({
      status: res.status,
      message: json.error || json.message,
      code: json.code,
      forbiddenMessage,
    });
    throw new Error(msg);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  return { blob, fileName: match ? match[1] : fallbackName };
}

export async function getLearningAnalyticsMeta(token, options = {}) {
  const res = await fetchClient(`${BASE_URL}/meta`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function postPruneAnalyticsSnapshots(token, body = {}, options = {}) {
  const res = await fetchClient(`${BASE_URL}/snapshots/prune`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function getLearningAnalyticsSettings(token, options = {}) {
  const res = await fetchClient(`${BASE_URL}/settings`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function updateLearningAnalyticsResourceSkillProfiles(token, profiles, options = {}) {
  const res = await fetchClient(`${BASE_URL}/settings/resource-skill-profiles`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ profiles }),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function resetLearningAnalyticsResourceSkillProfile(token, resourceKey, options = {}) {
  const res = await fetchClient(
    `${BASE_URL}/settings/resource-skill-profiles/${encodeURIComponent(resourceKey)}/reset`,
    {
      method: 'POST',
      headers: authHeaders(token),
      signal: options.signal,
    }
  );
  return parseEnvelope(res);
}

export async function updateLearningAnalyticsFilterReferences(token, refType, items, options = {}) {
  const res = await fetchClient(`${BASE_URL}/settings/filter-references/${encodeURIComponent(refType)}`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function updateLearningAnalyticsLvaConfig(token, params, options = {}) {
  const res = await fetchClient(`${BASE_URL}/settings/lva-config`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ params }),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function resetLearningAnalyticsLvaConfig(token, options = {}) {
  const res = await fetchClient(`${BASE_URL}/settings/lva-config/reset`, {
    method: 'POST',
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function getLearningAnalyticsInsights(token, params = {}, options = {}) {
  return fetchAnalytics(token, '/insights', params, options);
}

export async function getLearningAnalyticsStudentRecommendations(token, studentId, params = {}, options = {}) {
  const res = await fetchClient(
    `${BASE_URL}/students/${encodeURIComponent(studentId)}/recommendations${buildQuery(params)}`,
    { headers: authHeaders(token), signal: options.signal }
  );
  return parseEnvelope(res);
}

export async function listLearningAnalyticsModelRuns(token, params = {}, options = {}) {
  const res = await fetchClient(`${BASE_URL}/model-runs${buildQuery(params)}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function getLearningAnalyticsModelRun(token, id, options = {}) {
  const res = await fetchClient(`${BASE_URL}/model-runs/${encodeURIComponent(id)}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function createLearningAnalyticsModelRun(token, body = {}, options = {}) {
  const res = await fetchClient(`${BASE_URL}/model-runs`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function getLearningAnalyticsOverview(token, params = {}, options = {}) {
  return fetchAnalytics(token, '/overview', params, options);
}

export async function getLearningAnalyticsB1Plus(token, params = {}, options = {}) {
  return fetchAnalytics(token, '/b1-plus', params, options);
}

export async function getLearningAnalyticsStudentExplorer(token, params = {}, options = {}) {
  return fetchAnalytics(token, '/student-explorer', params, options);
}

export async function exportLearningAnalyticsStudentExplorer(token, params = {}, options = {}) {
  const fallback = `EEARS_LA_explore_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
  return fetchAnalyticsBlob(
    token,
    '/student-explorer/export',
    params,
    options,
    fallback,
    '您沒有匯出學習成效分析資料的權限。',
  );
}

export async function listLearningAnalyticsTrackingCohorts(token, options = {}) {
  const res = await fetchClient(`${BASE_URL}/tracking-cohorts`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function createLearningAnalyticsTrackingCohort(token, body, options = {}) {
  const res = await fetchClient(`${BASE_URL}/tracking-cohorts`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function getLearningAnalyticsTrackingCohort(token, id, params = {}, options = {}) {
  const res = await fetchClient(`${BASE_URL}/tracking-cohorts/${encodeURIComponent(id)}${buildQuery(params)}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function deleteLearningAnalyticsTrackingCohort(token, id, options = {}) {
  const res = await fetchClient(`${BASE_URL}/tracking-cohorts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function getLearningAnalyticsCohorts(token, params = {}, options = {}) {
  return fetchAnalytics(token, '/cohorts', params, options);
}

export async function getLearningAnalyticsOfferings(token, params = {}, options = {}) {
  return fetchAnalytics(token, '/offerings', params, options);
}

export async function getLearningAnalyticsOfferingDetail(token, params = {}, options = {}) {
  return fetchAnalytics(token, '/offerings/detail', params, options);
}

export async function exportLearningAnalyticsOfferings(token, params = {}, options = {}) {
  const fallback = `EEARS_LA_offerings_${String(params.dimension || 'course')}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_0000.xlsx`;
  return fetchAnalyticsBlob(
    token,
    '/offerings/export',
    params,
    options,
    fallback,
    '您沒有匯出學習成效分析資料的權限。',
  );
}

export async function getLearningAnalyticsResources(token, params = {}, options = {}) {
  return fetchAnalytics(token, '/resources', params, options);
}

export async function getLearningAnalyticsSkills(token, params = {}, options = {}) {
  return fetchAnalytics(token, '/skills', params, options);
}

export async function getLearningAnalyticsRawData(token, params = {}, options = {}) {
  return fetchAnalytics(token, '/raw-data', params, options);
}

export async function exportLearningAnalyticsRawData(token, params = {}, options = {}) {
  const format = String(params.format || 'xlsx').toLowerCase();
  const dataset = String(params.dataset || 'students');
  const ext = format === 'csv' ? 'csv' : 'xlsx';
  const fallback = `EEARS_LA_raw-${dataset}_all_snap-snapshot_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_0000.${ext}`;
  return fetchAnalyticsBlob(
    token,
    '/export',
    { ...params, format },
    options,
    fallback,
    '您沒有匯出學習成效分析資料的權限。',
  );
}

export async function getLearningAnalyticsStudentJourney(token, studentId, params = {}, options = {}) {
  const res = await fetchClient(
    `${BASE_URL}/students/${encodeURIComponent(studentId)}/journey${buildQuery(params)}`,
    { headers: authHeaders(token), signal: options.signal }
  );
  return parseEnvelope(res);
}

export async function listLearningAnalyticsKpiPolicies(token, params = {}, options = {}) {
  const res = await fetchClient(`${BASE_URL}/kpi/policies${buildQuery(params)}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function getLearningAnalyticsKpiPolicy(token, id, options = {}) {
  const res = await fetchClient(`${BASE_URL}/kpi/policies/${encodeURIComponent(id)}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function cloneLearningAnalyticsKpiPolicy(token, id, body = {}, options = {}) {
  const res = await fetchClient(`${BASE_URL}/kpi/policies/${encodeURIComponent(id)}/clone`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function createLearningAnalyticsKpiPolicy(token, body = {}, options = {}) {
  const res = await fetchClient(`${BASE_URL}/kpi/policies`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function updateLearningAnalyticsKpiPolicy(token, id, body = {}, options = {}) {
  const res = await fetchClient(`${BASE_URL}/kpi/policies/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function archiveLearningAnalyticsKpiPolicy(token, id, options = {}) {
  const res = await fetchClient(`${BASE_URL}/kpi/policies/${encodeURIComponent(id)}/archive`, {
    method: 'POST',
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function unarchiveLearningAnalyticsKpiPolicy(token, id, options = {}) {
  return updateLearningAnalyticsKpiPolicy(token, id, { isArchived: false }, options);
}

export async function runLearningAnalyticsKpiReport(token, body = {}, options = {}) {
  const res = await fetchClient(`${BASE_URL}/kpi/report`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function exportLearningAnalyticsKpiReport(token, params = {}, options = {}) {
  const fallback = `EEARS_KPI_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
  return fetchAnalyticsBlob(
    token,
    '/kpi/report/export',
    params,
    options,
    fallback,
    '您沒有匯出 KPI 報表的權限。',
  );
}

export async function runLearningAnalyticsKpiGaps(token, body = {}, options = {}) {
  const res = await fetchClient(`${BASE_URL}/kpi/gaps`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function exportLearningAnalyticsKpiGaps(token, params = {}, options = {}) {
  const fallback = `EEARS_KPI_GAPS_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
  return fetchAnalyticsBlob(
    token,
    '/kpi/gaps/export',
    params,
    options,
    fallback,
    '您沒有匯出缺口名單的權限。',
  );
}
