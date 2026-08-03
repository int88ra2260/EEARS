// components/EnglishTestViewEditModal.js
import React, { useState, useCallback } from 'react';
import { updateEnglishTestRegistration } from '../services/englishTestPublicApi';
import { useEnglishTestFormFields } from '../hooks/useEnglishTestFormFields';
import {
  getErrorStyle,
  ERROR_PULSE_STYLE,
  scrollToFirstError,
  buildUpdateFormData,
} from '../utils/englishTestFormHelpers';
import { validateEnglishTestEditForm } from '../utils/englishTestFormValidation';
import EnglishTestRegistrationFormBody from './english-test/registration/EnglishTestRegistrationFormBody';
import EnglishTestExtraQuestions, {
  validateExtraAnswers,
} from './english-test/registration/EnglishTestExtraQuestions';
import { useEnglishTestFormSchemaPublic } from '../hooks/useEnglishTestFormSchemaPublic';
import { buildFormOptionsFromMeta } from '../utils/englishTestFormSchemaMeta';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function buildInitialFormData(registration) {
  return {
    registrationId: registration.id,
    studentId: registration.studentId,
    name: registration.name,
    idNumber: registration.idNumber,
    email: registration.email || '',
    studentNameZh: registration.studentNameZh || registration.name || '',
    lastNameEn: registration.lastNameEn || '',
    firstNameEn: registration.firstNameEn || '',
    birthDate: registration.birthDate || '',
    nationalId: registration.nationalId || registration.idNumber || '',
    phone: registration.phone || '',
    postalCode: registration.postalCode || '',
    city: registration.city || '',
    district: registration.district || '',
    address: registration.address || '',
    degreeLevel: registration.degreeLevel || '',
    grade: registration.grade || '',
    college: registration.college || '',
    department: registration.department || '',
    isLowIncome: registration.isLowIncome || '否',
    hasDisabilityCard: registration.hasDisabilityCard || '否',
    disabilityTypes: registration.disabilityTypes || [],
    disabilityCertFront: null,
    disabilityCertBack: null,
    examAssistanceOptions: registration.examAssistanceOptions || [],
    examAssistanceOther: registration.examAssistanceOther || '',
    idPhoto: null,
    agreedToTerms: registration.agreedToTerms || false,
    infoSource: registration.infoSource || '',
    extraAnswers: registration.extraAnswers && typeof registration.extraAnswers === 'object'
      ? registration.extraAnswers
      : {},
  };
}

