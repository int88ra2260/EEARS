import { useEffect } from 'react';
import { animate } from 'motion';

/**
 * Hero 大卡：滑鼠跟隨光暈 + 輕微 3D 傾斜（Motion；觸控／減少動態時停用）
 */
export default function useHeroMouseParallax(panelRef) {
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return undefined;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer =
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches;

    if (prefersReduced || coarsePointer) return undefined;

    const glow = panel.querySelector('.home-hero-panel__glow');
    if (!glow) return undefined;

    let rafId = 0;
    let targetX = 0;
    let targetY = 0;
    let glowAnim;
    let panelAnim;

    const applyMotion = () => {
      rafId = 0;
      glowAnim?.stop?.();
      panelAnim?.stop?.();
      glowAnim = animate(
        glow,
        { x: targetX * 28, y: targetY * 18 },
        { duration: 0.85, ease: [0.16, 1, 0.3, 1] },
      );
      panelAnim = animate(
        panel,
        {
          rotateX: targetY * -2.5,
          rotateY: targetX * 3,
          transformPerspective: 1000,
        },
        { duration: 0.85, ease: [0.16, 1, 0.3, 1] },
      );
    };

    const onMove = (event) => {
      const rect = panel.getBoundingClientRect();
      targetX = (event.clientX - rect.left) / rect.width - 0.5;
      targetY = (event.clientY - rect.top) / rect.height - 0.5;
      if (!rafId) {
        rafId = window.requestAnimationFrame(applyMotion);
      }
    };

    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      if (!rafId) {
        rafId = window.requestAnimationFrame(applyMotion);
      }
    };

    panel.style.transformStyle = 'preserve-3d';
    panel.addEventListener('mousemove', onMove);
    panel.addEventListener('mouseleave', onLeave);

    return () => {
      panel.removeEventListener('mousemove', onMove);
      panel.removeEventListener('mouseleave', onLeave);
      if (rafId) window.cancelAnimationFrame(rafId);
      glowAnim?.stop?.();
      panelAnim?.stop?.();
      glow.style.transform = '';
      panel.style.transform = '';
    };
  }, [panelRef]);
}
