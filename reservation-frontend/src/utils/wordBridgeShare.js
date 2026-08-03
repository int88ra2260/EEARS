import { MAX_MISTAKES } from '../data/wordBridgePuzzles';

/**
 * @param {number} durationMs
 * @param {'zh'|'en'} lang
 */
export function formatGameDuration(durationMs, lang = 'zh') {
  const totalSec = Math.max(1, Math.round((durationMs || 0) / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;

  if (lang === 'en') {
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }
  return minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;
}

/**
 * @param {string} tpl
 * @param {Record<string, string | number>} vars
 */
function fillTemplate(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ''));
}

/**
 * @param {{
 *   result: { estimatedLevel: string, stats: { totalMistakes: number, durationMs?: number, maxMistakes?: number } },
 *   lang: 'zh' | 'en',
 *   t: (key: string) => string,
 *   origin?: string,
 * }} options
 */
export function buildWordBridgeSharePayload({ result, lang, t, origin = '' }) {
  const duration = formatGameDuration(result.stats.durationMs, lang);
  const mistakes = result.stats.totalMistakes ?? 0;
  const max = result.stats.maxMistakes ?? MAX_MISTAKES;
  const url = `${origin.replace(/\/$/, '')}/activities/word-bridge`;

  const text = fillTemplate(t('wordBridge.shareText'), {
    level: result.estimatedLevel,
    duration,
    mistakes,
    max,
    url,
  });

  return {
    title: t('wordBridge.shareTitle'),
    text,
    url,
  };
}

/**
 * @param {{ title: string, text: string, url: string }} payload
 * @returns {Promise<'shared' | 'copied'>}
 */
export async function shareWordBridgeResult(payload) {
  const shareBody = payload.text.includes(payload.url)
    ? payload.text
    : `${payload.text}\n${payload.url}`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: payload.title,
        text: shareBody,
        url: payload.url,
      });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw error;
      }
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(shareBody);
    return 'copied';
  }

  throw new Error('share_unavailable');
}
