import React from 'react';
import { fieldOptionPairs, fieldType } from '../../../utils/englishTestFormSchemaMeta';

/**
 * 預設題硬編碼控制項：依 schema.type 切換文字／下拉／多行（後台改題型後學生端跟著變）。
 */
export default function SchemaAwareControl({
  formOptions,
  fieldKey,
  name,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  placeholder,
  maxLength,
  style,
  className,
  inputType = 'text',
  fallbackType = 'text',
}) {
  const type = fieldType(formOptions, fieldKey, fallbackType);
  const options = fieldOptionPairs(formOptions, fieldKey);
  const controlName = name || fieldKey;
  const commonClass = className || (type === 'select' ? 'form-select' : 'form-control');

  if (type === 'select') {
    const hasCurrent =
      value != null &&
      value !== '' &&
      !options.some((opt) => String(opt.value) === String(value));
    return (
      <select
        className={commonClass}
        name={controlName}
        value={value || ''}
        onChange={onChange}
        disabled={disabled || readOnly}
        style={style}
      >
        <option value="">{placeholder || '請選擇'}</option>
        {hasCurrent ? <option value={value}>{value}</option> : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (type === 'textarea') {
    return (
      <textarea
        className={commonClass}
        name={controlName}
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
        rows={3}
        style={style}
      />
    );
  }

  return (
    <input
      type={type === 'email' || type === 'date' || type === 'tel' ? type : inputType}
      className={commonClass}
      name={controlName}
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      readOnly={readOnly}
      disabled={disabled}
      style={style}
    />
  );
}
