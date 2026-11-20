import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import StudentExplorerDetailDrawer, { recordedScore } from './StudentExplorerDetailDrawer';
import { getLearningAnalyticsStudentJourney } from '../../services/learningAnalyticsService';

vi.mock('../../services/learningAnalyticsService', () => ({
  getLearningAnalyticsStudentJourney: vi.fn(),
}));

describe('student explorer drawer', () => {
  test('missing scores stay missing and zero stays a recorded score', () => {
    expect(recordedScore(null)).toBeNull();
    expect(recordedScore('')).toBeNull();
    expect(recordedScore(0)).toBe(0);
  });

  test('shows skill GSE and pre-post differences without turning a missing score into zero', async () => {
    getLearningAnalyticsStudentJourney.mockResolvedValue({
      student: { studentId: 'S100', department: '合成學系', cohort: '114' },
      timeline: [
        {
          eventId: 'exam-1',
          lane: 'exam',
          eventDate: '2026-03-01',
          skill: 'listening',
          rawScore: null,
          cefrLevel: null,
          gse: null,
          invalidScore: false,
        },
        {
          eventId: 'course-1',
          lane: 'course',
          eventDate: '2026-04-01',
          title: '學術英文',
          hours: 2,
        },
      ],
      prePost: {
        skills: [
          {
            skill: 'listening',
            sameInstrument: true,
            rawDelta: 1,
            gseDelta: 12,
            pre: { rawScore: 6, cefr: 'B1', gse: 54, invalidScore: false },
            post: { rawScore: 7, cefr: 'B2', gse: 66, invalidScore: false },
          },
          {
            skill: 'reading',
            sameInstrument: false,
            rawDelta: null,
            gseDelta: null,
            pre: { rawScore: 0, cefr: null, gse: null, invalidScore: true },
            post: { rawScore: 400, cefr: 'B2', gse: 59, invalidScore: false },
          },
          {
            skill: 'speaking',
            sameInstrument: false,
            rawDelta: null,
            gseDelta: 8,
            pre: { rawScore: 5, cefr: 'A2', gse: 38, invalidScore: false },
            post: { rawScore: 80, cefr: 'A2', gse: 46, invalidScore: false },
          },
          {
            skill: 'writing',
            sameInstrument: true,
            rawDelta: null,
            gseDelta: null,
            pre: { rawScore: 5, cefr: 'A2', gse: null, invalidScore: false },
            post: { rawScore: 6, cefr: 'B1', gse: 54, invalidScore: false },
          },
        ],
      },
      meta: { snapshotVersion: 'synthetic-snapshot' },
    });

    render(
      <MemoryRouter>
        <StudentExplorerDetailDrawer studentId="S100" token="token" onClose={() => {}} />
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: 'GSE 與前後測' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '學習時間軸' })).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.getByText('+12')).toBeTruthy();
    expect(screen.getByText('無效分')).toBeTruthy();
    expect(screen.getByText('不同測驗')).toBeTruthy();
    expect(screen.getByText('無法換算')).toBeTruthy();
    expect(screen.queryByText('待補')).toBeNull();
    expect(screen.queryByText(/^0$/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '學習時間軸' }));
    expect(screen.getByText(/沒有原始分/)).toBeTruthy();
    expect(screen.getByText(/沒有 GSE/)).toBeTruthy();
    expect(screen.getByText('學術英文')).toBeTruthy();
    expect(screen.getByText('2 小時')).toBeTruthy();
  });
});
