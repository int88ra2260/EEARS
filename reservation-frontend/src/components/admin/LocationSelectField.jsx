import React, { useEffect, useState } from 'react';

export const LOCATION_OPTIONS = [
  '中山貨櫃創業基地 1樓－角落討論室',
  '圖資大樓 10樓 西灣廣場',
  '綜合大樓 3樓 - GE3013',
  '圖資大樓 10樓 - SW1008',
];

export const LOCATION_OTHER = '__OTHER__';

function deriveState(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return { mode: '', custom: '' };
  if (LOCATION_OPTIONS.includes(trimmed)) return { mode: trimmed, custom: '' };
  return { mode: LOCATION_OTHER, custom: trimmed };
}

export default function LocationSelectField({
  value,
  onChange,
  label = '活動地點',
  disabled = false,
  required = false,
  error = '',
  size = '',
  selectClassName = '',
  inputClassName = '',
}) {
  const [{ mode, custom }, setLocationState] = useState(() => deriveState(value));

  useEffect(() => {
    setLocationState(deriveState(value));
  }, [value]);

  const selectClass = [
    size ? `form-select-${size}` : '',
    selectClassName,
  ].filter(Boolean).join(' ');

  const inputClass = [
    size ? `form-control-${size}` : '',
    inputClassName,
  ].filter(Boolean).join(' ');

  const handleModeChange = (event) => {
    const nextMode = event.target.value;
    if (nextMode === LOCATION_OTHER) {
      setLocationState({ mode: LOCATION_OTHER, custom: '' });
      onChange?.('');
      return;
    }

    setLocationState({ mode: nextMode, custom: '' });
    onChange?.(nextMode || '');
  };

  const handleCustomChange = (event) => {
    const nextCustom = event.target.value;
    setLocationState({ mode: LOCATION_OTHER, custom: nextCustom });
    onChange?.(nextCustom);
  };

  return (
    <div>
      {label ? <label className="form-label">{label}{required ? ' *' : ''}</label> : null}
      <select
        className={`form-select ${selectClass}`.trim()}
        value={mode}
        onChange={handleModeChange}
        disabled={disabled}
        required={required}
      >
        <option value="">請選擇活動地點</option>
        {LOCATION_OPTIONS.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
        <option value={LOCATION_OTHER}>其他</option>
      </select>
      {mode === LOCATION_OTHER ? (
        <input
          className={`form-control mt-2 ${inputClass}`.trim()}
          value={custom}
          onChange={handleCustomChange}
          disabled={disabled}
          required={required}
          placeholder="請輸入活動地點"
        />
      ) : null}
      {error ? <div className="invalid-feedback d-block">{error}</div> : null}
    </div>
  );
}
