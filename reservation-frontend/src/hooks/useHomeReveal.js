import { useEffect } from 'react';

/**
 * 首頁區塊進場：IntersectionObserver + transform/opacity（尊重 reduced-motion）
 */
export default function useHomeReveal(selector = '.home-reveal') {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

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
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );

    nodes.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [selector]);
}
