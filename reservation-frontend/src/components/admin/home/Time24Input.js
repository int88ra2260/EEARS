import React from 'react';

/**
 * 把輸入收成 24 小時制 HH:mm。完整的 16:00、16:00:00 會補成兩位數。
 * @param {string} raw
 * @returns {string}
 */
export function formatTime24Input(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return '';

  const complete = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (complete) {
    const hour = Math.min(23, Number(complete[1]));
    const minute = Math.min(59, Number(complete[2]));
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  const hasColon = text.includes(':');
  if (hasColon) {
    const [left, right = ''] = text.split(':');
    const hour = left.replace(/\D/g, '').slice(0, 2);
    const minute = right.replace(/\D/g, '').slice(0, 2);
    if (text.endsWith(':') && minute.length === 0) return hour ? `${hour}:` : '';
    if (!minute) return hour;
    return `${hour}:${minute}`;
  }

  const digits = text.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/**
 * @param {Object} props
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {boolean} [props.required]
 * @param {'sm'|undefined} [props.size]
 * @param {string} [props.className]
 * @param {string} [props.id]
 */
export default function Time24Input({
  value,
  onChange,
  required = false,
  size,
  className = 'form-control',
  id,
}) {
  const classes = size === 'sm' ? `${className} form-control-sm` : className;

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={classes}
      placeholder="16:00"
      maxLength={5}
      required={required}
      pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
      title="24 小時制，例如 16:00"
      value={value || ''}
      onChange={(event) => onChange(formatTime24Input(event.target.value))}
      onBlur={(event) => onChange(formatTime24Input(event.target.value))}
    />
  );
}
