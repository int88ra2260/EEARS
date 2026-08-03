import React from 'react';
import {
  isEnglishTableEventType,
  applyCapacityFieldChange,
  computeTotalCapacity,
} from '../../../utils/eventCapacityFields';

/**
 * 活動名額欄位：ET 顯示組數／每組人數／總人數；其他類型僅總人數。
 */
function displayNumberValue(value) {
  return value == null || value === '' ? '' : value;
}

export default function EventCapacityFields({
  eventType,
  fields,
  onFieldsChange,
  size = 'default',
  layout = 'inline',
}) {
  const isET = isEnglishTableEventType(eventType);
  const total = isET
    ? computeTotalCapacity(fields.groupCount, fields.perGroupCapacity)
    : fields.maxParticipants;

  const setCapacityField = (key, value) => {
    onFieldsChange(applyCapacityFieldChange(fields, key, value, eventType));
  };

  const inputClass = size === 'sm' ? 'form-control form-control-sm' : 'form-control';
  // Keep enough width for digits + native spinner arrows (too narrow = arrows look present but unusable).
  const compactInputStyle = { minWidth: '4.5rem', width: '4.5rem', flex: '0 0 auto' };

  if (!isET) {
    if (layout === 'compact') {
      return (
        <input
          type="number"
          className={inputClass}
          min="1"
          max="100"
          placeholder="30"
          style={{ minWidth: '4rem' }}
          value={displayNumberValue(fields.maxParticipants)}
          onChange={(e) => setCapacityField('maxParticipants', e.target.value === '' ? '' : e.target.value)}
        />
      );
    }

    if (layout === 'labeled') {
      return (
        <div className="batch-capacity batch-capacity--single">
          <label className="form-label">總人數 *</label>
          <input
            type="number"
            className={inputClass}
            min="1"
            max="100"
            title="總人數"
            placeholder="30"
            value={displayNumberValue(fields.maxParticipants)}
            onChange={(e) => setCapacityField('maxParticipants', e.target.value === '' ? '' : e.target.value)}
          />
        </div>
      );
    }

    return (
      <div className={layout === 'inline' ? 'col-md-2' : 'mb-3'}>
        {layout !== 'inline' && <label className="form-label">總人數 *</label>}
        {layout === 'inline' && <label className="form-label">人數限制 *</label>}
        <input
          type="number"
          className={inputClass}
          min="1"
          max="100"
          placeholder="30"
          value={displayNumberValue(fields.maxParticipants)}
          onChange={(e) => setCapacityField('maxParticipants', e.target.value === '' ? '' : e.target.value)}
        />
      </div>
    );
  }

  if (layout === 'labeled') {
    return (
      <div className="batch-capacity">
        <div className="batch-capacity__field">
          <label className="form-label">組數 *</label>
          <input
            type="number"
            className={inputClass}
            min="1"
            max="20"
            title="組數"
            value={displayNumberValue(fields.groupCount)}
            onChange={(e) => setCapacityField('groupCount', e.target.value)}
          />
        </div>
        <span className="batch-capacity__op" aria-hidden="true">×</span>
        <div className="batch-capacity__field">
          <label className="form-label">每組人數 *</label>
          <input
            type="number"
            className={inputClass}
            min="1"
            max="30"
            title="每組人數"
            value={displayNumberValue(fields.perGroupCapacity)}
            onChange={(e) => setCapacityField('perGroupCapacity', e.target.value)}
          />
        </div>
        <span className="batch-capacity__op" aria-hidden="true">=</span>
        <div className="batch-capacity__field">
          <label className="form-label">總人數</label>
          <input
            type="number"
            className={inputClass}
            readOnly
            title="總人數"
            value={displayNumberValue(total)}
            placeholder="自動計算"
          />
        </div>
      </div>
    );
  }

  if (layout === 'compact') {
    return (
      <div className="d-flex gap-1 align-items-center">
        <input
          type="number"
          className={inputClass}
          min="1"
          max="20"
          title="組數"
          placeholder="組"
          style={compactInputStyle}
          value={displayNumberValue(fields.groupCount)}
          onChange={(e) => setCapacityField('groupCount', e.target.value)}
        />
        <span className="text-muted">×</span>
        <input
          type="number"
          className={inputClass}
          min="1"
          max="30"
          title="每組人數"
          placeholder="人"
          style={compactInputStyle}
          value={displayNumberValue(fields.perGroupCapacity)}
          onChange={(e) => setCapacityField('perGroupCapacity', e.target.value)}
        />
        <span className="text-muted">=</span>
        <input
          type="number"
          className={inputClass}
          readOnly
          title="總人數"
          placeholder="總"
          style={compactInputStyle}
          value={displayNumberValue(total)}
        />
      </div>
    );
  }

  const cols = layout === 'inline' ? 'col-md-2' : 'col-md-4';

  return (
    <>
      <div className={layout === 'inline' ? 'col-md-1' : cols}>
        {layout !== 'inline' && <label className="form-label">組數 *</label>}
        {layout === 'inline' && <label className="form-label">組數 *</label>}
        <input
          type="number"
          className={inputClass}
          min="1"
          max="20"
          value={displayNumberValue(fields.groupCount)}
          onChange={(e) => setCapacityField('groupCount', e.target.value)}
        />
      </div>
      <div className={layout === 'inline' ? 'col-md-1' : cols}>
        <label className="form-label">每組人數 *</label>
        <input
          type="number"
          className={inputClass}
          min="1"
          max="30"
          value={displayNumberValue(fields.perGroupCapacity)}
          onChange={(e) => setCapacityField('perGroupCapacity', e.target.value)}
        />
      </div>
      <div className={layout === 'inline' ? 'col-md-1' : cols}>
        <label className="form-label">總人數</label>
        <input
          type="number"
          className={inputClass}
          readOnly
          value={displayNumberValue(total)}
          placeholder="自動計算"
        />
        {layout !== 'inline' && (
          <div className="form-text">組數 × 每組人數</div>
        )}
      </div>
    </>
  );
}
