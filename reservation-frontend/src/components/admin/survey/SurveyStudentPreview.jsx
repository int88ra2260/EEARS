/**
 * 學生端問卷即時預覽（編輯器用，不送出）
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Card, Form } from 'react-bootstrap';
import '../../DynamicSurveyModal.css';

const LIKERT_OPTIONS = [
  { value: 1, label: '非常不同意', hint: 'SD' },
  { value: 2, label: '不同意', hint: 'D' },
  { value: 3, label: '沒意見', hint: 'N' },
  { value: 4, label: '同意', hint: 'A' },
  { value: 5, label: '非常同意', hint: 'SA' },
];

function QuestionControl({ question, value, onChange, onCheckboxChange }) {
  switch (question.type) {
    case 'radio':
      return (
        <div role="radiogroup" aria-label={question.label}>
          {(question.options || []).map((option) => (
            <label key={option} className="survey-option">
              <Form.Check
                type="radio"
                label={option}
                name={`preview_${question.id}`}
                value={option}
                checked={value === option}
                onChange={() => onChange(question.id, option)}
              />
            </label>
          ))}
        </div>
      );
    case 'checkbox':
      return (
        <div role="group" aria-label={question.label}>
          {(question.options || []).map((option) => (
            <label key={option} className="survey-option">
              <Form.Check
                type="checkbox"
                label={option}
                checked={(value || []).includes(option)}
                onChange={(e) => onCheckboxChange(question.id, option, e.target.checked)}
              />
            </label>
          ))}
        </div>
      );
    case 'text':
      return (
        <Form.Control
          type="text"
          placeholder={`請輸入${question.label || ''}`}
          value={value || ''}
          onChange={(e) => onChange(question.id, e.target.value)}
        />
      );
    case 'email':
      return (
        <Form.Control
          type="email"
          placeholder="請輸入聯絡信箱"
          value={value || ''}
          onChange={(e) => onChange(question.id, e.target.value)}
        />
      );
    case 'textarea':
      return (
        <Form.Control
          as="textarea"
          rows={3}
          placeholder={`請輸入${question.label || ''}`}
          value={value || ''}
          onChange={(e) => onChange(question.id, e.target.value)}
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
                  name={`preview_${question.id}`}
                  value={option.value}
                  checked={value === option.value}
                  onChange={() => onChange(question.id, option.value)}
                />
                <span className="survey-likert__value">{option.value}</span>
                <span className="survey-likert__hint">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      );
    default:
      return <div className="text-danger small">不支援的問題類型：{question.type || '（空）'}</div>;
  }
}

export default function SurveyStudentPreview({ schema }) {
  const questions = schema?.questions || [];
  const questionIdentity = useMemo(
    () => questions.map((q) => `${String(q.id)}\t${String(q.type || '')}`).join('\n'),
    [questions],
  );
  const [formData, setFormData] = useState({});

  useEffect(() => {
    const list = questionIdentity
      ? questionIdentity.split('\n').map((line) => {
          const [id, type] = line.split('\t');
          return { id, type };
        })
      : [];
    setFormData((prev) => {
      const next = {};
      for (const q of list) {
        if (!q.id) continue;
        if (Object.prototype.hasOwnProperty.call(prev, q.id)) {
          const prevVal = prev[q.id];
          if (q.type === 'checkbox') {
            next[q.id] = Array.isArray(prevVal) ? prevVal : [];
          } else {
            next[q.id] = Array.isArray(prevVal) ? '' : prevVal;
          }
        } else {
          next[q.id] = q.type === 'checkbox' ? [] : '';
        }
      }
      return next;
    });
  }, [questionIdentity]);

  const handleChange = (id, value) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleCheckboxChange = (id, option, checked) => {
    setFormData((prev) => {
      const current = prev[id] || [];
      if (checked) return { ...prev, [id]: [...current, option] };
      return { ...prev, [id]: current.filter((v) => v !== option) };
    });
  };

  return (
    <div className="dynamic-survey-modal survey-student-preview">
      <div className="survey-student-preview__chrome mb-2 d-flex align-items-center justify-content-between gap-2 flex-wrap">
        <Badge bg="primary">學生端預覽</Badge>
        <span className="small text-muted">僅供預覽，不會送出</span>
      </div>

      <div className="survey-student-preview__frame">
        <div className="survey-student-preview__header">
          <div className="fw-semibold">{schema?.title || '（未設定標題）'}</div>
          {schema?.subtitle ? (
            <div className="modal-title__subtitle">{schema.subtitle}</div>
          ) : null}
        </div>

        <div className="survey-student-preview__body">
          {schema?.description ? (
            <p className="survey-intro">{schema.description}</p>
          ) : null}

          <p className="survey-submit-hint text-muted small mb-3">
            標示 <span className="text-danger">*</span> 為必填。送出前請確認各題已填寫完整。
          </p>

          {questions.length === 0 ? (
            <Alert variant="light" className="border text-muted small mb-0">
              尚未新增題目。左側新增後會即時顯示在此。
            </Alert>
          ) : null}

          {questions.map((question, index) => (
            <Card key={question.id || `q-${index}`} className="survey-question border-0">
              <Card.Body className="p-3">
                <Form.Group>
                  <Form.Label className="survey-question__label">
                    <span className="survey-question__number" aria-hidden="true">
                      {index + 1}
                    </span>
                    {question.label || '（未命名題目）'}
                    {question.required ? <span className="text-danger ms-1">*</span> : null}
                  </Form.Label>
                  <QuestionControl
                    question={question}
                    value={formData[question.id]}
                    onChange={handleChange}
                    onCheckboxChange={handleCheckboxChange}
                  />
                </Form.Group>
              </Card.Body>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
