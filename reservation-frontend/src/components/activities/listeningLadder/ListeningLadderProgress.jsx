import React from 'react';
import GameTimer from '../shared/GameTimer';
import './ListeningLadderGame.css';

export default function ListeningLadderProgress({
  currentLevel,
  highestLevelReached,
  streak,
  secondsLeft,
  timerLabel,
  timerAria,
  urgent,
  levelLabel,
  streakLabel,
  highestLabel,
}) {
  return (
    <div className="listening-ladder-progress">
      <GameTimer
        secondsLeft={secondsLeft}
        label={timerLabel}
        urgent={urgent}
        ariaLabel={timerAria}
      />
      <div className="listening-ladder-progress__stats">
        <div className="listening-ladder-stat">
          <span className="listening-ladder-stat__label">{levelLabel}</span>
          <span className={`listening-ladder-level-pill listening-ladder-level-pill--${currentLevel.toLowerCase()}`}>
            {currentLevel}
          </span>
        </div>
        <div className="listening-ladder-stat">
          <span className="listening-ladder-stat__label">{streakLabel}</span>
          <span className="listening-ladder-stat__value">{streak}</span>
        </div>
        <div className="listening-ladder-stat">
          <span className="listening-ladder-stat__label">{highestLabel}</span>
          <span className="listening-ladder-stat__value">{highestLevelReached}</span>
        </div>
      </div>
    </div>
  );
}
