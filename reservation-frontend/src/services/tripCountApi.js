import { fetchClientThrow } from '../utils/fetchClient';

const BASE = '/api/admin/trip-counts';

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function readJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const err = new Error(data.error || '旅遊分帳請求失敗');
    err.code = data.code;
    throw err;
  }
  return data.data;
}

export function listTripCounts(token) {
  return fetchClientThrow(BASE, { headers: authHeaders(token) }).then(readJson);
}

export function createTripCount(token, payload) {
  return fetchClientThrow(BASE, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  }).then(readJson);
}

export function getTripCount(token, tripId) {
  return fetchClientThrow(`${BASE}/${tripId}`, { headers: authHeaders(token) }).then(readJson);
}

export function deleteTripCount(token, tripId) {
  return fetchClientThrow(`${BASE}/${tripId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  }).then(readJson);
}

export function addTripCountMember(token, tripId, name) {
  return fetchClientThrow(`${BASE}/${tripId}/members`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  }).then(readJson);
}

export function removeTripCountMember(token, tripId, memberId) {
  return fetchClientThrow(`${BASE}/${tripId}/members/${memberId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  }).then(readJson);
}

export function addTripCountExpense(token, tripId, payload) {
  return fetchClientThrow(`${BASE}/${tripId}/expenses`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  }).then(readJson);
}

export function removeTripCountExpense(token, tripId, expenseId) {
  return fetchClientThrow(`${BASE}/${tripId}/expenses/${expenseId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  }).then(readJson);
}
