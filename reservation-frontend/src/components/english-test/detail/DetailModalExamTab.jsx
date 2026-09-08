import React from 'react';
import {
  EXAM_TYPE_OPTIONS,
  SCORE_EXAM_TYPE_OPTIONS,
  YES_NO_OPTIONS,
  ensureOptionPairInList,
  getScoreExamTypeOptionsForSkill,
} from '../../../utils/englishTestFormOptions';
import { getExamTypeText } from './detailModalUtils';
import DetailModalEditingAlert from './DetailModalEditingAlert';
import { TabPanel } from './detailModalTabShell';

const SCORE_FIELDS = [
  {
    typeField: 'listeningExamType',
    scoreField: 'listeningScore',
    title: '聽力成績',
    skill: 'listening',
    borderClass: 'border-primary',
    headerClass: 'bg-primary text-white',
  },
  {
    typeField: 'readingExamType',
    scoreField: 'readingScore',
    title: '閱讀成績',
    skill: 'reading',
    borderClass: 'border-success',
    headerClass: 'bg-success text-white',
  },
  {
    typeField: 'speakingExamType',
    scoreField: 'speakingScore',
    title: '口說成績',
    skill: 'speaking',
    borderClass: 'border-warning',
    headerClass: 'bg-warning text-dark',
  },
  {
    typeField: 'writingExamType',
    scoreField: 'writingScore',
    title: '寫作成績',
    skill: 'writing',
    borderClass: 'border-danger',
    headerClass: 'bg-danger text-white',
  },
];

function ScoreCard({
  config,
  registration,
  isEditing,
  editData,
  handleEditChange,
  forceEditing,
  examTypeOptions,
}) {
  const source = isEditing ? editData : registration;
  const examType = source[config.typeField];
  const score = source[config.scoreField];
  const skillOptions = getScoreExamTypeOptionsForSkill(config.skill, examTypeOptions);
  const options = ensureOptionPairInList(skillOptions, examType);

  return (
    <div className="col-md-6 mb-3">
      <div className={`card ${config.borderClass}`}>
        <div className={`card-header ${config.headerClass}`}>
          <strong>{config.title}</strong>
        </div>
        <div className="card-body">
          <div className="mb-2">
            <strong>測驗類別：</strong>
            {isEditing ? (
              <select
                className="form-select form-select-sm"
                value={examType || ''}
                onChange={(e) => handleEditChange(config.typeField, e.target.value)}
              >
                <option value="">請選擇測驗類別</option>
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <span>{examType || '未填寫'}</span>
            )}
          </div>
          <div>
            <strong>成績：</strong>
            {isEditing ? (
              <input
                type="text"
                className="form-control form-control-sm"
                value={score || ''}
                onChange={(e) => handleEditChange(config.scoreField, e.target.value)}
                placeholder={forceEditing ? '請輸入成績' : undefined}
              />
            ) : (
              <span className="badge bg-info">{score || '未填寫'}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DetailModalExamTab({
  registration,
  isEditing,
  editData,
  handleEditChange,
  formOptions = null,
  embedded = false,
}) {
  const source = isEditing ? editData : registration;
  const hasCEFRB2 = source.hasCEFRB2;
  const hasAnyScore = SCORE_FIELDS.some(
    ({ typeField, scoreField }) => source[typeField] || source[scoreField],
  );
  const examTypeOptions = formOptions?.examTypeOptions?.length
    ? formOptions.examTypeOptions
    : EXAM_TYPE_OPTIONS;
  const scoreExamOptions = formOptions?.scoreExamTypeOptions?.length
    ? formOptions.scoreExamTypeOptions
    : SCORE_EXAM_TYPE_OPTIONS;
  const hasCefrOptions = formOptions?.hasCEFRB2Options?.length
    ? formOptions.hasCEFRB2Options.map((o) => o.value || o)
    : YES_NO_OPTIONS;

  return (
    <TabPanel embedded={embedded}>
      {isEditing && <DetailModalEditingAlert />}
      <div className="row">
        <div className="col-md-6 mb-3">
          <div className="card border-primary">
            <div className="card-header bg-primary text-white">
              <strong>報考項目</strong>
            </div>
            <div className="card-body">
              {isEditing ? (
                <select
                  className="form-select"
                  value={editData.examType || ''}
                  onChange={(e) => handleEditChange('examType', e.target.value)}
                >
                  <option value="">請選擇</option>
                  {ensureOptionPairInList(examTypeOptions, editData.examType).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div>
                  <strong>報考項目：</strong>
                  <span className="badge bg-info ms-2">{getExamTypeText(source.examType)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-6 mb-3">
          <div className="card border-success">
            <div className="card-header bg-success text-white">
              <strong>CEFR B2 資格</strong>
            </div>
            <div className="card-body">
              {isEditing ? (
                <select
                  className="form-select"
                  value={editData.hasCEFRB2 || ''}
                  onChange={(e) => handleEditChange('hasCEFRB2', e.target.value)}
                >
                  <option value="">請選擇</option>
                  {hasCefrOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <div>
                  <strong>是否取得 CEFR B2：</strong>
                  <span className={`badge ms-2 ${hasCEFRB2 === '是' ? 'bg-success' : 'bg-secondary'}`}>
                    {hasCEFRB2 || '未填寫'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {hasCEFRB2 === '是' && (
          <>
            {SCORE_FIELDS.map(
              (config) =>
                (source[config.typeField] || source[config.scoreField]) && (
                  <ScoreCard
                    key={config.typeField}
                    config={config}
                    registration={registration}
                    isEditing={isEditing}
                    editData={editData}
                    handleEditChange={handleEditChange}
                    examTypeOptions={scoreExamOptions}
                  />
                ),
            )}

            {!hasAnyScore && (
              <div className="col-12">
                {isEditing ? (
                  <div className="alert alert-info">
                    <i className="fas fa-info-circle me-2"></i>
                    編輯模式下可以填寫選考成績資料
                  </div>
                ) : (
                  <div className="alert alert-info">
                    <i className="fas fa-info-circle me-2"></i>
                    尚未填寫任何選考成績資料
                  </div>
                )}
              </div>
            )}

            {isEditing &&
              SCORE_FIELDS.map(
                (config) =>
                  !(editData[config.typeField] || editData[config.scoreField]) && (
                    <ScoreCard
                      key={`edit-${config.typeField}`}
                      config={config}
                      registration={registration}
                      isEditing={isEditing}
                      editData={editData}
                      handleEditChange={handleEditChange}
                      examTypeOptions={scoreExamOptions}
                      forceEditing
                    />
                  ),
              )}
          </>
        )}

        {hasCEFRB2 !== '是' && (
          <div className="col-12">
            <div className="alert alert-warning">
              <i className="fas fa-exclamation-triangle me-2"></i>
              此報名者未取得 CEFR B2 以上成績，無選考資料
            </div>
          </div>
        )}
      </div>
    </TabPanel>
  );
}
