import React from 'react';

export default function VocabularyDepthQuestion({
  t,
  lang,
  question,
  progress,
  lastFeedback,
  onSelect,
  disabled,
}) {
  const prompt = lang === 'en' ? question.prompt : (question.promptZh || question.prompt);

  return (
    <div className="vocabulary-depth-board">
      <div className="vocabulary-depth-progress" aria-live="polite">
        <span className="vocabulary-depth-progress__level">
          {t('vocabularyDepth.levelLabel')}: <strong>{progress.levelLabel}</strong>
        </span>
        <span className="vocabulary-depth-progress__count">
          {t('vocabularyDepth.questionProgress', {
            current: progress.current,
            total: progress.total,
          })}
        </span>
      </div>

      <fieldset className="vocabulary-depth-question" disabled={disabled}>
        <legend className="vocabulary-depth-question__prompt">{prompt}</legend>
        <div className="vocabulary-depth-options">
          {question.options.map((opt, index) => {
            const label = lang === 'en' ? opt.text : (opt.textZh || opt.text);
            const isSelected = lastFeedback?.selectedOptionId === opt.id;
            const isCorrectOption = opt.id === question.correctOptionId;
            let optionClass = 'vocabulary-depth-option';
            if (lastFeedback && isSelected) {
              optionClass += lastFeedback.isCorrect ? ' vocabulary-depth-option--correct' : ' vocabulary-depth-option--wrong';
            } else if (lastFeedback && isCorrectOption) {
              optionClass += ' vocabulary-depth-option--correct';
            }

            return (
              <button
                key={opt.id}
                type="button"
                className={optionClass}
                onClick={() => onSelect(opt.id)}
                disabled={disabled}
              >
                <span className="vocabulary-depth-option__key" aria-hidden="true">{index + 1}</span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {lastFeedback && (
        <div
          className={`vocabulary-depth-feedback ${lastFeedback.isCorrect ? 'vocabulary-depth-feedback--ok' : 'vocabulary-depth-feedback--miss'}`}
          role="status"
        >
          {lastFeedback.isCorrect
            ? t('vocabularyDepth.feedbackCorrect')
            : t('vocabularyDepth.feedbackIncorrect')}
          {question.explanationZh && lang !== 'en' ? (
            <p className="vocabulary-depth-feedback__explain">{question.explanationZh}</p>
          ) : null}
          {question.explanationEn && lang === 'en' ? (
            <p className="vocabulary-depth-feedback__explain">{question.explanationEn}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
