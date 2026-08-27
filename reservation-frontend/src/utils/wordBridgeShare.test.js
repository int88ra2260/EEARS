import { MAX_MISTAKES, computeWordBridgeResult } from '../data/wordBridgePuzzles';
import { buildWordBridgeSharePayload, formatGameDuration } from './wordBridgeShare';

describe('wordBridgeShare', () => {
  const t = (key) => ({
    'wordBridge.shareTitle': '語彙連橋測驗結果',
    'wordBridge.shareText': '我在國立中山大學全英語卓越教學中心「語彙連橋」測到約 {{level}} 層級（遊玩 {{duration}}、錯誤 {{mistakes}}/{{max}}）。你也來試試！{{url}}',
  }[key] || key);

  test('formatGameDuration formats zh and en', () => {
    expect(formatGameDuration(65000, 'zh')).toBe('1 分 5 秒');
    expect(formatGameDuration(8000, 'en')).toBe('8s');
  });

  test('buildWordBridgeSharePayload includes level, duration, mistakes, and center copy', () => {
    const result = computeWordBridgeResult({
      endReason: 'mistakes',
      failLevel: 'B1',
      passedLevels: ['A1', 'A2'],
      totalMistakes: 5,
      durationMs: 222000,
    });

    const payload = buildWordBridgeSharePayload({
      result,
      lang: 'zh',
      t,
      origin: 'https://example.com',
    });

    expect(payload.url).toBe('https://example.com/practice/word-bridge');
    expect(payload.text).toContain('A2');
    expect(payload.text).toContain('國立中山大學全英語卓越教學中心');
    expect(payload.text).toContain('3 分 42 秒');
    expect(payload.text).toContain(`5/${MAX_MISTAKES}`);
  });
});
