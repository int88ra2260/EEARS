import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { buildScrollWorldSegments } from '../constants/scrollWorldTestConfig';

/**
 * 40 幀隱喻：關鍵點 5 / 15 / 25 / 35；
 * 每個主題保留 FREE_FRAMES（3–5）幀供自由滾動。
 *
 * 效能：
 * - 背景用 still（不雙影片解碼）
 * - 只掛載鄰近片段 src
 * - seek 節流 ~24fps，且 seeking 中不疊加
 */
const KEYFRAME_FRAMES = [5, 15, 25, 35];
const TOTAL_FRAMES = 40;
const FREE_FRAMES = 4;

const AUTO_ENTER_SEC = 0.4;
const AUTO_HOP_MIN_SEC = 1;
const AUTO_HOP_MAX_SEC = 2;
const AUTO_WRAP_SEC = 2.5;
/** 進場最多等第一支 dive ready 多久；逾時仍開跑（避免影片失敗卡死） */
const ENTER_READY_TIMEOUT_MS = 4500;

/** 影片 seek 最小間隔（ms）≈ 24fps */
const SEEK_MIN_INTERVAL_MS = 42;
/** 平時 ±1；hop 時改走路徑保活，避免卸掉當前／connector 造成空窗 */
const NEIGHBOR_RADIUS = 1;

function clamp(x, a = 0, b = 1) {
  return Math.min(b, Math.max(a, x));
}

function smooth(x) {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
}

function lingerEase(x, L) {
  const linger = clamp(L);
  const c = x - 0.5;
  return (1 - linger) * x + linger * (4 * c * c * c + 0.5);
}

function seekVideo(video, time, epsilon = 0.04) {
  if (!video || !Number.isFinite(time)) return;
  if (video.seeking) return;
  if (!video.duration) return;
  const clamped = Math.max(0, Math.min(time, video.duration));
  if (Math.abs(video.currentTime - clamped) < epsilon) return;
  try {
    video.currentTime = clamped;
  } catch (_) {
    /* ignore */
  }
}

