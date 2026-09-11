import React, { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import useScrollWorldGsap from '../hooks/useScrollWorldGsap';
import { buildScrollWorldSegments } from '../constants/scrollWorldTestConfig';
import {
  CAMPUS_JOURNEY_BRAND,
  CAMPUS_JOURNEY_CONNECTORS,
  CAMPUS_JOURNEY_SECTIONS,
} from '../constants/campusJourneyDraftConfig';
import './ScrollWorldTestPage.css';

function CtaLink({ item, className }) {
  if (!item?.href || !item?.label) return null;
  if (item.external) {
    return (
      <a href={item.href} className={className} target="_blank" rel="noopener noreferrer">
        {item.label}
      </a>
    );
  }
  return (
    <Link to={item.href} className={className}>
      {item.label}
    </Link>
  );
}

/** Draft preview：靜態 config，不走 CMS */
export default function CampusJourneyDraftPage() {
  const videoRefs = useRef({});
  const sections = CAMPUS_JOURNEY_SECTIONS;
  const connectors = CAMPUS_JOURNEY_CONNECTORS;

  const segments = useMemo(
    () => buildScrollWorldSegments(sections, connectors),
    [sections, connectors],
  );

  const { rootRef } = useScrollWorldGsap({
    sections,
    connectors,
    videoRefs,
  });

  return (
    <div ref={rootRef} className="swt-page" data-swt-section="0">
      <a className="swt-close" href={CAMPUS_JOURNEY_BRAND.href} aria-label="返回首頁">
        <span aria-hidden="true">×</span>
        <span className="swt-close__label">離開預覽</span>
      </a>

      <div className="swt-sky" aria-hidden="true" />

      <section className="swt-stage" aria-label="校園旅程 Draft 預覽">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className={`swt-scene${seg.clip ? ' swt-scene--video' : ''}`}
            data-swt-seg={seg.key}
            style={{ '--swt-scene-accent': seg.accent }}
          >
            {seg.still ? (
              <img
                className="swt-scene__still swt-scene__still--bg"
                src={seg.still}
                alt=""
                decoding="async"
                loading="eager"
                aria-hidden="true"
              />
            ) : null}
            {seg.still ? (
              <img
                className="swt-scene__still swt-scene__still--fg"
                src={seg.still}
                alt=""
                decoding="async"
                loading="eager"
              />
            ) : null}
            {seg.clip ? (
              <video
                ref={(el) => {
                  videoRefs.current[seg.key] = el;
                }}
                className="swt-scene__video swt-scene__video--fg"
                data-swt-clip={seg.clip}
                muted
                playsInline
                preload="none"
                aria-hidden="true"
              />
            ) : null}
          </div>
        ))}
      </section>

      <div className="swt-copy-stack">
        <aside className="swt-topic-nav" aria-label="旅程段落">
          <div className="swt-topic-nav__list">
            {sections.map((section, index) => (
              <button
                key={section.id}
                type="button"
                className={`swt-topic-nav__item${index === 0 ? ' is-active' : ''}`}
                data-swt-jump={index}
                aria-label={`前往${section.label}`}
              >
                <span className="swt-topic-nav__text">{section.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="swt-copylayer">
          {sections.map((section, index) => (
            <article
              key={section.id}
              className="swt-copy"
              data-swt-copy={section.id}
              style={{ pointerEvents: index === 0 ? 'auto' : 'none' }}
            >
              <p className="swt-copy__eyebrow" style={{ margin: 0, opacity: 0.7, fontSize: '0.85rem' }}>
                {CAMPUS_JOURNEY_BRAND.name}
              </p>
              <h1 className="swt-copy__title">{section.title}</h1>
              <p className="swt-copy__body">{section.body}</p>
              {section.cta?.primary || section.cta?.secondary?.length ? (
                <div className="swt-copy__cta">
                  {section.cta.secondary?.length ? (
                    <div className="swt-copy__cta-secondary">
                      {section.cta.secondary.map((item) => (
                        <CtaLink
                          key={`${item.label}-${item.href}`}
                          item={item}
                          className="swt-btn swt-btn--ghost swt-btn--sm"
                        />
                      ))}
                    </div>
                  ) : null}
                  {section.cta.primary ? (
                    <CtaLink item={section.cta.primary} className="swt-btn swt-btn--primary" />
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </div>

      <button type="button" className="swt-hint" data-swt-hint aria-label="向下探索下一個主題">
        <span className="swt-hint__label" data-swt-hint-label>
          向下滾動探索
        </span>
        <span className="swt-hint__mouse" aria-hidden="true">
          <i />
        </span>
        <span className="swt-hint__chevron" aria-hidden="true" />
      </button>
    </div>
  );
}
