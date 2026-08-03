import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import './ActivityPhrasebook.css';

export default function PhrasePatternBlock({ patterns }) {
  const { lang } = useLanguage();
  if (!patterns?.length) return null;
  const isZh = lang === 'zh';

  return (
    <div className="phrase-block phrase-block--pattern">
      <h4 className="phrase-block__title">{isZh ? '句型模板' : 'Patterns'}</h4>
      <ul className="phrase-block__list">
        {patterns.map((p) => (
          <li key={p.en}>{isZh ? p.zh : p.en}</li>
        ))}
      </ul>
    </div>
  );
}

export function PhraseTipBlock({ tips }) {
  const { lang } = useLanguage();
  if (!tips) return null;
  const isZh = lang === 'zh';

  return (
    <div className="phrase-block phrase-block--tip">
      <h4 className="phrase-block__title">{isZh ? '小提醒' : 'Tip'}</h4>
      <p>{isZh ? tips.zh : tips.en}</p>
    </div>
  );
}

export function PhraseAvoidBlock({ avoid }) {
  const { lang } = useLanguage();
  if (!avoid) return null;
  const isZh = lang === 'zh';

  return (
    <div className="phrase-block phrase-block--avoid">
      <h4 className="phrase-block__title">{isZh ? '避免說法' : 'Avoid'}</h4>
      <p>{isZh ? avoid.zh : avoid.en}</p>
    </div>
  );
}
