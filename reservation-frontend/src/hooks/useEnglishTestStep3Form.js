import React, { useState, useRef, useCallback } from 'react';
import {
  validateScoreFormat,
  validateEnglishTestStep3Form,
} from '../utils/englishTestStep3Validation';
import {
  getErrorStyle as getFieldErrorStyle,
  scrollToFirstError,
} from '../utils/englishTestFormHelpers';

const INITIAL_FORM_DATA = {
  examType: '',
  hasCEFRB2: '',
  listeningExamType: '',
  listeningScore: '',
  readingExamType: '',
  readingScore: '',
  speakingExamType: '',
  speakingScore: '',
  writingExamType: '',
  writingScore: '',
  b2CertificateFiles: [],
};

function clearFormatError(prevErrors, scoreField) {
  const newErrors = { ...prevErrors };
  if (newErrors[scoreField] && (newErrors[scoreField].includes('格式') || newErrors[scoreField].includes('範圍'))) {
    delete newErrors[scoreField];
  }
  return newErrors;
}

function applyLiveScoreValidation(name, newData, setErrors) {
  const examTypeScorePairs = [
    { examType: 'listeningExamType', score: 'listeningScore', skill: 'listening' },
    { examType: 'readingExamType', score: 'readingScore', skill: 'reading' },
    { examType: 'speakingExamType', score: 'speakingScore', skill: 'speaking' },
    { examType: 'writingExamType', score: 'writingScore', skill: 'writing' },
  ];

  for (const { examType, score, skill } of examTypeScorePairs) {
    if (name === examType && newData[score]) {
      const formatCheck = validateScoreFormat(newData[examType], newData[score], skill);
      if (!formatCheck.isValid) {
        setErrors((prev) => ({ ...prev, [score]: formatCheck.error }));
      } else {
        setErrors((prev) => clearFormatError(prev, score));
      }
      return;
    }
    if (name === score && newData[examType] && newData[score]) {
      const formatCheck = validateScoreFormat(newData[examType], newData[score], skill);
      if (!formatCheck.isValid) {
        setErrors((prev) => ({ ...prev, [score]: formatCheck.error }));
      } else {
        setErrors((prev) => clearFormatError(prev, score));
      }
      return;
    }
  }
}

export function useEnglishTestStep3Form({ onNext, onClose, onSubmitNonExam, toast, confirm }) {
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState({});
  const fieldRefs = useRef({});

  const getFieldRef = useCallback((fieldName) => {
    if (!fieldRefs.current[fieldName]) {
      fieldRefs.current[fieldName] = React.createRef();
    }
    return fieldRefs.current[fieldName];
  }, []);

  const getErrorStyle = useCallback(
    (fieldName) => getFieldErrorStyle(errors, fieldName),
    [errors],
  );

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;

    if (type === 'checkbox') {
      setFormData((prev) => {
        const currentArray = prev[name] || [];
        if (checked) {
          return { ...prev, [name]: [...currentArray, value] };
        }
        return { ...prev, [name]: currentArray.filter((item) => item !== value) };
      });
    } else {
      setFormData((prev) => {
        const newData = { ...prev, [name]: value };
        applyLiveScoreValidation(name, newData, setErrors);
        return newData;
      });
    }

    setErrors((prev) => {
      if (prev[name] && !prev[name].includes('格式') && !prev[name].includes('範圍')) {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      }
      return prev;
    });
  }, []);

  const handleFileChange = useCallback((e) => {
    const { name } = e.target;
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      if (name === 'b2CertificateFiles') {
        setFormData((prev) => ({
          ...prev,
          [name]: files,
        }));
      } else {
        setFormData((prev) => ({ ...prev, [name]: files[0] }));
      }
    }
  }, []);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();

    const validationResult = validateEnglishTestStep3Form(formData);
    setErrors(validationResult.errors);

    if (!validationResult.isValid) {
      scrollToFirstError(getFieldRef, validationResult.firstErrorField);

      const errorCount = Object.keys(errors).length;
      toast.warning(`請修正表單錯誤後再提交（共 ${errorCount} 個欄位）`);
      return;
    }

    if (validationResult.shouldExit) {
      const nonExamData = {
        ...formData,
      };

      confirm({
        title: '確認結束報名流程？',
        description: '您選擇不報考且未取得 CEFR B2 以上成績，確定要結束報名流程嗎？',
        confirmText: '結束報名',
        cancelText: '返回',
        variant: 'warning',
      }).then((ok) => {
        if (!ok) return;
        if (onSubmitNonExam) {
          onSubmitNonExam(nonExamData);
        } else {
          onNext(nonExamData);
          setTimeout(() => {
            onClose();
          }, 100);
        }
      });
      return;
    }

    if (formData.examType === 'NON' && formData.hasCEFRB2 === '是') {
      confirm({
        title: '確認結束報名流程？',
        description: '您選擇不報考且已取得 CEFR B2 以上成績，確定要結束報名流程嗎？',
        confirmText: '結束報名',
        cancelText: '返回',
        variant: 'warning',
      }).then((ok) => {
        if (!ok) return;
        if (onSubmitNonExam) {
          onSubmitNonExam(formData);
        } else {
          onNext(formData);
          setTimeout(() => {
            onClose();
          }, 100);
        }
      });
      return;
    }

    confirm({
      title: '送出前提醒',
      description: '提醒您，若您是此學期有修習英文課程之學生，此部分將影響部分的學期總成績，請確認資料正確及選考項目正確再行送出。',
      confirmText: '確認並下一步',
      cancelText: '返回檢查',
      variant: 'primary',
    }).then((ok) => {
      if (!ok) return;
      onNext(formData);
    });
  }, [formData, errors, getFieldRef, toast, confirm, onNext, onClose, onSubmitNonExam]);

  return {
    formData,
    errors,
    getFieldRef,
    getErrorStyle,
    handleChange,
    handleFileChange,
    handleSubmit,
  };
}
