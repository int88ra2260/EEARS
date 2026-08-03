import React from 'react';
import {
  COLLEGES,
  GRADES,
  DEPARTMENT_OPTIONS,
  DISABILITY_TYPES,
  EXAM_ASSISTANCE_OPTIONS,
  EXAM_ASSISTANCE_OPTIONS_EDIT,
  INFO_SOURCE_OPTIONS,
  INFO_SOURCE_OPTIONS_EDIT,
  DEGREE_LEVEL_OPTIONS,
} from '../../../utils/englishTestFormOptions';
import { FormErrorMessage, getDisabledStyle } from '../../../utils/englishTestFormHelpers';
import {
  fieldLabel,
  fieldRequired,
  fieldVisible,
  sectionTitleOf,
} from '../../../utils/englishTestFormSchemaMeta';
import EnglishTestEmailVerificationPanel from './EnglishTestEmailVerificationPanel';
import SchemaFieldLabel from './SchemaFieldLabel';
import SchemaContentBlock from './SchemaContentBlock';

const SECTION_HEADER_STYLE = {
  color: '#FF6B6B',
  borderBottom: '2px solid #FF6B6B',
  paddingBottom: '0.5rem',
};

const SECTION_TITLES = {
  create: {
    academic: 'B. 身分與學籍資料',
    special: 'C. 特殊身分與協助需求',
    photo: 'D. 照片與同意事項',
    info: 'E. 資訊來源',
  },
  edit: {
    academic: 'C. 身分與學籍資料',
    special: 'E. 特殊身分與協助需求',
    photo: 'F. 照片與同意事項',
    info: 'G. 資訊來源',
  },
};

function inputStyle(disabled, errors, fieldName, getErrorStyle, extra = {}) {
  if (disabled) {
    return { ...getDisabledStyle(true), ...extra };
  }
  return { ...getErrorStyle(errors, fieldName), ...extra };
}

