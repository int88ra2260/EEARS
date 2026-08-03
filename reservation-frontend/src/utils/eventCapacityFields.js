export const DEFAULT_ET_GROUP_COUNT = 9;
export const DEFAULT_ET_PER_GROUP_CAPACITY = 4;
export const MAX_GROUP_COUNT = 20;
export const MAX_PER_GROUP_CAPACITY = 30;
export const MAX_ET_TOTAL_CAPACITY = 300;
export const MAX_NON_ET_CAPACITY = 100;

export function isEnglishTableEventType(eventType) {
  return (eventType || 'English Table') === 'English Table';
}

export function computeTotalCapacity(groupCount, perGroupCapacity) {
  const gc = parseInt(groupCount, 10);
  const pgc = parseInt(perGroupCapacity, 10);
  if (!gc || !pgc || gc < 1 || pgc < 1) return null;
  return gc * pgc;
}

export function getDefaultCapacityFields(eventType) {
  if (isEnglishTableEventType(eventType)) {
    return {
      groupCount: DEFAULT_ET_GROUP_COUNT,
      perGroupCapacity: DEFAULT_ET_PER_GROUP_CAPACITY,
      maxParticipants: DEFAULT_ET_GROUP_COUNT * DEFAULT_ET_PER_GROUP_CAPACITY,
    };
  }
  return {
    groupCount: '',
    perGroupCapacity: '',
    maxParticipants: 30,
  };
}

export function applyCapacityFieldChange(fields, key, rawValue, eventType) {
  const next = { ...fields, [key]: rawValue };
  const isET = isEnglishTableEventType(eventType);

  if (!isET) {
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

  if (key === 'groupCount') {
    next.groupCount = parseBounded(rawValue, MAX_GROUP_COUNT);
  }
  if (key === 'perGroupCapacity') {
    next.perGroupCapacity = parseBounded(rawValue, MAX_PER_GROUP_CAPACITY);
  }

  const total = computeTotalCapacity(next.groupCount, next.perGroupCapacity);
  next.maxParticipants = total != null ? total : '';

  if (key === 'eventType' && isET) {
    const defaults = getDefaultCapacityFields(eventType);
    return { ...next, ...defaults };
  }

  return next;
}

export function validateCapacityFields(fields, eventType) {
  const isET = isEnglishTableEventType(eventType);
  if (!isET) {
    const cap = parseInt(fields.maxParticipants, 10);
    if (!cap || cap < 1 || cap > MAX_NON_ET_CAPACITY) {
      return `請輸入有效的總人數（1-${MAX_NON_ET_CAPACITY}）`;
    }
    return null;
  }

  const gc = parseInt(fields.groupCount, 10);
  const pgc = parseInt(fields.perGroupCapacity, 10);
  if (!gc || gc < 1 || gc > MAX_GROUP_COUNT) {
    return `請輸入有效的組數（1-${MAX_GROUP_COUNT}）`;
  }
  if (!pgc || pgc < 1 || pgc > MAX_PER_GROUP_CAPACITY) {
    return `請輸入有效的每組人數（1-${MAX_PER_GROUP_CAPACITY}）`;
  }
  const total = gc * pgc;
  if (total > MAX_ET_TOTAL_CAPACITY) {
    return `總人數不可超過 ${MAX_ET_TOTAL_CAPACITY}`;
  }
  return null;
}

export function buildCapacityRequestPayload(fields, eventType) {
  const isET = isEnglishTableEventType(eventType);
  if (!isET) {
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

export function mapEventToCapacityFields(event) {
  const eventType = event?.eventType || 'English Table';
  if (isEnglishTableEventType(eventType)) {
    const groupCount = event?.groupCount ?? DEFAULT_ET_GROUP_COUNT;
    const perGroupCapacity = event?.perGroupCapacity
      ?? Math.max(1, Math.ceil((event?.maxCapacity || event?.maxParticipants || 30) / (groupCount || DEFAULT_ET_GROUP_COUNT)));
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
