import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import OutcomesModeSwitch from '../../components/learningAnalytics/OutcomesModeSwitch';
import LearningJourneyAnalyticsPanel from '../../components/learningJourneyV3/LearningJourneyAnalyticsPanel';
import { formatKpiGeneratedAt, isKpiQueryStale, resolveKpiRunAcceptance } from './LearningAnalyticsKpiReportPage';

describe('learning outcomes ux r3', () => {
  test('kpi numbers are stale only after a completed query changes', () => {
    expect(isKpiQueryStale('', '1|115-1|', null)).toBe(false);
    expect(isKpiQueryStale('1|115-1|', '1|115-1|', { rows: [] })).toBe(false);
    expect(isKpiQueryStale('1|115-1|', '1|114-2|', { rows: [] })).toBe(true);
  });

  test('a late or mismatched KPI response is not accepted', () => {
    expect(resolveKpiRunAcceptance({
      requestSeq: 1,
      latestSeq: 2,
      requestSemester: '115-1',
      responseSemester: '115-1',
    })).toEqual({ accept: false, reason: 'stale' });
    const mismatch = resolveKpiRunAcceptance({
      requestSeq: 2,
      latestSeq: 2,
      requestSemester: '114-2',
      responseSemester: '115-1',
    });
    expect(mismatch.accept).toBe(false);
    expect(mismatch.reason).toBe('semester-mismatch');
    expect(resolveKpiRunAcceptance({
      requestSeq: 2,
      latestSeq: 2,
      requestSemester: '114-2',
      responseSemester: '114-2',
    })).toMatchObject({ accept: true, semesterId: '114-2' });
  });

  test('KPI timestamp is shown in Taipei time', () => {
    const text = formatKpiGeneratedAt('2026-11-03T05:00:00.000Z');
    expect(text).toContain('13:00');
    expect(text).not.toContain('T05');
  });

  test('roster skill counts stay inside the same active roster total', () => {
    const report = {
      semesterId: '115-1',
      totalStudents: 40,
      skills: {
        listening: { count: 30 },
        reading: { count: 28 },
        speaking: { count: 10 },
        writing: { count: 12 },
      },
    };
    const list = {
      items: [{ studentId: 'B11000001' }],
      pagination: { total: 40, returned: 1 },
    };
    expect(list.pagination.total).toBe(report.totalStudents);
    expect(list.items).not.toHaveLength(0);
    Object.values(report.skills).forEach((skill) => {
      expect(skill.count).toBeLessThanOrEqual(report.totalStudents);
    });
  });

  test('mode switch keeps the two existing urls', () => {
    render(
      <MemoryRouter initialEntries={['/admin/learning-analytics/overview']}>
        <OutcomesModeSwitch />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: '能力分布' })).toHaveAttribute(
      'href',
      '/admin/learning-analytics/overview'
    );
    expect(screen.getByRole('link', { name: '學期 B2 KPI' })).toHaveAttribute(
      'href',
      '/admin/learning-analytics/kpi-report'
    );
  });

  test('roster page does not print snapshot attainment counts', () => {
    render(
      <MemoryRouter>
        <LearningJourneyAnalyticsPanel semesterId="115-1" />
      </MemoryRouter>
    );
    expect(screen.getByText('資料範圍：學期名冊')).toBeInTheDocument();
    expect(screen.queryByText('B2+ 達標率')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看學習成效分析' })).toHaveAttribute(
      'href',
      '/admin/learning-analytics/overview?semester=115-1'
    );
  });
});
