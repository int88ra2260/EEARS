'use strict';

const STORAGE_KEY = 'eears.eventCapacityPrefs.v1';

/**
 * @returns {{ groupCount?: number, perGroupCapacity?: number, maxParticipants?: number }}
 */
export function loadCapacityPrefs() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

/**
 * @param {{ groupCount?: number|string, perGroupCapacity?: number|string, maxParticipants?: number|string, eventType?: string }} fields
 */
export function saveCapacityPrefs(fields = {}) {
  try {
    if (typeof localStorage === 'undefined') return;
    const prev = loadCapacityPrefs();
    const next = { ...prev };
    const eventType = fields.eventType || 'English Table';
    const isEt = eventType === 'English Table';

    if (isEt) {
      const gc = parseInt(fields.groupCount, 10);
      const pgc = parseInt(fields.perGroupCapacity, 10);
      if (Number.isFinite(gc) && gc >= 1) next.groupCount = gc;
      if (Number.isFinite(pgc) && pgc >= 1) next.perGroupCapacity = pgc;
    } else {
      const max = parseInt(fields.maxParticipants, 10);
      if (Number.isFinite(max) && max >= 1) next.maxParticipants = max;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}
