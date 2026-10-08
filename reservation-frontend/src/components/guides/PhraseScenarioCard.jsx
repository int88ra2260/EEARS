import React, { useEffect, useId, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import PhraseLevelExamples from './PhraseLevelExamples';
import PhrasePatternBlock, { PhraseTipBlock, PhraseAvoidBlock } from './PhrasePatternBlock';
import './ActivityPhrasebook.css';

export default function PhraseScenarioCard({ item, defaultOpen = false }) {
  const { lang } = useLanguage();
  const { hash } = useLocation();
  const isZh = lang === 'zh';
  const highlighted = hash === `#${item.id}`;
  const [open, setOpen] = useState(defaultOpen || highlighted);
  const panelId = useId();

  useEffect(() => {
    if (!highlighted) return undefined;
    setOpen(true);
    const node = document.getElementById(item.id);
    if (node) node.scrollIntoView({ block: 'start' });
    return undefined;
  }, [highlighted, item.id]);
  const title = isZh ? item.scenarioTitleZh : item.scenarioTitleEn;
  const description = isZh ? item.scenarioDescriptionZh : item.scenarioDescriptionEn;
  const direction = isZh ? item.responseDirectionZh : item.responseDirectionEn;

  return (
    <article id={item.id} className="phrase-scenario-card">
      <h3 className="phrase-scenario-card__heading">
        <button
          type="button"
          className="phrase-scenario-card__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="phrase-scenario-card__title">{title}</span>
          <span className="phrase-scenario-card__chevron" aria-hidden="true">{open ? '−' : '+'}</span>
        </button>
      </h3>

      {open ? (
        <div id={panelId} className="phrase-scenario-card__body">
          <p className="phrase-scenario-card__desc">{description}</p>
          <div className="phrase-scenario-card__direction">
            <h4>{isZh ? '應答方向' : 'Response direction'}</h4>
            <p>{direction}</p>
          </div>
          <div className="phrase-scenario-card__examples">
            <h4>{isZh ? '可以這樣說' : 'Try these'}</h4>
            <PhraseLevelExamples phrases={item.phrases} lang={lang} />
          </div>
          <PhrasePatternBlock patterns={item.patterns} />
          <PhraseTipBlock tips={item.tips} />
          <PhraseAvoidBlock avoid={item.avoid} />
        </div>
      ) : null}
    </article>
  );
}
