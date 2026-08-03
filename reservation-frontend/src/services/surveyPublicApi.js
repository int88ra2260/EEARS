/**
 * 問卷學生端 API 薄層
 */
import { fetchClient } from '../utils/fetchClient';

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

export async function fetchEnabledSurveys() {
  const res = await fetchClient('/api/surveys/enabled');
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || '無法載入問卷列表');
  return Array.isArray(data) ? data : [];
}

export async function fetchPublicSurvey(surveyId) {
  const res = await fetchClient(`/api/surveys/public/${surveyId}`);
  const data = await parseJson(res);
  if (!res.ok || !data?.survey) {
    throw new Error(data.error || '找不到問卷');
  }
  return data;
}

export async function checkSurveyFilled(surveyId, studentId) {
  const res = await fetchClient(`/api/surveys/check/${surveyId}/${studentId}`);
  const data = await parseJson(res);
  if (!res.ok) return { filled: false };
  return data;
}

export async function submitSurvey(surveyId, body) {
  const res = await fetchClient(`/api/surveys/${surveyId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}

export async function submitEnglishTableSurvey(body) {
  const res = await fetchClient('/api/survey/english-table', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  return { ok: res.ok, status: res.status, data };
}
