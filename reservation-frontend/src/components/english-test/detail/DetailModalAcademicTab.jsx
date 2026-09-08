import React from 'react';
import {
  COLLEGES,
  GRADES,
  DEPARTMENT_OPTIONS,
  DEGREE_LEVEL_OPTIONS,
  YES_NO_OPTIONS,
  SCORE_EXAM_TYPE_OPTIONS,
  B2_SKILL_TYPE_OPTIONS,
  ensureOptionInList,
  ensureOptionPairInList,
} from '../../../utils/englishTestFormOptions';
import DetailModalEditingAlert from './DetailModalEditingAlert';
import { TabPanel } from './detailModalTabShell';

const selectStyle = { width: 'auto', minWidth: '12rem', maxWidth: '100%' };

export default function DetailModalAcademicTab({
  registration,
  isEditing,
  editData,
  handleEditChange,
  handleEditToggleArray,
  formOptions = null,
  embedded = false,
}) {
  const hasCEFRB2 = isEditing ? editData.hasCEFRB2 : registration.hasCEFRB2;
  const colleges = formOptions?.colleges || COLLEGES;
  const grades = formOptions?.grades || GRADES;
  const departmentOptions = formOptions?.departmentOptions || DEPARTMENT_OPTIONS;
  const degreeLevelOptions = formOptions?.degreeLevelOptions || DEGREE_LEVEL_OPTIONS;
  const yesNoOptions = YES_NO_OPTIONS;
  const scoreExamOptions = formOptions?.scoreExamTypeOptions?.length
    ? formOptions.scoreExamTypeOptions
    : SCORE_EXAM_TYPE_OPTIONS;

  const collegeValue = editData.college || '';
  const departmentList = ensureOptionInList(
    departmentOptions[collegeValue] || [],
    editData.department,
  );
  const collegeList = ensureOptionInList(colleges, collegeValue);
  const gradeList = ensureOptionInList(grades, editData.grade);
  const degreeList = ensureOptionInList(degreeLevelOptions, editData.degreeLevel);
  const b2SkillList = ensureOptionInList(B2_SKILL_TYPE_OPTIONS, editData.b2SkillType);
  const passedExamPairs = ensureOptionPairInList(
    scoreExamOptions,
    Array.isArray(editData.passedExamTypes) ? null : editData.passedExamTypes,
  );
  // 既有 passedExamTypes 陣列中的孤兒值也要可勾選
  const passedExamOptions = (() => {
    const base = [...passedExamPairs];
    const current = Array.isArray(editData.passedExamTypes) ? editData.passedExamTypes : [];
    current.forEach((value) => {
      if (value && !base.some((o) => o.value === value)) {
        base.push({ value, label: value });
      }
    });
    return base;
  })();

  const handleCollegeChange = (value) => {
    const nextDepts = departmentOptions[value] || [];
    const keepDept = nextDepts.includes(editData.department) ? editData.department : '';
    handleEditChange({ college: value, department: keepDept });
  };

  return (
    <TabPanel embedded={embedded}>
      {isEditing && <DetailModalEditingAlert />}
      <div className="row">
        <div className="col-md-6 mb-3">
          <strong>學院：</strong>{' '}
          {isEditing ? (
            <select
              className="form-select form-select-sm d-inline-block"
              style={selectStyle}
              value={collegeValue}
              onChange={(e) => handleCollegeChange(e.target.value)}
            >
              <option value="">請選擇</option>
              {collegeList.map((college) => (
                <option key={college} value={college}>
                  {college}
                </option>
              ))}
            </select>
          ) : (
            registration.college
          )}
        </div>
        <div className="col-md-6 mb-3">
          <strong>科系：</strong>{' '}
          {isEditing ? (
            collegeValue && departmentOptions[collegeValue] ? (
              <select
                className="form-select form-select-sm d-inline-block"
                style={selectStyle}
                value={editData.department || ''}
                onChange={(e) => handleEditChange('department', e.target.value)}
              >
                <option value="">請選擇</option>
                {departmentList.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="form-control form-control-sm d-inline-block"
                style={selectStyle}
                value={editData.department || ''}
                onChange={(e) => handleEditChange('department', e.target.value)}
                placeholder="請先選擇學院"
                disabled={!collegeValue}
              />
            )
          ) : (
            registration.department
          )}
        </div>
        <div className="col-md-6 mb-3">
          <strong>年級：</strong>{' '}
          {isEditing ? (
            <select
              className="form-select form-select-sm d-inline-block"
              style={selectStyle}
              value={editData.grade || ''}
              onChange={(e) => handleEditChange('grade', e.target.value)}
            >
              <option value="">請選擇</option>
              {gradeList.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          ) : (
            registration.grade
          )}
        </div>
        <div className="col-md-6 mb-3">
          <strong>就讀身分：</strong>{' '}
          {isEditing ? (
            <select
              className="form-select form-select-sm d-inline-block"
              style={selectStyle}
              value={editData.degreeLevel || ''}
              onChange={(e) => handleEditChange('degreeLevel', e.target.value)}
            >
              <option value="">請選擇</option>
              {degreeList.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
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
              style={selectStyle}
              value={editData.hasTakenBESTEP || ''}
              onChange={(e) => handleEditChange('hasTakenBESTEP', e.target.value)}
            >
              <option value="">請選擇</option>
              {yesNoOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
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
              style={selectStyle}
              value={editData.hasCEFRB2 || ''}
              onChange={(e) => handleEditChange('hasCEFRB2', e.target.value)}
            >
              <option value="">請選擇</option>
              {yesNoOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            registration.hasCEFRB2
          )}
        </div>
        {hasCEFRB2 === '是' && (
          <>
            <div className="col-12 mb-3">
              <strong>已通過測驗種類：</strong>{' '}
              {isEditing ? (
                <div className="mt-2">
                  <div className="row">
                    {passedExamOptions.map((opt) => (
                      <div key={opt.value} className="col-md-6 mb-1">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`passed-exam-${opt.value}`}
                            checked={
                              Array.isArray(editData.passedExamTypes)
                              && editData.passedExamTypes.includes(opt.value)
                            }
                            onChange={() => handleEditToggleArray?.('passedExamTypes', opt.value)}
                          />
                          <label className="form-check-label" htmlFor={`passed-exam-${opt.value}`}>
                            {opt.label}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : registration.passedExamTypes && Array.isArray(registration.passedExamTypes) ? (
                registration.passedExamTypes.join(', ')
              ) : (
                '無'
              )}
            </div>
            <div className="col-md-6 mb-3">
              <strong>B2 項目：</strong>{' '}
              {isEditing ? (
                <select
                  className="form-select form-select-sm d-inline-block"
                  style={selectStyle}
                  value={editData.b2SkillType || ''}
                  onChange={(e) => handleEditChange('b2SkillType', e.target.value)}
                >
                  <option value="">請選擇</option>
                  {b2SkillList.map((skill) => (
                    <option key={skill} value={skill}>
                      {skill}
                    </option>
                  ))}
                </select>
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
