import { useEffect } from 'react';

/**
 * 快速入口卡：滑鼠位置驅動光暈（--mouse-x / --mouse-y）
 */
export default function useHeroQuickCardHover(containerRef) {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;

    const coarsePointer =
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches;
    if (coarsePointer) return undefined;

    const cards = root.querySelectorAll('.home-hero-quick-card');
    if (!cards.length) return undefined;

    const onMove = (event) => {
      const card = event.currentTarget;
      const rect = card.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--mouse-x', `${x}%`);
      card.style.setProperty('--mouse-y', `${y}%`);
    };

    const onLeave = (event) => {
      event.currentTarget.style.setProperty('--mouse-x', '50%');
      event.currentTarget.style.setProperty('--mouse-y', '50%');
    };

    cards.forEach((card) => {
      card.addEventListener('mousemove', onMove);
      card.addEventListener('mouseleave', onLeave);
    });

    return () => {
      cards.forEach((card) => {
        card.removeEventListener('mousemove', onMove);
        card.removeEventListener('mouseleave', onLeave);
      });
    };
  }, [containerRef]);
}