export default function EnglishTestViewEditModal({ registration, basicInfo: _basicInfo, onClose, onUpdateSuccess }) {
  const cannotEdit = ['approved', 'success', 'failed'].includes(registration.status);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailVerificationToken, setEmailVerificationToken] = useState(null);
  const [verifiedEmail, setVerifiedEmail] = useState(null);
  const originalEmail = registration.email || '';
  const { schema, meta, customQuestions } = useEnglishTestFormSchemaPublic();
  const formOptions = buildFormOptionsFromMeta(
    meta
      ? { ...meta, questions: meta.questions || schema?.questions || [] }
      : schema,
    { mode: 'edit' }
  );

  const {
    formData,
    setFormData,
    errors,
    setErrors,
    previewUrls,
    handleChange,
    handleFileChange,
    getFieldRef,
    fileInputs,
  } = useEnglishTestFormFields(buildInitialFormData(registration), {
    readOnly: cannotEdit,
    trackFileInputs: true,
  });

  const handleEmailVerificationChange = useCallback(({ token, verifiedEmail: nextVerified }) => {
    setEmailVerificationToken(token || null);
    setVerifiedEmail(nextVerified || null);
  }, []);

  const getStatusMessage = () => {
    switch (registration.status) {
      case 'approved':
      case 'success':
        return '你的基本資料已經通過審查，是否報名成功仍以信件通知為準，若是想要修改報考項目或是補照片請聯繫全英語卓越教學中心';
      case 'failed':
        return '此報名已失敗，無法進行修改。如有疑問請聯繫全英語卓越教學中心';
      default:
        return '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (cannotEdit) {
      const statusMessages = {
        approved: '已通過審核無法進行修改',
        success: '報名已成功無法進行修改',
        failed: '報名已失敗無法進行修改',
      };
      alert(statusMessages[registration.status] || '此狀態無法進行修改');
      return;
    }

    const validationResult = validateEnglishTestEditForm(formData, registration, fileInputs);
    const nextErrors = {
      ...validationResult.errors,
      ...validateExtraAnswers(customQuestions, formData.extraAnswers),
    };

    const nextEmail = normalizeEmail(formData.email);
    const prevEmail = normalizeEmail(originalEmail);
    if (nextEmail && nextEmail !== prevEmail) {
      if (!emailVerificationToken || normalizeEmail(verifiedEmail) !== nextEmail) {
        nextErrors.emailVerification = '信箱已變更，請先完成信箱驗證碼驗證';
      }
    }

    setErrors(nextErrors);

    const hasExtraErrors = Object.keys(nextErrors).some((k) => k.startsWith('extra.'));
    if (!validationResult.isValid || nextErrors.emailVerification || hasExtraErrors) {
      scrollToFirstError(getFieldRef, validationResult.firstErrorField || Object.keys(nextErrors)[0] || 'email');
      const errorCount = Object.keys(nextErrors).length;
      alert(`請修正表單錯誤後再提交\n\n發現 ${errorCount} 個必填欄位未填寫，已自動跳轉至第一個錯誤欄位`);
      return;
    }

    setIsSubmitting(true);

    try {
      const submitData = buildUpdateFormData(
        { ...formData, emailVerificationToken },
        fileInputs
      );
      const { ok, data } = await updateEnglishTestRegistration(submitData);

      if (ok) {
        onUpdateSuccess();
      } else {
        console.error('更新失敗:', data);
        alert(data.error || data.message || '更新失敗，請稍後再試');
      }
    } catch (error) {
      console.error('更新報名資料錯誤:', error);
      alert('更新失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal fade show"
      style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10003 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">檢視與修正報名資料 - {registration.name}</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            {cannotEdit && (
              <div className="alert alert-info d-flex align-items-center mb-4" role="alert">
                <i className="fas fa-info-circle me-2" style={{ fontSize: '1.5rem' }} />
                <div>
                  <strong>
                    {registration.status === 'approved' || registration.status === 'success'
                      ? '已通過審核無法進行修改'
                      : '報名已失敗無法進行修改'}
                  </strong>
                  <p className="mb-0 mt-1">{getStatusMessage()}</p>
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <style>{ERROR_PULSE_STYLE}</style>
              <EnglishTestRegistrationFormBody
                formData={formData}
                setFormData={setFormData}
                errors={errors}
                getFieldRef={getFieldRef}
                getErrorStyle={getErrorStyle}
                handleChange={handleChange}
                handleFileChange={handleFileChange}
                disabled={cannotEdit}
                mode="edit"
                existingFiles={{
                  idPhoto: registration.idPhoto,
                  disabilityCertFront: registration.disabilityCertFront,
                  disabilityCertBack: registration.disabilityCertBack,
                }}
                previewUrls={previewUrls}
                originalEmail={originalEmail}
                emailVerificationToken={emailVerificationToken}
                verifiedEmail={verifiedEmail}
                onEmailVerificationChange={handleEmailVerificationChange}
                formOptions={formOptions}
              />
              <EnglishTestExtraQuestions
                questions={customQuestions}
                sections={schema?.sections || []}
                extraAnswers={formData.extraAnswers || {}}
                errors={errors}
                disabled={cannotEdit}
                getFieldRef={getFieldRef}
                onChange={(next) => setFormData((prev) => ({ ...prev, extraAnswers: next }))}
              />
              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  style={{ padding: '0.625rem 1.5rem', fontSize: '1rem', fontWeight: 'bold' }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || cannotEdit}
                  style={{
                    padding: '0.625rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    backgroundColor: cannotEdit ? '#6c757d' : '#FF6B6B',
                    borderColor: cannotEdit ? '#6c757d' : '#FF6B6B',
                    opacity: isSubmitting || cannotEdit ? 0.6 : 1,
                    cursor: cannotEdit ? 'not-allowed' : 'pointer',
                  }}
                >
                  {cannotEdit
                    ? registration.status === 'approved' || registration.status === 'success'
                      ? '已通過審核無法修改'
                      : '報名已失敗無法修改'
                    : isSubmitting
                      ? '更新中...'
                      : '確認更新'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
