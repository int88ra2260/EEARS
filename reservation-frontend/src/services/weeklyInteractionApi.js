import { fetchClient } from '../utils/fetchClient';

export async function fetchPollResults({ slug, blockId, voterKey }) {
  const qs = new URLSearchParams({ slug, voterKey });
  const res = await fetchClient(`/api/weekly/interactions/poll/${encodeURIComponent(blockId)}?${qs}`);
  if (!res.ok) throw new Error('無法載入投票結果');
  return res.json();
}

export async function submitPollVote({ slug, blockId, optionIds, voterKey }) {
  const res = await fetchClient('/api/weekly/interactions/poll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, blockId, optionIds, voterKey }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '投票失敗');
  return data;
}

export async function submitQuizAnswers({ slug, blockId, answers, voterKey }) {
  const res = await fetchClient('/api/weekly/interactions/quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, blockId, answers, voterKey }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '提交失敗');
  return data;
}

export async function recordWeeklyEngagement({ slug, eventType, blockId, voterKey, payload }) {
  const res = await fetchClient('/api/weekly/interactions/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, eventType, blockId, voterKey, payload }),
  });
  if (!res.ok) return null;
  return res.json();
}
