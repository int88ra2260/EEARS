/**
 * MicroLearningBreak - 關卡間休息提示組件
 * 
 * 認知負荷優化設計：
 * - 提供視覺上的「喘息空間」
 * - 正向的鼓勵訊息減少焦慮
 * - 漸進式披露下一關卡資訊
 */
import React, { useEffect, useState } from 'react';
import './MicroLearningBreak.css';

const DEFAULT_MESSAGES = {
  levelComplete: '太棒了！',
  preparing: '準備進入下一關...',
  encouragement: [
    '繼續保持！',
    '做得很好！',
    '你正在進步！',
    '加油！',
  ],
};

export default function MicroLearningBreak({
  type = 'level-complete',
  title,
  message,
  nextLevel,
  autoAdvance = false,
  autoAdvanceDelay = 2500,
  onAdvance,
  showProgress = true,
  currentLevel,
  totalLevels,
  children,
  className = '',
}) {
  const [countdown, setCountdown] = useState(autoAdvance ? Math.ceil(autoAdvanceDelay / 1000) : 0);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    if (!autoAdvance || !onAdvance) return;

    const timer = setTimeout(() => {
      onAdvance();
    }, autoAdvanceDelay);

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(countdownInterval);
    };
  }, [autoAdvance, autoAdvanceDelay, onAdvance]);

  useEffect(() => {
    const animTimer = setTimeout(() => setIsAnimating(false), 600);
    return () => clearTimeout(animTimer);
  }, []);

  const displayTitle = title || DEFAULT_MESSAGES.levelComplete;
  const displayMessage = message || (
    autoAdvance
      ? DEFAULT_MESSAGES.preparing
      : DEFAULT_MESSAGES.encouragement[Math.floor(Math.random() * DEFAULT_MESSAGES.encouragement.length)]
  );

  return (
    <div 
      className={`ml-break ml-break--${type} ${isAnimating ? 'ml-break--animating' : ''} ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="ml-break__content">
        {/* 成就圖示 */}
        <div className="ml-break__icon" aria-hidden="true">
          {type === 'level-complete' && '🎉'}
          {type === 'milestone' && '⭐'}
          {type === 'pause' && '☕'}
        </div>

        {/* 標題與訊息 */}
        <h3 className="ml-break__title">{displayTitle}</h3>
        <p className="ml-break__message">{displayMessage}</p>

        {/* 下一關卡預告 */}
        {nextLevel && (
          <div className="ml-break__next">
            <span className="ml-break__next-label">下一關</span>
            <span className={`ml-break__next-level ml-break__next-level--${nextLevel.toLowerCase()}`}>
              {nextLevel}
            </span>
          </div>
        )}

        {/* 進度指示 */}
        {showProgress && currentLevel && totalLevels && (
          <div className="ml-break__progress-info">
            <span>關卡 {currentLevel} / {totalLevels}</span>
          </div>
        )}

        {/* 自訂內容 */}
        {children}

        {/* 自動前進倒數 */}
        {autoAdvance && countdown > 0 && (
          <div className="ml-break__countdown">
            <span className="ml-break__countdown-number">{countdown}</span>
            <span className="ml-break__countdown-label">秒後繼續</span>
          </div>
        )}

        {/* 手動前進按鈕 */}
        {!autoAdvance && onAdvance && (
          <button
            type="button"
            className="ml-break__advance-btn btn btn-primary"
            onClick={onAdvance}
          >
            繼續
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * MicroLearningTip - 學習小提示組件
 */
export function MicroLearningTip({
  tip,
  type = 'info',
  dismissible = false,
  onDismiss,
  className = '',
}) {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  return (
    <div className={`ml-tip ml-tip--${type} ${className}`} role="note">
      <span className="ml-tip__icon" aria-hidden="true">
        {type === 'info' && '💡'}
        {type === 'success' && '✓'}
        {type === 'warning' && '⚠️'}
      </span>
      <span className="ml-tip__text">{tip}</span>
      {dismissible && (
        <button
          type="button"
          className="ml-tip__dismiss"
          onClick={handleDismiss}
          aria-label="關閉提示"
        >
          ×
        </button>
      )}
    </div>
  );
}
