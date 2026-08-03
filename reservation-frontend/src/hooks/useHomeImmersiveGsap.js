import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { HOME_IMMERSIVE_JOURNEY } from '../constants/homeImmersiveTestConfig';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const STICKY_OFFSET = 68;

function chapterDistance() {
  return Math.max(window.innerHeight - STICKY_OFFSET, 560);
}

/**
 * /hometest：Hero 進場 + 四島飛入切換（接近 B 的 dive 質感）+ 下方區塊 once 進場
 */
export default function useHomeImmersiveGsap() {
  const rootRef = useRef(null);
  const scrollToStepRef = useRef(() => {});

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return undefined;

      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const heroReveals = root.querySelectorAll('[data-hit-reveal]');
      const pinEl = root.querySelector('.hit-journey__pin');
      const panels = gsap.utils.toArray('[data-hit-journey-panel]', root);
      const scenes = gsap.utils.toArray('[data-hit-scene]', root);
      const dots = gsap.utils.toArray('[data-hit-journey-dot]', root);

      if (prefersReduced) {
        gsap.set(heroReveals, { autoAlpha: 1, y: 0, clearProps: 'all' });
        gsap.set(panels, { autoAlpha: 1, y: 0, clearProps: 'all' });
        gsap.set(scenes, { autoAlpha: 1, scale: 1, y: 0, clearProps: 'transform' });
        return undefined;
      }

      if (heroReveals.length) {
        gsap.from(heroReveals, {
          y: 22,
          autoAlpha: 0,
          duration: 0.65,
          stagger: 0.08,
          ease: 'power3.out',
          delay: 0.08,
        });
      }

      if (pinEl && panels.length > 1) {
        gsap.set(panels, { autoAlpha: 0, y: 28 });
        gsap.set(panels[0], { autoAlpha: 1, y: 0 });
        panels[0].style.pointerEvents = 'auto';
        gsap.set(scenes, { autoAlpha: 0, scale: 0.62, y: '14%', transformOrigin: '50% 58%' });
        gsap.set(scenes[0], { autoAlpha: 1, scale: 0.78, y: '6%' });

        let active = 0;
        const setActive = (index) => {
          if (index === active) return;
          active = index;
          dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
          panels.forEach((panel, i) => {
            panel.style.pointerEvents = i === index ? 'auto' : 'none';
          });
          root.style.setProperty('--hit-accent', HOME_IMMERSIVE_JOURNEY[index]?.accent || '#D4564A');
        };

        root.style.setProperty('--hit-accent', HOME_IMMERSIVE_JOURNEY[0]?.accent || '#D4564A');

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: pinEl,
            start: 'top top',
            end: () => `+=${(panels.length - 1) * chapterDistance() * 1.15}`,
            pin: true,
            scrub: 0.75,
            anticipatePin: 0,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const idx = Math.min(
                panels.length - 1,
                Math.round(self.progress * (panels.length - 1)),
              );
              setActive(idx);
            },
          },
        });

        // 第一島：由遠飛近
        tl.to(
          scenes[0],
          { scale: 1, y: '0%', duration: 0.9, ease: 'power1.inOut' },
          0,
        );

        panels.forEach((panel, i) => {
          if (i === 0) return;
          const prev = panels[i - 1];
          const prevScene = scenes[i - 1];
          const scene = scenes[i];
          const pos = i;

          tl.to(prev, { autoAlpha: 0, y: -22, duration: 0.85, ease: 'power2.inOut' }, pos)
            .to(panel, { autoAlpha: 1, y: 0, duration: 0.85, ease: 'power2.inOut' }, pos)
            .to(
              prevScene,
              {
                autoAlpha: 0,
                scale: 1.1,
                y: '-8%',
                duration: 0.9,
                ease: 'power2.inOut',
              },
              pos,
            )
            .fromTo(
              scene,
              { autoAlpha: 0, scale: 0.62, y: '14%' },
              {
                autoAlpha: 1,
                scale: 0.78,
                y: '6%',
                duration: 0.9,
                ease: 'power2.inOut',
              },
              pos,
            )
            .to(
              scene,
              { scale: 1, y: '0%', duration: 0.95, ease: 'power1.inOut' },
              pos + 0.35,
            );
        });

        scrollToStepRef.current = (index) => {
          const st = tl.scrollTrigger;
          if (!st) return;
          const progress = panels.length > 1 ? index / (panels.length - 1) : 0;
          const y = st.start + progress * (st.end - st.start);
          window.scrollTo({ top: y, behavior: 'smooth' });
        };
      }

      root.querySelectorAll('.home-section').forEach((section) => {
        const shell = section.querySelector('.home-shell, .hit-shell');
        if (!shell) return;
        const items = shell.querySelectorAll(
          '.home-section__header > *, .home-section__header--split > div > *, .home-announce-card-link, .home-faq__item, .home-contact-card, .hit-quick__card, .home-section__footer, .home-section__header-action, .home-empty-state, .home-contact-grid__copy > *',
        );
        if (!items.length) return;
        items.forEach((el) => el.classList.add('home-scroll-item'));
        gsap.from(items, {
          y: 22,
          autoAlpha: 0,
          duration: 0.5,
          stagger: 0.06,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 86%',
            once: true,
          },
        });
      });

      ScrollTrigger.refresh();

      return () => {
        scrollToStepRef.current = () => {};
      };
    },
    { scope: rootRef },
  );

  const scrollToJourneyStep = (index) => {
    scrollToStepRef.current(index);
  };

  return { rootRef, scrollToJourneyStep };
}
