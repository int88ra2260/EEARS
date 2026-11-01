import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { formatAttendanceCell } from './classBestepDisplayHelpers';

function textOf(attendance) {
  const { container } = render(<>{formatAttendanceCell(attendance)}</>);
  return container.textContent;
}

describe('formatAttendanceCell legacy display', () => {
  test('renders confirmed present and confirmed absent', () => {
    expect(textOf({ L: { attended: true } })).toContain('L: 出席');
    expect(textOf({ L: { attended: false } })).toContain('L: 缺席');
  });

  test('renders unknown attendance as absent in the current UI', () => {
    expect(textOf({ L: { attended: null } })).toContain('L: 缺席');
    expect(textOf({ L: {} })).toContain('L: 缺席');
    expect(screen.queryByText('未知')).toBeNull();
  });

  test('renders a missing attendance record as not imported', () => {
    expect(textOf(undefined)).toContain('未匯入');
    expect(textOf(null)).toContain('未匯入');
    expect(textOf({})).toContain('未匯入');
  });
});
