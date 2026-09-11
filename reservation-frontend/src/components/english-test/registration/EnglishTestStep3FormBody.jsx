import React from 'react';
import SchemaFieldLabel from './SchemaFieldLabel';
import {
  SCORE_EXAM_TYPE_OPTIONS,
  EXAM_TYPE_OPTIONS,
  getScoreExamTypeOptionsForSkill,
} from '../../../utils/englishTestFormOptions';
import {
  fieldHelp,
  fieldLabel,
  fieldOptionPairs,
  fieldVisible,
  sectionTitleOf,
} from '../../../utils/englishTestFormSchemaMeta';

const DEFAULT_EXAM_TYPE_OPTIONS = SCORE_EXAM_TYPE_OPTIONS;

const DEFAULT_EXAM_TYPE_RADIOS = EXAM_TYPE_OPTIONS.map((opt) => (
  opt.value === 'NON'
    ? { ...opt, label: '不報考（NON）- 作答完前四題即可送出表單。' }
    : opt.value === 'LRSW'
      ? { ...opt, label: '聽說讀寫（LRSW）' }
      : opt
));

const B2_WARNING = '此成績未達B2，若是這學期有修習英文課，無法免考。若未選考，將無法獲得課堂成績5%';

function ScoreRow({
  label,
  examTypeName,
  scoreName,
  examTypeValue,
  scoreValue,
  scoreError,
  getErrorStyle,
  handleChange,
  checkB2Level,
  skill,
  examTypeOptions,
  disabled = false,
}) {
  return (
    <>
      <div className="row mb-3">
        <div className="col-md-3">
          <label className="form-label">{label}</label>
        </div>
        <div className="col-md-4">
          <select
            className="form-select"
            name={examTypeName}
            value={examTypeValue}
            onChange={handleChange}
            disabled={disabled}
            style={getErrorStyle(examTypeName)}
          >
            <option value="">請選擇測驗類別</option>
            {examTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-5">
          <input
            type="text"
            className="form-control"
            name={scoreName}
            value={scoreValue}
            onChange={handleChange}
            placeholder="請輸入成績"
            disabled={disabled}
            style={getErrorStyle(scoreName)}
          />
        </div>
      </div>
      {scoreError && (
        <div className="text-danger mb-2" style={{ fontSize: '0.9rem', marginLeft: '15%' }}>
          ⚠️ {scoreError}
        </div>
      )}
      {examTypeValue && scoreValue &&
       !scoreError &&
       checkB2Level(examTypeValue, scoreValue, skill) === false && (
        <div className="text-danger mb-2" style={{ fontSize: '0.9rem', marginLeft: '15%' }}>
          {B2_WARNING}
        </div>
      )}
    </>
  );
}

export default function EnglishTestStep3FormBody({
  formData,
  errors,
  getFieldRef,
  getErrorStyle,
  handleChange,
  handleFileChange,
  removeB2CertificateFile,
  checkB2Level,
  onBack,
  onClose,
  formOptions = null,
  showActions = true,
  disabled = false,
  existingB2Certificate = false,
}) {
  const sectionTitle = sectionTitleOf(formOptions, 'eligibility', '英語能力與培力資格相關');
  const examTypeRadios = fieldOptionPairs(formOptions, 'examType', DEFAULT_EXAM_TYPE_RADIOS);
  const hasCEFROptions = fieldOptionPairs(formOptions, 'hasCEFRB2', [
    { value: '是', label: '是' },
    { value: '否', label: '否' },
  ]);
  const scoreExamOptions = fieldOptionPairs(
    formOptions,
    'listeningScore',
    DEFAULT_EXAM_TYPE_OPTIONS
  );
  const showExamType = fieldVisible(formOptions, 'examType');
  const showHasCEFR = fieldVisible(formOptions, 'hasCEFRB2');
  const showScores =
    fieldVisible(formOptions, 'listeningScore') ||
    fieldVisible(formOptions, 'readingScore') ||
    fieldVisible(formOptions, 'speakingScore') ||
    fieldVisible(formOptions, 'writingScore');
  const showB2File = fieldVisible(formOptions, 'b2CertificateFile');

  const scoresHeading =
    fieldHelp(formOptions, 'listeningScore', '') ||
    'Q3. 各項成績';

  return (
    <>
      <div className="mb-4">
        <h4 className="mb-3" style={{ color: '#2a5d9f', borderBottom: '2px solid #2a5d9f', paddingBottom: '0.5rem' }}>
          {sectionTitle}
        </h4>

        {showExamType && (
          <div className="mb-3" ref={getFieldRef('examType')}>
            <SchemaFieldLabel
              formOptions={formOptions}
              fieldKey="examType"
              fallback="Q1. 報考項目"
              requiredFallback
            />
            <div style={errors.examType ? {
              padding: '1rem',
              border: '3px solid #dc3545',
              borderRadius: '5px',
              backgroundColor: '#fff5f5',
            } : {}}>
              {examTypeRadios.map((opt) => (
                <div className="form-check mb-2" key={opt.value}>
                  <input
                    className="form-check-input"
                    type="radio"
                    name="examType"
                    value={opt.value}
                    checked={formData.examType === opt.value}
                    onChange={handleChange}
                    disabled={disabled}
                  />
                  <label
                    className="form-check-label"
                    style={opt.value === 'NON' ? { color: '#dc3545', fontWeight: 'bold' } : undefined}
                  >
                    {opt.label}
                  </label>
                </div>
              ))}
            </div>
            {errors.examType && (
              <div className="text-danger mt-2 p-2 rounded" style={{
                backgroundColor: '#f8d7da',
                border: '1px solid #f5c6cb',
                fontWeight: 'bold',
                fontSize: '1rem',
              }}>
                ⚠️ {errors.examType}
              </div>
            )}
          </div>
        )}

        {showHasCEFR && (
          <div className="mb-3" ref={getFieldRef('hasCEFRB2')}>
            <SchemaFieldLabel
              formOptions={formOptions}
              fieldKey="hasCEFRB2"
              fallback="Q2. 是否曾取得 CEFR B2（含）以上成績"
              requiredFallback
            />
            <div style={errors.hasCEFRB2 ? {
              padding: '1rem',
              border: '3px solid #dc3545',
              borderRadius: '5px',
              backgroundColor: '#fff5f5',
            } : {}}>
              {hasCEFROptions.map((opt) => (
                <div className="form-check form-check-inline" key={opt.value}>
                  <input
                    className="form-check-input"
                    type="radio"
                    name="hasCEFRB2"
                    value={opt.value}
                    checked={formData.hasCEFRB2 === opt.value}
                    onChange={handleChange}
                    disabled={disabled}
                  />
                  <label className="form-check-label">{opt.label}</label>
                </div>
              ))}
            </div>
            {errors.hasCEFRB2 && (
              <div className="text-danger mt-2 p-2 rounded" style={{
                backgroundColor: '#f8d7da',
                border: '1px solid #f5c6cb',
                fontWeight: 'bold',
                fontSize: '1rem',
              }}>
                ⚠️ {errors.hasCEFRB2}
              </div>
            )}
          </div>
        )}

        {formData.examType === 'NON' && (
          <div className="alert alert-warning mb-3">
            <strong>注意：</strong>您選擇不報考，若本學期有修習英語文課程且無提出英語檢定達CEFR B2以上相關證明，將會影響您的課堂成績。
          </div>
        )}

        {formData.hasCEFRB2 === '是' && (
          <>
            {showScores && (
              <div className="mb-3" ref={getFieldRef('listeningExamType')}>
                <label className="form-label">
                  {scoresHeading.startsWith('Q3') ? scoresHeading : `Q3. 各項成績`}
                  <span style={{ color: 'red' }}> *</span>
                </label>

                {fieldVisible(formOptions, 'listeningScore') && (
                  <ScoreRow
                    label={fieldLabel(formOptions, 'listeningScore', '聽力成績')}
                    examTypeName="listeningExamType"
                    scoreName="listeningScore"
                    examTypeValue={formData.listeningExamType}
                    scoreValue={formData.listeningScore}
                    scoreError={errors.listeningScore}
                    getErrorStyle={getErrorStyle}
                    handleChange={handleChange}
                    checkB2Level={checkB2Level}
                    skill="listening"
                    examTypeOptions={getScoreExamTypeOptionsForSkill('listening', scoreExamOptions)}
                    disabled={disabled}
                  />
                )}

                {fieldVisible(formOptions, 'readingScore') && (
                  <ScoreRow
                    label={fieldLabel(formOptions, 'readingScore', '閱讀成績')}
                    examTypeName="readingExamType"
                    scoreName="readingScore"
                    examTypeValue={formData.readingExamType}
                    scoreValue={formData.readingScore}
                    scoreError={errors.readingScore}
                    getErrorStyle={getErrorStyle}
                    handleChange={handleChange}
                    checkB2Level={checkB2Level}
                    skill="reading"
                    examTypeOptions={getScoreExamTypeOptionsForSkill('reading', scoreExamOptions)}
                    disabled={disabled}
                  />
                )}

                {fieldVisible(formOptions, 'speakingScore') && (
                  <ScoreRow
                    label={fieldLabel(formOptions, 'speakingScore', '口說成績')}
                    examTypeName="speakingExamType"
                    scoreName="speakingScore"
                    examTypeValue={formData.speakingExamType}
                    scoreValue={formData.speakingScore}
                    scoreError={errors.speakingScore}
                    getErrorStyle={getErrorStyle}
                    handleChange={handleChange}
                    checkB2Level={checkB2Level}
                    skill="speaking"
                    examTypeOptions={getScoreExamTypeOptionsForSkill('speaking', scoreExamOptions)}
                    disabled={disabled}
                  />
                )}

                {fieldVisible(formOptions, 'writingScore') && (
                  <ScoreRow
                    label={fieldLabel(formOptions, 'writingScore', '寫作成績')}
                    examTypeName="writingExamType"
                    scoreName="writingScore"
                    examTypeValue={formData.writingExamType}
                    scoreValue={formData.writingScore}
                    scoreError={errors.writingScore}
                    getErrorStyle={getErrorStyle}
                    handleChange={handleChange}
                    checkB2Level={checkB2Level}
                    skill="writing"
                    examTypeOptions={getScoreExamTypeOptionsForSkill('writing', scoreExamOptions)}
                    disabled={disabled}
                  />
                )}

                {(errors.listeningExamType || errors.listeningScore || errors.readingExamType ||
                  errors.readingScore || errors.speakingExamType || errors.speakingScore ||
                  errors.writingExamType || errors.writingScore) && (
                  <div className="text-danger mt-2 p-2 rounded" style={{
                    backgroundColor: '#f8d7da',
                    border: '1px solid #f5c6cb',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                  }}>
                    ⚠️ {errors.listeningExamType || errors.listeningScore || errors.readingExamType ||
                         errors.readingScore || errors.speakingExamType || errors.speakingScore ||
                         errors.writingExamType || errors.writingScore}
                  </div>
                )}
              </div>
            )}

            {showB2File && (
              <div className="mb-3" ref={getFieldRef('b2CertificateFiles')}>
                <SchemaFieldLabel
                  formOptions={formOptions}
                  fieldKey="b2CertificateFile"
                  fallback="Q4. 請上傳 B2 成績證明（可上傳多張）"
                  requiredFallback
                />
                <input
                  type="file"
                  className="form-control"
                  name="b2CertificateFiles"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  disabled={disabled}
                  style={errors.b2CertificateFiles ? {
                    border: '3px solid #dc3545',
                    backgroundColor: '#fff5f5',
                  } : {}}
                />
                <small className="text-muted">
                  支援格式：PDF, JPG, PNG（可一次選多個，或分次選擇；分次選擇會累加，不會覆蓋）
                </small>
                {existingB2Certificate && !(formData.b2CertificateFiles && formData.b2CertificateFiles.length > 0) && (
                  <div className="alert alert-info py-2 mt-2 mb-0 small">
                    已有上傳的 B2 成績證明；若要更換請重新選擇檔案。
                  </div>
                )}
                {formData.b2CertificateFiles && formData.b2CertificateFiles.length > 0 && (
                  <div className="mt-2">
                    <small className="text-muted">已選擇 {formData.b2CertificateFiles.length} 個檔案：</small>
                    <ul className="list-unstyled mt-1 mb-0">
                      {formData.b2CertificateFiles.map((file, index) => (
                        <li key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="text-muted small d-flex align-items-center gap-2">
                          <span>• {file.name}</span>
                          {!disabled && typeof removeB2CertificateFile === 'function' && (
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-0 text-danger"
                              onClick={() => removeB2CertificateFile(index)}
                              aria-label={`移除 ${file.name}`}
                            >
                              移除
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {errors.b2CertificateFiles && (
                  <div className="text-danger mt-2 p-2 rounded" style={{
                    backgroundColor: '#f8d7da',
                    border: '1px solid #f5c6cb',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                  }}>
                    ⚠️ {errors.b2CertificateFiles}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showActions ? (
      <div className="d-flex justify-content-between gap-2">
        <div className="d-flex gap-2">
          {onBack ? (
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onBack}
              style={{
                padding: '0.625rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 'bold',
              }}
            >
              ← 上一步
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{
              padding: '0.625rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 'bold',
            }}
          >
            取消
          </button>
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          style={{
            padding: '0.625rem 1.5rem',
            fontSize: '1rem',
            fontWeight: 'bold',
            backgroundColor: '#b42318',
            borderColor: '#b42318',
          }}
        >
          {formData.examType === 'NON' && formData.hasCEFRB2 === '否'
            ? '送出表單'
            : formData.examType === 'NON'
            ? '結束報名'
            : '下一步'}
        </button>
      </div>
      ) : null}
    </>
  );
}
