import React from 'react';
import {
  DISABILITY_TYPES,
  EXAM_ASSISTANCE_OPTIONS_EDIT,
  LOW_INCOME_OPTIONS,
  YES_NO_OPTIONS,
  ensureOptionInList,
} from '../../../utils/englishTestFormOptions';
import DetailModalEditingAlert from './DetailModalEditingAlert';
import { TabPanel } from './detailModalTabShell';

const selectStyle = { width: 'auto', minWidth: '12rem', maxWidth: '100%' };

export default function DetailModalSpecialTab({
  registration,
  isEditing,
  editData,
  handleEditChange,
  handleEditToggleArray,
  formOptions = null,
  embedded = false,
}) {
  const hasDisabilityCard = isEditing ? editData.hasDisabilityCard : registration.hasDisabilityCard;
  const lowIncomeOptions = ensureOptionInList(
    formOptions?.optionPairsByFieldKey?.isLowIncome?.length
      ? formOptions.optionPairsByFieldKey.isLowIncome.map((o) => o.value)
      : LOW_INCOME_OPTIONS,
    editData.isLowIncome,
  );
  const disabilityTypes = (() => {
    const base = [...(formOptions?.disabilityTypes || DISABILITY_TYPES), '其他'];
    const current = Array.isArray(editData.disabilityTypes) ? editData.disabilityTypes : [];
    current.forEach((value) => {
      if (value && !base.includes(value)) base.push(value);
    });
    return base;
  })();
  const examOptions = (() => {
    const base = [...(formOptions?.examAssistanceOptions || EXAM_ASSISTANCE_OPTIONS_EDIT)];
    if (!base.includes('其他')) base.push('其他');
    const current = Array.isArray(editData.examAssistanceOptions)
      ? editData.examAssistanceOptions
      : [];
    current.forEach((value) => {
      if (value && !base.includes(value)) base.push(value);
    });
    return base;
  })();

  return (
    <TabPanel embedded={embedded}>
      {isEditing && <DetailModalEditingAlert />}
      <div className="row">
        <div className="col-md-6 mb-3">
          <strong>中低收入戶：</strong>{' '}
          {isEditing ? (
            <select
              className="form-select form-select-sm d-inline-block"
              style={selectStyle}
              value={editData.isLowIncome || ''}
              onChange={(e) => handleEditChange('isLowIncome', e.target.value)}
            >
              <option value="">請選擇</option>
              {lowIncomeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            registration.isLowIncome
          )}
        </div>
        <div className="col-md-6 mb-3">
          <strong>身心障礙手冊：</strong>{' '}
          {isEditing ? (
            <select
              className="form-select form-select-sm d-inline-block"
              style={selectStyle}
              value={editData.hasDisabilityCard || ''}
              onChange={(e) => handleEditChange('hasDisabilityCard', e.target.value)}
            >
              <option value="">請選擇</option>
              {YES_NO_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            registration.hasDisabilityCard
          )}
        </div>
        {hasDisabilityCard === '是' && (
          <>
            <div className="col-12 mb-3">
              <strong>身心障礙類別：</strong>{' '}
              {isEditing ? (
                <div className="mt-2 row">
                  {disabilityTypes.map((type) => (
                    <div key={type} className="col-md-6 mb-1">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`disability-type-${type}`}
                          checked={
                            Array.isArray(editData.disabilityTypes)
                            && editData.disabilityTypes.includes(type)
                          }
                          onChange={() => handleEditToggleArray?.('disabilityTypes', type)}
                        />
                        <label className="form-check-label" htmlFor={`disability-type-${type}`}>
                          {type}
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              ) : registration.disabilityTypes && Array.isArray(registration.disabilityTypes) ? (
                registration.disabilityTypes.join(', ')
              ) : (
                '無'
              )}
            </div>
            <div className="col-12 mb-3">
              <strong>考試協助項目：</strong>{' '}
              {isEditing ? (
                <div className="mt-2 row">
                  {examOptions.map((option) => (
                    <div key={option} className="col-md-6 mb-1">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`exam-assist-${option}`}
                          checked={
                            Array.isArray(editData.examAssistanceOptions)
                            && editData.examAssistanceOptions.includes(option)
                          }
                          onChange={() => handleEditToggleArray?.('examAssistanceOptions', option)}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`exam-assist-${option}`}
                          style={{ fontSize: '0.9rem' }}
                        >
                          {option}
                        </label>
                      </div>
                    </div>
                  ))}
                  {Array.isArray(editData.examAssistanceOptions)
                    && editData.examAssistanceOptions.includes('其他') && (
                    <div className="col-12 mt-2">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={editData.examAssistanceOther || ''}
                        onChange={(e) => handleEditChange('examAssistanceOther', e.target.value)}
                        placeholder="請填寫其他考試協助項目"
                      />
                    </div>
                  )}
                </div>
              ) : registration.examAssistanceOptions &&
                Array.isArray(registration.examAssistanceOptions) ? (
                registration.examAssistanceOptions.join(', ')
              ) : (
                '無'
              )}
            </div>
          </>
        )}
      </div>
      {registration.extraAnswers &&
        typeof registration.extraAnswers === 'object' &&
        Object.keys(registration.extraAnswers).length > 0 && (
          <div className="mt-3 pt-3 border-top">
            <strong className="d-block mb-2">自訂題答案</strong>
            {Object.entries(registration.extraAnswers).map(([key, value]) => (
              <div key={key} className="mb-2 small">
                <strong>{key}：</strong>{' '}
                {Array.isArray(value) ? value.join(', ') : String(value ?? '')}
              </div>
            ))}
          </div>
        )}
    </TabPanel>
  );
}
