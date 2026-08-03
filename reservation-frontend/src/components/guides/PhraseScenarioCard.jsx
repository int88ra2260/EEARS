import React, { useId, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import PhraseLevelExamples from './PhraseLevelExamples';
import PhrasePatternBlock, { PhraseTipBlock, PhraseAvoidBlock } from './PhrasePatternBlock';
import './ActivityPhrasebook.css';

export default function PhraseScenarioCard({ item, defaultOpen = false }) {
  const { lang } = useLanguage();
  const isZh = lang === 'zh';
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const title = isZh ? item.scenarioTitleZh : item.scenarioTitleEn;
  const description = isZh ? item.scenarioDescriptionZh : item.scenarioDescriptionEn;
  const direction = isZh ? item.responseDirectionZh : item.responseDirectionEn;

  return (
    <article className="phrase-scenario-card">
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
