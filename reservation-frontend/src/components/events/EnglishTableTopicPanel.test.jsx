import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import EnglishTableTopicPanel from './EnglishTableTopicPanel';

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (path, vars) => {
      if (path === 'booking.etTopicWeek') return `第 ${vars.week} 週`;
      if (path === 'booking.etFormatConversation') return '口說問答';
      if (path === 'booking.etTopicLabel') return '主題';
      return path;
    },
  }),
}));

describe('EnglishTableTopicPanel', () => {
  test('shows the session topic and questions for an English Table date', () => {
    render(
      <EnglishTableTopicPanel
        date="2026-10-05"
        eventType="english_table"
        defaultOpen
      />,
    );

    expect(screen.getByText('Online Shopping')).toBeInTheDocument();
    expect(screen.getByText(/bought online recently/)).toBeInTheDocument();
    expect(screen.getByText('口說問答 · 第 5 週')).toBeInTheDocument();
  });

  test('stays hidden for other activity types on the same date', () => {
    const { container } = render(
      <EnglishTableTopicPanel
        date="2026-10-05"
        eventType="english_club"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
