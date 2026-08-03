// components/EnglishTestDetailForm.js
import React, { useEffect, useState, useCallback } from 'react';
import { registerEnglishTest } from '../services/englishTestPublicApi';
import { useEnglishTestFormFields } from '../hooks/useEnglishTestFormFields';
import {
  getErrorStyle,
  ERROR_PULSE_STYLE,
  scrollToFirstError,
  buildRegisterFormData,
} from '../utils/englishTestFormHelpers';
import { validateEnglishTestDetailForm } from '../utils/englishTestFormValidation';
import EnglishTestRegistrationFormBody from './english-test/registration/EnglishTestRegistrationFormBody';
import EnglishTestExtraQuestions, {
  validateExtraAnswers,
} from './english-test/registration/EnglishTestExtraQuestions';
import { useEnglishTestFormSchemaPublic } from '../hooks/useEnglishTestFormSchemaPublic';
import { buildFormOptionsFromMeta } from '../utils/englishTestFormSchemaMeta';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function buildInitialFormData(initialData, basicInfo, step3Data) {
  return {
    studentId: basicInfo.studentId || '',
    name: basicInfo.name || '',
    idNumber: basicInfo.idNumber || '',
    examType: step3Data?.examType || '',
    hasCEFRB2: step3Data?.hasCEFRB2 || '',
    listeningExamType: step3Data?.listeningExamType || '',
    listeningScore: step3Data?.listeningScore || '',
    readingExamType: step3Data?.readingExamType || '',
    readingScore: step3Data?.readingScore || '',
    speakingExamType: step3Data?.speakingExamType || '',
    speakingScore: step3Data?.speakingScore || '',
    writingExamType: step3Data?.writingExamType || '',
    writingScore: step3Data?.writingScore || '',
    b2CertificateFiles: step3Data?.b2CertificateFiles || [],
    email: initialData?.email || '',
    studentNameZh: initialData?.name || basicInfo.name || '',
    lastNameEn: '',
    firstNameEn: '',
    birthDate: initialData?.birthDate || '',
    nationalId: basicInfo.idNumber || '',
    phone: initialData?.phone || '',
    postalCode: initialData?.postalCode || '',
    city: initialData?.city || '',
    district: initialData?.district || '',
    address: initialData?.address || '',
    degreeLevel: initialData?.degreeLevel || '',
    grade: initialData?.grade || '',
    college: initialData?.college || '',
    department: initialData?.department || '',
    isLowIncome: '',
    hasDisabilityCard: '',
    disabilityTypes: [],
    disabilityOther: '',
    disabilityCertFront: null,
    disabilityCertBack: null,
    examAssistanceOptions: [],
    examAssistanceOther: '',
    idPhoto: null,
    agreedToTerms: false,
    infoSource: '',
    infoSourceOther: '',
    addressConfirmed: false,
    extraAnswers: {},
  };
}

export default function EnglishTestDetailForm({ initialData, basicInfo, step3Data, onBack, onClose }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailVerificationToken, setEmailVerificationToken] = useState(null);
  const [verifiedEmail, setVerifiedEmail] = useState(null);
  const { schema, meta, customQuestions } = useEnglishTestFormSchemaPublic();
  const formOptions = buildFormOptionsFromMeta(
    meta
      ? { ...meta, questions: meta.questions || schema?.questions || [] }
      : schema,
    { mode: 'create' }
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
  } = useEnglishTestFormFields(buildInitialFormData(initialData, basicInfo, step3Data));

  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        email: initialData.email || prev.email,
        studentNameZh: initialData.name || prev.studentNameZh,
        birthDate: initialData.birthDate || prev.birthDate,
        phone: initialData.phone || prev.phone,
        postalCode: initialData.postalCode || prev.postalCode,
        city: initialData.city || prev.city,
        district: initialData.district || prev.district,
        address: initialData.address || prev.address,
        degreeLevel: initialData.degreeLevel || prev.degreeLevel,
        grade: initialData.grade || prev.grade,
        college: initialData.college || prev.college,
        department: initialData.department || prev.department,
      }));
    }
  }, [initialData, setFormData]);

  const handleEmailVerificationChange = useCallback(({ token, verifiedEmail: nextVerified }) => {
    setEmailVerificationToken(token || null);
    setVerifiedEmail(nextVerified || null);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationResult = validateEnglishTestDetailForm(formData);
    const nextErrors = { ...validationResult.errors, ...validateExtraAnswers(customQuestions, formData.extraAnswers) };

    const email = normalizeEmail(formData.email);
    if (email && (!emailVerificationToken || normalizeEmail(verifiedEmail) !== email)) {
      nextErrors.emailVerification = '請先完成信箱驗證碼驗證';
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
      const submitData = buildRegisterFormData({
        ...formData,
        emailVerificationToken,
      });
      const { ok, data } = await registerEnglishTest(submitData);

      if (ok) {
        const successUrl = '/english-test-success.html';
        setTimeout(() => {
          const newWindow = window.open(successUrl, '_blank');
          if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            alert('報名成功！請查看瀏覽器是否阻止了新分頁開啟。\n\n謝謝您的回覆。報名完成後，若資料正常送出，您應該會在報名填寫的email收到通知。如有其他疑問，歡迎寄信聯絡我們（emicenter@mail.nsysu.edu.tw），謝謝。\n\n如果沒有收到通知，請先確認有無誤分到垃圾信件匣。若還是沒有，可能沒有正確送出報名資料，請協助重新再報一次名。\n\n主辦單位將於考前一至二週以email及手機簡訊另行通知您考試的日期及試場，請確認您報名時留的是常收信的email。如有任何疑問，請洽全英語卓越教學中心（建議優先寄信到emicenter@mail.nsysu.edu.tw），謝謝。');
          }
        }, 100);
        onClose();
      } else {
        console.error('提交失敗:', data);
        alert(data.error || data.message || '提交失敗，請稍後再試');
      }
    } catch (error) {
      console.error('提交報名資料錯誤:', error);
      alert('提交失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
        disabled={false}
        mode="create"
        previewUrls={previewUrls}
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
        getFieldRef={getFieldRef}
        onChange={(next) => setFormData((prev) => ({ ...prev, extraAnswers: next }))}
      />
      <div className="d-flex justify-content-between gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onBack}
          style={{ padding: '0.625rem 1.5rem', fontSize: '1rem', fontWeight: 'bold' }}
        >
          上一步
        </button>
        <div>
          <button
            type="button"
            className="btn btn-secondary me-2"
            onClick={onClose}
            style={{ padding: '0.625rem 1.5rem', fontSize: '1rem', fontWeight: 'bold' }}
          >
            取消
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
            style={{
              padding: '0.625rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              backgroundColor: '#FF6B6B',
              borderColor: '#FF6B6B',
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? '提交中...' : '提交報名'}
          </button>
        </div>
      </div>
    </form>
  );
}
