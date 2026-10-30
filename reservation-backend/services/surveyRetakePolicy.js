'use strict';

/**
 * 填寫次數的單一判斷。
 * 後台「填寫次數」寫在 fillScope；預約 Gate 歷史上讀 retakePolicy。
 * once_ever 與實際行為同為每學期一次，視為 once_per_semester 的舊值。
 */

function normalizeRetakePolicy(rule) {
  const fillScope = String(rule?.fillScope || '').trim();
  const retakePolicy = String(rule?.retakePolicy || '').trim();
  const raw = fillScope || retakePolicy || 'once_per_semester';
  if (raw === 'unlimited') return 'unlimited';
  if (raw === 'once_per_event') return 'once_per_event';
  if (raw === 'once_ever' || raw === 'once_per_semester' || raw === 'once_per_activity') {
    return 'once_per_semester';
  }
  return 'once_per_semester';
}

function isSemesterScopedPolicy(policy) {
  return normalizeRetakePolicy({ retakePolicy: policy }) === 'once_per_semester';
}

function semesterStatusLabel(filled, policy) {
  const normalized = normalizeRetakePolicy({ retakePolicy: policy });
  if (normalized === 'unlimited') return '可填寫';
  if (normalized === 'once_per_event') return filled ? '這場已填' : '這場未填';
  return filled ? '本學期已填' : '本學期未填';
}

module.exports = {
  normalizeRetakePolicy,
  isSemesterScopedPolicy,
  semesterStatusLabel,
};
