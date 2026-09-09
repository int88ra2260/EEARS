/**
 * EEARS UI Motion 預設（進出場）
 * 一律尊重 prefers-reduced-motion（呼叫端傳入 useReducedMotion()）。
 */

export const MOTION_EASE_OUT = [0.16, 1, 0.3, 1];

export function toastMotion(reduceMotion) {
  return {
    initial: reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 },
    transition: reduceMotion
      ? { duration: 0 }
      : { duration: 0.22, ease: MOTION_EASE_OUT },
  };
}

export function backdropMotion(reduceMotion) {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: reduceMotion ? { duration: 0 } : { duration: 0.2 },
  };
}

export function modalPanelMotion(reduceMotion, { y = 16 } = {}) {
  return {
    initial: reduceMotion ? false : { opacity: 0, y, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 },
    transition: reduceMotion
      ? { duration: 0 }
      : { duration: 0.25, ease: MOTION_EASE_OUT },
  };
}

export function sheetPanelMotion(reduceMotion, isMobile) {
  const y = isMobile ? 40 : 16;
  return {
    initial: reduceMotion ? false : { opacity: 0, y, scale: isMobile ? 1 : 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: reduceMotion
      ? { opacity: 0 }
      : { opacity: 0, y: isMobile ? 24 : 8, scale: isMobile ? 1 : 0.98 },
    transition: reduceMotion
      ? { duration: 0 }
      : { duration: 0.28, ease: MOTION_EASE_OUT },
  };
}

export function drawerPanelMotion(reduceMotion) {
  return {
    initial: reduceMotion ? false : { opacity: 0, y: -8 },
    animate: { opacity: 1, y: 0 },
    exit: reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 },
    transition: reduceMotion
      ? { duration: 0 }
      : { duration: 0.2, ease: MOTION_EASE_OUT },
  };
}

export function accordionPanelMotion(reduceMotion) {
  return {
    initial: reduceMotion ? false : { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto' },
    exit: reduceMotion ? { opacity: 0, height: 0 } : { opacity: 0, height: 0 },
    transition: reduceMotion
      ? { duration: 0 }
      : { duration: 0.28, ease: MOTION_EASE_OUT },
  };
}
