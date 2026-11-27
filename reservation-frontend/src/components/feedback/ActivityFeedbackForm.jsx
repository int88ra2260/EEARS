import React, { useState } from 'react';
import { Alert, Button, Form } from 'react-bootstrap';
import { applySurveyVisibility, isQuestionVisible, validateVisibleAnswers } from '../../utils/surveyVisibility';
import './ActivityFeedbackForm.css';

function optionLabel(option) {
  if (option && typeof option === 'object') return option.label || option.value || '';
  return String(option ?? '');
}

function optionValue(option) {
  if (option && typeof option === 'object') return option.value ?? option.label ?? '';
  return option;
}

function toggleCheckbox(question, value, current) {
  const selected = Array.isArray(current) ? current : [];
  const exclusive = question.exclusiveValue;
  if (selected.includes(value)) return selected.filter((item) => item !== value);
  if (exclusive && value === exclusive) return [exclusive];
  const withoutExclusive = exclusive ? selected.filter((item) => item !== exclusive) : selected;
  if (question.maxSelect && withoutExclusive.length >= Number(question.maxSelect)) return selected;
  return [...withoutExclusive, value];
}

export default function ActivityFeedbackForm({ schema, onSubmit }) {
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [invalidId, setInvalidId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const questions = schema?.questions || [];
  const sections = schema?.sections || [];
  const visibleData = applySurveyVisibility(answers, questions);
  const visibleQuestions = questions.filter((question) => isQuestionVisible(question, visibleData));

  const setField = (id, value) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setInvalidId((current) => (current === id ? '' : current));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = validateVisibleAnswers(answers, questions);
    if (!result.ok) {
      setError(result.error);
      setInvalidId(result.id);
      const node = document.getElementById(`af-${result.id}`);
      node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setError('');
    setInvalidId('');
    setSubmitting(true);
    try {
      await onSubmit(result.data);
    } catch (err) {
      setError(err?.message || '送出失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  };

  const questionsBySection = new Map();
  visibleQuestions.forEach((question) => {
    const key = question.section || 'about';
    if (!questionsBySection.has(key)) questionsBySection.set(key, []);
    questionsBySection.get(key).push(question);
  });

  return (
    <Form className="activity-feedback" onSubmit={handleSubmit} noValidate>
      {schema?.description ? <p className="activity-feedback__lead">{schema.description}</p> : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {sections.map((section) => {
        const items = questionsBySection.get(section.id);
        if (!items?.length) return null;
        return (
          <section key={section.id} className="activity-feedback__section" aria-labelledby={`af-section-${section.id}`}>
            <h2 id={`af-section-${section.id}`} className="activity-feedback__section-title">{section.title}</h2>
            {items.map((question) => (
              <Question
                key={question.id}
                question={question}
                value={answers[question.id]}
                invalid={invalidId === question.id}
                onChange={(value) => setField(question.id, value)}
              />
            ))}
          </section>
        );
      })}
      <div className="activity-feedback__actions">
        <Button type="submit" disabled={submitting}>
          {submitting ? '送出中…' : '送出問卷'}
        </Button>
      </div>
    </Form>
  );
}

function Question({ question, value, invalid, onChange }) {
  const legendId = `af-legend-${question.id}`;
  return (
    <fieldset
      id={`af-${question.id}`}
      className={`activity-feedback__question${invalid ? ' is-invalid' : ''}`}
      aria-invalid={invalid || undefined}
    >
      <legend id={legendId} className="activity-feedback__legend">
        {question.label}
        {question.required ? <span className="text-danger"> *</span> : null}
      </legend>
      {question.hint ? <p className="activity-feedback__hint">{question.hint}</p> : null}
      {question.type === 'textarea' ? (
        <Form.Control
          as="textarea"
          rows={3}
          value={value || ''}
          aria-labelledby={legendId}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
      {question.type === 'likert' ? (
        <LikertOptions question={question} value={value} onChange={onChange} />
      ) : null}
      {question.type === 'radio' ? (
        (question.options || []).map((option) => {
          const optionText = optionLabel(option);
          const stored = optionValue(option);
          return (
            <Form.Check
              key={String(stored)}
              className="activity-feedback__option"
              type="radio"
              id={`${question.id}-${stored}`}
              name={question.id}
              label={optionText}
              checked={value === stored}
              onChange={() => onChange(stored)}
            />
          );
        })
      ) : null}
      {question.type === 'checkbox' ? (
        (question.options || []).map((option) => {
          const optionText = optionLabel(option);
          const stored = optionValue(option);
          const selected = Array.isArray(value) && value.includes(stored);
          return (
            <Form.Check
              key={String(stored)}
              className="activity-feedback__option"
              type="checkbox"
              id={`${question.id}-${stored}`}
              label={optionText}
              checked={selected}
              onChange={() => onChange(toggleCheckbox(question, stored, value))}
            />
          );
        })
      ) : null}
    </fieldset>
  );
}

function LikertOptions({ question, value, onChange }) {
  const labels = question.scaleLabels || ['非常不同意', '不同意', '普通', '同意', '非常同意'];
  return labels.map((label, index) => {
    const score = String(index + 1);
    return (
      <Form.Check
        key={score}
        className="activity-feedback__option"
        type="radio"
        id={`${question.id}-${score}`}
        name={question.id}
        label={label}
        checked={String(value ?? '') === score}
        onChange={() => onChange(score)}
      />
    );
  });
}
