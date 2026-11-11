import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import ToastMessage from './ToastMessage';

describe('ToastMessage', () => {
  test('warning 使用白字與白色關閉鈕，文案與關閉行為保留', () => {
    const onClose = vi.fn();
    render(
      <ToastMessage show message="請先完成必填欄位" variant="warning" onClose={onClose} />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('請先完成必填欄位');
    expect(alert.className).toContain('bg-warning');
    expect(alert.className).toContain('text-white');
    expect(alert.className).not.toContain('text-dark');

    const close = screen.getByRole('button', { name: '關閉' });
    expect(close.className).toContain('btn-close-white');
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['success', 'bg-success'],
    ['danger', 'bg-danger'],
    ['info', 'bg-info'],
  ])('%s 維持白字與白色關閉鈕', (variant, background) => {
    render(<ToastMessage show message="完成" variant={variant} onClose={() => {}} />);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain(background);
    expect(alert.className).toContain('text-white');
    expect(alert.className).not.toContain('text-dark');
    expect(screen.getByRole('button', { name: '關閉' }).className).toContain('btn-close-white');
  });
});
