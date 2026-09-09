import { useEffect, useRef } from 'react';
import { animate, inView, stagger } from 'motion';

const SECTION_HEADER_SELECTORS = [
  '.home-section__header > *',
  '.home-section__header--split > div > *',
  '.home-practice-now__header > *',
  '.home-contact-grid__copy > *',
].join(', ');

const SECTION_ITEM_SELECTORS = [
  '.home-activity-tile',
  '.home-steps-rail__item',
  '.home-announce-card-link',
  '.home-practice-now__card',
  '.home-faq__item',
  '.home-contact-card',
  '.home-section__footer',
  '.home-section__header-action',
  '.home-empty-state',
].join(', ');

const EASE_OUT = [0.16, 1, 0.3, 1];

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function showImmediately(nodes) {
  nodes.forEach((el) => {
    el.style.opacity = '1';
    el.style.transform = 'none';
  });
}

/**
 * 首頁進場：Hero 序列 + 區塊 while-in-view stagger（Motion，取代 GSAP ScrollTrigger）
 */
export default function useHomeMotion() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const cleanups = [];

    if (prefersReducedMotion()) {
      showImmediately(root.querySelectorAll('.home-scroll-item, .home-section .home-reveal'));
      return undefined;
    }

    const hero = root.querySelector('.home-hero');
    if (hero) {
      const heroFrame = hero.querySelector('.home-hero-desk');
      const copyEls = hero.querySelectorAll(
        '.home-hero-desk__copy > *, .home-hero-panel__quick-header > *',
      );
      const cards = hero.querySelectorAll('.home-hero-quick-card');

      if (heroFrame) {
        cleanups.push(
          animate(
            heroFrame,
            { opacity: [0, 1], y: [20, 0] },
            { duration: 0.55, ease: EASE_OUT },
          ).stop,
        );
      }

      if (copyEls.length) {
        cleanups.push(
          animate(
            copyEls,
            { opacity: [0, 1], y: [18, 0] },
            { duration: 0.55, delay: stagger(0.06, { startDelay: 0.2 }), ease: EASE_OUT },
          ).stop,
        );
      }

      if (cards.length) {
        cleanups.push(
          animate(
            cards,
            { opacity: [0, 1], y: [12, 0] },
            { duration: 0.45, delay: stagger(0.07, { startDelay: 0.35 }), ease: EASE_OUT },
          ).stop,
        );
      }
    }

    root.querySelectorAll('.home-section').forEach((section) => {
      const shell = section.querySelector('.home-shell');
      if (!shell) return;

      const headerEls = shell.querySelectorAll(SECTION_HEADER_SELECTORS);
      const gridItems = shell.querySelectorAll(SECTION_ITEM_SELECTORS);

      headerEls.forEach((el) => el.classList.add('home-scroll-item'));
      gridItems.forEach((el) => el.classList.add('home-scroll-item'));

      [...headerEls, ...gridItems].forEach((el) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(22px)';
      });

      const stop = inView(
        section,
        () => {
          if (headerEls.length) {
            animate(
              headerEls,
              { opacity: 1, y: 0 },
              { duration: 0.58, delay: stagger(0.09), ease: EASE_OUT },
            );
          }
          if (gridItems.length) {
            animate(
              gridItems,
              { opacity: 1, y: 0 },
              {
                duration: 0.52,
                delay: stagger(0.07, { startDelay: headerEls.length ? 0.28 : 0 }),
                ease: EASE_OUT,
              },
            );
          }
          stop();
        },
        { margin: '0px 0px -14% 0px', amount: 0.12 },
      );

      cleanups.push(stop);
    });

    return () => {
      cleanups.forEach((fn) => {
        try {
          fn?.();
        } catch (_) {
          /* ignore */
        }
      });
    };
  }, []);

  return rootRef;
}
