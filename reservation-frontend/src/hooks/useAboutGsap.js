import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const STICKY_HEADER_OFFSET = 68;

function chapterScrollDistance() {
  return Math.max(window.innerHeight - STICKY_HEADER_OFFSET, 520);
}

function seekVideo(video, time) {
  if (!video || !Number.isFinite(time)) return;
  if (video.seeking) return;
  const clamped = Math.max(0, Math.min(time, video.duration || time));
  if (Math.abs(video.currentTime - clamped) < 0.04) return;
  video.currentTime = clamped;
}

/**
 * About 全頁沈浸：滾動 scrub 影片 + 敘事面板 pin/scrub
 */
export default function useAboutGsap({ videoRef } = {}) {
  const rootRef = useRef(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const video = videoRef?.current || root.querySelector('[data-about-scroll-video]');
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReduced) {
        gsap.set(root.querySelectorAll('.about-story__panel'), {
          autoAlpha: 1,
          x: 0,
          y: 0,
          clearProps: 'all',
        });
        if (video) seekVideo(video, 0);
        return undefined;
      }

      const pinEl = root.querySelector('.about-story__pin');
      const panels = gsap.utils.toArray('[data-about-story-panel]', root);
      if (!pinEl || panels.length < 1) return undefined;

      let pendingSeek = null;

      const scrubVideoToProgress = (progress) => {
        if (!video || !video.duration) return;
        const target = progress * video.duration;
        if (video.seeking) {
          pendingSeek = target;
          return;
        }
        seekVideo(video, target);
      };

      const onSeeked = () => {
        if (pendingSeek == null) return;
        const next = pendingSeek;
        pendingSeek = null;
        seekVideo(video, next);
      };

      const onLoadedMetadata = () => {
        seekVideo(video, 0);
        ScrollTrigger.refresh();
      };

      if (video) {
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('seeked', onSeeked);
        if (video.readyState >= 1) onLoadedMetadata();
      }

      gsap.set(panels, { autoAlpha: 0, y: 32 });
      gsap.set(panels[0], { autoAlpha: 1, y: 0 });

      const scrollDistance = () => (panels.length - 1) * chapterScrollDistance();

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: pinEl,
          start: 'top top',
          end: () => `+=${scrollDistance()}`,
          pin: true,
          scrub: 0.85,
          anticipatePin: 0,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            scrubVideoToProgress(self.progress);
          },
        },
      });

      panels.forEach((panel, i) => {
        if (i === 0) return;
        const prev = panels[i - 1];
        tl.to(prev, { autoAlpha: 0, y: -28, duration: 1, ease: 'power2.inOut' }, i)
          .to(panel, { autoAlpha: 1, y: 0, duration: 1, ease: 'power2.inOut' }, i);
      });

      ScrollTrigger.refresh();

      return () => {
        if (video) {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('seeked', onSeeked);
        }
      };
    },
    { scope: rootRef, dependencies: [videoRef] },
  );

  return rootRef;
}
