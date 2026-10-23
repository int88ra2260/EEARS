import React from 'react';
import EventCapacityFields from './EventCapacityFields';
import Time24Input from './Time24Input';
import LocationSelectField from '../LocationSelectField';
import ErrorAlert from '../shared/ErrorAlert';
import { getDefaultCapacityFields } from '../../../utils/eventCapacityFields';
import {
  CAPACITY_MODES,
  getDefaultTypeConfig,
  getEventTypeSelectOptions,
  isOtherEventType,
} from '../../../constants/eventTypeCatalog';
import { DEFAULT_OTHER_OPEN_RULE_FIELDS } from '../../../utils/otherEventForm';
import OtherEventOpenRuleFields, { StudentHiddenField } from './OtherEventOpenRuleFields';

/**
 * @param {Object} props
 * @param {Object} props.fields
 * @param {(next: Object) => void} props.onFieldsChange
 * @param {boolean} props.loading
 * @param {string} props.error
 * @param {(e: React.FormEvent) => void} props.onSubmit
 * @param {() => void} props.onOpenBatchAdd
 * @param {Array<{ value: string, label: string }>} [props.eventTypeOptions]
 * @param {(raw: string) => object|null} [props.resolveTypeConfig]
 */
export default function AddEventForm({
  fields,
  onFieldsChange,
  loading,
  error,
  onSubmit,
  onOpenBatchAdd,
  eventTypeOptions,
  resolveTypeConfig,
}) {
  const options = eventTypeOptions?.length
    ? eventTypeOptions
    : getEventTypeSelectOptions({ includeOther: true });

  const typeConfig = typeof resolveTypeConfig === 'function'
    ? resolveTypeConfig(fields.eventType)
    : null;

  const isOther = isOtherEventType(fields.eventType);
  const otherConfig = isOther
    ? (typeConfig || getDefaultTypeConfig('other'))
    : null;

  const setField = (key, value) => {
    if (key === 'eventType') {
      const cfg = typeof resolveTypeConfig === 'function' ? resolveTypeConfig(value) : null;
      const becomingOther = isOtherEventType(value);
      onFieldsChange({
        ...fields,
        eventType: value,
        ...(becomingOther ? DEFAULT_OTHER_OPEN_RULE_FIELDS : { capacityMode: undefined }),
        ...getDefaultCapacityFields(
          value,
          cfg,
          becomingOther ? CAPACITY_MODES.SIMPLE : undefined,
        ),
      });
      return;
    }
    onFieldsChange({ ...fields, [key]: value });
  };

  const handleCapacityModeChange = (mode) => {
    onFieldsChange({
      ...fields,
      capacityMode: mode,
      ...getDefaultCapacityFields(fields.eventType, typeConfig, mode),
    });
  };

  const handleCapacityChange = (nextFields) => {
    onFieldsChange(nextFields);
  };

  return (
    <>
      <h5 className="mb-3">新增活動</h5>
      <form onSubmit={onSubmit} className="mb-4">
        <div className="row g-2 mb-2">
          <div className="col-md-2">
            <label className="form-label">活動名稱 *</label>
            <input
              className="form-control"
              placeholder="請輸入活動名稱"
              required
              value={fields.name}
              onChange={(e) => setField('name', e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label">活動類型 *</label>
            <select
              className="form-control"
              required
              value={fields.eventType}
              onChange={(e) => setField('eventType', e.target.value)}
            >
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {isOther && (
            <div className="col-md-2">
              <label className="form-label">名額方式 *</label>
              <select
                className="form-control"
                value={fields.capacityMode === CAPACITY_MODES.GROUPED ? CAPACITY_MODES.GROUPED : CAPACITY_MODES.SIMPLE}
                onChange={(e) => handleCapacityModeChange(e.target.value)}
              >
                <option value={CAPACITY_MODES.SIMPLE}>總人數</option>
                <option value={CAPACITY_MODES.GROUPED}>分組</option>
              </select>
            </div>
          )}
          <EventCapacityFields
            eventType={fields.eventType}
            typeConfig={isOther
              ? {
                ...(otherConfig || {}),
                capacityMode: fields.capacityMode === CAPACITY_MODES.GROUPED
                  ? CAPACITY_MODES.GROUPED
                  : CAPACITY_MODES.SIMPLE,
              }
              : typeConfig}
            fields={fields}
            onFieldsChange={handleCapacityChange}
            layout="inline"
          />
          <div className="col-md-2">
            <label className="form-label">日期 *</label>
            <input
              type="date"
              className="form-control"
              required
              value={fields.date}
              onChange={(e) => setField('date', e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label">&nbsp;</label>
            <button type="submit" className="btn btn-primary w-100" disabled={loading}>
              {loading ? '新增中...' : '新增活動'}
            </button>
          </div>
        </div>
        <div className="row g-2 mb-2">
          <div className="col-md-2">
            <label className="form-label">開始時間 *</label>
            <Time24Input
              required
              value={fields.startTime}
              onChange={(value) => setField('startTime', value)}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label">結束時間 *</label>
            <Time24Input
              required
              value={fields.endTime}
              onChange={(value) => setField('endTime', value)}
            />
          </div>
          <div className="col-md-4">
            <LocationSelectField
              value={fields.location || ''}
              onChange={(location) => setField('location', location)}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label">備註</label>
            <input
              className="form-control"
              placeholder="選填"
              maxLength={255}
              value={fields.notes ?? ''}
              onChange={(e) => setField('notes', e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label">&nbsp;</label>
            <button type="button" className="btn btn-success w-100" onClick={onOpenBatchAdd}>
              批量新增活動
            </button>
          </div>
        </div>

        {isOther && (
          <OtherEventOpenRuleFields
            fields={fields}
            onChange={onFieldsChange}
            cutoffHours={Number(otherConfig?.cutoffHours) || 2}
          />
        )}
        <StudentHiddenField
          id="add-event-hidden-from-students"
          checked={fields.hiddenFromStudents}
          onChange={(checked) => setField('hiddenFromStudents', checked)}
        />

        {error && <ErrorAlert error={error} />}
      </form>
    </>
  );
}
