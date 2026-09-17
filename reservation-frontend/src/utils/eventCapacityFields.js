import { loadCapacityPrefs } from './eventCapacityPrefs';
import {
  DEFAULT_EVENT_TYPE_CODE,
  CAPACITY_MODES,
  getDefaultTypeConfig,
  normalizeEventTypeCode,
} from '../constants/eventTypeCatalog';

export const DEFAULT_ET_GROUP_COUNT = 9;
export const DEFAULT_ET_PER_GROUP_CAPACITY = 4;
export const MAX_GROUP_COUNT = 20;
export const MAX_PER_GROUP_CAPACITY = 30;
export const MAX_ET_TOTAL_CAPACITY = 300;
export const MAX_NON_ET_CAPACITY = 100;

export function isGroupedCapacityEventType(eventType, typeConfig) {
  const cfg = typeConfig || getDefaultTypeConfig(eventType);
  return cfg.capacityMode === CAPACITY_MODES.GROUPED;
}

/** 是否為 English Table（相容 code／legacy 顯示名）；容量 UI 請用 isGroupedCapacityEventType */
export function isEnglishTableEventType(eventType) {
  return normalizeEventTypeCode(eventType) === 'english_table';
}

export function isEnglishClubEventType(eventType) {
  return normalizeEventTypeCode(eventType) === 'english_club';
}

export function computeTotalCapacity(groupCount, perGroupCapacity) {
  const gc = parseInt(groupCount, 10);
  const pgc = parseInt(perGroupCapacity, 10);
  if (!gc || !pgc || gc < 1 || pgc < 1) return null;
  return gc * pgc;
}

export function getDefaultCapacityFields(eventType, typeConfig) {
  const prefs = loadCapacityPrefs();
  const cfg = typeConfig || getDefaultTypeConfig(eventType || DEFAULT_EVENT_TYPE_CODE);
  if (isGroupedCapacityEventType(eventType, cfg)) {
    const groupCount = Number.isFinite(Number(prefs.groupCount)) && Number(prefs.groupCount) >= 1
      ? Number(prefs.groupCount)
      : (cfg.defaultGroupCount || DEFAULT_ET_GROUP_COUNT);
    const perGroupCapacity = Number.isFinite(Number(prefs.perGroupCapacity)) && Number(prefs.perGroupCapacity) >= 1
      ? Number(prefs.perGroupCapacity)
      : (cfg.defaultPerGroupCapacity || DEFAULT_ET_PER_GROUP_CAPACITY);
    return {
      groupCount,
      perGroupCapacity,
      maxParticipants: groupCount * perGroupCapacity,
    };
  }
  const maxParticipants = Number.isFinite(Number(prefs.maxParticipants)) && Number(prefs.maxParticipants) >= 1
    ? Number(prefs.maxParticipants)
    : 30;
  return {
    groupCount: '',
    perGroupCapacity: '',
    maxParticipants,
  };
}

export function applyCapacityFieldChange(fields, key, rawValue, eventType, typeConfig) {
  const next = { ...fields, [key]: rawValue };
  const isGrouped = isGroupedCapacityEventType(eventType, typeConfig);

  if (!isGrouped) {
    if (key === 'maxParticipants') {
      next.groupCount = '';
      next.perGroupCapacity = '';
    }
    return next;
  }

  const parseBounded = (value, max) => {
    if (value === '' || value === null || value === undefined) return '';
    const n = parseInt(value, 10);
    if (Number.isNaN(n) || n < 1) return '';
    return Math.min(n, max);
  };

  const maxGroups = typeConfig?.maxGroupCount || MAX_GROUP_COUNT;
  const maxPerGroup = typeConfig?.maxPerGroup || MAX_PER_GROUP_CAPACITY;

  if (key === 'groupCount') {
    next.groupCount = parseBounded(rawValue, maxGroups);
  }
  if (key === 'perGroupCapacity') {
    next.perGroupCapacity = parseBounded(rawValue, maxPerGroup);
  }

  const total = computeTotalCapacity(next.groupCount, next.perGroupCapacity);
  next.maxParticipants = total != null ? total : '';

  if (key === 'eventType' && isGrouped) {
    const defaults = getDefaultCapacityFields(eventType, typeConfig);
    return { ...next, ...defaults };
  }

  return next;
}

export function validateCapacityFields(fields, eventType, typeConfig) {
  const cfg = typeConfig || getDefaultTypeConfig(eventType);
  const isGrouped = isGroupedCapacityEventType(eventType, cfg);
  const maxSimple = cfg.maxCapacityCap || MAX_NON_ET_CAPACITY;
  const maxGrouped = cfg.maxCapacityCap || MAX_ET_TOTAL_CAPACITY;
  const maxGroups = cfg.maxGroupCount || MAX_GROUP_COUNT;
  const maxPerGroup = cfg.maxPerGroup || MAX_PER_GROUP_CAPACITY;
  if (!isGrouped) {
    const cap = parseInt(fields.maxParticipants, 10);
    if (!cap || cap < 1 || cap > maxSimple) {
      return `請輸入有效的總人數（1-${maxSimple}）`;
    }
    return null;
  }
  const gc = parseInt(fields.groupCount, 10);
  const pgc = parseInt(fields.perGroupCapacity, 10);
  if (!gc || gc < 1 || gc > maxGroups) {
    return `請輸入有效的組數（1-${maxGroups}）`;
  }
  if (!pgc || pgc < 1 || pgc > maxPerGroup) {
    return `請輸入有效的每組人數（1-${maxPerGroup}）`;
  }
  const total = gc * pgc;
  if (total > maxGrouped) {
    return `總人數不可超過 ${maxGrouped}`;
  }
  return null;
}

export function buildCapacityRequestPayload(fields, eventType, typeConfig) {
  const isGrouped = isGroupedCapacityEventType(eventType, typeConfig);
  if (!isGrouped) {
    return { maxCapacity: parseInt(fields.maxParticipants, 10) };
  }
  const groupCount = parseInt(fields.groupCount, 10);
  const perGroupCapacity = parseInt(fields.perGroupCapacity, 10);
  return {
    groupCount,
    perGroupCapacity,
    maxCapacity: groupCount * perGroupCapacity,
  };
}

export function mapEventToCapacityFields(event, typeConfig) {
  const eventType = event?.eventType || DEFAULT_EVENT_TYPE_CODE;
  if (isGroupedCapacityEventType(eventType, typeConfig)) {
    const cfg = typeConfig || getDefaultTypeConfig(eventType);
    const defaultGroups = cfg.defaultGroupCount || DEFAULT_ET_GROUP_COUNT;
    const groupCount = event?.groupCount ?? defaultGroups;
    const perGroupCapacity = event?.perGroupCapacity
      ?? Math.max(1, Math.ceil((event?.maxCapacity || event?.maxParticipants || 30) / (groupCount || defaultGroups)));
    return {
      groupCount,
      perGroupCapacity,
      maxParticipants: groupCount * perGroupCapacity,
    };
  }
  return {
    groupCount: '',
    perGroupCapacity: '',
    maxParticipants: event?.maxParticipants || event?.maxCapacity || 30,
  };
}
