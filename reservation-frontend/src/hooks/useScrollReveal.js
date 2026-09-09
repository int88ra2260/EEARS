import { useEffect } from 'react';
import { animate, inView } from 'motion';

const REVEAL_EASE = [0.16, 1, 0.3, 1];
const REVEAL_Y = 20;
const REVEAL_DURATION = 0.45;

/**
 * 區塊進場：Motion inView + animate（尊重 reduced-motion）
 * @param {string} selector
 */
export default function useScrollReveal(selector) {
  useEffect(() => {
    if (typeof window === 'undefined' || !selector) return undefined;

    const prefersReduced =
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    const nodes = document.querySelectorAll(selector);
    if (!nodes.length) return undefined;

    if (prefersReduced) {
      nodes.forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'none';
        el.classList.add('is-visible');
      });
      return undefined;
    }

    const stops = [];

    nodes.forEach((el) => {
      animate(el, { opacity: 0, y: REVEAL_Y }, { duration: 0 });

      const delayVar = getComputedStyle(el).getPropertyValue('--reveal-delay').trim();
      const delay = delayVar ? Number.parseFloat(delayVar) / 1000 : 0;

      const stop = inView(
        el,
        () => {
          animate(
            el,
            { opacity: 1, y: 0 },
            {
              duration: REVEAL_DURATION,
              delay: Number.isFinite(delay) ? delay : 0,
              ease: REVEAL_EASE,
            },
          ).then(() => {
            el.classList.add('is-visible');
          });
          stop();
        },
        { margin: '0px 0px -6% 0px', amount: 0.1 },
      );

      stops.push(stop);
    });

    return () => {
      stops.forEach((stop) => stop());
    };
  }, [selector]);
}
