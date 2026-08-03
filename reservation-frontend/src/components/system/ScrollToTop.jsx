import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollToPageTop } from '../../utils/scrollToPageTop';

/**
 * 路由 pathname / search 變更時捲回頂端；保留 hash 錨點導向。
 */
export default function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ block: 'start' });
        return;
      }
    }

    scrollToPageTop();
  }, [location.pathname, location.search, location.hash]);

  return null;
}
