import React from 'react';
import EventCapacityFields from './EventCapacityFields';
import LocationSelectField from '../LocationSelectField';
import ErrorAlert from '../shared/ErrorAlert';
import { getDefaultCapacityFields } from '../../../utils/eventCapacityFields';
import { getEventTypeSelectOptions } from '../../../constants/eventTypeCatalog';

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

  const setField = (key, value) => {
    if (key === 'eventType') {
      const cfg = typeof resolveTypeConfig === 'function' ? resolveTypeConfig(value) : null;
      onFieldsChange({
        ...fields,
        eventType: value,
        ...getDefaultCapacityFields(value, cfg),
      });
      return;
    }
    onFieldsChange({ ...fields, [key]: value });
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
          <EventCapacityFields
            eventType={fields.eventType}
            typeConfig={typeConfig}
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
            <input
              type="time"
              className="form-control"
              required
              value={fields.startTime}
              onChange={(e) => setField('startTime', e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label">結束時間 *</label>
            <input
              type="time"
              className="form-control"
              required
              value={fields.endTime}
              onChange={(e) => setField('endTime', e.target.value)}
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
              placeholder="實踐歷程檔案"
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

        {fields.eventType === '其他' && (
          <div className="row g-2 mb-2">
            <div className="col-md-4">
              <label className="form-label">自定義活動類型名稱 *</label>
              <input
                className="form-control"
                placeholder="請輸入活動類型名稱"
                required
                value={fields.customEventType}
                onChange={(e) => setField('customEventType', e.target.value)}
              />
            </div>
            <div className="col-md-8">
              <label className="form-label">預約開始時間規則 *</label>
              <input
                className="form-control"
                placeholder="例：活動開始前兩天的下午3點、這個禮拜二的早上9點等"
                required
                value={fields.customReservationRule}
                onChange={(e) => setField('customReservationRule', e.target.value)}
              />
              <small className="text-muted">注意：自定義活動類型將使用 English Table 的預約時間邏輯（前一天 12:00 開始）</small>
            </div>
          </div>
        )}

        {error && <ErrorAlert error={error} />}
      </form>
    </>
  );
}
