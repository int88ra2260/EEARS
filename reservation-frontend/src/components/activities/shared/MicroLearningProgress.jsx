/**
 * MicroLearningProgress - 統一的微學習進度指示器
 * 
 * 認知負荷優化設計：
 * - 視覺化進度條減少數字閱讀負擔
 * - 清晰的關卡標示
 * - 適當的動畫過渡
 */
import React from 'react';
import './MicroLearningProgress.css';

export default function MicroLearningProgress({
  current,
  total,
  level,
  levelLabel,
  showBar = true,
  showCount = true,
  tone = 'default',
  size = 'normal',
  className = '',
}) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div 
      className={`ml-progress ml-progress--${tone} ml-progress--${size} ${className}`}
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`進度：${current} / ${total}`}
    >
      <div className="ml-progress__info">
        {level && (
          <span className={`ml-progress__level ml-progress__level--${level.toLowerCase()}`}>
            {levelLabel || level}
          </span>
        )}
        {showCount && (
          <span className="ml-progress__count">
            <span className="ml-progress__current">{current}</span>
            <span className="ml-progress__separator">/</span>
            <span className="ml-progress__total">{total}</span>
          </span>
        )}
      </div>
      
      {showBar && (
        <div className="ml-progress__track">
          <div 
            className="ml-progress__bar"
            style={{ width: `${percentage}%` }}
          />
          {/* 關卡標記點 */}
          {total <= 10 && Array.from({ length: total - 1 }, (_, i) => (
            <div
              key={i}
              className="ml-progress__marker"
              style={{ left: `${((i + 1) / total) * 100}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * MicroLearningSteps - 階段式進度指示器（適用於多關卡遊戲）
 */
export function MicroLearningSteps({
  steps,
  currentStep,
  completedSteps = [],
  size = 'normal',
  className = '',
}) {
  return (
    <div className={`ml-steps ml-steps--${size} ${className}`} role="navigation" aria-label="遊戲進度">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id || index);
        const isCurrent = currentStep === (step.id || index);
        const isPending = !isCompleted && !isCurrent;

        return (
          <React.Fragment key={step.id || index}>
            {index > 0 && (
              <div className={`ml-steps__connector ${isCompleted || isCurrent ? 'ml-steps__connector--active' : ''}`} />
            )}
            <div
              className={`ml-steps__step ${isCompleted ? 'ml-steps__step--completed' : ''} ${isCurrent ? 'ml-steps__step--current' : ''} ${isPending ? 'ml-steps__step--pending' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className="ml-steps__dot">
                {isCompleted ? '✓' : index + 1}
              </span>
              {step.label && (
                <span className="ml-steps__label">{step.label}</span>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
