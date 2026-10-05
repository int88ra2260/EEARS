import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Time24Input, { formatTime24Input } from './Time24Input';

describe('formatTime24Input', () => {
  test('把連續數字收成 24 小時制', () => {
    expect(formatTime24Input('')).toBe('');
    expect(formatTime24Input('16')).toBe('16');
    expect(formatTime24Input('1600')).toBe('16:00');
    expect(formatTime24Input('9:5')).toBe('9:5');
    expect(formatTime24Input('9:05')).toBe('09:05');
    expect(formatTime24Input('16:00:00')).toBe('16:00');
    expect(formatTime24Input('下午 12:00')).toBe('12:00');
  });
});

function Harness() {
  const [value, setValue] = useState('12:00');
  return <Time24Input value={value} onChange={setValue} required />;
}

describe('Time24Input', () => {
  test('顯示 24 小時制，輸入數字會補上冒號', () => {
    render(<Harness />);
    const input = screen.getByTitle('24 小時制，例如 16:00');
    expect(input).toHaveValue('12:00');
    expect(input).toHaveAttribute('type', 'text');

    fireEvent.change(input, { target: { value: '1655' } });
    expect(input).toHaveValue('16:55');
  });
});
