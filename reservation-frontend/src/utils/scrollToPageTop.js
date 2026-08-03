/**
 * 將視窗捲回頁面頂端（路由切換、開始遊戲等）。
 * 使用 instant 避免與全域 scroll-behavior: smooth 疊加造成延遲感。
 */
export function scrollToPageTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

  const main = document.getElementById('main-content');
  if (main && main.scrollTop > 0 && typeof main.scrollTo === 'function') {
    main.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }
}
