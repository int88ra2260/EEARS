import React from 'react';

export default function DetailModalSequenceControls({ registration, onAdjustSequence, adjustingSequence }) {
  if (registration.status !== 'success' || !onAdjustSequence) return null;

  return (
    <div className="btn-group btn-group-sm" role="group">
      {['up', 'down'].map((direction) => (
        <button
          key={direction}
          type="button"
          className="btn btn-outline-light"
          onClick={() => onAdjustSequence(registration.id, direction)}
          disabled={adjustingSequence}
          title={direction === 'up' ? '上移一位' : '下移一位'}
          aria-label={direction === 'up' ? '上移一位' : '下移一位'}
        >
          {adjustingSequence ? (
            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
          ) : (
            <i className={`fas fa-arrow-${direction}`}></i>
          )}
        </button>
      ))}
    </div>
  );
}
