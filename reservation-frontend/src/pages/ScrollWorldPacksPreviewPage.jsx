import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import useScrollWorldGsap from '../hooks/useScrollWorldGsap';
import { buildScrollWorldSegments } from '../constants/scrollWorldTestConfig';
import { SCROLL_WORLD_PACKS, getScrollWorldPack } from '../constants/scrollWorldPacks';
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

/**
 * 三包預覽（Clay / Papercraft / Neon）— 手動切換，之後可改自動輪播。
 * 路徑：/scroll-world-packs
 */
export default function ScrollWorldPacksPreviewPage() {
  const [packId, setPackId] = useState('papercraft');
  const pack = useMemo(() => getScrollWorldPack(packId), [packId]);
  const videoRefs = useRef({});

  const sections = pack.sections;
  const connectors = pack.connectors;

  const segments = useMemo(
    () => buildScrollWorldSegments(sections, connectors),
    [sections, connectors],
  );

  // outer div key={packId} remounts the GSAP chain when pack changes
  const { rootRef } = useScrollWorldGsap({
    sections,
    connectors,
    videoRefs,
  });

  return (
    <div
      key={packId}
      ref={rootRef}
      className="swt-page"
      data-swt-section="0"
      style={{ '--swt-pack-bg': pack.bg }}
    >
      <a className="swt-close" href="/" aria-label="返回首頁">
        <span aria-hidden="true">×</span>
        <span className="swt-close__label">離開預覽</span>
      </a>

      <div
        className="swt-pack-switcher"
        role="tablist"
        aria-label="Scroll World 素材包"
        style={{
          position: 'fixed',
          top: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 40,
          display: 'flex',
          gap: '0.4rem',
          padding: '0.35rem',
          borderRadius: '999px',
          background: packId === 'neon' ? 'rgba(11,18,32,0.85)' : 'rgba(255,255,255,0.9)',
          boxShadow: '0 8px 24px rgba(28,61,110,0.16)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {SCROLL_WORLD_PACKS.map((p) => {
          const active = p.id === packId;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPackId(p.id)}
              style={{
                border: 'none',
                borderRadius: '999px',
                padding: '0.4rem 0.9rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: active ? '#2a5d9f' : 'transparent',
                color: active ? '#fff' : packId === 'neon' ? '#e8eef7' : '#1c3d6e',
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="swt-sky" aria-hidden="true" style={{ background: pack.bg }} />

      <section className="swt-stage" aria-label={`${pack.label} 沉浸式場景`}>
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
        <aside className="swt-topic-nav" aria-label="主題快速導覽">
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
              <p className="swt-copy__eyebrow" style={{ margin: 0, opacity: 0.65, fontSize: '0.8rem' }}>
                {pack.label} · {pack.style}
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
