/**
 * Scroll World 多包輪播 — 同四島敘事（活動／修課／學習／其他）
 *
 * 首頁輪換：clay / papercraft / soft-dusk / glossy-toy
 * Neon 保留預覽用，不進首頁（調性差太大）
 */
import {
  SCROLL_WORLD_CONNECTORS,
  SCROLL_WORLD_SECTIONS,
} from './scrollWorldTestConfig';

export const HOME_SW_PACK_ROTATION_KEY = 'eears-home-sw-pack-idx';

/** 正式首頁啟用的包（日間／暖色調一致） */
export const HOME_SCROLL_WORLD_PACK_IDS = ['clay', 'papercraft', 'soft-dusk', 'glossy-toy'];

const SECTION_META = SCROLL_WORLD_SECTIONS.map(({ id, label, accent, title, body, scroll, linger, cta }) => ({
  id,
  label,
  accent,
  title,
  body,
  scroll,
  linger,
  cta,
}));

function buildPackSections(assetBase, dioramaPrefix = null) {
  return SECTION_META.map((meta) => ({
    ...meta,
    diorama: dioramaPrefix ? `${dioramaPrefix}-${meta.id}` : meta.id,
    clip: `${assetBase}/${meta.id}.mp4`,
    still: `${assetBase}/${meta.id}.webp`,
  }));
}

function buildPackConnectors(assetBase, count = 4) {
  return Array.from({ length: count }, (_, i) => `${assetBase}/conn${i + 1}.mp4`);
}

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   style: string,
 *   bg: string,
 *   ink: string,
 *   inkSoft: string,
 *   sections: object[],
 *   connectors: string[],
 * }} ScrollWorldPack
 */

/** @type {ScrollWorldPack[]} */
export const SCROLL_WORLD_PACKS = [
  {
    id: 'clay',
    label: 'Clay',
    style: 'soft matte clay diorama',
    bg: '#f5ede0',
    ink: '#241d2b',
    inkSoft: '#6a6072',
    sections: SCROLL_WORLD_SECTIONS,
    connectors: SCROLL_WORLD_CONNECTORS,
  },
  {
    id: 'papercraft',
    label: 'Papercraft',
    style: 'flat papercraft',
    bg: '#f7f9fc',
    ink: '#1c3d6e',
    inkSoft: '#5a6169',
    sections: buildPackSections('/videos/scroll-world-papercraft'),
    connectors: buildPackConnectors('/videos/scroll-world-papercraft'),
  },
  {
    id: 'soft-dusk',
    label: 'Soft Dusk',
    style: 'soft dusk golden-hour clay',
    bg: '#f3ebe3',
    ink: '#2f3437',
    inkSoft: '#6a6169',
    sections: buildPackSections('/videos/scroll-world-soft-dusk'),
    connectors: buildPackConnectors('/videos/scroll-world-soft-dusk'),
  },
  {
    id: 'glossy-toy',
    label: 'Glossy Toy',
    style: 'glossy vinyl-toy diorama',
    bg: '#f7f9fc',
    ink: '#1c3d6e',
    inkSoft: '#5a6169',
    sections: buildPackSections('/videos/scroll-world-glossy-toy'),
    connectors: buildPackConnectors('/videos/scroll-world-glossy-toy'),
  },
  {
    id: 'neon',
    label: 'Neon Night',
    style: 'neon night miniature',
    bg: '#0b1220',
    ink: '#e8eef7',
    inkSoft: '#a8b4c8',
    sections: buildPackSections('/videos/scroll-world-neon'),
    connectors: buildPackConnectors('/videos/scroll-world-neon'),
  },
];

export function getScrollWorldPack(packId = 'clay') {
  return SCROLL_WORLD_PACKS.find((p) => p.id === packId) || SCROLL_WORLD_PACKS[0];
}

export function listScrollWorldPackIds() {
  return SCROLL_WORLD_PACKS.map((p) => p.id);
}

/**
 * 正式首頁：讀取並推進輪換索引，回傳本次應使用的 packId。
 */
export function takeNextHomeScrollWorldPackId(enabledIds = HOME_SCROLL_WORLD_PACK_IDS) {
  const ids = Array.isArray(enabledIds) && enabledIds.length
    ? enabledIds.filter((id) => SCROLL_WORLD_PACKS.some((p) => p.id === id))
    : HOME_SCROLL_WORLD_PACK_IDS;
  const safeIds = ids.length ? ids : ['clay'];

  let idx = 0;
  try {
    const raw = localStorage.getItem(HOME_SW_PACK_ROTATION_KEY);
    const parsed = Number.parseInt(raw || '0', 10);
    idx = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch (_) {
    idx = 0;
  }

  const packId = safeIds[idx % safeIds.length];
  try {
    localStorage.setItem(HOME_SW_PACK_ROTATION_KEY, String((idx + 1) % safeIds.length));
  } catch (_) {
    /* ignore */
  }
  return packId;
}
