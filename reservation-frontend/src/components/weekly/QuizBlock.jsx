import React, { useMemo, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { useLanguage } from '../../context/LanguageContext';
import { getWeeklyVoterId } from '../../utils/weeklyVoter';
import { submitQuizAnswers } from '../../services/weeklyInteractionApi';

function formatMessage(t, key, vars = {}) {
  const tpl = t(key);
  if (typeof tpl !== 'string' || tpl === key) return vars.default || key;
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
}

export default function QuizBlock({ blockId, slug, props }) {
  const { t } = useLanguage();
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const questions = useMemo(
    () => (Array.isArray(props?.questions) ? props.questions : []),
    [props?.questions]
  );

  if (!questions.length) return null;

  const setAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const onSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const payload = questions.map((q) => ({
        questionId: q.id,
        value: answers[q.id] || '',
      }));
      const data = await submitQuizAnswers({
        slug,
        blockId,
        answers: payload,
        voterKey: getWeeklyVoterId(),
      });
      setResult(data);
    } catch (err) {
      setError(err.message || t('weekly.quizSubmitError'));
    } finally {
      setSubmitting(false);
    }
  };

  const allAnswered = questions.every((q) => String(answers[q.id] || '').trim());

  return (
    <section className="wb-quiz public-card">
      {props?.title ? <h2 className="wb-section-title">{props.title}</h2> : null}
      {error ? <p className="text-danger small">{error}</p> : null}

      {questions.map((q, idx) => {
        const feedback = result?.results?.find((r) => r.questionId === q.id);
        return (
          <div key={q.id} className="wb-quiz__question">
            <p className="wb-quiz__prompt">
              <span className="wb-quiz__num">{idx + 1}.</span>
              {q.prompt}
            </p>
            {q.audioUrl ? (
              <audio controls preload="metadata" src={q.audioUrl} className="wb-quiz__audio mb-2">
                <track kind="captions" />
              </audio>
            ) : null}
            {q.type === 'fill' ? (
              <Form.Control
                value={answers[q.id] || ''}
                disabled={Boolean(result)}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder={t('weekly.quizFillPlaceholder')}
              />
            ) : (
              <div className="wb-quiz__choices">
                {(q.options || []).map((opt) => (
                  <Form.Check
                    key={opt}
                    type="radio"
                    name={`quiz-${blockId}-${q.id}`}
                    id={`quiz-${blockId}-${q.id}-${opt}`}
                    label={opt}
                    checked={answers[q.id] === opt}
                    disabled={Boolean(result)}
                    onChange={() => setAnswer(q.id, opt)}
                  />
                ))}
              </div>
            )}
            {feedback ? (
              <p className={`wb-quiz__feedback small mb-0${feedback.correct ? ' text-success' : ' text-danger'}`}>
                {feedback.correct ? t('weekly.quizCorrect') : t('weekly.quizWrong')}
                {feedback.explanation ? ` — ${feedback.explanation}` : ''}
              </p>
            ) : null}
          </div>
        );
      })}

      {!result ? (
        <Button
          size="sm"
          variant="primary"
          className="mt-2"
          disabled={!allAnswered || submitting}
          onClick={onSubmit}
        >
          {submitting ? t('weekly.quizSubmitting') : t('weekly.quizSubmit')}
        </Button>
      ) : (
        <p className="wb-quiz__score mt-3 mb-0">
          {formatMessage(t, 'weekly.quizScore', {
            correct: result.correct,
            total: result.total,
          })}
        </p>
      )}
    </section>
  );
}
