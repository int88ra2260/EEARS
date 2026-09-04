import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useToast from '../components/ui/useToast';
import useAlert from '../components/ui/useAlert';
import useConfirm from '../components/ui/useConfirm';
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
import { extractEnglishTestQueryResult } from '../utils/englishTestQueryResponse';
import { formatEnglishTestSemesterLabel } from '../utils/englishTestSemesterDisplay';
import {
  clearEnglishTestRegistrationDraft,
  getEnglishTestLeaveConfirmDescription,
  hasEnglishTestRegistrationProgress,
  loadEnglishTestRegistrationDraft,
  saveEnglishTestRegistrationDraft,
  stripStep3DataForDraft,
} from '../utils/englishTestRegistrationDraft';
import {
  getEnglishTestNavigableMaxStep,
  getEnglishTestStepGateBlockMessage,
} from '../utils/englishTestRegistrationStepGates';
import { useEnglishTestFormSchemaPublic } from './useEnglishTestFormSchemaPublic';

import {
  ENGLISH_TEST_ANNOUNCEMENT_ACK_KEY,
} from '../constants/englishTestRegistrationAnnouncement';

export default function useEnglishTestRegistrationPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { alert } = useAlert();
  const { confirm } = useConfirm();
  const { schema } = useEnglishTestFormSchemaPublic();

  const [englishTestStep, setEnglishTestStep] = useState(0);
  const [maxReachedStep, setMaxReachedStep] = useState(0);
  const [agreedToAnnouncement, setAgreedToAnnouncement] = useState(() => {
    try {
      return sessionStorage.getItem(ENGLISH_TEST_ANNOUNCEMENT_ACK_KEY) === '1';
    } catch {
      return false;
    }
  });
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
  const [viewEditMeta, setViewEditMeta] = useState({
    semester: null,
    statusMessage: null,
    canEdit: true,
    legacySemesterInferred: false,
  });
  const [isLoadingRegistration, setIsLoadingRegistration] = useState(false);
  const [step3Data, setStep3Data] = useState(null);
  const [registrationTab, setRegistrationTab] = useState('individual');
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [isCheckingRegistrationStatus, setIsCheckingRegistrationStatus] = useState(true);
  const [draftRestored, setDraftRestored] = useState(false);

  const navigableMaxStep = useMemo(() => getEnglishTestNavigableMaxStep({
    maxReachedStep,
    schema,
    agreedToAnnouncement,
    agreedToPrivacyPolicy,
    registrationEnabled,
    hasStep3Data: Boolean(step3Data),
  }), [
    maxReachedStep,
    schema,
    agreedToAnnouncement,
    agreedToPrivacyPolicy,
    registrationEnabled,
    step3Data,
  ]);

  const advanceToStep = useCallback((step) => {
    setEnglishTestStep(step);
    setMaxReachedStep((prev) => Math.max(prev, step));
  }, []);

  const getProgressSnapshot = useCallback(() => ({
    englishTestStep,
    maxReachedStep,
    agreedToPrivacyPolicy,
    step3Data,
    englishTestForm,
  }), [englishTestStep, maxReachedStep, agreedToPrivacyPolicy, step3Data, englishTestForm]);

  useEffect(() => {
    if (englishTestStep <= navigableMaxStep) return;
    setEnglishTestStep(navigableMaxStep);
  }, [englishTestStep, navigableMaxStep]);

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

  useEffect(() => {
    if (isCheckingRegistrationStatus || draftRestored) return;

    const draft = loadEnglishTestRegistrationDraft();
    if (!draft) {
      setDraftRestored(true);
      return;
    }

    const draftProgress = hasEnglishTestRegistrationProgress({
      englishTestStep: draft.englishTestStep ?? 0,
      agreedToPrivacyPolicy: Boolean(draft.agreedToPrivacyPolicy),
      step3Data: draft.step3Data ?? null,
      englishTestForm: draft.englishTestForm ?? {},
    });

    if (!draftProgress) {
      clearEnglishTestRegistrationDraft();
      setDraftRestored(true);
      return;
    }

    if (typeof draft.englishTestStep === 'number') {
      const restoredStep = draft.englishTestStep;
      const restoredMax = typeof draft.maxReachedStep === 'number'
        ? Math.max(draft.maxReachedStep, restoredStep)
        : restoredStep;
      setEnglishTestStep(restoredStep);
      setMaxReachedStep(restoredMax);
    }
    if (draft.agreedToPrivacyPolicy) {
      setAgreedToPrivacyPolicy(true);
    }
    if (draft.englishTestForm && typeof draft.englishTestForm === 'object') {
      setEnglishTestForm((prev) => ({ ...prev, ...draft.englishTestForm }));
    }
    if (draft.step3Data) {
      setStep3Data(draft.step3Data);
    }

    toast.info('已恢復上次未完成的報名進度');
    setDraftRestored(true);
  }, [draftRestored, isCheckingRegistrationStatus, toast]);

  useEffect(() => {
    if (!draftRestored || isCheckingRegistrationStatus) return;

    const snapshot = getProgressSnapshot();
    if (!hasEnglishTestRegistrationProgress(snapshot)) {
      clearEnglishTestRegistrationDraft();
      return;
    }

    saveEnglishTestRegistrationDraft({
      englishTestStep: snapshot.englishTestStep,
      maxReachedStep: snapshot.maxReachedStep,
      agreedToPrivacyPolicy: snapshot.agreedToPrivacyPolicy,
      englishTestForm: snapshot.englishTestForm,
      step3Data: stripStep3DataForDraft(snapshot.step3Data),
      savedAt: new Date().toISOString(),
    });
  }, [draftRestored, getProgressSnapshot, isCheckingRegistrationStatus]);

  const handleCloseEnglishTestModal = useCallback(async (options = {}) => {
    const skipConfirm = options?.skipConfirm === true;
    const snapshot = getProgressSnapshot();

    if (!skipConfirm && hasEnglishTestRegistrationProgress(snapshot)) {
      const ok = await confirm({
        title: '離開報名流程？',
        description: getEnglishTestLeaveConfirmDescription(snapshot),
        confirmText: '離開',
        cancelText: '繼續填寫',
        variant: 'warning',
      });
      if (!ok) return;
      clearEnglishTestRegistrationDraft();
    } else if (skipConfirm) {
      clearEnglishTestRegistrationDraft();
    }

    navigate('/');
  }, [confirm, getProgressSnapshot, navigate]);

  const handleAnnouncementAgreeChange = useCallback((checked) => {
    const next = Boolean(checked);
    setAgreedToAnnouncement(next);
    try {
      if (next) {
        sessionStorage.setItem(ENGLISH_TEST_ANNOUNCEMENT_ACK_KEY, '1');
      } else {
        sessionStorage.removeItem(ENGLISH_TEST_ANNOUNCEMENT_ACK_KEY);
      }
    } catch {
      // ignore private browsing
    }
  }, []);

  const handlePrivacyAgreeChange = useCallback((checked) => {
    setAgreedToPrivacyPolicy(Boolean(checked));
  }, []);

  const handleAnnouncementNext = useCallback(() => {
    const block = getEnglishTestStepGateBlockMessage({
      targetStep: 1,
      schema,
      agreedToAnnouncement,
      agreedToPrivacyPolicy,
      registrationEnabled,
      hasStep3Data: Boolean(step3Data),
      maxReachedStep: Math.max(maxReachedStep, 1),
    });
    if (block) {
      if (block.tone === 'info') toast.info(block.message);
      else toast.warning(block.message);
      return;
    }
    try {
      sessionStorage.setItem(ENGLISH_TEST_ANNOUNCEMENT_ACK_KEY, '1');
    } catch {
      // ignore private browsing
    }
    advanceToStep(1);
  }, [
    agreedToAnnouncement,
    agreedToPrivacyPolicy,
    schema,
    registrationEnabled,
    step3Data,
    maxReachedStep,
    toast,
    advanceToStep,
  ]);

  const handlePrivacyPolicyNext = useCallback(() => {
    const block = getEnglishTestStepGateBlockMessage({
      targetStep: 2,
      schema,
      agreedToAnnouncement,
      agreedToPrivacyPolicy,
      registrationEnabled,
      hasStep3Data: Boolean(step3Data),
      maxReachedStep: Math.max(maxReachedStep, 2),
    });
    if (block) {
      if (block.tone === 'info') toast.info(block.message);
      else toast.warning(block.message);
      return;
    }
    advanceToStep(2);
  }, [
    agreedToAnnouncement,
    agreedToPrivacyPolicy,
    schema,
    registrationEnabled,
    step3Data,
    maxReachedStep,
    toast,
    advanceToStep,
  ]);

  const handleStepBack = useCallback(() => {
    setEnglishTestStep((prev) => Math.max(0, prev - 1));
  }, []);

  const handleGoToStep = useCallback((targetStep) => {
    if (typeof targetStep !== 'number' || targetStep < 0 || targetStep > 4) return;
    if (targetStep === englishTestStep) return;

    const block = getEnglishTestStepGateBlockMessage({
      targetStep,
      schema,
      agreedToAnnouncement,
      agreedToPrivacyPolicy,
      registrationEnabled,
      hasStep3Data: Boolean(step3Data),
      maxReachedStep,
    });
    if (block) {
      if (block.tone === 'info') toast.info(block.message);
      else toast.warning(block.message);
      return;
    }

    setEnglishTestStep(targetStep);
  }, [
    englishTestStep,
    maxReachedStep,
    schema,
    agreedToAnnouncement,
    agreedToPrivacyPolicy,
    registrationEnabled,
    step3Data,
    toast,
  ]);

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

      const lookup = extractEnglishTestQueryResult(data);

      if (ok && lookup.found && lookup.registration) {
        setExistingRegistration(lookup.registration);
        setViewEditMeta({
          semester: lookup.semester,
          statusMessage: lookup.statusMessage,
          canEdit: lookup.canEdit,
          legacySemesterInferred: lookup.legacySemesterInferred,
        });
        setShowViewEditModal(true);
      } else if (ok && lookup.found && !lookup.registration) {
        toast.warning('查詢成功但無法載入報名資料，請稍後再試或聯繫全英中心');
      } else {
        const semesterLabel = formatEnglishTestSemesterLabel(lookup.semester);
        const semesterHint = semesterLabel ? `（${semesterLabel}）` : '';
        const errorMsg = data.error || `找不到本學期培力英檢報名資料${semesterHint}`;
        if (data.mismatchedFields && Array.isArray(data.mismatchedFields)) {
          await alert({
            title: '找不到報名資料',
            description: `${errorMsg}\n\n不正確的欄位：${data.mismatchedFields.join('、')}`,
            variant: 'warning',
          });
        } else {
          await alert({
            title: '找不到報名資料',
            description: `${errorMsg}\n\n若您尚未報名，請按「下一步 →」開始填寫新報名資料。`,
            variant: 'info',
          });
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
        await alert({
          title: '無法確認報名狀態',
          description: '系統暫時無法確認您是否已報名，請稍後再試。若問題持續，請聯繫全英語卓越教學中心。',
          variant: 'warning',
        });
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
        await alert({
          title: '無法確認報名狀態',
          description: '系統回應異常，無法確認您是否已報名。請稍後再試，或使用「檢視與修正」查詢。',
          variant: 'warning',
        });
        return;
      }

      const lookup = extractEnglishTestQueryResult(registrationCheckData);

      if (checkOk && lookup.found) {
        const semesterLabel = formatEnglishTestSemesterLabel(lookup.semester);
        const semesterHint = semesterLabel ? `（${semesterLabel}）` : '';
        await alert({
          title: '不可重複報名',
          description: `您本學期${semesterHint}已經報名過培力英檢，無法重複報名。\n請使用「檢視與修正」功能來修改您的報名資料。`,
          variant: 'info',
        });
        setIsLoadingStudent(false);
        return;
      }

      setStudentData(null);
      advanceToStep(3);
    } catch (error) {
      console.error('檢查報名狀態錯誤:', error);
      await alert({
        title: '無法確認報名狀態',
        description: '連線或系統發生錯誤，無法確認您是否已報名。請稍後再試。',
        variant: 'warning',
      });
    } finally {
      setIsLoadingStudent(false);
    }
  }, [registrationEnabled, englishTestForm, toast, alert, advanceToStep]);

  const handleRegistrationClosedSubmitClick = useCallback(() => {
    toast.warning('報名時間已截止，無法進行新報名（可使用「檢視與修正」）。');
  }, [toast]);

  const handleCloseViewEditModal = useCallback(() => {
    setShowViewEditModal(false);
    setExistingRegistration(null);
    setViewEditMeta({ semester: null, statusMessage: null, canEdit: true, legacySemesterInferred: false });
  }, []);

  const handleViewEditUpdateSuccess = useCallback(() => {
    setShowViewEditModal(false);
    setExistingRegistration(null);
    setViewEditMeta({ semester: null, statusMessage: null, canEdit: true, legacySemesterInferred: false });
    toast.success('報名資料已更新成功！');
  }, [toast]);

  const handleStep3Next = useCallback((step3FormData) => {
    setStep3Data(step3FormData);
    advanceToStep(4);
  }, [advanceToStep]);

  const handleStep4Back = useCallback(() => {
    setEnglishTestStep(3);
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
        clearEnglishTestRegistrationDraft();
        const successUrl = '/english-test-success.html';
        setTimeout(() => {
          const newWindow = window.open(successUrl, '_blank');
          if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            toast.success('報名成功！若未自動開啟成功頁，請確認瀏覽器是否阻擋新分頁。');
          }
        }, 100);
        handleCloseEnglishTestModal({ skipConfirm: true });
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

  const handleNavigateToGroupRegistration = useCallback(async () => {
    const snapshot = getProgressSnapshot();
    if (hasEnglishTestRegistrationProgress(snapshot)) {
      const ok = await confirm({
        title: '前往團體報名？',
        description: `${getEnglishTestLeaveConfirmDescription(snapshot)}\n\n確定要前往團體報名嗎？`,
        confirmText: '前往團體報名',
        cancelText: '留在此頁',
        variant: 'warning',
      });
      if (!ok) return;
      clearEnglishTestRegistrationDraft();
    }
    navigate('/register/english-test/group');
  }, [confirm, getProgressSnapshot, navigate]);

  return {
    englishTestStep,
    maxReachedStep,
    navigableMaxStep,
    agreedToAnnouncement,
    setAgreedToAnnouncement: handleAnnouncementAgreeChange,
    agreedToPrivacyPolicy,
    setAgreedToPrivacyPolicy: handlePrivacyAgreeChange,
    englishTestForm,
    formErrors,
    studentData,
    isLoadingStudent,
    showViewEditModal,
    existingRegistration,
    viewEditMeta,
    isLoadingRegistration,
    step3Data,
    registrationTab,
    setRegistrationTab,
    registrationEnabled,
    isCheckingRegistrationStatus,
    handleCloseEnglishTestModal,
    handleAnnouncementNext,
    handlePrivacyPolicyNext,
    handleStepBack,
    handleGoToStep,
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
