import React from 'react';
import { render, screen } from '@testing-library/react';
import LearningJourneyTimeline from './LearningJourneyTimeline';

describe('LearningJourneyTimeline', () => {
  it('shows empty state when no events', () => {
    render(<LearningJourneyTimeline data={{ timeline: [], meta: { warnings: [] } }} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/尚無可顯示的學習歷程事件/)).toBeInTheDocument();
  });

  it('shows no-retest warning from meta', () => {
    render(
      <LearningJourneyTimeline
        data={{
          timeline: [{ eventId: '1', lane: 'exam', title: 'TOEIC', eventType: 'exam' }],
          meta: {
            warnings: [{ code: 'NO_RETEST', message: '此學生無後測，無法判斷個人增益' }],
          },
        }}
      />
    );
    expect(screen.getByText(/無法判斷個人增益/)).toBeInTheDocument();
  });

  it('renders registered_no_score as 未出分 in exam card', () => {
    render(
      <LearningJourneyTimeline
        data={{
          timeline: [{
            eventId: '2',
            lane: 'exam',
            title: 'TOEIC',
            eventType: 'exam',
            eventDate: '2025-01-01',
            status: 'registered_no_score',
            rawScore: null,
            badges: ['未出分'],
          }],
          meta: { warnings: [] },
        }}
      />
    );
    expect(screen.getAllByText(/未出分/).length).toBeGreaterThan(0);
  });

  it('groups repeated activity titles into expandable control', () => {
    render(
      <LearningJourneyTimeline
        data={{
          timeline: [
            { eventId: 'a1', lane: 'activity', title: 'English Table', termLabel: '114-2', eventDate: '2026-01-01', hours: 0.5 },
            { eventId: 'a2', lane: 'activity', title: 'English Table', termLabel: '114-2', eventDate: '2026-02-01', hours: 0.5 },
          ],
          meta: { warnings: [] },
        }}
      />
    );
    expect(screen.getByRole('button', { name: /English Table/i })).toBeInTheDocument();
    expect(screen.getByText(/2 筆/)).toBeInTheDocument();
    expect(screen.getByText('114-2')).toBeInTheDocument();
  });

  it('renders semester axis headers aligned with grid', () => {
    render(
      <LearningJourneyTimeline
        data={{
          student: { enrollmentTerm: '114-1' },
          timeline: [
            { eventId: 'e1', lane: 'exam', title: 'BESTEP', termLabel: '114-1', instrument: 'BESTEP' },
            { eventId: 'a1', lane: 'activity', title: 'ET', termLabel: '114-2', eventDate: '2026-03-01' },
          ],
          meta: { warnings: [] },
        }}
      />
    );
    expect(screen.getByText('114-1（入學）')).toBeInTheDocument();
    expect(screen.getByText('114-2')).toBeInTheDocument();
    expect(screen.getByText('畢業門檻')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '學生事件時間軸' })).toBeInTheDocument();
  });
});
