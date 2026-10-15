import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
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

  test('shows the last saved sentence for a practiced question', () => {
    render(
      <MemoryRouter>
        <EnglishTableTopicPanel
          date="2026-10-05"
          eventType="english_table"
          defaultOpen
          practiceByQuestion={{
            1: {
              heard: 'I bought a book online.',
              say: 'I bought a book online because ______.',
              phraseId: 'pb_et_009',
            },
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('看上次的說法')).toBeInTheDocument();
    expect(screen.getByText('I bought a book online.')).toBeInTheDocument();
    expect(screen.getByText('I bought a book online because ______.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '打開這張句庫卡' })).toHaveAttribute(
      'href',
      '/guides/activity-phrasebook/english-table#pb_et_009',
    );
  });
});
