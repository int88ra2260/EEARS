import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import EventCalendarSection from './EventCalendarSection';

const state = vi.hoisted(() => ({ lang: 'zh' }));

vi.mock('@fullcalendar/react', () => ({
  default: React.forwardRef((props, _ref) => (
    <div
      data-testid="calendar"
      data-today={props.buttonText?.today}
      data-prev={typeof props.buttonHints?.prev === 'function' ? props.buttonHints.prev('月', 'month') : props.buttonHints?.prev}
      data-next={typeof props.buttonHints?.next === 'function' ? props.buttonHints.next('月', 'month') : props.buttonHints?.next}
      data-prev-week={typeof props.buttonHints?.prev === 'function' ? props.buttonHints.prev('週', 'week') : ''}
      data-next-week={typeof props.buttonHints?.next === 'function' ? props.buttonHints.next('週', 'week') : ''}
      data-locale={typeof props.locale === 'string' ? props.locale : props.locale?.code}
    />
  )),
}));

vi.mock('@fullcalendar/daygrid', () => ({ default: {} }));
vi.mock('@fullcalendar/list', () => ({ default: {} }));
vi.mock('../../hooks/useMediaQuery', () => ({ default: () => false }));
vi.mock('../ui/useToast', () => ({ default: () => vi.fn() }));
vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ lang: state.lang }),
}));

function t(key) {
  const zh = {
    'home.today': '今天',
    'home.prevMonth': '上個月',
    'home.nextMonth': '下個月',
    'home.prevWeek': '上週',
    'home.nextWeek': '下週',
    'home.month': '月',
    'home.list': '清單',
  };
  const en = {
    'home.today': 'Today',
    'home.prevMonth': 'Previous month',
    'home.nextMonth': 'Next month',
    'home.prevWeek': 'Previous week',
    'home.nextWeek': 'Next week',
    'home.month': 'Month',
    'home.list': 'List',
  };
  return (state.lang === 'en' ? en : zh)[key] || key;
}

function renderCalendar() {
  return render(
    <EventCalendarSection
      events={[]}
      canReserveAndReason={() => ({ canReserve: true, reasonCode: null })}
      onEventClick={() => {}}
      t={t}
    />
  );
}

describe('event calendar labels', () => {
  beforeEach(() => {
    state.lang = 'zh';
  });

  test('Chinese locale supplies today and month navigation labels', () => {
    renderCalendar();
    const calendar = screen.getByTestId('calendar');
    expect(calendar).toHaveAttribute('data-today', '今天');
    expect(calendar).toHaveAttribute('data-prev', '上個月');
    expect(calendar).toHaveAttribute('data-next', '下個月');
    expect(calendar).toHaveAttribute('data-prev-week', '上週');
    expect(calendar).toHaveAttribute('data-next-week', '下週');
    expect(calendar).toHaveAttribute('data-locale', 'zh-tw');
  });

  test('English locale supplies English toolbar labels', () => {
    state.lang = 'en';
    renderCalendar();
    const calendar = screen.getByTestId('calendar');
    expect(calendar).toHaveAttribute('data-today', 'Today');
    expect(calendar).toHaveAttribute('data-prev', 'Previous month');
    expect(calendar).toHaveAttribute('data-next', 'Next month');
    expect(calendar).toHaveAttribute('data-prev-week', 'Previous week');
    expect(calendar).toHaveAttribute('data-next-week', 'Next week');
    expect(calendar).toHaveAttribute('data-locale', 'en');
  });
});
