import { fetchClient } from '../utils/fetchClient';

const BASE_URL = '/api/admin/learning-analytics';

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function parseEnvelope(res) {
  const json = await res.json().catch(() => ({}));
  const requestId = json.requestId || res.headers.get('x-request-id') || '';
  if (!res.ok || json.success === false) {
    let msg = json.error || json.message || `HTTP ${res.status}`;
    if (res.status === 403 || json.code === 'INSUFFICIENT_PERMISSIONS') {
      msg = '您沒有執行此操作的權限。';
    }
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
  const res = await fetchClient(`${BASE_URL}/insights${buildQuery(params)}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res);
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
  const res = await fetchClient(`${BASE_URL}/overview${buildQuery(params)}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function getLearningAnalyticsCohorts(token, params = {}, options = {}) {
  const res = await fetchClient(`${BASE_URL}/cohorts${buildQuery(params)}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function getLearningAnalyticsOfferings(token, params = {}, options = {}) {
  const res = await fetchClient(`${BASE_URL}/offerings${buildQuery(params)}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function getLearningAnalyticsOfferingDetail(token, params = {}, options = {}) {
  const res = await fetchClient(`${BASE_URL}/offerings/detail${buildQuery(params)}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function exportLearningAnalyticsOfferings(token, params = {}, options = {}) {
  const qs = buildQuery(params);
  const res = await fetchClient(`${BASE_URL}/offerings/export${qs}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    let msg = json.error || json.message || `HTTP ${res.status}`;
    if (res.status === 403 || json.code === 'INSUFFICIENT_PERMISSIONS') {
      msg = '您沒有匯出學習成效分析資料的權限。';
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const fallback = `EEARS_LA_offerings_${String(params.dimension || 'course')}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_0000.xlsx`;
  return { blob, fileName: match ? match[1] : fallback };
}

export async function getLearningAnalyticsResources(token, params = {}, options = {}) {
  const res = await fetchClient(`${BASE_URL}/resources${buildQuery(params)}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function getLearningAnalyticsSkills(token, params = {}, options = {}) {
  const res = await fetchClient(`${BASE_URL}/skills${buildQuery(params)}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function getLearningAnalyticsRawData(token, params = {}, options = {}) {
  const res = await fetchClient(`${BASE_URL}/raw-data${buildQuery(params)}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  return parseEnvelope(res);
}

export async function exportLearningAnalyticsRawData(token, params = {}, options = {}) {
  const format = String(params.format || 'xlsx').toLowerCase();
  const qs = buildQuery({ ...params, format });
  const res = await fetchClient(`${BASE_URL}/export${qs}`, {
    headers: authHeaders(token),
    signal: options.signal,
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    let msg = json.error || json.message || `HTTP ${res.status}`;
    if (res.status === 403 || json.code === 'INSUFFICIENT_PERMISSIONS') {
      msg = '您沒有匯出學習成效分析資料的權限。';
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const dataset = String(params.dataset || 'students');
  const ext = format === 'csv' ? 'csv' : 'xlsx';
  const fallback = `EEARS_LA_raw-${dataset}_all_snap-snapshot_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_0000.${ext}`;
  return { blob, fileName: match ? match[1] : fallback };
}

export async function getLearningAnalyticsStudentJourney(token, studentId, params = {}, options = {}) {
  const res = await fetchClient(
    `${BASE_URL}/students/${encodeURIComponent(studentId)}/journey${buildQuery(params)}`,
    { headers: authHeaders(token), signal: options.signal }
  );
  return parseEnvelope(res);
}
