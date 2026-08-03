// src/components/DynamicSurveyModal.js
import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Card } from 'react-bootstrap';
import { submitSurvey } from '../services/surveyPublicApi';
import './DynamicSurveyModal.css';

const LIKERT_OPTIONS = [
  { value: 1, label: '非常不同意', hint: 'SD' },
  { value: 2, label: '不同意', hint: 'D' },
  { value: 3, label: '沒意見', hint: 'N' },
  { value: 4, label: '同意', hint: 'A' },
  { value: 5, label: '非常同意', hint: 'SA' },
];

const STUDENT_BASIC_INFO_FIELDS = [
  {
    id: 'studentId',
    type: 'text',
    label: '學號 / Student ID',
    placeholder: '請輸入學號 / Please enter your student ID',
  },
  {
    id: 'studentName',
    type: 'text',
    label: '姓名 / Name',
    placeholder: '請輸入姓名 / Please enter your name',
  },
  {
    id: 'studentEmail',
    type: 'email',
    label: 'Email',
    placeholder: '請輸入 Email / Please enter your email',
  },
];

export default function DynamicSurveyModal({ show, onClose, onSurveyComplete, userInfo, surveyConfig }) {
  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [invalidFields, setInvalidFields] = useState(() => new Set());
  const [refs, setRefs] = useState({});

  useEffect(() => {
    if (show && surveyConfig) {
      const newRefs = {};
      const initialData = {};

      STUDENT_BASIC_INFO_FIELDS.forEach((field) => {
        newRefs[field.id] = React.createRef();
        initialData[field.id] = userInfo?.[field.id] || '';
      });

      surveyConfig.questions.forEach((question) => {
        newRefs[question.id] = React.createRef();

        if (userInfo && ['studentId', 'studentName', 'studentEmail'].includes(question.id)) {
          if (question.id === 'studentId' && userInfo.studentId) {
            initialData[question.id] = userInfo.studentId;
          } else if (question.id === 'studentName' && userInfo.studentName) {
            initialData[question.id] = userInfo.studentName;
          } else if (question.id === 'studentEmail' && userInfo.studentEmail) {
            initialData[question.id] = userInfo.studentEmail;
          } else {
            initialData[question.id] = question.type === 'checkbox' ? [] : '';
          }
        } else {
          initialData[question.id] = question.type === 'checkbox' ? [] : '';
        }
      });

      setRefs(newRefs);
      setFormData(initialData);
      setError('');
      setSuccess('');
      setInvalidFields(new Set());
    }
  }, [show, surveyConfig, userInfo]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setInvalidFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  };

  const handleCheckboxChange = (field, option, checked) => {
    setFormData((prev) => {
      const currentValues = prev[field] || [];
      if (checked) {
        return { ...prev, [field]: [...currentValues, option] };
      }
      return { ...prev, [field]: currentValues.filter((v) => v !== option) };
    });
    setInvalidFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  };

  const flagInvalid = (fieldId, message) => {
    setInvalidFields(new Set([fieldId]));
    setError(message);
    refs[fieldId]?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  };

  const validateForm = () => {
    if (!surveyConfig) return false;

    setInvalidFields(new Set());

    const hasReservationData =
      userInfo && userInfo.studentId && userInfo.studentName && userInfo.studentEmail;

    if (!hasReservationData) {
      for (const field of STUDENT_BASIC_INFO_FIELDS) {
        const value = formData[field.id];
        if (!value || String(value).trim() === '') {
          return flagInvalid(field.id, `請填寫：${field.label} / Please fill in: ${field.label}`);
        }
      }

      const studentEmail = formData.studentEmail;
      if (studentEmail && studentEmail.trim().length > 3) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(studentEmail)) {
          return flagInvalid('studentEmail', 'Email格式不正確 / Invalid email format');
        }
      }
    }

    for (const question of surveyConfig.questions) {
      if (question.required) {
        const value = formData[question.id];

        if (hasReservationData && ['studentId', 'studentName', 'studentEmail'].includes(question.id)) {
          continue;
        }

        if (!value || (Array.isArray(value) && value.length === 0)) {
          return flagInvalid(
            question.id,
            `請填寫：${question.label} / Please fill in: ${question.label}`,
          );
        }
      }
    }

    const emailQuestions = surveyConfig.questions.filter((q) => q.type === 'email');
    for (const emailQuestion of emailQuestions) {
      const email = formData[emailQuestion.id];
      if (email && email.trim() && email.trim().length > 3) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          setError('聯絡信箱格式不正確 / Invalid email format');
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const submitData = {
        studentId: formData.studentId || (userInfo && userInfo.studentId) || '',
        name: formData.studentName || (userInfo && userInfo.studentName) || '',
        email: formData.studentEmail || (userInfo && userInfo.studentEmail) || '',
        ...formData,
      };

      if (!submitData.studentId || submitData.studentId === 'undefined' || submitData.studentId.trim() === '') {
        setError('請填寫學號 / Please fill in Student ID');
        setIsSubmitting(false);
        return;
      }

      if (!submitData.name || submitData.name.trim() === '') {
        setError('請填寫姓名 / Please fill in Name');
        setIsSubmitting(false);
        return;
      }

      if (!submitData.email || submitData.email.trim() === '') {
        setError('請填寫Email / Please fill in Email');
        setIsSubmitting(false);
        return;
      }

      if (submitData.email && submitData.email.trim().length > 3) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(submitData.email)) {
          setError('Email格式不正確 / Invalid email format');
          setIsSubmitting(false);
          return;
        }
      }

      const { ok, status, data } = await submitSurvey(surveyConfig.id, submitData);

      if (ok) {
        setSuccess('問卷已成功送出，謝謝您的寶貴意見。 / Survey submitted successfully.');
        setTimeout(() => {
          onClose();
          if (onSurveyComplete) onSurveyComplete();
        }, 1500);
      } else if (status === 400 && data.error && data.error.includes('已填過')) {
        setError('您本學期已填寫過此問卷，無需重複填寫。 / You have already filled out this survey this semester.');
      } else {
        setError(data.error || '問卷送出失敗，請稍後再試 / Survey submission failed, please try again later');
      }
    } catch {
      setError('網路錯誤，請檢查連線後再試 / Network error, please check your connection and try again');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestion = (question) => {
    const value = formData[question.id] || (question.type === 'checkbox' ? [] : '');

    switch (question.type) {
      case 'radio':
        return (
          <div role="radiogroup" aria-label={question.label}>
            {question.options.map((option) => (
              <label key={option} className="survey-option">
                <Form.Check
                  type="radio"
                  label={option}
                  name={question.id}
                  value={option}
                  checked={value === option}
                  onChange={() => handleInputChange(question.id, option)}
                />
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <div role="group" aria-label={question.label}>
            {question.options.map((option) => (
              <label key={option} className="survey-option">
                <Form.Check
                  type="checkbox"
                  label={option}
                  checked={value.includes(option)}
                  onChange={(e) => handleCheckboxChange(question.id, option, e.target.checked)}
                />
              </label>
            ))}
          </div>
        );

      case 'text':
        return (
          <Form.Control
            type="text"
            placeholder={`請輸入${question.label}`}
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
          />
        );

      case 'email':
        return (
          <Form.Control
            type="email"
            placeholder="請輸入聯絡信箱"
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
          />
        );

      case 'textarea':
        return (
          <Form.Control
            as="textarea"
            rows={3}
            placeholder={`請輸入${question.label}`}
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
          />
        );

      case 'likert':
        return (
          <div className="survey-likert">
            <div className="survey-likert__scale-labels">
              <span>非常不同意 / Strongly Disagree</span>
              <span>非常同意 / Strongly Agree</span>
            </div>
            <div className="survey-likert__options" role="radiogroup" aria-label={question.label}>
              {LIKERT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`survey-likert__option ${value === option.value ? 'is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={option.value}
                    checked={value === option.value}
                    onChange={() => handleInputChange(question.id, option.value)}
                  />
                  <span className="survey-likert__value">{option.value}</span>
                  <span className="survey-likert__hint">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        );

      default:
        return <div>不支援的問題類型：{question.type}</div>;
    }
  };

  if (!surveyConfig) return null;

  const hasReservationData =
    userInfo && userInfo.studentId && userInfo.studentName && userInfo.studentEmail;

  let visibleQuestionIndex = 0;

  return (
    <Modal
      show={show}
      onHide={onClose}
      backdrop="static"
      centered
      size="lg"
      scrollable
      className="dynamic-survey-modal"
      dialogClassName="dynamic-survey-modal__dialog"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          <div>{surveyConfig.title}</div>
          {surveyConfig.subtitle ? (
            <div className="modal-title__subtitle">{surveyConfig.subtitle}</div>
          ) : null}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {surveyConfig.description ? (
          <p className="survey-intro">{surveyConfig.description}</p>
        ) : null}

        <p className="survey-submit-hint text-muted small mb-3">
          標示 <span className="text-danger">*</span> 為必填。送出前請確認各題已填寫完整。
        </p>

        {error ? <Alert variant="danger" role="alert">{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}

        {!hasReservationData && (
          <Card className="survey-student-card border-0">
            <Card.Body className="p-3">
              <h6 className="survey-student-card__title">學生基本資料 / Student Information</h6>
              <p className="text-muted small mb-3">
                問卷需使用學號判斷本學期填答狀態，請確認資料正確。
              </p>
              {STUDENT_BASIC_INFO_FIELDS.map((field) => (
                <Form.Group
                  key={field.id}
                  ref={refs[field.id]}
                  className={`mb-3${invalidFields.has(field.id) ? ' survey-field-has-error' : ''}`}
                >
                  <Form.Label className="fw-semibold">
                    {field.label}
                    <span className="text-danger ms-1">*</span>
                  </Form.Label>
                  <Form.Control
                    type={field.type}
                    placeholder={field.placeholder}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                  />
                </Form.Group>
              ))}
            </Card.Body>
          </Card>
        )}

        {surveyConfig.questions.map((question) => {
          const isStudentBasicInfo = ['studentId', 'studentName', 'studentEmail'].includes(question.id);
          if (hasReservationData && isStudentBasicInfo) return null;

          visibleQuestionIndex += 1;
          const questionNumber = visibleQuestionIndex;

          return (
            <Card
              key={question.id}
              ref={refs[question.id]}
              className={`survey-question border-0${invalidFields.has(question.id) ? ' has-error' : ''}`}
            >
              <Card.Body className="p-3">
                <Form.Group>
                  <Form.Label className="survey-question__label">
                    <span className="survey-question__number" aria-hidden="true">
                      {questionNumber}
                    </span>
                    {question.label}
                    {question.required ? <span className="text-danger ms-1">*</span> : null}
                  </Form.Label>
                  {renderQuestion(question)}
                </Form.Group>
              </Card.Body>
            </Card>
          );
        })}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose} disabled={isSubmitting}>
          稍後填寫 / Fill Later
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? '送出中… / Submitting…' : '送出問卷 / Submit Survey'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
