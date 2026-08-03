import React from 'react';
import './ActivityPhrasebook.css';

export default function PhraseLevelExamples({ phrases, lang }) {
  if (!phrases?.length) return null;
  const isZh = lang === 'zh';

  return (
    <div className="phrase-level-examples">
      {phrases.map((phrase) => (
        <article key={phrase.level} className="phrase-level-examples__item">
          <header className="phrase-level-examples__head">
            <span className={`phrase-level-badge phrase-level-badge--${phrase.level.toLowerCase()}`}>
              {phrase.level}
            </span>
            <span className="phrase-level-examples__label">
              {isZh ? phrase.labelZh : phrase.labelEn}
            </span>
          </header>
          <p className="phrase-level-examples__text">&ldquo;{phrase.text}&rdquo;</p>
          {(isZh ? phrase.noteZh : phrase.noteEn) ? (
            <p className="phrase-level-examples__note">
              {isZh ? phrase.noteZh : phrase.noteEn}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}
