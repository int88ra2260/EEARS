import React from 'react';
import { render, screen } from '@testing-library/react';
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

  test('shows journey exams without inventing GSE', async () => {
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
        },
      ],
      meta: { snapshotVersion: 'synthetic-snapshot' },
    });

    render(
      <MemoryRouter>
        <StudentExplorerDetailDrawer studentId="S100" token="token" onClose={() => {}} />
      </MemoryRouter>
    );

    expect(await screen.findByText('沒有原始分')).toBeTruthy();
    expect(screen.getByRole('button', { name: '測驗紀錄' })).toBeTruthy();
    expect(screen.getByText(/尚未提供 GSE 換算結果/)).toBeTruthy();
    expect(screen.getByText('沒有 CEFR')).toBeTruthy();
    expect(screen.getByText('待補')).toBeTruthy();
    expect(screen.queryByText(/^0$/)).toBeNull();
  });
});
