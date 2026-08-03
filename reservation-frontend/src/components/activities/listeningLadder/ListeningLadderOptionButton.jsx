import React from 'react';
import './ListeningLadderGame.css';

const OPTION_KEYS = ['1', '2', '3', '4'];

export default function ListeningLadderOptionButton({
  option,
  index,
  onSelect,
  disabled,
}) {
  const keyHint = OPTION_KEYS[index] || String(index + 1);
  return (
    <button
      type="button"
      className="listening-ladder-option"
      onClick={() => onSelect(option.id)}
      disabled={disabled}
      aria-keyshortcuts={keyHint}
    >
      <span className="listening-ladder-option__key" aria-hidden="true">{keyHint}</span>
      <span className="listening-ladder-option__text">{option.text}</span>
    </button>
  );
}
