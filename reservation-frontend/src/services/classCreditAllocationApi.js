import { fetchClient } from '../utils/fetchClient';

function studentQs(identity) {
  return new URLSearchParams({
    studentId: identity.studentId || '',
    studentName: identity.studentName || '',
    studentEmail: identity.studentEmail || '',
  });
}

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

function throwIfNotOk(res, data, fallback) {
  if (res.ok) return;
  const msg = data?.message || data?.error || fallback;
  const err = new Error(msg);
  err.status = res.status;
  err.code = data?.code;
  throw err;
}

/**
 * @param {{ studentId: string, studentName: string, studentEmail: string }} identity
 * @param {string} semester
 */
export async function fetchClassCreditAllocation(identity, semester) {
  const qs = studentQs(identity);
  qs.set('semester', semester);
  const res = await fetchClient(`/api/class-credit-allocation?${qs}`);
  const data = await parseJson(res);
  throwIfNotOk(res, data, '載入課堂加分配置失敗');
  return data.data;
}

/**
 * @param {{ studentId: string, studentName: string, studentEmail: string }} identity
 * @param {string} semester
 * @param {{ classId: number, hours: number }[]} allocations
 */
export async function saveClassCreditAllocation(identity, semester, allocations) {
  const res = await fetchClient('/api/class-credit-allocation', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: identity.studentId,
      studentName: identity.studentName,
      studentEmail: identity.studentEmail,
      semester,
      allocations,
    }),
  });
  const data = await parseJson(res);
  throwIfNotOk(res, data, '儲存課堂加分配置失敗');
  return data.data;
}

export async function fetchClassCreditNavEnabled() {
  try {
    const res = await fetchClient('/api/class-credit-allocation/nav-enabled');
    const data = await parseJson(res);
    if (!res.ok) return true;
    return data.enabled !== false;
  } catch {
    return true;
  }
}

export async function updateClassCreditNavEnabled(token, enabled) {
  const res = await fetchClient('/api/admin/class-credit-allocation/nav-enabled', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ enabled: !!enabled }),
  });
  const data = await parseJson(res);
  throwIfNotOk(res, data, '更新入口開關失敗');
  return data.enabled !== false;
}

export async function fetchClassCreditDeadlines(token) {
  const res = await fetchClient('/api/admin/class-credit-allocation/deadlines', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJson(res);
  throwIfNotOk(res, data, '載入截止日失敗');
  return data.data;
}

export async function fetchAdminClassCreditStudent(token, semester, studentId) {
  const qs = new URLSearchParams({
    semester: semester || '',
    studentId: studentId || '',
  });
  const res = await fetchClient(`/api/admin/class-credit-allocation/students?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJson(res);
  throwIfNotOk(res, data, '查詢學生時數失敗');
  return data.data;
}

export async function createClassCreditAdjustment(token, payload) {
  const res = await fetchClient('/api/admin/class-credit-allocation/adjustments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  throwIfNotOk(res, data, '新增時數調整失敗');
  return data.data;
}

export async function deleteClassCreditAdjustment(token, id) {
  const res = await fetchClient(`/api/admin/class-credit-allocation/adjustments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJson(res);
  throwIfNotOk(res, data, '刪除時數調整失敗');
  return data.data;
}

export async function previewClassCreditReminder(token, semester) {
  const qs = new URLSearchParams({ semester: semester || '' });
  const res = await fetchClient(`/api/admin/class-credit-allocation/reminders/preview?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJson(res);
  throwIfNotOk(res, data, '預覽提醒對象失敗');
  return data.data;
}

export async function sendClassCreditReminder(token, semester) {
  const res = await fetchClient('/api/admin/class-credit-allocation/reminders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ semester }),
  });
  const data = await parseJson(res);
  throwIfNotOk(res, data, '寄送提醒失敗');
  return data.data;
}

export async function updateClassCreditDeadline(token, semester, deadline) {
  const res = await fetchClient(`/api/admin/class-credit-allocation/deadlines/${encodeURIComponent(semester)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ deadline }),
  });
  const data = await parseJson(res);
  throwIfNotOk(res, data, '更新截止日失敗');
  return data.data;
}
