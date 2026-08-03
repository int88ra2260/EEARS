import React from 'react';
import './GameShared.css';

export default function GameCefrDisclaimer({ text }) {
  return (
    <p className="game-cefr-disclaimer" role="note">
      {text}
    </p>
  );
}
