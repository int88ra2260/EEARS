import { useMemo } from 'react';
import { getSessionShuffledItems } from '../utils/sessionShuffle';

/**
 * 同一瀏覽分頁內維持穩定的洗牌順序（用於活動介紹等）。
 */
export default function useSessionShuffled(items, sessionKey) {
  return useMemo(
    () => getSessionShuffledItems(items, sessionKey),
    // items 為常數陣列；sessionKey 變更時重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionKey, items.length],
  );
}