export default function EnglishTestRegistrationFormBody({
  formData,
  setFormData,
  errors,
  getFieldRef,
  getErrorStyle,
  handleChange,
  handleFileChange,
  disabled,
  mode,
  existingFiles,
  previewUrls,
  originalEmail = null,
  emailVerificationToken = null,
  verifiedEmail = null,
  onEmailVerificationChange,
  formOptions = null,
}) {
  const isCreate = mode === 'create';
  const fallbackSections = SECTION_TITLES[mode];
  const colleges = formOptions?.colleges || COLLEGES;
  const grades = formOptions?.grades || GRADES;
  const departmentOptions = formOptions?.departmentOptions || DEPARTMENT_OPTIONS;
  const disabilityTypes = formOptions?.disabilityTypes || DISABILITY_TYPES;
  const examOptions = formOptions?.examAssistanceOptions
    || (isCreate ? EXAM_ASSISTANCE_OPTIONS : EXAM_ASSISTANCE_OPTIONS_EDIT);
  const infoSourceOptions = formOptions?.infoSourceOptions
    || (isCreate ? INFO_SOURCE_OPTIONS : INFO_SOURCE_OPTIONS_EDIT);
  const degreeLevelOptions = formOptions?.degreeLevelOptions || DEGREE_LEVEL_OPTIONS;
  const sections = {
    academic: sectionTitleOf(formOptions, 'academic', fallbackSections.academic),
    special: sectionTitleOf(formOptions, 'special', fallbackSections.special),
    photo: sectionTitleOf(formOptions, 'photo', fallbackSections.photo),
    info: sectionTitleOf(formOptions, 'info', fallbackSections.info),
  };
  const contactSectionTitle = sectionTitleOf(formOptions, 'contact', 'A. 基本聯絡資訊');
  const addressLabel = fieldLabel(formOptions, 'address', isCreate ? 'Q8. 通訊地址' : 'Q8. 聯絡地址');
  const L = (fieldKey, fallback, requiredFallback = true) => (
    <SchemaFieldLabel
      formOptions={formOptions}
      fieldKey={fieldKey}
      fallback={fallback}
      requiredFallback={requiredFallback}
    />
  );
  const show = (fieldKey) => fieldVisible(formOptions, fieldKey);
  const contentQuestions = (formOptions?.questions || []).filter(
    (q) => q.type === 'content_block' && q.visible !== false
  );
  const addressConfirmLabel = fieldLabel(
    formOptions,
    'addressConfirmed',
    '培力官方可能以紙本寄送考試相關文件，請確認所填地址能夠接收「掛號」信件，若因填寫錯誤導致無法領取，本中心概不負責。'
  );
  const FALLBACK_PHOTO_GUIDE = {
    fieldKey: 'idPhotoGuide',
    label: '📸 合格證件照規範：',
    type: 'content_block',
    visible: true,
    content: {
      warning:
        '本次考試可免費下載電子證書， 證書上將印出考生照片。由於報名完成後無法再抽換照片，請上傳符合證件規格、正面清晰、背景乾淨之照片，避免未來遺憾。',
      listItems: [
        '應為6個月內所拍攝之正面、脫帽、露耳、五官清晰、白色或淺色背景之彩色證件照片。',
        '臉部需佔照片面積之70%~80%，頭部或頭髮不能碰觸到照片邊框（女性長髮碰到邊框下緣情形例外）。',
        '眼睛正視相機鏡頭拍攝，兩眼必須張開且清晰可見，表情自然不誇張，且不能有紅眼。',
        '如配戴眼鏡，眼睛需清楚呈現，不得配戴深色鏡片眼鏡，不能有閃光反射在眼睛上，鏡框不得遮蓋眼睛任何一部分。',
        '不得使用合成或修改之照片，亦不可使用生活照修剪。',
        '考生上傳照片，將於一週內審核，如所上傳照片不符規定將以e-mail通知，請於通知日後三日內修正重傳；未於期限內修正者，皆以照片不符報考規定處理，恕無法受理報名。',
        '完成上傳照片，經審核通過，不得更換。',
        '務必上傳考生本人之照片，若測驗當日核對與上傳照片無法確認為本人，測驗結束後得要求考生再接受查驗。',
      ],
      images: [
        { url: '/正確證件照範例.png', alt: '合格證件照範例', caption: '✅ 合格範例', variant: 'success' },
        { url: '/不合格證件照範例.jpg', alt: '不合格證件照範例', caption: '❌ 不合格範例', variant: 'danger' },
      ],
    },
  };
  const photoGuideFromSchema = (formOptions?.questions || []).find((q) => q.fieldKey === 'idPhotoGuide');
  const photoGuideQ = photoGuideFromSchema
    ? (photoGuideFromSchema.visible === false ? null : photoGuideFromSchema)
    : contentQuestions.find((q) => q.sectionId === 'photo') || FALLBACK_PHOTO_GUIDE;

  const handleCollegeChange = (e) => {
    handleChange(e);
    setFormData((prev) => ({ ...prev, department: '' }));
  };

  const wrapHandleChange = (e) => {
    handleChange(e);
    if (e?.target?.name === 'email' && typeof onEmailVerificationChange === 'function') {
      onEmailVerificationChange({ token: null, verifiedEmail: null });
    }
  };

  return (
    <>
      {/* A. 基本聯絡資訊 */}
      <div className="mb-4">
        <h4 className="mb-3" style={SECTION_HEADER_STYLE}>
          {contactSectionTitle}
        </h4>

        {show('email') && (
        <div className="mb-3" ref={getFieldRef('email')}>
          {L('email', 'Q1. 電子郵件', true)}
          <input
            type="email"
            className="form-control"
            name="email"
            value={formData.email}
            onChange={wrapHandleChange}
            placeholder={isCreate ? undefined : 'example@email.com'}
            readOnly={disabled}
            disabled={disabled}
            style={
              isCreate && !disabled
                ? {
                    border: errors.email ? '3px solid #dc3545' : '1px solid #ced4da',
                    backgroundColor: errors.email ? '#fff5f5' : 'white',
                    boxShadow: errors.email ? '0 0 0 0.2rem rgba(220, 53, 69, 0.25)' : 'none',
                  }
                : inputStyle(disabled, errors, 'email', getErrorStyle)
            }
          />
          <FormErrorMessage message={errors.email} />
        </div>
        )}

        <EnglishTestEmailVerificationPanel
          email={formData.email}
          studentId={formData.studentId}
          disabled={disabled}
          originalEmail={isCreate ? null : originalEmail}
          emailVerificationToken={emailVerificationToken}
          verifiedEmail={verifiedEmail}
          onTokenChange={onEmailVerificationChange}
          errorMessage={errors.emailVerification}
        />

        {show('studentNameZh') && (
        <div className="mb-3" ref={getFieldRef('studentNameZh')}>
          {L('studentNameZh', 'Q2. 中文姓名', true)}
          <input
            type="text"
            className="form-control"
            name="studentNameZh"
            value={formData.studentNameZh}
            onChange={handleChange}
            readOnly={disabled}
            disabled={disabled}
            style={inputStyle(disabled, errors, 'studentNameZh', getErrorStyle)}
          />
          <FormErrorMessage message={errors.studentNameZh} />
        </div>
        )}

        <div className="row mb-3">
          {show('lastNameEn') && (
        <div className="col-md-6" ref={getFieldRef('lastNameEn')}>
            {L('lastNameEn', 'Q3. 英文拼音姓', true)}
            <input
              type="text"
              className="form-control"
              name="lastNameEn"
              value={formData.lastNameEn}
              onChange={handleChange}
              readOnly={disabled}
              disabled={disabled}
              style={inputStyle(disabled, errors, 'lastNameEn', getErrorStyle, { textTransform: 'uppercase' })}
              placeholder="大寫英文姓氏"
            />
            <FormErrorMessage message={errors.lastNameEn} />
          </div>
        )}
          {show('firstNameEn') && (
        <div className="col-md-6" ref={getFieldRef('firstNameEn')}>
            {L('firstNameEn', 'Q4. 英文拼音名', true)}
            <input
              type="text"
              className="form-control"
              name="firstNameEn"
              value={formData.firstNameEn}
              onChange={handleChange}
              readOnly={disabled}
              disabled={disabled}
              style={inputStyle(disabled, errors, 'firstNameEn', getErrorStyle, { textTransform: 'uppercase' })}
              placeholder="大寫英文名字"
            />
            <FormErrorMessage message={errors.firstNameEn} />
          </div>
        )}
        </div>

        {show('birthDate') && (
        <div className="mb-3" ref={getFieldRef('birthDate')}>
          {L('birthDate', 'Q5. 出生年月日', true)}
          <input
            type="date"
            className="form-control"
            name="birthDate"
            value={formData.birthDate}
            onChange={handleChange}
            readOnly={disabled}
            disabled={disabled}
            style={inputStyle(disabled, errors, 'birthDate', getErrorStyle)}
          />
          <FormErrorMessage message={errors.birthDate} />
        </div>
        )}
      </div>

      {/* B/C. 身分與學籍資料 */}
      <div className="mb-4">
        <h4 className="mb-3" style={SECTION_HEADER_STYLE}>
          {sections.academic}
        </h4>

        {show('nationalId') && (
        <div className="mb-3">
          {L('nationalId', 'Q6. 身分證字號', true)}
          <input
            type="text"
            className="form-control"
            name="nationalId"
            value={formData.nationalId}
            readOnly
            style={{ backgroundColor: '#f5f5f5' }}
          />
        </div>
        )}

        {show('phone') && (
        <div className="mb-3" ref={getFieldRef('phone')}>
          {L('phone', 'Q7. 行動電話', true)}
          <input
            type="tel"
            className="form-control"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder={isCreate ? undefined : '09xxxxxxxx'}
            maxLength="10"
            readOnly={disabled}
            disabled={disabled}
            style={inputStyle(disabled, errors, 'phone', getErrorStyle)}
          />
          <FormErrorMessage message={errors.phone} />
        </div>
        )}

        {show('address') && (
        <div className="mb-3" ref={getFieldRef('postalCode')}>
          <label className="form-label">
            {addressLabel}{fieldRequired(formOptions, 'address', true) ? <span style={{ color: 'red' }}> *</span> : null}
          </label>
          <div className="row">
            <div className="col-md-3 mb-2">
              <input
                type="text"
                className="form-control"
                name="postalCode"
                value={formData.postalCode}
                onChange={handleChange}
                placeholder="郵遞區號"
                maxLength="3"
                readOnly={disabled}
                disabled={disabled}
                style={inputStyle(disabled, errors, 'postalCode', getErrorStyle)}
              />
              <FormErrorMessage message={errors.postalCode} small />
            </div>
            <div className="col-md-3 mb-2" ref={getFieldRef('city')}>
              <input
                type="text"
                className="form-control"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="縣市"
                readOnly={disabled}
                disabled={disabled}
                style={inputStyle(disabled, errors, 'city', getErrorStyle)}
              />
              <FormErrorMessage message={errors.city} small />
            </div>
            <div className="col-md-3 mb-2" ref={getFieldRef('district')}>
              <input
                type="text"
                className="form-control"
                name="district"
                value={formData.district}
                onChange={handleChange}
                placeholder="行政區"
                readOnly={disabled}
                disabled={disabled}
                style={inputStyle(disabled, errors, 'district', getErrorStyle)}
              />
              <FormErrorMessage message={errors.district} small />
            </div>
            <div className="col-md-3 mb-2" ref={getFieldRef('address')}>
              <input
                type="text"
                className="form-control"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="詳細地址"
                readOnly={disabled}
                disabled={disabled}
                style={inputStyle(disabled, errors, 'address', getErrorStyle)}
              />
              <FormErrorMessage message={errors.address} small />
            </div>
          </div>
        </div>
        )}

        {isCreate && show('addressConfirmed') && (
          <div className="mb-3" ref={getFieldRef('addressConfirmed')}>
            <div
              style={
                errors.addressConfirmed
                  ? {
                      padding: '1rem',
                      border: '3px solid #dc3545',
                      borderRadius: '5px',
                      backgroundColor: '#fff5f5',
                    }
                  : {}
              }
            >
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  name="addressConfirmed"
                  checked={formData.addressConfirmed}
                  onChange={handleChange}
                  disabled={disabled}
                  style={{
                    width: '1.2rem',
                    height: '1.2rem',
                    cursor: 'pointer',
                    marginTop: '0.25rem',
                  }}
                />
                <label
                  className="form-check-label ms-2"
                  style={{
                    fontSize: '1rem',
                    cursor: 'pointer',
                    fontWeight: errors.addressConfirmed ? 'bold' : 'normal',
                  }}
                >
                  {addressConfirmLabel}
                  {fieldRequired(formOptions, 'addressConfirmed', true) ? (
                    <span style={{ color: 'red' }}> *</span>
                  ) : null}
                </label>
              </div>
            </div>
            <FormErrorMessage message={errors.addressConfirmed} />
          </div>
        )}

        <div className="row mb-3">
          {show('degreeLevel') && (
        <div className="col-md-6" ref={getFieldRef('degreeLevel')}>
            {L('degreeLevel', 'Q9. 就讀身分', true)}
            <select
              className="form-select"
              name="degreeLevel"
              value={formData.degreeLevel}
              onChange={handleChange}
              disabled={disabled}
              style={inputStyle(disabled, errors, 'degreeLevel', getErrorStyle)}
            >
              <option value="">請選擇</option>
              {degreeLevelOptions.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
            <FormErrorMessage message={errors.degreeLevel} />
          </div>
        )}
          {show('grade') && (
        <div className="col-md-6" ref={getFieldRef('grade')}>
            {L('grade', 'Q10. 年級', true)}
            <select
              className="form-select"
              name="grade"
              value={formData.grade}
              onChange={handleChange}
              disabled={disabled}
              style={inputStyle(disabled, errors, 'grade', getErrorStyle)}
            >
              <option value="">請選擇</option>
              {grades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
            <FormErrorMessage message={errors.grade} />
          </div>
        )}
        </div>

        <div className="mb-3">
          <label className="form-label">
            Q11. 學號 <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="text"
            className="form-control"
            name="studentId"
            value={formData.studentId}
            readOnly
            style={{ backgroundColor: '#f5f5f5' }}
          />
        </div>

        <div className="row mb-3">
          {show('college') && (
        <div className="col-md-6" ref={getFieldRef('college')}>
            {L('college', 'Q12. 學院', true)}
            <select
              className="form-select"
              name="college"
              value={formData.college}
              onChange={isCreate ? handleCollegeChange : handleChange}
              disabled={disabled}
              style={inputStyle(disabled, errors, 'college', getErrorStyle)}
            >
              <option value="">請選擇</option>
              {colleges.map((college) => (
                <option key={college} value={college}>
                  {college}
                </option>
              ))}
            </select>
            <FormErrorMessage message={errors.college} />
          </div>
        )}
          {show('department') && (
        <div className="col-md-6" ref={getFieldRef('department')}>
            {L('department', 'Q13. 科系', true)}
            {formData.college && departmentOptions[formData.college] ? (
              <select
                className="form-select"
                name="department"
                value={formData.department}
                onChange={handleChange}
                disabled={disabled}
                style={inputStyle(disabled, errors, 'department', getErrorStyle)}
              >
                <option value="">請選擇</option>
                {departmentOptions[formData.college].map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="form-control"
                name="department"
                value={formData.department}
                onChange={handleChange}
                placeholder={isCreate ? '請先選擇學院' : '請填寫科系'}
                readOnly={disabled}
                disabled={disabled || (isCreate && !formData.college)}
                style={inputStyle(disabled, errors, 'department', getErrorStyle)}
              />
            )}
            <FormErrorMessage message={errors.department} />
          </div>
        )}
        </div>
      </div>

      {/* C/E. 特殊身分與協助需求 */}
      <div className="mb-4">
        <h4 className="mb-3" style={SECTION_HEADER_STYLE}>
          {sections.special}
        </h4>

        {show('isLowIncome') && (
        <div className="mb-3" ref={getFieldRef('isLowIncome')}>
          {L('isLowIncome', 'Q14. 是否為中低收入戶', true)}
          <div
            style={
              errors.isLowIncome
                ? {
                    padding: '1rem',
                    border: '3px solid #dc3545',
                    borderRadius: '5px',
                    backgroundColor: '#fff5f5',
                  }
                : {}
            }
          >
            {(formOptions?.optionPairsByFieldKey?.isLowIncome?.length
              ? formOptions.optionPairsByFieldKey.isLowIncome.map((o) => o.value)
              : ['否', '中低收入戶', '低收入戶']
            ).map((value) => (
              <div key={value} className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="radio"
                  name="isLowIncome"
                  value={value}
                  checked={formData.isLowIncome === value}
                  onChange={handleChange}
                  disabled={disabled}
                />
                <label className="form-check-label">{value}</label>
              </div>
            ))}
          </div>
          <FormErrorMessage message={errors.isLowIncome} />
        </div>
        )}

        {show('hasDisabilityCard') && (
        <div className="mb-3" ref={getFieldRef('hasDisabilityCard')}>
          {L('hasDisabilityCard', 'Q15. 是否有身心障礙手冊', true)}
          <div
            style={
              errors.hasDisabilityCard
                ? {
                    padding: '1rem',
                    border: '3px solid #dc3545',
                    borderRadius: '5px',
                    backgroundColor: '#fff5f5',
                  }
                : {}
            }
          >
            {(formOptions?.optionPairsByFieldKey?.hasDisabilityCard?.length
              ? formOptions.optionPairsByFieldKey.hasDisabilityCard
              : [{ value: '是', label: '是' }, { value: '否', label: '否' }]
            ).map((opt) => (
              <div key={opt.value} className="form-check form-check-inline">
                <input
                  className="form-check-input"
                  type="radio"
                  name="hasDisabilityCard"
                  value={opt.value}
                  checked={formData.hasDisabilityCard === opt.value}
                  onChange={handleChange}
                  disabled={disabled}
                />
                <label className="form-check-label">{opt.label}</label>
              </div>
            ))}
          </div>
          <FormErrorMessage message={errors.hasDisabilityCard} />
        </div>
        )}

        {formData.hasDisabilityCard === '是' && (
          <>
            <div className="mb-3">
              {L('disabilityTypes', 'Q16. 身心障礙類別（可複選）', false)}
              <div className="row">
                {(isCreate ? disabilityTypes : [...disabilityTypes, '其他']).map((type) => (
                  <div key={type} className="col-md-6 mb-2">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        name="disabilityTypes"
                        value={type}
                        checked={formData.disabilityTypes.includes(type)}
                        onChange={handleChange}
                        disabled={disabled}
                      />
                      <label className="form-check-label">{type}</label>
                    </div>
                  </div>
                ))}
                {isCreate && (
                  <div className="col-md-6 mb-2">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        name="disabilityTypes"
                        value="其他"
                        checked={formData.disabilityTypes.includes('其他')}
                        onChange={handleChange}
                        disabled={disabled}
                      />
                      <label className="form-check-label">其他</label>
                    </div>
                  </div>
                )}
              </div>
              {isCreate && formData.disabilityTypes.includes('其他') && (
                <div className="mt-3">
                  <input
                    type="text"
                    className="form-control"
                    name="disabilityOther"
                    value={formData.disabilityOther}
                    onChange={handleChange}
                    placeholder="請填寫其他身心障礙類別"
                    disabled={disabled}
                  />
                </div>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label">Q17. 身心障礙證明正反面上傳</label>
              <div className="row">
                {['disabilityCertFront', 'disabilityCertBack'].map((field, index) => (
                  <div key={field} className="col-md-6 mb-2">
                    <input
                      type="file"
                      className="form-control"
                      name={field}
                      onChange={handleFileChange}
                      accept=".pdf,.jpg,.jpeg,.png"
                      disabled={disabled}
                    />
                    <small className="text-muted">{index === 0 ? '正面' : '反面'}</small>
                    {!isCreate && existingFiles?.[field] && !previewUrls[field] && (
                      <div className="mt-1">
                        <a
                          href={`/uploads/${existingFiles[field]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline-primary"
                        >
                          查看現有檔案
                        </a>
                      </div>
                    )}
                    {previewUrls[field] && (
                      <div className="mt-2">
                        <small className="text-muted d-block mb-1">
                          {isCreate ? '預覽：' : '預覽上傳的檔案：'}
                        </small>
                        <img
                          src={previewUrls[field]}
                          alt={index === 0 ? '身心障礙證明正面預覽' : '身心障礙證明反面預覽'}
                          style={{
                            maxWidth: '200px',
                            maxHeight: '200px',
                            border: '1px solid #ddd',
                            borderRadius: '5px',
                            cursor: 'pointer',
                          }}
                          onClick={() => window.open(previewUrls[field], '_blank')}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-3">
              {L('examAssistanceOptions', 'Q18. 需要的考試協助項目（可複選）', false)}
              <div className="row">
                {examOptions.map((option) => (
                  <div key={option} className="col-md-6 mb-2">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        name="examAssistanceOptions"
                        value={option}
                        checked={formData.examAssistanceOptions.includes(option)}
                        onChange={handleChange}
                        disabled={disabled}
                      />
                      <label className="form-check-label" style={{ fontSize: '0.9rem' }}>
                        {option}
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              {formData.examAssistanceOptions.includes('其他') && (
                <div className="mt-3">
                  <input
                    type="text"
                    className="form-control"
                    name="examAssistanceOther"
                    value={formData.examAssistanceOther}
                    onChange={handleChange}
                    placeholder="請填寫其他考試協助項目"
                    readOnly={disabled}
                    disabled={disabled}
                    style={disabled ? getDisabledStyle(true) : {}}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* D/F. 照片與同意事項 */}
      <div className="mb-4">
        <h4 className="mb-3" style={SECTION_HEADER_STYLE}>
          {sections.photo}
        </h4>

        {show('idPhoto') && (
        <div className="mb-3" ref={getFieldRef('idPhoto')}>
          {L('idPhoto', 'Q19. 上傳證件照（2 吋）', true)}

          {isCreate ? (
            <>
              {photoGuideQ ? <SchemaContentBlock question={photoGuideQ} /> : null}

              <div className="mt-3">
                <input
                  type="file"
                  className="form-control"
                  name="idPhoto"
                  onChange={handleFileChange}
                  accept=".jpg,.jpeg,.png"
                  style={
                    errors.idPhoto
                      ? { border: '3px solid #dc3545', backgroundColor: '#fff5f5' }
                      : {}
                  }
                />
                <small className="text-muted">限制：JPG/PNG、白底、3MB 以下</small>
                {previewUrls.idPhoto && (
                  <div className="mt-2">
                    <small className="text-muted d-block mb-1">預覽上傳的證件照：</small>
                    <img
                      src={previewUrls.idPhoto}
                      alt="證件照預覽"
                      style={{
                        maxWidth: '150px',
                        maxHeight: '200px',
                        border: '1px solid #ddd',
                        borderRadius: '5px',
                        cursor: 'pointer',
                      }}
                      onClick={() => window.open(previewUrls.idPhoto, '_blank')}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <input
                type="file"
                className="form-control"
                name="idPhoto"
                onChange={handleFileChange}
                accept=".jpg,.jpeg,.png"
                disabled={disabled}
                style={
                  errors.idPhoto
                    ? { border: '3px solid #dc3545', backgroundColor: '#fff5f5' }
                    : {}
                }
              />
              <small className="text-muted">限制：JPG/PNG、白底、3MB 以下</small>
              {previewUrls.idPhoto && (
                <div className="mt-2">
                  <small className="text-muted d-block mb-1">預覽上傳的證件照：</small>
                  <img
                    src={previewUrls.idPhoto}
                    alt="證件照預覽"
                    style={{
                      maxWidth: '150px',
                      maxHeight: '200px',
                      border: '1px solid #ddd',
                      borderRadius: '5px',
                      cursor: 'pointer',
                    }}
                    onClick={() => window.open(previewUrls.idPhoto, '_blank')}
                  />
                </div>
              )}
              {photoGuideQ ? (
                <div style={{ opacity: disabled ? 0.7 : 1 }}>
                  <SchemaContentBlock question={photoGuideQ} />
                </div>
              ) : null}

              {existingFiles?.idPhoto && !previewUrls.idPhoto && (
                <div className="mt-2">
                  <small className="text-muted">目前證件照：</small>
                  <img
                    src={`/uploads/${existingFiles.idPhoto}`}
                    alt="證件照"
                    style={{
                      maxWidth: '150px',
                      maxHeight: '200px',
                      border: '1px solid #ddd',
                      borderRadius: '5px',
                      marginLeft: '10px',
                      cursor: 'pointer',
                    }}
                    onClick={() => window.open(`/uploads/${existingFiles.idPhoto}`, '_blank')}
                  />
                </div>
              )}
            </>
          )}

          <FormErrorMessage message={errors.idPhoto} />
        </div>
        )}

        <div className="mb-4" ref={getFieldRef('agreedToTerms')}>
          {isCreate ? (
            <div
              className="p-4 rounded"
              style={{
                border: formData.agreedToTerms
                  ? '3px solid #28a745'
                  : errors.agreedToTerms
                    ? '3px solid #dc3545'
                    : '3px solid #dc3545',
                backgroundColor: formData.agreedToTerms
                  ? '#d4edda'
                  : errors.agreedToTerms
                    ? '#f8d7da'
                    : '#f8d7da',
                transition: 'all 0.3s ease',
              }}
            >
              <div style={{ fontSize: '1rem', color: '#333', lineHeight: '1.8' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <strong style={{ color: '#d9534f', fontSize: '1.1rem' }}>【個人資料保護聲明】</strong>
                  <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                    <li>本人同意國立中山大學西灣學院（以下簡稱「本單位」）為辦理培力英檢報名及相關業務，得蒐集、處理及利用本人之個人資料（包括但不限於姓名、學號、身分證字號、聯絡方式、學籍資料、英語能力證明等）。</li>
                    <li>本人了解本單位將依個人資料保護法及相關法規，妥善保管及使用本人之個人資料，並僅用於培力英檢報名、考試安排、成績通知、相關行政作業及統計分析等目的。</li>
                    <li>本人了解得隨時向本單位查詢、請求閱覽、請求補充或更正、請求停止蒐集、處理或利用、請求刪除本人之個人資料，惟若因此影響報名或考試權益，由本人自行負責。</li>
                  </ul>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <strong style={{ color: '#d9534f', fontSize: '1.1rem' }}>【報名規範與注意事項】</strong>
                  <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                    <li>報名資料一經提交，即視為完成報名程序，除因系統錯誤或不可抗力因素外，不得要求取消報名。</li>
                    <li>報名時所填寫之各項資料（包括但不限於姓名、學號、聯絡方式、英語能力證明等）必須真實、正確且完整，如有虛偽不實或錯誤，本單位得取消報名資格或考試成績，且不負任何損害賠償責任。</li>
                    <li>考試時間、地點及相關注意事項將以電子郵件或簡訊通知，請確保聯絡方式正確且可正常接收訊息。</li>
                    <li>考試當日請攜帶有效身分證件應試，未攜帶或證件不符者，不得入場應試。</li>
                    <li>考試過程中如有違規行為（如作弊、代考等），本單位得取消考試資格及成績，並依校規處理。</li>
                  </ul>
                </div>
                <div
                  style={{
                    marginTop: '1.5rem',
                    padding: '1rem',
                    backgroundColor: '#fff3cd',
                    border: '2px solid #ffc107',
                    borderRadius: '5px',
                    fontWeight: 'bold',
                    color: '#856404',
                  }}
                >
                  <strong style={{ fontSize: '1.1rem' }}>【資料確認聲明】</strong>
                  <p style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                    我本人已確認上述資訊（包括但不限於電子信箱、地址、英檢成績證明、個人基本資料等）核實無誤，如有錯誤、遺漏或虛偽不實，本人自行負責，並同意本單位得依相關規定處理，不得異議。
                  </p>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      name="agreedToTerms"
                      checked={formData.agreedToTerms}
                      onChange={handleChange}
                      disabled={disabled}
                      style={{
                        width: '1.5rem',
                        height: '1.5rem',
                        cursor: 'pointer',
                        marginTop: '0.25rem',
                      }}
                    />
                    <label
                      className="form-check-label ms-3"
                      style={{
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        color: formData.agreedToTerms ? '#155724' : '#721c24',
                      }}
                    >
                      {fieldLabel(formOptions, 'agreedToTerms', 'Q20. 個資與報名規範同意')}{fieldRequired(formOptions, 'agreedToTerms', true) ? <span style={{ color: 'red', fontSize: '1.3rem' }}> *</span> : null}
                    </label>
                  </div>
                </div>
                <div className="mt-3" style={{ fontSize: '0.95rem', color: '#666', fontStyle: 'italic' }}>
                  <strong>重要提醒：</strong>請務必仔細核對所有填寫資料，確認無誤後再勾選同意。一旦勾選同意並提交報名，即視為您已充分了解並同意遵守上述所有條款及規範。
                </div>
              </div>
            </div>
          ) : (
            <div
              className="form-check p-4 rounded"
              style={{
                border: formData.agreedToTerms
                  ? '3px solid #28a745'
                  : errors.agreedToTerms
                    ? '3px solid #dc3545'
                    : '3px solid #dc3545',
                backgroundColor: formData.agreedToTerms
                  ? '#d4edda'
                  : errors.agreedToTerms
                    ? '#f8d7da'
                    : '#f8d7da',
                transition: 'all 0.3s ease',
                opacity: disabled ? 0.7 : 1,
              }}
            >
              <input
                className="form-check-input"
                type="checkbox"
                name="agreedToTerms"
                checked={formData.agreedToTerms}
                onChange={handleChange}
                disabled={disabled}
                style={{
                  width: '1.5rem',
                  height: '1.5rem',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  marginTop: '0.25rem',
                }}
              />
              <label
                className="form-check-label ms-3"
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  color: formData.agreedToTerms ? '#155724' : '#721c24',
                }}
              >
                {fieldLabel(formOptions, 'agreedToTerms', 'Q20. 個資與報名規範同意')}{fieldRequired(formOptions, 'agreedToTerms', true) ? <span style={{ color: 'red', fontSize: '1.3rem' }}> *</span> : null}
              </label>
              <div className="mt-3" style={{ fontSize: '1rem', color: '#333', lineHeight: '1.8', marginLeft: '2.5rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <strong style={{ color: '#d9534f', fontSize: '1.1rem' }}>【個人資料保護聲明】</strong>
                  <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                    <li>本人同意國立中山大學西灣學院（以下簡稱「本單位」）為辦理培力英檢報名及相關業務，得蒐集、處理及利用本人之個人資料（包括但不限於姓名、學號、身分證字號、聯絡方式、學籍資料、英語能力證明等）。</li>
                    <li>本人了解本單位將依個人資料保護法及相關法規，妥善保管及使用本人之個人資料，並僅用於培力英檢報名、考試安排、成績通知、相關行政作業及統計分析等目的。</li>
                    <li>本人了解得隨時向本單位查詢、請求閱覽、請求補充或更正、請求停止蒐集、處理或利用、請求刪除本人之個人資料，惟若因此影響報名或考試權益，由本人自行負責。</li>
                  </ul>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <strong style={{ color: '#d9534f', fontSize: '1.1rem' }}>【報名規範與注意事項】</strong>
                  <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                    <li>報名資料一經提交，即視為完成報名程序，除因系統錯誤或不可抗力因素外，不得要求修改或取消報名。</li>
                    <li>報名時所填寫之各項資料（包括但不限於姓名、學號、聯絡方式、英語能力證明等）必須真實、正確且完整，如有虛偽不實或錯誤，本單位得取消報名資格或考試成績，且不負任何責任。</li>
                    <li>報名費用（如有）一經繳交，除因本單位取消考試或不可抗力因素外，概不退費。</li>
                    <li>考試時間、地點及相關注意事項將以電子郵件或簡訊通知，請確保聯絡方式正確且可正常接收訊息。</li>
                    <li>考試當日請攜帶有效身分證件應試，未攜帶或證件不符者，不得入場應試。</li>
                    <li>考試過程中如有違規行為（如作弊、代考等），本單位得取消考試資格及成績，並依校規處理。</li>
                  </ul>
                </div>
                <div
                  style={{
                    marginTop: '1.5rem',
                    padding: '1rem',
                    backgroundColor: '#fff3cd',
                    border: '2px solid #ffc107',
                    borderRadius: '5px',
                    fontWeight: 'bold',
                    color: '#856404',
                  }}
                >
                  <strong style={{ fontSize: '1.1rem' }}>【資料確認聲明】</strong>
                  <p style={{ marginTop: '0.5rem', marginBottom: '0' }}>
                    我本人已確認上述資訊（包括但不限於電子信箱、地址、英檢成績證明、個人基本資料等）核實無誤，如有錯誤、遺漏或虛偽不實，本人自行負責，並同意本單位得依相關規定處理，不得異議。
                  </p>
                </div>
                <div className="mt-3" style={{ fontSize: '0.95rem', color: '#666', fontStyle: 'italic' }}>
                  <strong>重要提醒：</strong>請務必仔細核對所有填寫資料，確認無誤後再勾選同意。一旦勾選同意並提交報名，即視為您已充分了解並同意遵守上述所有條款及規範。
                </div>
              </div>
            </div>
          )}
          {errors.agreedToTerms && (
            <div
              className="text-danger mt-2 p-2 rounded"
              style={{
                backgroundColor: isCreate ? '#f8d7da' : '#f8d7da',
                fontSize: '1rem',
                fontWeight: 'bold',
                ...(isCreate ? {} : { border: '1px solid #f5c6cb' }),
              }}
            >
              {isCreate ? errors.agreedToTerms : `⚠️ ${errors.agreedToTerms}`}
            </div>
          )}
        </div>
      </div>

      {/* E/G. 資訊來源 */}
      <div className="mb-4">
        <h4 className="mb-3" style={SECTION_HEADER_STYLE}>
          {sections.info}
        </h4>

        {show('infoSource') && (
        <div className="mb-3" ref={getFieldRef('infoSource')}>
          {L('infoSource', 'Q21. 從何得知培力英檢', true)}
          <select
            className="form-select"
            name="infoSource"
            value={formData.infoSource}
            onChange={handleChange}
            disabled={disabled}
            style={inputStyle(disabled, errors, 'infoSource', getErrorStyle)}
          >
            <option value="">請選擇</option>
            {infoSourceOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {isCreate && formData.infoSource === '其他' && (
            <div className="mt-3" ref={getFieldRef('infoSourceOther')}>
              <input
                type="text"
                className="form-control"
                name="infoSourceOther"
                value={formData.infoSourceOther}
                onChange={handleChange}
                placeholder="請填寫其他資訊來源"
                style={getErrorStyle(errors, 'infoSourceOther')}
              />
              <FormErrorMessage message={errors.infoSourceOther} />
            </div>
          )}
          <FormErrorMessage message={errors.infoSource} />
        </div>
        )}
      </div>
    </>
  );
}
