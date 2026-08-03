import { useEffect } from 'react';

/**
 * 區塊進場：IntersectionObserver + transform/opacity（尊重 reduced-motion）
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
      nodes.forEach((el) => el.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.1 },
    );

    nodes.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [selector]);
}
