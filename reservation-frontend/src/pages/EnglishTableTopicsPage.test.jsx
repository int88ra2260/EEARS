import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import EnglishTableTopicsPage from './EnglishTableTopicsPage';

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({
    lang: 'zh',
    t: (path, vars) => {
      if (path === 'booking.etTopicWeek') return `第 ${vars.week} 週`;
      if (path === 'etTopics.pageTitle') return '本學期主題與題目';
      if (path === 'etTopics.thisWeek') return '本週';
      if (path === 'booking.etFormatConversation') return '口說問答';
      if (path === 'booking.etFormatChart') return '圖表討論';
      if (path === 'booking.etFormatPassage') return '短文與圖表';
      if (path === 'booking.etFormatDiscussion') return '主題討論';
      if (path === 'booking.etFormatHoliday') return '國定假日';
      if (path === 'booking.etTopicHoliday') return '本日為國定假日';
      if (path === 'booking.etTopicChartNote') return '圖表在活動現場提供';
      if (path === 'booking.etTopicPassageLabel') return '短文';
      return path;
    },
  }),
}));

describe('EnglishTableTopicsPage', () => {
  test('lists every semester topic, including sessions that are not open for booking', () => {
    render(
      <MemoryRouter>
        <EnglishTableTopicsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '本學期主題與題目' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(40);
    expect(screen.getByText('Online Shopping')).toBeInTheDocument();
    expect(screen.getByText('Building a Better Campus')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'etTopics.backToEnglishTable' })).toHaveAttribute(
      'href',
      '/activities/english-table',
    );
  });
});
