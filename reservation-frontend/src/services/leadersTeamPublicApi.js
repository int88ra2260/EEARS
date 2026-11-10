import { fetchClient } from '../utils/fetchClient';

export async function fetchPublicLeaders() {
  const res = await fetchClient('/api/leaders-team');
  if (!res.ok) {
    const err = new Error('載入 LEADERS 介紹失敗');
    err.status = res.status;
    throw err;
  }
  return res.json();
}
