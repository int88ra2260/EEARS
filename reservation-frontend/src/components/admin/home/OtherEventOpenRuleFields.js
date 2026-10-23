import React from 'react';
import { OPEN_RULE_TYPES } from '../../../constants/eventTypeCatalog';
import { WEEKDAY_OPTIONS } from '../../../utils/otherEventForm';

/**
 * 「其他」活動的預約開始時間。名額方式由外層欄位控制。
 */
export default function OtherEventOpenRuleFields({
  fields,
  onChange,
  cutoffHours = 2,
}) {
  const set = (key, value) => onChange({ ...fields, [key]: value });
  const ruleType = fields.openRuleType || OPEN_RULE_TYPES.DAY_BEFORE;

  return (
    <div className="row g-2 mb-2">
      <div className="col-md-3">
        <label className="form-label">預約開始時間 *</label>
        <select
          className="form-control"
          value={ruleType}
          onChange={(e) => set('openRuleType', e.target.value)}
        >
          <option value={OPEN_RULE_TYPES.DAY_BEFORE}>活動開始前 N 天</option>
          <option value={OPEN_RULE_TYPES.PREV_WEEKDAY}>上週指定星期</option>
        </select>
      </div>
      {ruleType === OPEN_RULE_TYPES.PREV_WEEKDAY ? (
        <div className="col-md-2">
          <label className="form-label">星期 *</label>
          <select
            className="form-control"
            value={fields.openRuleWeekday ?? 1}
            onChange={(e) => set('openRuleWeekday', Number(e.target.value))}
          >
            {WEEKDAY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="col-md-2">
          <label className="form-label">天數 N *</label>
          <input
            type="number"
            className="form-control"
            min="0"
            max="60"
            required
            value={fields.openRuleDays ?? 1}
            onChange={(e) => set('openRuleDays', e.target.value)}
          />
        </div>
      )}
      <div className="col-md-2">
        <label className="form-label">開放時刻（時）*</label>
        <input
          type="number"
          className="form-control"
          min="0"
          max="23"
          required
          value={fields.openRuleHour ?? 12}
          onChange={(e) => set('openRuleHour', e.target.value)}
        />
      </div>
      <div className="col-md-2">
        <label className="form-label">分 *</label>
        <input
          type="number"
          className="form-control"
          min="0"
          max="59"
          required
          value={fields.openRuleMinute ?? 0}
          onChange={(e) => set('openRuleMinute', e.target.value)}
        />
      </div>
      <div className="col-12">
        <small className="text-muted">
          這裡決定學生何時可以開始預約。截止仍依此類型設定，為活動開始前 {cutoffHours} 小時（預約與取消相同）。
        </small>
      </div>
    </div>
  );
}

export function StudentHiddenField({ checked, onChange, id = 'event-hidden-from-students' }) {
  return (
    <div className="form-check mb-2">
      <input
        id={id}
        className="form-check-input"
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label className="form-check-label" htmlFor={id}>
        學生端不可見
      </label>
      <div className="form-text">
        勾選後，前台活動列表不會出現這場，學生也無法預約。
      </div>
    </div>
  );
}
