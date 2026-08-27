import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import DioramaScene from '../components/scrollWorld/DioramaScene';
import useScrollWorldGsap from '../hooks/useScrollWorldGsap';
import {
  SCROLL_WORLD_CONNECTORS,
  SCROLL_WORLD_SECTIONS,
  buildScrollWorldSegments,
} from '../constants/scrollWorldTestConfig';
import { fetchScrollWorldTestPublic } from '../services/pageContentPublicApi';
import './ScrollWorldTestPage.css';

function SwtCtaLink({ item, className }) {
  if (!item?.href || !item?.label) return null;
  if (item.external) {
    return (
      <a
        href={item.href}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
      >
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

/** 中／英逗號後自動換行（保留逗號） */
function renderCommaBreaks(text) {
  const raw = String(text || '');
  if (!raw) return null;
  const parts = raw.split(/([，,])/);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part === '，' || part === ',') {
      return (
        <React.Fragment key={`c-${i}`}>
          {part}
          <br />
        </React.Fragment>
      );
    }
    return <React.Fragment key={`t-${i}`}>{part}</React.Fragment>;
  });
}

export default function ScrollWorldTestPage({ onClose = null }) {
  const { t, lang } = useLanguage();
  const videoRefs = useRef({});
  const [dbSegments, setDbSegments] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchScrollWorldTestPublic();
        if (cancelled) return;
        setDbSegments(data?.segments || []);
      } catch (_) {
        // API 失敗時回退到靜態 config，避免空白頁
        if (!cancelled) setDbSegments(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sectionsOrdered = useMemo(() => {
    const rows = Array.isArray(dbSegments) ? [...dbSegments].sort((a, b) => a.sortOrder - b.sortOrder) : [];
    const active = rows.length ? rows.filter((s) => !!s.isActive) : (dbSegments == null ? SCROLL_WORLD_SECTIONS : []);

    if (!active || active.length === 0) return [];

    // 當 DB 尚未 ready 時，回到既有靜態 config（確保頁面不會空白）
    if (active === SCROLL_WORLD_SECTIONS) return SCROLL_WORLD_SECTIONS;

    return active
      .map((seg) => {
        const staticSection = SCROLL_WORLD_SECTIONS.find((s) => s.id === seg.sectionId);
        if (!staticSection) return null;

        const secondary = Array.isArray(seg.secondaryCtas) ? seg.secondaryCtas : [];
        const secondaryResolved = secondary.length
          ? secondary.map((x) => ({
              label: lang === 'zh' ? x.labelZh || x.labelEn : x.labelEn || x.labelZh,
              href: x.href,
              external: !!x.isExternal,
            }))
          : staticSection.cta?.secondary?.map((x) => ({ ...x }));

        const primaryLabel = lang === 'zh' ? seg.primaryCtaLabelZh || seg.primaryCtaLabelEn : seg.primaryCtaLabelEn || seg.primaryCtaLabelZh;
        const primary =
          seg.primaryCtaHref
            ? {
                label: primaryLabel,
                href: seg.primaryCtaHref,
                external: !!seg.primaryCtaIsExternal,
              }
            : staticSection.cta?.primary
              ? { ...staticSection.cta.primary }
              : null;

        const resolvedCta = {
          primary,
          secondary: secondaryResolved,
        };

        return {
          ...staticSection,
          label: lang === 'zh' ? seg.labelZh || staticSection.label : seg.labelEn || staticSection.label,
          title: lang === 'zh' ? seg.titleZh || staticSection.title : seg.titleEn || staticSection.title,
          body: lang === 'zh' ? seg.bodyZh || staticSection.body : seg.bodyEn || staticSection.body,
          cta: resolvedCta,
        };
      })
      .filter(Boolean);
  }, [dbSegments, lang]);

  const segments = useMemo(
    () => buildScrollWorldSegments(sectionsOrdered, SCROLL_WORLD_CONNECTORS),
    [sectionsOrdered],
  );

  const { rootRef } = useScrollWorldGsap({
    sections: sectionsOrdered,
    connectors: SCROLL_WORLD_CONNECTORS,
    videoRefs,
  });

  return (
    <div ref={rootRef} className="swt-page" data-swt-section="0">
      {typeof onClose === 'function' ? (
        <button
          type="button"
          className="swt-close"
          onClick={onClose}
          aria-label={t('page.homeOverlayClose')}
        >
          <span aria-hidden="true">×</span>
          <span className="swt-close__label">{t('page.homeOverlayClose')}</span>
        </button>
      ) : null}

      <div className="swt-sky" aria-hidden="true" />

      <section className="swt-stage" aria-label="沉浸式滾動場景">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className={`swt-scene${seg.clip ? ' swt-scene--video' : ''}`}
            data-swt-seg={seg.key}
            style={{ '--swt-scene-accent': seg.accent }}
          >
            {/* 背景：靜態 still + CSS blur（不再解第二支影片） */}
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

            {/* 前景影片：preload=none，由 hook 依鄰近段落動態掛 src */}
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

            {!seg.clip && seg.diorama ? (
              <div className="swt-scene__visual">
                <DioramaScene variant={seg.diorama} accent={seg.accent} />
              </div>
            ) : null}
          </div>
        ))}
      </section>

      <div className="swt-copy-stack">
        <aside className="swt-topic-nav" aria-label="主題快速導覽">
          <div className="swt-topic-nav__list">
            {sectionsOrdered.map((section, index) => (
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
          {sectionsOrdered.map((section, index) => (
            <article
              key={section.id}
              className="swt-copy"
              data-swt-copy={section.id}
              style={{ pointerEvents: index === 0 ? 'auto' : 'none' }}
            >
              <h1 className="swt-copy__title">{renderCommaBreaks(section.title)}</h1>
              <p className="swt-copy__body">{renderCommaBreaks(section.body)}</p>
              {section.cta?.primary || section.cta?.secondary?.length ? (
                <div className="swt-copy__cta">
                  {section.cta.secondary?.length ? (
                    <div className="swt-copy__cta-secondary">
                      {section.cta.secondary.map((item) => (
                        <SwtCtaLink
                          key={`${item.label}-${item.href}`}
                          item={item}
                          className="swt-btn swt-btn--ghost swt-btn--sm"
                        />
                      ))}
                    </div>
                  ) : null}
                  {section.cta.primary ? (
                    <SwtCtaLink item={section.cta.primary} className="swt-btn swt-btn--primary" />
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
