import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useToast from '../components/ui/useToast';
import useAlert from '../components/ui/useAlert';
import {
  fetchRegistrationEnabled,
  queryEnglishTestRegistration,
  registerEnglishTest,
} from '../services/englishTestPublicApi';
import {
  validateStudentId,
  validateName,
  validateIdNumber,
  validateEnglishTestBasicForm,
} from '../utils/englishTestRegistrationValidation';

export default function useEnglishTestRegistrationPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { alert } = useAlert();

  const [englishTestStep, setEnglishTestStep] = useState(0);
  const [agreedToPrivacyPolicy, setAgreedToPrivacyPolicy] = useState(false);
  const [englishTestForm, setEnglishTestForm] = useState({
    studentId: '',
    name: '',
    idNumber: '',
  });
  const [formErrors, setFormErrors] = useState({
    studentId: '',
    name: '',
    idNumber: '',
  });
  const [studentData, setStudentData] = useState(null);
  const [isLoadingStudent, setIsLoadingStudent] = useState(false);
  const [showViewEditModal, setShowViewEditModal] = useState(false);
  const [existingRegistration, setExistingRegistration] = useState(null);
  const [isLoadingRegistration, setIsLoadingRegistration] = useState(false);
  const [step3Data, setStep3Data] = useState(null);
  const [registrationTab, setRegistrationTab] = useState('individual');
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [isCheckingRegistrationStatus, setIsCheckingRegistrationStatus] = useState(true);

  useEffect(() => {
    const loadRegistrationStatus = async () => {
      try {
        const enabled = await fetchRegistrationEnabled();
        setRegistrationEnabled(enabled);
      } catch (error) {
        console.error('載入報名狀態錯誤:', error);
        setRegistrationEnabled(true);
      } finally {
        setIsCheckingRegistrationStatus(false);
      }
    };
    loadRegistrationStatus();
  }, []);

  const handleCloseEnglishTestModal = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handlePrivacyPolicyNext = useCallback(() => {
    if (!agreedToPrivacyPolicy) {
      toast.warning('請先勾選同意個資使用同意書後才能繼續');
      return;
    }
    setEnglishTestStep(1);
  }, [agreedToPrivacyPolicy, toast]);

  const handleViewEdit = useCallback(async () => {
    const errors = validateEnglishTestBasicForm(englishTestForm);
    setFormErrors(errors);

    if (errors.studentId || errors.name || errors.idNumber) {
      toast.warning('請修正表單錯誤後再查詢');
      return;
    }

    setIsLoadingRegistration(true);
    try {
      const { ok, status, data } = await queryEnglishTestRegistration({
        studentId: englishTestForm.studentId,
        name: englishTestForm.name,
        idNumber: englishTestForm.idNumber,
      });

      if (
        status === 409 &&
        data?.code === 'ENGLISH_TEST_STUDENT_IDCARD_MISMATCH' &&
        (data.error || data.message)
      ) {
        await alert({
          title: '資料不符',
          description: data.error || data.message,
          variant: 'warning',
        });
        return;
      }

      if (ok && data.found) {
        setExistingRegistration(data.registration);
        setShowViewEditModal(true);
      } else {
        const errorMsg = data.error || '找不到報名資料';
        if (data.mismatchedFields && Array.isArray(data.mismatchedFields)) {
          await alert({
            title: '找不到報名資料',
            description: `${errorMsg}\n\n不正確的欄位：${data.mismatchedFields.join('、')}`,
            variant: 'warning',
          });
        } else {
          toast.warning(errorMsg);
        }
      }
    } catch (error) {
      console.error('查詢報名資料錯誤:', error);
      toast.error('查詢報名資料時發生錯誤，請稍後再試');
    } finally {
      setIsLoadingRegistration(false);
    }
  }, [englishTestForm, toast, alert]);

  const handleEnglishTestFormChange = useCallback((e) => {
    const { name, value } = e.target;
    let processedValue = value;

    if (name === 'studentId' && value.length > 0) {
      processedValue = value.charAt(0).toUpperCase() + value.slice(1);
    }

    if (name === 'idNumber') {
      processedValue = value.toUpperCase();
    }

    setEnglishTestForm((prev) => ({
      ...prev,
      [name]: processedValue,
    }));

    let error = '';
    if (name === 'studentId' && processedValue) {
      error = validateStudentId(processedValue);
    } else if (name === 'name' && processedValue) {
      error = validateName(processedValue);
    } else if (name === 'idNumber' && processedValue) {
      error = validateIdNumber(processedValue);
    }

    setFormErrors((prev) => ({
      ...prev,
      [name]: error,
    }));
  }, []);

  const handleEnglishTestSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!registrationEnabled) {
      await alert({
        title: '報名已截止',
        description: '報名時間已截止，無法進行新報名。\n如需檢視或修正已報名資料，請使用「檢視與修正」功能。',
        variant: 'warning',
      });
      return;
    }

    const errors = validateEnglishTestBasicForm(englishTestForm);
    setFormErrors(errors);

    if (errors.studentId || errors.name || errors.idNumber) {
      toast.warning('請修正表單錯誤後再提交');
      return;
    }

    setIsLoadingStudent(true);
    try {
      const { ok: checkOk, status: checkStatus, data: registrationCheckData } = await queryEnglishTestRegistration({
        studentId: englishTestForm.studentId,
        name: englishTestForm.name,
        idNumber: englishTestForm.idNumber,
      });

      if (checkStatus === 404) {
        console.warn('查詢 API 不存在 (404)，跳過檢查直接進入下一步');
        setStudentData(null);
        setEnglishTestStep(2);
        setIsLoadingStudent(false);
        return;
      }

      if (
        checkStatus === 409 &&
        registrationCheckData?.code === 'ENGLISH_TEST_STUDENT_IDCARD_MISMATCH' &&
        (registrationCheckData.error || registrationCheckData.message)
      ) {
        await alert({
          title: '資料不符',
          description: registrationCheckData.error || registrationCheckData.message,
          variant: 'warning',
        });
        return;
      }

      if (!registrationCheckData || typeof registrationCheckData !== 'object') {
        setStudentData(null);
        setEnglishTestStep(2);
        setIsLoadingStudent(false);
        return;
      }

      if (checkOk && registrationCheckData.found) {
        await alert({
          title: '不可重複報名',
          description: '您已經報名過培力英檢，無法重複報名。\n請使用「檢視與修正」功能來修改您的報名資料。',
          variant: 'info',
        });
        setIsLoadingStudent(false);
        return;
      }

      setStudentData(null);
      setEnglishTestStep(2);
    } catch (error) {
      console.error('檢查報名狀態錯誤:', error);
      console.warn('查詢報名狀態失敗，允許繼續報名流程');
      setStudentData(null);
      setEnglishTestStep(2);
    } finally {
      setIsLoadingStudent(false);
    }
  }, [registrationEnabled, englishTestForm, toast, alert]);

  const handleRegistrationClosedSubmitClick = useCallback(() => {
    toast.warning('報名時間已截止，無法進行新報名（可使用「檢視與修正」）。');
  }, [toast]);

  const handleCloseViewEditModal = useCallback(() => {
    setShowViewEditModal(false);
    setExistingRegistration(null);
  }, []);

  const handleViewEditUpdateSuccess = useCallback(() => {
    setShowViewEditModal(false);
    setExistingRegistration(null);
    toast.success('報名資料已更新成功！');
  }, [toast]);

  const handleStep3Next = useCallback((step3FormData) => {
    setStep3Data(step3FormData);
    setEnglishTestStep(3);
  }, []);

  const handleStep4Back = useCallback(() => {
    setEnglishTestStep(2);
  }, []);

  const handleSubmitNonExam = useCallback(async (nonExamData) => {
    try {
      const submitData = new FormData();

      submitData.append('studentId', englishTestForm.studentId);
      submitData.append('name', englishTestForm.name);
      submitData.append('idNumber', englishTestForm.idNumber);

      submitData.append('examType', nonExamData.examType);
      submitData.append('hasCEFRB2', nonExamData.hasCEFRB2);

      submitData.append('email', '');
      submitData.append('studentNameZh', englishTestForm.name);
      submitData.append('lastNameEn', '');
      submitData.append('firstNameEn', '');
      submitData.append('phone', '');
      submitData.append('postalCode', '');
      submitData.append('city', '');
      submitData.append('district', '');
      submitData.append('address', '');
      submitData.append('degreeLevel', '');
      submitData.append('grade', '');
      submitData.append('college', '');
      submitData.append('department', '');
      submitData.append('isLowIncome', '否');
      submitData.append('hasDisabilityCard', '否');
      submitData.append('disabilityTypes', JSON.stringify([]));
      submitData.append('examAssistanceOptions', JSON.stringify([]));
      submitData.append('examAssistanceOther', '');
      submitData.append('agreedToTerms', 'true');
      submitData.append('infoSource', '其他');

      if (nonExamData.hasCEFRB2 === '是') {
        submitData.append('listeningExamType', nonExamData.listeningExamType || '');
        submitData.append('listeningScore', nonExamData.listeningScore || '');
        submitData.append('readingExamType', nonExamData.readingExamType || '');
        submitData.append('readingScore', nonExamData.readingScore || '');
        submitData.append('speakingExamType', nonExamData.speakingExamType || '');
        submitData.append('speakingScore', nonExamData.speakingScore || '');
        submitData.append('writingExamType', nonExamData.writingExamType || '');
        submitData.append('writingScore', nonExamData.writingScore || '');
        if (nonExamData.b2CertificateFiles && nonExamData.b2CertificateFiles.length > 0) {
          nonExamData.b2CertificateFiles.forEach((file) => {
            submitData.append('b2CertificateFiles', file);
          });
        }
      } else {
        submitData.append('listeningExamType', '');
        submitData.append('listeningScore', '');
        submitData.append('readingExamType', '');
        submitData.append('readingScore', '');
        submitData.append('speakingExamType', '');
        submitData.append('speakingScore', '');
        submitData.append('writingExamType', '');
        submitData.append('writingScore', '');
      }

      const { ok, status, data } = await registerEnglishTest(submitData);

      if (ok) {
        const successUrl = '/english-test-success.html';
        setTimeout(() => {
          const newWindow = window.open(successUrl, '_blank');
          if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            toast.success('報名成功！若未自動開啟成功頁，請確認瀏覽器是否阻擋新分頁。');
          }
        }, 100);
        handleCloseEnglishTestModal();
      } else {
        if (
          status === 409 &&
          data?.code === 'ENGLISH_TEST_STUDENT_IDCARD_MISMATCH' &&
          (data.error || data.message)
        ) {
          await alert({
            title: '資料不符',
            description: data.error || data.message,
            variant: 'warning',
          });
          return;
        }
        toast.error(data.error || data.message || '提交失敗，請稍後再試');
      }
    } catch (error) {
      console.error('提交報名資料錯誤:', error);
      toast.error('提交失敗，請稍後再試');
    }
  }, [englishTestForm, toast, alert, handleCloseEnglishTestModal]);

  const handleNavigateToGroupRegistration = useCallback(() => {
    navigate('/register/english-test/group');
  }, [navigate]);

  return {
    englishTestStep,
    agreedToPrivacyPolicy,
    setAgreedToPrivacyPolicy,
    englishTestForm,
    formErrors,
    studentData,
    isLoadingStudent,
    showViewEditModal,
    existingRegistration,
    isLoadingRegistration,
    step3Data,
    registrationTab,
    setRegistrationTab,
    registrationEnabled,
    isCheckingRegistrationStatus,
    handleCloseEnglishTestModal,
    handlePrivacyPolicyNext,
    handleViewEdit,
    handleEnglishTestFormChange,
    handleEnglishTestSubmit,
    handleRegistrationClosedSubmitClick,
    handleCloseViewEditModal,
    handleViewEditUpdateSuccess,
    handleStep3Next,
    handleStep4Back,
    handleSubmitNonExam,
    handleNavigateToGroupRegistration,
  };
}
