import React from 'react';
import ListeningLadderOptionButton from './ListeningLadderOptionButton';
import './ListeningLadderGame.css';

export default function ListeningLadderQuestionCard({
  onReplay,
  replayLabel,
  speechError,
  speechErrorText,
  feedback,
  correctLabel,
  incorrectLabel,
  children,
}) {
  return (
    <div className="listening-ladder-question">
      <div className="listening-ladder-question__audio">
        <button
          type="button"
          className="btn btn-outline-secondary listening-ladder-replay-btn"
          onClick={onReplay}
        >
          {replayLabel}
        </button>
      </div>
      {speechError ? (
        <p className="listening-ladder-speech-error" role="alert">{speechErrorText}</p>
      ) : null}
      {feedback ? (
        <div
          className={`listening-ladder-feedback listening-ladder-feedback--${feedback.isCorrect ? 'correct' : 'incorrect'}`}
          role="status"
          aria-live="polite"
        >
          <span className="listening-ladder-feedback__icon" aria-hidden="true">
            {feedback.isCorrect ? '✓' : '→'}
          </span>
          <span>
            {feedback.isCorrect ? correctLabel : incorrectLabel}
            {!feedback.isCorrect && feedback.correctWord ? (
              <strong className="listening-ladder-feedback__answer">
                {' "'}
                {feedback.correctWord}
                {'"'}
              </strong>
            ) : null}
          </span>
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function ListeningLadderOptions({ options, onSelect, disabled }) {
  return (
    <div className="listening-ladder-options" role="group" aria-label="Answer options">
      {options.map((option, index) => (
        <ListeningLadderOptionButton
          key={option.id}
          option={option}
          index={index}
          onSelect={onSelect}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
