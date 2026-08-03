import React from 'react';
import useMediaQuery from '../../../hooks/useMediaQuery';
import RegistrationClosedNotice from './RegistrationClosedNotice';
import { useEnglishTestFormSchemaPublic } from '../../../hooks/useEnglishTestFormSchemaPublic';
import { buildFormOptionsFromMeta, fieldHelp, fieldLabel, fieldRequired, fieldVisible } from '../../../utils/englishTestFormSchemaMeta';

export default function RegistrationVerifyStep({
  registrationTab,
  onRegistrationTabChange,
  onNavigateToGroupRegistration,
  registrationEnabled,
  englishTestForm,
  formErrors,
  onFormChange,
  onSubmit,
  onViewEdit,
  onClose,
  onRegistrationClosedSubmitClick,
  isLoadingRegistration,
  isLoadingStudent,
}) {
  const isSmallMobile = useMediaQuery('(max-width: 576px)');
  const { meta } = useEnglishTestFormSchemaPublic();
  const formOptions = buildFormOptionsFromMeta(meta);
  const labelStudentId = fieldLabel(formOptions, 'studentId', '學號');
  const labelName = fieldLabel(formOptions, 'name', '姓名');
  const labelIdNumber = fieldLabel(formOptions, 'idNumber', '身分證字號');
  const phStudentId = fieldHelp(formOptions, 'studentId', '請輸入學號（例如：B123456789）');
  const phName = fieldHelp(formOptions, 'name', '請輸入中文姓名');
  const phIdNumber = fieldHelp(formOptions, 'idNumber', '請輸入身分證字號（例如：A123456789）');
  const showStudentId = fieldVisible(formOptions, 'studentId');
  const showName = fieldVisible(formOptions, 'name');
  const showIdNumber = fieldVisible(formOptions, 'idNumber');
  const req = (key) => fieldRequired(formOptions, key, true);

  return (
    <div>
      <ul className="nav nav-tabs mb-4" role="tablist" style={{ borderBottom: '2px solid #dee2e6' }}>
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link ${registrationTab === 'individual' ? 'active' : ''}`}
            type="button"
            onClick={() => onRegistrationTabChange('individual')}
            style={{
              color: registrationTab === 'individual' ? '#FF6B6B' : '#6c757d',
              fontWeight: registrationTab === 'individual' ? 'bold' : 'normal',
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: registrationTab === 'individual' ? '2px solid #FF6B6B' : '2px solid transparent',
              marginBottom: '-2px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
          >
            個人報名
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            className="nav-link"
            type="button"
            onClick={onNavigateToGroupRegistration}
            style={{
              color: '#6c757d',
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: '2px solid transparent',
              marginBottom: '-2px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.target.style.color = '#FF6B6B';
              e.target.style.borderBottomColor = '#FF6B6B';
            }}
            onMouseLeave={(e) => {
              e.target.style.color = '#6c757d';
              e.target.style.borderBottomColor = 'transparent';
            }}
          >
            團體報名
          </button>
        </li>
      </ul>

      <div className="tab-content">
        {registrationTab === 'individual' && (
          <form onSubmit={onSubmit}>
            {!registrationEnabled && <RegistrationClosedNotice />}

            {showStudentId && (
            <div className="mb-4">
              <label
                htmlFor="studentId"
                className="form-label"
                style={{
                  fontWeight: 'bold',
                  fontSize: isSmallMobile ? '0.9375rem' : '1.1rem',
                  color: '#333',
                  marginBottom: '0.5rem',
                }}
              >
                {labelStudentId}{req('studentId') ? <span style={{ color: '#dc3545' }}> *</span> : null}
              </label>
              <input
                type="text"
                className={`form-control form-input ${formErrors.studentId ? 'error' : ''}`}
                id="studentId"
                name="studentId"
                value={englishTestForm.studentId}
                onChange={onFormChange}
                required={req('studentId')}
                placeholder={phStudentId}
                maxLength="10"
                style={{
                  fontSize: isSmallMobile ? '0.9375rem' : '1rem',
                  padding: isSmallMobile ? '0.625rem 0.75rem' : '0.75rem 1rem',
                  borderRadius: '8px',
                  transition: 'all 0.3s ease',
                }}
              />
              {formErrors.studentId && (
                <div className="text-danger mt-2" style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>⚠️</span>
                  <span>{formErrors.studentId}</span>
                </div>
              )}
            </div>
            )}

            {showName && (
            <div className="mb-4">
              <label
                htmlFor="name"
                className="form-label"
                style={{
                  fontWeight: 'bold',
                  fontSize: isSmallMobile ? '0.9375rem' : '1.1rem',
                  color: '#333',
                  marginBottom: '0.5rem',
                }}
              >
                {labelName}{req('name') ? <span style={{ color: '#dc3545' }}> *</span> : null}
              </label>
              <input
                type="text"
                className={`form-control form-input ${formErrors.name ? 'error' : ''}`}
                id="name"
                name="name"
                value={englishTestForm.name}
                onChange={onFormChange}
                required={req('name')}
                placeholder={phName}
                style={{
                  fontSize: isSmallMobile ? '0.9375rem' : '1rem',
                  padding: isSmallMobile ? '0.625rem 0.75rem' : '0.75rem 1rem',
                  borderRadius: '8px',
                  transition: 'all 0.3s ease',
                }}
              />
              {formErrors.name && (
                <div className="text-danger mt-2" style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>⚠️</span>
                  <span>{formErrors.name}</span>
                </div>
              )}
            </div>
            )}

            {showIdNumber && (
            <div className="mb-4">
              <label
                htmlFor="idNumber"
                className="form-label"
                style={{
                  fontWeight: 'bold',
                  fontSize: isSmallMobile ? '0.9375rem' : '1.1rem',
                  color: '#333',
                  marginBottom: '0.5rem',
                }}
              >
                {labelIdNumber}{req('idNumber') ? <span style={{ color: '#dc3545' }}> *</span> : null}
              </label>
              <input
                type="text"
                className={`form-control form-input ${formErrors.idNumber ? 'error' : ''}`}
                id="idNumber"
                name="idNumber"
                value={englishTestForm.idNumber}
                onChange={onFormChange}
                required={req('idNumber')}
                placeholder={phIdNumber}
                maxLength="10"
                style={{
                  fontSize: isSmallMobile ? '0.9375rem' : '1rem',
                  padding: isSmallMobile ? '0.625rem 0.75rem' : '0.75rem 1rem',
                  borderRadius: '8px',
                  textTransform: 'uppercase',
                  transition: 'all 0.3s ease',
                }}
              />
              {formErrors.idNumber && (
                <div className="text-danger mt-2" style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>⚠️</span>
                  <span>{formErrors.idNumber}</span>
                </div>
              )}
            </div>
            )}

            <div
              className="d-flex justify-content-between align-items-center"
              style={{
                flexDirection: isSmallMobile ? 'column' : 'row',
                gap: isSmallMobile ? '1rem' : '0.5rem',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className="btn btn-outline-info"
                onClick={onViewEdit}
                disabled={isLoadingRegistration}
                style={{
                  padding: isSmallMobile ? '0.625rem 1.25rem' : '0.625rem 1.5rem',
                  fontSize: isSmallMobile ? '0.875rem' : '1rem',
                  fontWeight: 'bold',
                  opacity: isLoadingRegistration ? 0.6 : 1,
                  borderRadius: '8px',
                  width: isSmallMobile ? '100%' : 'auto',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isLoadingRegistration) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                {isLoadingRegistration ? '查詢中...' : '🔍 檢視與修正'}
              </button>

              <div
                className="d-flex gap-2"
                style={{
                  width: isSmallMobile ? '100%' : 'auto',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  style={{
                    padding: isSmallMobile ? '0.625rem 1.25rem' : '0.625rem 1.5rem',
                    fontSize: isSmallMobile ? '0.875rem' : '1rem',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    flex: isSmallMobile ? 1 : 'none',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn btn-primary-custom"
                  disabled={isLoadingStudent || !registrationEnabled}
                  style={{
                    padding: isSmallMobile ? '0.625rem 1.25rem' : '0.625rem 1.5rem',
                    fontSize: isSmallMobile ? '0.875rem' : '1rem',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    flex: isSmallMobile ? 1 : 'none',
                    minWidth: isSmallMobile ? 'auto' : '120px',
                    opacity: (!registrationEnabled || isLoadingStudent) ? 0.6 : 1,
                    cursor: (!registrationEnabled || isLoadingStudent) ? 'not-allowed' : 'pointer',
                  }}
                  onClick={(e) => {
                    if (!registrationEnabled) {
                      e.preventDefault();
                      onRegistrationClosedSubmitClick();
                    }
                  }}
                >
                  {isLoadingStudent ? '檢查中...' : '下一步 →'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
