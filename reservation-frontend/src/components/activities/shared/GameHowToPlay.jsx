import React from 'react';
import './GameShared.css';

export default function GameHowToPlay({ title, rules = [] }) {
  if (!rules.length) return null;
  return (
    <section className="game-how-to" aria-labelledby="game-how-to-title">
      {title ? <h3 id="game-how-to-title" className="game-how-to__title">{title}</h3> : null}
      <ol className="game-how-to__list">
        {rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ol>
    </section>
  );
}
