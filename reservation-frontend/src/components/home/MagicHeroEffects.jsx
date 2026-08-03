import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

export function DotPattern({
  className = '',
  spacing = 16,
  dotSize = 1.2,
  color = 'rgba(17, 17, 17, 0.14)',
  glow = false,
  fade = true,
} = {}) {
  return (
    <div
      className={`home-hero__dot-pattern ${className}`}
      aria-hidden
      style={{
        backgroundImage: `radial-gradient(circle, ${color} ${dotSize}px, transparent ${dotSize + 0.2}px)`,
        backgroundSize: `${spacing}px ${spacing}px`,
        filter: glow ? 'drop-shadow(0 0 10px rgba(42, 93, 159, 0.25))' : undefined,
        WebkitMaskImage: fade
          ? 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 100%)'
          : undefined,
        maskImage: fade
          ? 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 100%)'
          : undefined,
      }}
    />
  );
}

export function AnimatedShinyText({
  children,
  className = '',
  shimmerWidth = 220,
} = {}) {
  return (
    <span
      className={`magic-animated-shiny-text ${className}`}
      style={{ '--shiny-width': `${shimmerWidth}px` }}
    >
      {children}
    </span>
  );
}

/** Magic UI 風格：主標題漸層流光（漸層必須套在實際文字節點上） */
export function AnimatedGradientText({
  children,
  className = '',
} = {}) {
  return (
    <span className={`magic-hero-gradient-text ${className}`}>
      <span className="magic-hero-gradient-text__label">{children}</span>
    </span>
  );
}

export function BlurIn({
  children,
  className = '',
  delayMs = 0,
} = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduce-motion：直接呈現，避免動畫影響體驗
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`magic-blur-in ${inView ? 'magic-blur-in--visible' : ''} ${className}`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}

function shimmerClasses(variant, className) {
  return [
    'magic-shimmer-button',
    variant !== 'default' ? `magic-shimmer-button--${variant}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

function ShimmerButtonInner({ children }) {
  return (
    <>
      <span className="magic-shimmer-button__shine" aria-hidden />
      <span className="magic-shimmer-button__label">{children}</span>
    </>
  );
}

export function ShimmerButton({
  to,
  onClick,
  type = 'button',
  children,
  className = '',
  variant = 'default',
  ariaLabel,
} = {}) {
  const classes = shimmerClasses(variant, className);

  if (to) {
    return (
      <Link to={to} className={classes} aria-label={ariaLabel}>
        <ShimmerButtonInner>{children}</ShimmerButtonInner>
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes} aria-label={ariaLabel}>
      <ShimmerButtonInner>{children}</ShimmerButtonInner>
    </button>
  );
}

