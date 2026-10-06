import { describe, expect, test } from 'vitest';
import {
  diagnosticsQueueLabel,
  diagnosticsQueueStatusLabel,
  diagnosticsServiceLabel,
} from './InternalDiagnosticsPage';

describe('系統診斷標籤', () => {
  test('服務與佇列使用中文名稱', () => {
    expect(diagnosticsServiceLabel('mysql')).toBe('資料庫');
    expect(diagnosticsServiceLabel('smtp_reservation')).toBe('預約郵件');
    expect(diagnosticsQueueLabel('emailQueue')).toBe('郵件佇列');
    expect(diagnosticsQueueLabel('customQueue')).toBe('customQueue');
  });

  test('佇列狀態不直接顯示顏色代碼', () => {
    expect(diagnosticsQueueStatusLabel('green')).toBe('正常');
    expect(diagnosticsQueueStatusLabel('yellow')).toBe('注意');
    expect(diagnosticsQueueStatusLabel('red')).toBe('異常');
  });
});
