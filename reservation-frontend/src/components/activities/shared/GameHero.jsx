import React from 'react';
import './GameShared.css';

export default function GameHero({
  kicker,
  title,
  lead,
  children,
}) {
  return (
    <header className="game-hero">
      {kicker ? <p className="game-hero__kicker">{kicker}</p> : null}
      {title ? <h2 className="game-hero__title">{title}</h2> : null}
      {lead ? <p className="game-hero__lead">{lead}</p> : null}
      {children}
    </header>
  );
}
