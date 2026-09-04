// components/EnglishTestDetailForm.js
import React, { useEffect, useState, useCallback } from 'react';
import { registerEnglishTest } from '../services/englishTestPublicApi';
import { useEnglishTestFormFields } from '../hooks/useEnglishTestFormFields';
import useToast from './ui/useToast';
import useAlert from './ui/useAlert';
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
  const toast = useToast();
  const { alert } = useAlert();
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
      toast.warning(`請修正表單錯誤後再提交（共 ${errorCount} 個欄位），已跳至第一個錯誤位置`);
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
            void alert({
              title: '報名成功',
              description:
                '若未自動開啟成功頁，請確認瀏覽器是否阻擋新分頁。\n\n'
                + '報名完成後，您應會在填寫的 Email 收到通知；若未收到請先查看垃圾信件匣。\n\n'
                + '考前一至二週將以 Email 及簡訊通知考試日期與試場。如有疑問請洽 emicenter@mail.nsysu.edu.tw。',
              variant: 'success',
            });
          } else {
            toast.success('報名已成功送出！');
          }
        }, 100);
        onClose({ skipConfirm: true });
      } else {
        console.error('提交失敗:', data);
        toast.error(data.error || data.message || '提交失敗，請稍後再試');
      }
    } catch (error) {
      console.error('提交報名資料錯誤:', error);
      toast.error('提交失敗，請稍後再試');
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
          ← 上一步
        </button>
        <div>
          <button
            type="button"
            className="btn btn-secondary me-2"
            onClick={() => { void onClose(); }}
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
