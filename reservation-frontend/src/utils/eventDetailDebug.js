/**
 * 活動明細頁最小觀測點（僅開發環境 console.debug）
 */
export function debugEventDetail(tag, payload) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[EEARS EventDetail]', tag, payload ?? '');
  }
}
