import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import ReservationUsageModal from './ReservationUsageModal';

const state = vi.hoisted(() => ({ lang: 'zh' }));

const copy = {
  zh: {
    'home.usageButtonPrimary': '我知道了',
    'home.usageButtonSecondary': 'Noted',
    'home.usageTitle': '預約系統使用說明',
  },
  en: {
    'home.usageButtonPrimary': 'Got it',
    'home.usageButtonSecondary': 'Noted',
    'home.usageTitle': 'Reservation System Guide',
  },
};

vi.mock('../../hooks/useMediaQuery', () => ({
  default: () => false,
}));

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({
    lang: state.lang,
    t: (key) => copy[state.lang][key] ?? key,
  }),
}));

describe('reservation usage dialog labels', () => {
  beforeEach(() => {
    state.lang = 'zh';
  });

  test('Chinese shows one confirm label and Escape closes the dialog', () => {
    const onClose = vi.fn();
    render(<ReservationUsageModal show onClose={onClose} />);
    const button = screen.getByRole('button', { name: '我知道了' });
    expect(button).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Noted/ })).toBeNull();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'usage-modal-title');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('English uses the English confirm label', () => {
    state.lang = 'en';
    render(<ReservationUsageModal show onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Noted/ })).toBeNull();
  });
});