export default function useScrollWorldGsap({ sections, connectors, videoRefs }) {
  const rootRef = useRef(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || !sections?.length) return undefined;

      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const stage = root.querySelector('.swt-stage');
      const hint = root.querySelector('[data-swt-hint]');
      const hintLabel = root.querySelector('[data-swt-hint-label]');
      const copies = gsap.utils.toArray('[data-swt-copy]', root);
      const dots = gsap.utils.toArray('[data-swt-dot]', root);
      const jumpItems = gsap.utils.toArray('[data-swt-jump]', root);
      const segments = buildScrollWorldSegments(sections, connectors);
      const segEls = segments
        .map((seg) => root.querySelector(`[data-swt-seg="${seg.key}"]`))
        .filter(Boolean);

      if (!stage || segEls.length < 1) return undefined;

      document.documentElement.classList.add('swt-lock-scroll');
      document.body.classList.add('swt-lock-scroll');

      const weights = segments.map((s) => s.weight || 1.2);
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      const freeSpan = (FREE_FRAMES / TOTAL_FRAMES) * totalWeight;

      const zones = sections.map((_, sectionIndex) => {
        const diveIdx = segments.findIndex(
          (s) => s.kind === 'dive' && s.sectionIndex === sectionIndex,
        );
        if (diveIdx < 0) {
          return { center: 0, start: 0, end: 0, diveStart: 0, diveEnd: 0 };
        }
        const diveStart = weights.slice(0, diveIdx).reduce((sum, w) => sum + w, 0);
        const diveEnd = diveStart + weights[diveIdx];
        const frameBias = KEYFRAME_FRAMES[sectionIndex] / TOTAL_FRAMES;
        const local = clamp(0.48 + frameBias * 0.12, 0.5, 0.68);
        const center = diveStart + weights[diveIdx] * local;
        const half = freeSpan / 2;
        const start = clamp(center - half, diveStart + weights[diveIdx] * 0.38, diveEnd);
        const end = clamp(center + half, diveStart, diveEnd - weights[diveIdx] * 0.08);
        return {
          center,
          start: Math.min(start, end - freeSpan * 0.5),
          end: Math.max(end, start + freeSpan * 0.5),
          diveStart,
          diveEnd,
        };
      });

      /** @type {Array<{ index: number, key: string, video: HTMLVideoElement, clip: string, pending: number|null, lastSeekAt: number, ready: boolean }>} */
      const slots = segments.map((seg, i) => {
        const video = videoRefs?.current?.[seg.key];
        return {
          index: i,
          key: seg.key,
          video: video || null,
          clip: seg.clip || '',
          linger: seg.linger || 0,
          pending: null,
          lastSeekAt: 0,
          ready: false,
        };
      });

      let activeSection = 0;
      let activeSegIndex = 0;
      let sectionIndex = 0;
      let animating = false;
      let hintDismissed = false;
      /** hop 期間保活的片段區間（含兩端） */
      let hopKeepFrom = 0;
      let hopKeepTo = 0;
      /** wrap 時路徑不連續（最後 dive + conn-wrap + 第一 dive） */
      let hopAlsoKeep = [];
      /** hop 時間軸順序（用於正確 seek 非連續 index） */
      let hopPath = [];
      const progressState = { units: 0 };

      const markReady = (slot) => {
        slot.ready = true;
        segEls[slot.index]?.classList.add('has-clip');
      };

      /** 依進度算出 seek 時間；seedProgress 供載入後對準接縫幀 */
      const progressToTime = (slot, progress) => {
        const eased = slot.linger ? lingerEase(progress, slot.linger) : progress;
        return clamp(eased, 0, 0.999) * (slot.video?.duration || 1);
      };

      const onSeeked = (slot) => {
        if (!slot.video) return;
        // 有實際畫格後才蓋掉 still，避免載入瞬間黑／空窗
        if (slot.video.readyState >= 2) markReady(slot);
        if (slot.pending == null) return;
        if (slot.video.seeking) return;
        const next = slot.pending;
        slot.pending = null;
        seekVideo(slot.video, next);
      };

      const onLoadedData = (slot) => {
        if (!slot.video) return;
        // 不要一律跳回 0：hop／倒轉時要對準接縫幀，否則 conn→dive 會卡一下
        let t = 0.001;
        if (slot.pending != null) {
          t = slot.pending;
          slot.pending = null;
        } else if (Number.isFinite(slot.seedProgress)) {
          t = progressToTime(slot, slot.seedProgress);
        }
        try {
          if (Math.abs((slot.video.currentTime || 0) - t) > 0.04) {
            slot.video.currentTime = Math.max(0.001, t);
            return; // 等 seeked 再 markReady
          }
        } catch (_) {
          /* ignore */
        }
        if (slot.video.readyState >= 2) markReady(slot);
      };

      slots.forEach((slot) => {
        if (!slot.video || !slot.clip) return;
        const seeked = () => onSeeked(slot);
        const loaded = () => onLoadedData(slot);
        slot._seeked = seeked;
        slot._loaded = loaded;
        slot.video.addEventListener('seeked', seeked);
        slot.video.addEventListener('loadeddata', loaded);
      });

      const loadSlot = (slot) => {
        if (!slot.video || !slot.clip) return;
        if (slot.video.getAttribute('src') === slot.clip) {
          if (slot.video.readyState >= 2) markReady(slot);
          return;
        }
        slot.ready = false;
        // 載入中維持 still，勿提早蓋黑
        segEls[slot.index]?.classList.remove('has-clip');
        slot.video.setAttribute('src', slot.clip);
        slot.video.load();
      };

      const unloadSlot = (slot) => {
        if (!slot.video) return;
        if (!slot.video.getAttribute('src')) return;
        // 正在顯示／hop 路徑中的片段不卸載
        if (slot.index === activeSegIndex) return;
        if (animating && slot.index >= hopKeepFrom && slot.index <= hopKeepTo) return;
        if (animating && hopAlsoKeep.includes(slot.index)) return;
        try {
          slot.video.pause();
        } catch (_) {
          /* ignore */
        }
        slot.video.removeAttribute('src');
        slot.video.load();
        slot.ready = false;
        slot.pending = null;
        slot.seedProgress = undefined;
        segEls[slot.index]?.classList.remove('has-clip');
      };

      /**
       * @param {number} centerSegIndex
       * @param {{ keepFrom?: number, keepTo?: number, alsoKeep?: number[] }} [range]
       */
      const syncLoadedNeighbors = (centerSegIndex, range = {}) => {
        const from = Number.isFinite(range.keepFrom) ? range.keepFrom : centerSegIndex;
        const to = Number.isFinite(range.keepTo) ? range.keepTo : centerSegIndex;
        const lo = Math.min(from, to, centerSegIndex) - NEIGHBOR_RADIUS;
        const hi = Math.max(from, to, centerSegIndex) + NEIGHBOR_RADIUS;
        const also = new Set((range.alsoKeep || []).filter((i) => i >= 0));
        slots.forEach((slot) => {
          if (!slot.clip) return;
          if ((slot.index >= lo && slot.index <= hi) || also.has(slot.index)) loadSlot(slot);
          else unloadSlot(slot);
        });
      };

      const scrubSlot = (slot, progress, { force = false } = {}) => {
        if (!slot.video || !slot.clip) return;
        if (!slot.video.getAttribute('src')) return;
        if (!slot.video.duration && slot.video.readyState < 1) return;

        const eased = slot.linger ? lingerEase(progress, slot.linger) : progress;
        const target = clamp(eased, 0, 0.999) * (slot.video.duration || 1);
        const now = performance.now();

        if (!force && now - slot.lastSeekAt < SEEK_MIN_INTERVAL_MS) {
          slot.pending = target;
          return;
        }
        if (slot.video.seeking) {
          slot.pending = target;
          return;
        }
        slot.lastSeekAt = now;
        slot.pending = null;
        seekVideo(slot.video, target);
        if (slot.video.readyState >= 2) markReady(slot);
      };

      /** hop 前把路徑上的片段預 seek 到接縫側，避免跨段時才從頭解碼 */
      const primeSlotProgress = (slot, progress) => {
        if (!slot?.clip) return;
        slot.seedProgress = progress;
        loadSlot(slot);
        if (!slot.video?.getAttribute('src')) return;
        if (!slot.video.duration && slot.video.readyState < 1) {
          // metadata 未到：留下 seedProgress，等 onLoadedData 對準
          return;
        }
        scrubSlot(slot, progress, { force: true });
      };

      /** 依 units 算出某 dive 區段的 local progress（落地／接縫用） */
      const diveLocalAtUnits = (diveIdx, units) => {
        if (diveIdx < 0) return 0;
        const diveStart = weights.slice(0, diveIdx).reduce((sum, w) => sum + w, 0);
        const diveW = weights[diveIdx] || 1;
        return clamp((units - diveStart) / diveW);
      };

      /** 預載相鄰島路徑（往前 + 往後／wrap），減少 conn→dive 才開始解碼 */
      const prefetchNeighborPaths = (fromSection) => {
        const n = sections.length;
        const diveIdx = segments.findIndex(
          (s) => s.kind === 'dive' && s.sectionIndex === fromSection,
        );
        if (diveIdx < 0) return;

        const prevDiveIdx = segments.findIndex(
          (s) => s.kind === 'dive' && s.sectionIndex === (fromSection - 1 + n) % n,
        );
        const nextDiveIdx = segments.findIndex(
          (s) => s.kind === 'dive' && s.sectionIndex === (fromSection + 1) % n,
        );
        const wrapIdx = segments.findIndex((s) => s.wrap);

        if (fromSection === 0) {
          syncLoadedNeighbors(diveIdx, {
            keepFrom: diveIdx,
            keepTo: nextDiveIdx >= 0 ? nextDiveIdx : diveIdx,
            alsoKeep: [prevDiveIdx, wrapIdx],
          });
        } else if (fromSection >= n - 1) {
          syncLoadedNeighbors(diveIdx, {
            keepFrom: prevDiveIdx >= 0 ? prevDiveIdx : diveIdx,
            keepTo: wrapIdx >= 0 ? wrapIdx : diveIdx,
            alsoKeep: [nextDiveIdx, wrapIdx],
          });
        } else {
          syncLoadedNeighbors(activeSegIndex, {
            keepFrom: Math.min(prevDiveIdx, diveIdx),
            keepTo: Math.max(diveIdx, nextDiveIdx),
          });
        }

        if (prevDiveIdx >= 0) primeSlotProgress(slots[prevDiveIdx], 0.985);
        if (nextDiveIdx >= 0) primeSlotProgress(slots[nextDiveIdx], 0);
      };

      gsap.set(segEls, { autoAlpha: 0 });
      if (segEls[0]) gsap.set(segEls[0], { autoAlpha: 1 });
      gsap.set(copies, { autoAlpha: 0, y: 16 });
      if (copies[0]) gsap.set(copies[0], { autoAlpha: 1, y: 0 });

      // 進場前只先掛第一支 dive；鄰居等 enter 完成再 prefetchNeighborPaths
      syncLoadedNeighbors(0);

      const setHintMode = (mode) => {
        if (!hintLabel) return;
        hintLabel.textContent =
          mode === 'free' ? '此主題可微調滾動 · 再往下進入下一島' : '向下滾動探索';
      };

      const dismissHint = () => {
        if (hintDismissed || !hint) return;
        hintDismissed = true;
        hint.classList.add('is-gone');
      };

      const updateCopy = (si, localProgress, isDive, seg) => {
        const n = sections.length;
        const nextSection = !isDive ? (seg?.wrap ? 0 : Math.min(si + 1, n - 1)) : si;

        // 同一時間只顯示一個主題；文案跟「目前畫面所在片段」走，避免空窗或卡在上一島
        let activeCopy;
        if (!animating) {
          activeCopy = sectionIndex;
        } else if (isDive) {
          // 已在某島 dive 上 → 立刻用該島文案（不再回落到上一島）
          activeCopy = si;
        } else {
          // connector：偏早切到下一島，對齊飛向下一島的畫面
          activeCopy = localProgress >= 0.32 ? nextSection : si;
        }
        activeCopy = ((activeCopy % n) + n) % n;

        copies.forEach((copy, k) => {
          const opacity = k === activeCopy ? 1 : 0;
          gsap.set(copy, { autoAlpha: opacity, y: 0 });
          copy.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none';
        });
      };

      const resolveUnits = (rawUnits) => {
        let units = rawUnits;
        while (units < 0) units += totalWeight;
        while (units >= totalWeight) units -= totalWeight;

        let acc = 0;
        let segIndex = segments.length - 1;
        let localProgress = 1;

        for (let i = 0; i < segments.length; i += 1) {
          const weight = weights[i];
          if (units <= acc + weight) {
            segIndex = i;
            localProgress = weight > 0 ? (units - acc) / weight : 0;
            break;
          }
          acc += weight;
        }
        return { units, segIndex, localProgress, seg: segments[segIndex] };
      };

      /** 視覺層（便宜）：可每幀更新 */
      const applyVisual = (rawUnits) => {
        const { segIndex, localProgress, seg } = resolveUnits(rawUnits);

        const nearSection =
          seg.kind === 'dive'
            ? seg.sectionIndex
            : localProgress > 0.5
              ? seg.wrap
                ? 0
                : Math.min(seg.sectionIndex + 1, sections.length - 1)
              : seg.sectionIndex;

        if (nearSection !== activeSection) {
          activeSection = nearSection;
          root.style.setProperty('--swt-accent', sections[nearSection]?.accent || '#8A6BB5');
          root.dataset.swtSection = String(nearSection);
          dots.forEach((dot, k) => dot.classList.toggle('is-active', k === nearSection));
          jumpItems.forEach((item, k) => item.classList.toggle('is-active', k === nearSection));
        }

        if (segIndex !== activeSegIndex) {
          activeSegIndex = segIndex;
          if (animating) {
            syncLoadedNeighbors(segIndex, {
              keepFrom: hopKeepFrom,
              keepTo: hopKeepTo,
              alsoKeep: hopAlsoKeep,
            });
          } else {
            syncLoadedNeighbors(segIndex);
          }
        }

        updateCopy(seg.sectionIndex, localProgress, seg.kind === 'dive', seg);

        // 交叉淡化；hop 時略收窄，減少 conn↔dive 接縫「拖泥帶水」的卡頓感
        const fadeBand = animating ? 0.14 : 0.18;
        const curSlot = slots[segIndex];
        const curReady =
          !curSlot?.clip || curSlot.ready || segEls[segIndex]?.classList.contains('has-clip');
        const hasStill = Boolean(segEls[segIndex]?.querySelector('.swt-scene__still--fg'));

        segEls.forEach((el, i) => {
          let op = 0;
          if (i === segIndex) {
            op = hasStill || curReady ? 1 : 0.4;
          } else if (i === segIndex - 1) {
            if (localProgress < fadeBand) op = 1 - localProgress / fadeBand;
            else if (!curReady) op = 0.95;
          } else if (i === segIndex + 1 && localProgress > 1 - fadeBand) {
            op = (localProgress - (1 - fadeBand)) / fadeBand;
          }
          if (!animating && Math.abs(i - segIndex) > NEIGHBOR_RADIUS + 1) op = 0;
          gsap.set(el, { autoAlpha: op });
          el.style.zIndex =
            i === segIndex ? '5' : i === segIndex - 1 && !curReady ? '4' : String(1 + Math.round(op * 3));
        });

        return { segIndex, localProgress };
      };

      /** 影片 seek（節流） */
      const applyVideo = (rawUnits, { force = false } = {}) => {
        const { segIndex, localProgress } = resolveUnits(rawUnits);
        const pathPosActive = hopPath.length ? hopPath.indexOf(segIndex) : -1;

        slots.forEach((slot) => {
          if (!slot.clip) return;
          const onHopPath =
            animating &&
            ((slot.index >= hopKeepFrom && slot.index <= hopKeepTo) ||
              hopAlsoKeep.includes(slot.index));
          if (!onHopPath && Math.abs(slot.index - segIndex) > NEIGHBOR_RADIUS) return;

          let targetProgress;
          if (slot.index === segIndex) {
            targetProgress = localProgress;
          } else if (pathPosActive >= 0) {
            const pathPos = hopPath.indexOf(slot.index);
            if (pathPos < 0) targetProgress = slot.index < segIndex ? 1 : 0;
            else if (pathPos < pathPosActive) targetProgress = 1;
            else targetProgress = 0;
          } else {
            targetProgress = slot.index < segIndex ? 1 : 0;
          }
          scrubSlot(slot, targetProgress, { force });
        });
      };

      const applyUnits = (rawUnits, { forceSeek = false } = {}) => {
        applyVisual(rawUnits);
        applyVideo(rawUnits, { force: forceSeek });
      };

      // 島際動畫：視覺每幀、影片 ~24fps
      let lastHopSeekAt = 0;
      const hopTick = () => {
        applyVisual(progressState.units);
        const now = performance.now();
        if (now - lastHopSeekAt >= SEEK_MIN_INTERVAL_MS) {
          lastHopSeekAt = now;
          applyVideo(progressState.units);
        }
      };

      const hopDuration = (distanceUnits) => {
        if (prefersReduced) return 0.05;
        const t = AUTO_HOP_MIN_SEC + Math.abs(distanceUnits) * 0.55;
        return clamp(t, AUTO_HOP_MIN_SEC, AUTO_HOP_MAX_SEC);
      };

      const autoToSection = (nextIndex, options = {}) => {
        if (animating) return;
        const n = sections.length;
        if (nextIndex === sectionIndex) return;
        const speedMultiplier = Number.isFinite(options.speedMultiplier)
          ? Math.max(0.1, options.speedMultiplier)
          : 1;
        const wrapped = ((nextIndex % n) + n) % n;

        const start = progressState.units;
        const wrapForward = sectionIndex === n - 1 && wrapped === 0 && nextIndex > sectionIndex;
        const wrapBack = sectionIndex === 0 && wrapped === n - 1 && nextIndex < sectionIndex;
        const goingForward = nextIndex > sectionIndex || wrapForward;
        // 往前落地自由區前緣；往後落地自由區後緣（與 tween 終點一致，避免播完再 snip）
        let end = goingForward ? zones[wrapped].start : zones[wrapped].end;
        let duration = hopDuration(Math.abs(end - start)) / speedMultiplier;

        if (wrapForward) {
          // 走出最後 dive → conn-wrap → 進入第一 dive 自由區（與一般 hop 同一套 scrub）
          end = totalWeight + zones[0].start;
          duration = prefersReduced
            ? 0.05
            : Math.max(AUTO_WRAP_SEC / speedMultiplier, hopDuration(end - start) / speedMultiplier);
        } else if (wrapBack) {
          progressState.units = totalWeight + zones[0].start;
          end = zones[n - 1].end;
          duration = prefersReduced
            ? 0.05
            : Math.max(
                AUTO_WRAP_SEC / speedMultiplier,
                hopDuration(Math.abs(end - progressState.units)) / speedMultiplier,
              );
        }

        animating = true;
        root.classList.add('is-animating');
        root.classList.remove('is-free-scrub');
        setHintMode('explore');
        dismissHint();

        const fromDiveIdx = segments.findIndex(
          (s) => s.kind === 'dive' && s.sectionIndex === sectionIndex,
        );
        const targetDiveIdx = segments.findIndex(
          (s) => s.kind === 'dive' && s.sectionIndex === wrapped,
        );
        const wrapConnIdx = segments.findIndex((s) => s.wrap);

        if (wrapForward || wrapBack) {
          // 路徑不連續：最後 dive + wrap conn + 第一 dive
          hopKeepFrom = Math.min(fromDiveIdx, segments.length - 1);
          hopKeepTo = Math.max(fromDiveIdx, segments.length - 1);
          hopAlsoKeep = [fromDiveIdx, targetDiveIdx, wrapConnIdx].filter((i) => i >= 0);
          // 時間軸：離開島 → wrap conn → 抵達島（forward / back 皆同）
          hopPath = [fromDiveIdx, wrapConnIdx, targetDiveIdx].filter((i) => i >= 0);
        } else {
          hopKeepFrom = Math.min(
            activeSegIndex,
            fromDiveIdx >= 0 ? fromDiveIdx : activeSegIndex,
            targetDiveIdx >= 0 ? targetDiveIdx : activeSegIndex,
          );
          hopKeepTo = Math.max(
            activeSegIndex,
            fromDiveIdx >= 0 ? fromDiveIdx : activeSegIndex,
            targetDiveIdx >= 0 ? targetDiveIdx : activeSegIndex,
          );
          hopAlsoKeep = [];
          hopPath = [];
          for (let i = hopKeepFrom; i <= hopKeepTo; i += 1) hopPath.push(i);
        }
        syncLoadedNeighbors(activeSegIndex, {
          keepFrom: hopKeepFrom,
          keepTo: hopKeepTo,
          alsoKeep: hopAlsoKeep,
        });

        // 接縫預對準：目標 dive 往前→開頭、往後→結尾；路徑中段 connector 對齊進出側
        const landUnits = goingForward ? zones[wrapped].start : zones[wrapped].end;
        if (targetDiveIdx >= 0) {
          const targetProgress = goingForward
            ? 0
            : diveLocalAtUnits(targetDiveIdx, landUnits % totalWeight || landUnits);
          // 倒轉進入上一島時，先停在 dive 尾端接縫（≈1），再 scrub 回自由區後緣
          primeSlotProgress(
            slots[targetDiveIdx],
            goingForward ? 0 : Math.max(targetProgress, 0.985),
          );
        }
        hopPath.forEach((idx) => {
          if (idx === fromDiveIdx || idx === targetDiveIdx) return;
          // connector：往前從 0 開始，往後從 1 開始
          primeSlotProgress(slots[idx], goingForward ? 0 : 0.999);
        });
        // 當下片段也 force 一次，清掉 pending 落差
        applyVideo(progressState.units, { force: true });

        gsap.killTweensOf(progressState);
        lastHopSeekAt = 0;
        gsap.to(progressState, {
          units: end,
          duration,
          ease: 'power1.inOut',
          onUpdate: hopTick,
          onComplete: () => {
            // tween 終點已是正確落地點；再正規化一次避免 float 誤差
            const land = goingForward ? zones[wrapped].start : zones[wrapped].end;
            progressState.units = land;
            sectionIndex = wrapped;
            animating = false;
            hopKeepFrom = activeSegIndex;
            hopKeepTo = activeSegIndex;
            hopAlsoKeep = [];
            hopPath = [];
            applyUnits(progressState.units, { forceSeek: true });
            prefetchNeighborPaths(sectionIndex);
            root.classList.remove('is-animating');
            root.classList.add('is-free-scrub');
            setHintMode('free');
          },
        });
      };

      const jumpToSection = (targetIndex) => {
        if (!Number.isInteger(targetIndex)) return;
        if (targetIndex === sectionIndex) {
          const zone = zones[targetIndex];
          progressState.units = zone.start;
          applyUnits(progressState.units, { forceSeek: true });
          dismissHint();
          return;
        }
        const total = sections.length;
        const forward = (targetIndex - sectionIndex + total) % total;
        const backward = forward - total;
        const shortestDelta = Math.abs(backward) < Math.abs(forward) ? backward : forward;
        dismissHint();
        autoToSection(sectionIndex + shortestDelta, { speedMultiplier: 2.5 });
      };

      applyUnits(0, { forceSeek: true });
      setHintMode('explore');

      let enterStarted = false;
      let enterTimer = 0;
      let enterPollRaf = 0;
      let enterPaintRaf = 0;

      const startEnterTween = () => {
        if (enterStarted) return;
        enterStarted = true;
        if (enterTimer) {
          clearTimeout(enterTimer);
          enterTimer = 0;
        }
        if (enterPollRaf) {
          cancelAnimationFrame(enterPollRaf);
          enterPollRaf = 0;
        }
        if (enterPaintRaf) {
          cancelAnimationFrame(enterPaintRaf);
          enterPaintRaf = 0;
        }

        animating = true;
        root.classList.add('is-animating');
        progressState.units = 0;
        applyUnits(0, { forceSeek: true });
        lastHopSeekAt = 0;
        gsap.to(progressState, {
          units: zones[0].start,
          duration: AUTO_ENTER_SEC,
          ease: 'power1.out',
          onUpdate: hopTick,
          onComplete: () => {
            sectionIndex = 0;
            applyUnits(progressState.units, { forceSeek: true });
            animating = false;
            prefetchNeighborPaths(0);
            root.classList.remove('is-animating');
            root.classList.add('is-free-scrub');
            setHintMode('free');
          },
        });
      };

      const isFirstDiveReady = () => {
        const slot = slots[0];
        if (!slot?.clip) return true;
        const v = slot.video;
        if (!v || !v.getAttribute('src')) return false;
        if (!Number.isFinite(v.duration) || v.duration <= 0) return false;
        if (v.readyState < 2) return false;
        if (v.seeking) return false;
        return slot.ready || segEls[0]?.classList.contains('has-clip');
      };

      if (prefersReduced) {
        progressState.units = zones[0].start;
        applyUnits(progressState.units, { forceSeek: true });
        sectionIndex = 0;
        prefetchNeighborPaths(0);
        root.classList.add('is-free-scrub');
        setHintMode('free');
      } else {
        // 進場前只保活第一支 dive，避免跟鄰居搶頻寬／解碼；ready 後再 tween
        animating = true;
        root.classList.add('is-animating');
        syncLoadedNeighbors(0);
        primeSlotProgress(slots[0], 0);

        const pollEnterReady = () => {
          if (enterStarted) return;
          if (isFirstDiveReady()) {
            // 等兩幀讓首幀真正畫上，再開始 scrub
            enterPaintRaf = requestAnimationFrame(() => {
              enterPaintRaf = requestAnimationFrame(() => {
                startEnterTween();
              });
            });
            return;
          }
          enterPollRaf = requestAnimationFrame(pollEnterReady);
        };
        enterPollRaf = requestAnimationFrame(pollEnterReady);
        enterTimer = window.setTimeout(() => {
          startEnterTween();
        }, ENTER_READY_TIMEOUT_MS);
      }

      const scrubGain = () =>
        (freeSpan / 480) * (window.matchMedia('(max-width: 860px)').matches ? 1.35 : 1);

      let scrubRaf = 0;
      const flushScrub = () => {
        scrubRaf = 0;
        applyUnits(progressState.units);
      };
      const queueScrub = () => {
        if (scrubRaf) return;
        scrubRaf = requestAnimationFrame(flushScrub);
      };

      const onWheel = (e) => {
        e.preventDefault();
        if (animating) return;

        const dy = e.deltaY;
        if (Math.abs(dy) < 2) return;
        dismissHint();

        const zone = zones[sectionIndex];
        const delta = dy * scrubGain();
        const next = progressState.units + delta;

        if (dy > 0) {
          if (next <= zone.end + 0.0001) {
            progressState.units = clamp(next, zone.start, zone.end);
            root.classList.add('is-free-scrub');
            queueScrub();
            return;
          }
          autoToSection(sectionIndex + 1);
          return;
        }

        if (next >= zone.start - 0.0001) {
          progressState.units = clamp(next, zone.start, zone.end);
          root.classList.add('is-free-scrub');
          queueScrub();
          return;
        }
        autoToSection(sectionIndex - 1);
      };

      let touchY = null;
      let touchAcc = 0;
      const onTouchStart = (e) => {
        touchY = e.touches[0]?.clientY ?? null;
        touchAcc = 0;
      };
      const onTouchMove = (e) => {
        if (touchY == null || animating) return;
        const y = e.touches[0]?.clientY;
        if (y == null) return;
        const dy = touchY - y;
        touchY = y;
        touchAcc += dy;
        if (Math.abs(touchAcc) < 10) return;
        const fake = { preventDefault() {}, deltaY: touchAcc };
        touchAcc = 0;
        onWheel(fake);
      };
      const onTouchEnd = () => {
        touchY = null;
        touchAcc = 0;
      };

      const onKeyDown = (e) => {
        if (animating) return;
        const zone = zones[sectionIndex];
        const step = freeSpan * 0.22;
        if (['ArrowDown', 'PageDown'].includes(e.key)) {
          e.preventDefault();
          if (progressState.units + step <= zone.end) {
            progressState.units = Math.min(zone.end, progressState.units + step);
            applyUnits(progressState.units);
          } else {
            autoToSection(sectionIndex + 1);
          }
        } else if (['ArrowUp', 'PageUp'].includes(e.key)) {
          e.preventDefault();
          if (progressState.units - step >= zone.start) {
            progressState.units = Math.max(zone.start, progressState.units - step);
            applyUnits(progressState.units);
          } else {
            autoToSection(sectionIndex - 1);
          }
        } else if (e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          autoToSection(sectionIndex + 1);
        }
      };

      const onHintActivate = () => {
        if (animating) return;
        const zone = zones[sectionIndex];
        const mid = (zone.start + zone.end) / 2;
        if (progressState.units < mid) {
          progressState.units = zone.end;
          applyUnits(progressState.units, { forceSeek: true });
        } else {
          autoToSection(sectionIndex + 1);
        }
      };

      const onJumpClick = (e) => {
        if (animating) return;
        const raw = e.currentTarget?.dataset?.swtJump;
        const targetIndex = Number.parseInt(raw ?? '', 10);
        if (!Number.isNaN(targetIndex)) jumpToSection(targetIndex);
      };

      root.addEventListener('wheel', onWheel, { passive: false });
      root.addEventListener('touchstart', onTouchStart, { passive: true });
      root.addEventListener('touchmove', onTouchMove, { passive: true });
      root.addEventListener('touchend', onTouchEnd, { passive: true });
      window.addEventListener('keydown', onKeyDown);
      hint?.addEventListener('click', onHintActivate);
      jumpItems.forEach((item) => item.addEventListener('click', onJumpClick));

      const prime = () => {
        slots.forEach((slot) => {
          if (!slot.video?.src || !slot.video.play) return;
          try {
            const p = slot.video.play();
            if (p?.then) {
              p.then(() => {
                try {
                  slot.video.pause();
                } catch (_) {
                  /* ignore */
                }
              }).catch(() => {});
            }
          } catch (_) {
            /* ignore */
          }
        });
      };
      window.addEventListener('pointerdown', prime, { once: true, passive: true });

      return () => {
        document.documentElement.classList.remove('swt-lock-scroll');
        document.body.classList.remove('swt-lock-scroll');
        enterStarted = true;
        if (enterTimer) clearTimeout(enterTimer);
        if (enterPollRaf) cancelAnimationFrame(enterPollRaf);
        if (enterPaintRaf) cancelAnimationFrame(enterPaintRaf);
        gsap.killTweensOf(progressState);
        if (scrubRaf) cancelAnimationFrame(scrubRaf);
        root.removeEventListener('wheel', onWheel);
        root.removeEventListener('touchstart', onTouchStart);
        root.removeEventListener('touchmove', onTouchMove);
        root.removeEventListener('touchend', onTouchEnd);
        window.removeEventListener('keydown', onKeyDown);
        hint?.removeEventListener('click', onHintActivate);
        jumpItems.forEach((item) => item.removeEventListener('click', onJumpClick));
        window.removeEventListener('pointerdown', prime);
        slots.forEach((slot) => {
          if (!slot.video) return;
          if (slot._seeked) slot.video.removeEventListener('seeked', slot._seeked);
          if (slot._loaded) slot.video.removeEventListener('loadeddata', slot._loaded);
          unloadSlot(slot);
        });
      };
    },
    { scope: rootRef, dependencies: [sections, connectors, videoRefs] },
  );

  return { rootRef };
}
