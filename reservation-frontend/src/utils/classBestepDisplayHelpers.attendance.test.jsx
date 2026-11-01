import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { formatAttendanceCell } from './classBestepDisplayHelpers';

function textOf(attendance) {
  const { container } = render(<>{formatAttendanceCell(attendance)}</>);
  return container.textContent;
}

describe('formatAttendanceCell tri-state display', () => {
  test('keeps confirmed present and confirmed absent', () => {
    expect(textOf({ L: { attended: true } })).toContain('L: 出席');
    expect(textOf({ R: { attended: false } })).toContain('R: 缺席');
    expect(textOf({ S: { attended: true } })).toContain('S: 出席');
    expect(textOf({ W: { attended: false } })).toContain('W: 缺席');
    expect(textOf({ LR: { attended: true } })).toContain('LR: 出席');
    expect(textOf({ SW: { attended: false } })).toContain('SW: 缺席');
  });

  test('does not present unknown attendance as confirmed absence', () => {
    expect(textOf({ L: { attended: null } })).toContain('L: 未確認');
    expect(textOf({ L: { attended: null } })).not.toContain('缺席');
    expect(textOf({ R: {} })).toContain('R: 未確認');
    expect(textOf({ S: { attended: undefined } })).toContain('S: 未確認');
    expect(textOf({ W: { attended: undefined } })).not.toContain('缺席');
  });

  test('keeps a missing attendance record as not imported and does not guess registration or exemption', () => {
    ['', textOf(undefined), textOf(null), textOf({})].forEach((text) => {
      if (!text) return;
      expect(text).toContain('未匯入');
      expect(text).not.toContain('缺席');
      expect(text).not.toContain('不適用');
      expect(text).not.toContain('抵免');
    });
  });
});
