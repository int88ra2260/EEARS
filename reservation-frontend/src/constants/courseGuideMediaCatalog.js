/**
 * 修課說明／媒體庫 catalog 種子（後端 MediaAssets 會同步相同資料）
 * 前端僅作新增 figure 區塊的預設值；實際挑選以媒體庫 API 為準。
 */

/** @type {MediaAssetRef[]} */
export const COURSE_GUIDE_MEDIA_CATALOG = [
  {
    id: 'catalog:diagram-112-115',
    url: '/images/course-guide/diagram-112-115.jpg',
    label: '112–115 學年度流程圖',
    source: 'catalog',
    mime: 'image/jpeg',
  },
  {
    id: 'catalog:diagram-110',
    url: '/images/course-guide/diagram-110.png',
    label: '110 學年度流程圖',
    source: 'catalog',
    mime: 'image/png',
  },
];

export function findCatalogAssetByUrl(url) {
  if (!url) return null;
  return COURSE_GUIDE_MEDIA_CATALOG.find((a) => a.url === url) || null;
}

/**
 * 正規化選取結果（blocks / 未來媒體庫都吃這份）
 * @param {MediaAssetRef|null} asset
 */
export function toMediaSelection(asset) {
  if (!asset?.url) return { url: '', mediaId: null };
  return {
    url: asset.url,
    mediaId: asset.id || null,
  };
}
