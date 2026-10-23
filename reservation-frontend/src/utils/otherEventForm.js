import { OPEN_RULE_TYPES, CAPACITY_MODES, isOtherEventType } from '../constants/eventTypeCatalog';

export const WEEKDAY_OPTIONS = Object.freeze([
  { value: 0, label: '星期日' },
  { value: 1, label: '星期一' },
  { value: 2, label: '星期二' },
  { value: 3, label: '星期三' },
  { value: 4, label: '星期四' },
  { value: 5, label: '星期五' },
  { value: 6, label: '星期六' },
]);

export const DEFAULT_OTHER_OPEN_RULE_FIELDS = Object.freeze({
  capacityMode: CAPACITY_MODES.SIMPLE,
  openRuleType: OPEN_RULE_TYPES.DAY_BEFORE,
  openRuleDays: 1,
  openRuleWeekday: 1,
  openRuleHour: 12,
  openRuleMinute: 0,
});

function normalizeOpenRuleType(type) {
  if (type === OPEN_RULE_TYPES.PREV_WEEKDAY) return OPEN_RULE_TYPES.PREV_WEEKDAY;
  return OPEN_RULE_TYPES.DAY_BEFORE;
}

export function openRuleToFields(openRule) {
  const rule = openRule && typeof openRule === 'object' ? openRule : {};
  return {
    openRuleType: normalizeOpenRuleType(rule.type),
    openRuleDays: rule.days ?? 1,
    openRuleWeekday: rule.weekday ?? 1,
    openRuleHour: rule.hour ?? 12,
    openRuleMinute: rule.minute ?? 0,
  };
}

export function buildOpenRulePayload(fields) {
  const type = normalizeOpenRuleType(fields?.openRuleType);
  const hour = Number(fields?.openRuleHour);
  const minute = Number(fields?.openRuleMinute);
  const rule = {
    type,
    hour: Number.isFinite(hour) ? hour : 12,
    minute: Number.isFinite(minute) ? minute : 0,
  };
  if (type === OPEN_RULE_TYPES.PREV_WEEKDAY) {
    rule.weekday = Number(fields?.openRuleWeekday);
  } else {
    const days = Number(fields?.openRuleDays);
    rule.days = Number.isFinite(days) ? days : 1;
  }
  return rule;
}

export function otherEventRequestFields(fields) {
  if (!isOtherEventType(fields?.eventType)) {
    return { hiddenFromStudents: !!fields?.hiddenFromStudents };
  }
  return {
    openRule: buildOpenRulePayload(fields),
    capacityMode: fields.capacityMode === CAPACITY_MODES.GROUPED
      ? CAPACITY_MODES.GROUPED
      : CAPACITY_MODES.SIMPLE,
    hiddenFromStudents: !!fields?.hiddenFromStudents,
  };
}
