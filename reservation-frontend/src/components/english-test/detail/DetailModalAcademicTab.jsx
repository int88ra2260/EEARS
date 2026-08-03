import React from 'react';
import DetailModalEditingAlert from './DetailModalEditingAlert';
import { TabPanel } from './detailModalTabShell';

export default function DetailModalAcademicTab({
  registration,
  isEditing,
  editData,
  handleEditChange,
  embedded = false,
}) {
  const hasCEFRB2 = isEditing ? editData.hasCEFRB2 : registration.hasCEFRB2;

  return (
    <TabPanel embedded={embedded}>
      {isEditing && <DetailModalEditingAlert />}
      <div className="row">
        <div className="col-md-6 mb-3">
          <strong>學院：</strong>{' '}
          {isEditing ? (
            <input
              type="text"
              className="form-control form-control-sm d-inline-block"
              style={{ width: 'auto' }}
              value={editData.college || ''}
              onChange={(e) => handleEditChange('college', e.target.value)}
            />
          ) : (
            registration.college
          )}
        </div>
        <div className="col-md-6 mb-3">
          <strong>科系：</strong>{' '}
          {isEditing ? (
            <input
              type="text"
              className="form-control form-control-sm d-inline-block"
              style={{ width: 'auto' }}
              value={editData.department || ''}
              onChange={(e) => handleEditChange('department', e.target.value)}
            />
          ) : (
            registration.department
          )}
        </div>
        <div className="col-md-6 mb-3">
          <strong>年級：</strong>{' '}
          {isEditing ? (
            <input
              type="text"
              className="form-control form-control-sm d-inline-block"
              style={{ width: 'auto' }}
              value={editData.grade || ''}
              onChange={(e) => handleEditChange('grade', e.target.value)}
            />
          ) : (
            registration.grade
          )}
        </div>
        <div className="col-md-6 mb-3">
          <strong>就讀身分：</strong>{' '}
          {isEditing ? (
            <select
              className="form-select form-select-sm d-inline-block"
              style={{ width: 'auto' }}
              value={editData.degreeLevel || ''}
              onChange={(e) => handleEditChange('degreeLevel', e.target.value)}
            >
              <option value="">請選擇</option>
              <option value="學士班">學士班</option>
              <option value="碩士班">碩士班</option>
              <option value="博士班">博士班</option>
            </select>
          ) : (
            registration.degreeLevel
          )}
        </div>
        <div className="col-md-6 mb-3">
          <strong>是否曾報考 BESTEP：</strong>{' '}
          {isEditing ? (
            <select
              className="form-select form-select-sm d-inline-block"
              style={{ width: 'auto' }}
              value={editData.hasTakenBESTEP || ''}
              onChange={(e) => handleEditChange('hasTakenBESTEP', e.target.value)}
            >
              <option value="">請選擇</option>
              <option value="是">是</option>
              <option value="否">否</option>
            </select>
          ) : (
            registration.hasTakenBESTEP
          )}
        </div>
        <div className="col-md-6 mb-3">
          <strong>是否取得 CEFR B2：</strong>{' '}
          {isEditing ? (
            <select
              className="form-select form-select-sm d-inline-block"
              style={{ width: 'auto' }}
              value={editData.hasCEFRB2 || ''}
              onChange={(e) => handleEditChange('hasCEFRB2', e.target.value)}
            >
              <option value="">請選擇</option>
              <option value="是">是</option>
              <option value="否">否</option>
            </select>
          ) : (
            registration.hasCEFRB2
          )}
        </div>
        {hasCEFRB2 === '是' && (
          <>
            <div className="col-md-6 mb-3">
              <strong>已通過測驗種類：</strong>{' '}
              {isEditing ? (
                <input
                  type="text"
                  className="form-control form-control-sm d-inline-block"
                  style={{ width: 'auto' }}
                  value={
                    Array.isArray(editData.passedExamTypes)
                      ? editData.passedExamTypes.join(', ')
                      : editData.passedExamTypes || ''
                  }
                  onChange={(e) =>
                    handleEditChange(
                      'passedExamTypes',
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s),
                    )
                  }
                  placeholder="以逗號分隔"
                />
              ) : registration.passedExamTypes && Array.isArray(registration.passedExamTypes) ? (
                registration.passedExamTypes.join(', ')
              ) : (
                '無'
              )}
            </div>
            <div className="col-md-6 mb-3">
              <strong>B2 項目：</strong>{' '}
              {isEditing ? (
                <input
                  type="text"
                  className="form-control form-control-sm d-inline-block"
                  style={{ width: 'auto' }}
                  value={editData.b2SkillType || ''}
                  onChange={(e) => handleEditChange('b2SkillType', e.target.value)}
                />
              ) : (
                registration.b2SkillType || '無'
              )}
            </div>
          </>
        )}
      </div>
    </TabPanel>
  );
}
