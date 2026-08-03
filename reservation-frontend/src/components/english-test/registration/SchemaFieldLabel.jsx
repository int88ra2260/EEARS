import React from 'react';
import { fieldHelp, fieldLabel, fieldRequired } from '../../../utils/englishTestFormSchemaMeta';

/** 依 schema 顯示欄位標籤（含必填星號與說明） */
export default function SchemaFieldLabel({
  formOptions,
  fieldKey,
  fallback,
  requiredFallback = false,
  className = 'form-label',
  requiredStyle = { color: 'red' },
}) {
  const label = fieldLabel(formOptions, fieldKey, fallback);
  const required = fieldRequired(formOptions, fieldKey, requiredFallback);
  const help = fieldHelp(formOptions, fieldKey, '');

  return (
    <>
      <label className={className}>
        {label}
        {required ? <span style={requiredStyle}> *</span> : null}
      </label>
      {help ? <div className="form-text mb-1">{help}</div> : null}
    </>
  );
}
