import React from 'react';
import './GameShared.css';

export default function GameTimer({ secondsLeft, label, urgent, ariaLabel }) {
  return (
    <div
      className={`game-timer${urgent ? ' game-timer--urgent' : ''}`}
      role="timer"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <span className="game-timer__value">{secondsLeft}</span>
      {label ? <span className="game-timer__label">{label}</span> : null}
    </div>
  );
}
