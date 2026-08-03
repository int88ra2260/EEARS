import { fetchClient } from '../utils/fetchClient';

async function parseJson(res) {
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function fetchLearningResourcesPublic() {
  const res = await fetchClient('/api/page-content/learning-resources');
  return parseJson(res);
}

export async function fetchRegulationsFormsPublic() {
  const res = await fetchClient('/api/page-content/regulations-forms');
  return parseJson(res);
}

export async function fetchScrollWorldTestPublic() {
  const res = await fetchClient('/api/page-content/scroll-world-test');
  return parseJson(res);
}

