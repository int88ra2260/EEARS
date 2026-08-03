import React from 'react';
import DetailModalEditingAlert from './DetailModalEditingAlert';
import { TabPanel } from './detailModalTabShell';

export default function DetailModalSpecialTab({
  registration,
  isEditing,
  editData,
  handleEditChange,
  embedded = false,
}) {
  const hasDisabilityCard = isEditing ? editData.hasDisabilityCard : registration.hasDisabilityCard;

  return (
    <TabPanel embedded={embedded}>
      {isEditing && <DetailModalEditingAlert />}
      <div className="row">
        <div className="col-md-6 mb-3">
          <strong>中低收入戶：</strong>{' '}
          {isEditing ? (
            <select
              className="form-select form-select-sm d-inline-block"
              style={{ width: 'auto' }}
              value={editData.isLowIncome || ''}
              onChange={(e) => handleEditChange('isLowIncome', e.target.value)}
            >
              <option value="">請選擇</option>
              <option value="否">否</option>
              <option value="中低收入戶">中低收入戶</option>
              <option value="低收入戶">低收入戶</option>
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
              style={{ width: 'auto' }}
              value={editData.hasDisabilityCard || ''}
              onChange={(e) => handleEditChange('hasDisabilityCard', e.target.value)}
            >
              <option value="">請選擇</option>
              <option value="是">是</option>
              <option value="否">否</option>
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
                <input
                  type="text"
                  className="form-control form-control-sm d-inline-block"
                  style={{ width: 'auto' }}
                  value={
                    Array.isArray(editData.disabilityTypes)
                      ? editData.disabilityTypes.join(', ')
                      : editData.disabilityTypes || ''
                  }
                  onChange={(e) =>
                    handleEditChange(
                      'disabilityTypes',
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s),
                    )
                  }
                  placeholder="以逗號分隔"
                />
              ) : registration.disabilityTypes && Array.isArray(registration.disabilityTypes) ? (
                registration.disabilityTypes.join(', ')
              ) : (
                '無'
              )}
            </div>
            <div className="col-12 mb-3">
              <strong>考試協助項目：</strong>{' '}
              {isEditing ? (
                <input
                  type="text"
                  className="form-control form-control-sm d-inline-block"
                  style={{ width: 'auto' }}
                  value={
                    Array.isArray(editData.examAssistanceOptions)
                      ? editData.examAssistanceOptions.join(', ')
                      : editData.examAssistanceOptions || ''
                  }
                  onChange={(e) =>
                    handleEditChange(
                      'examAssistanceOptions',
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s),
                    )
                  }
                  placeholder="以逗號分隔"
                />
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
