import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import LearningAnalyticsOfferingsPage from './LearningAnalyticsOfferingsPage';
import {
  exportLearningAnalyticsOfferings,
  getLearningAnalyticsMeta,
  getLearningAnalyticsOfferingDetail,
  getLearningAnalyticsOfferings,
} from '../../services/learningAnalyticsService';

vi.mock('../../services/learningAnalyticsService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getLearningAnalyticsMeta: vi.fn(),
    getLearningAnalyticsOfferings: vi.fn(),
    getLearningAnalyticsOfferingDetail: vi.fn(),
    exportLearningAnalyticsOfferings: vi.fn(),
  };
});

const meta = {
  snapshots: [],
  warnings: [],
  recommendedSnapshotVersion: 'synth-1',
  snapshotVersionCount: 1,
  hasAnalyticData: true,
  filterOptions: { semesters: [{ value: '115-1', label: '115-1學期' }] },
};

function row(label, key) {
  return {
    offeringKey: key,
    label,
    courseCode: 'GE101',
    semesterId: '115-1',
    semesterLabel: '115-1',
    participantCount: 4,
    growthSampleSize: 0,
    avgRawDelta: null,
    causalClaimAllowed: false,
    direction: { improved: 0, flat: 0, declined: 0, total: 0 },
    improvement: { any: { studentCount: 1, rate: 0.25 }, allSkills: null },
    skillBreakdown: [],
  };
}

function renderPage() {
  localStorage.setItem('token', 'e30.e30.sig');
  return render(
    <MemoryRouter initialEntries={['/admin/learning-analytics/offerings']}>
      <LearningAnalyticsOfferingsPage />
    </MemoryRouter>
  );
}

describe('offerings workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getLearningAnalyticsMeta.mockResolvedValue(meta);
    getLearningAnalyticsOfferingDetail.mockResolvedValue({ students: [] });
    exportLearningAnalyticsOfferings.mockResolvedValue({ blob: new Blob(['x']), fileName: 'offerings.xlsx' });
  });

  test('labels the semester scope and keeps a stale response from replacing the new dimension', async () => {
    const user = userEvent.setup();
    let releaseFirst;
    getLearningAnalyticsOfferings
      .mockImplementationOnce(() => new Promise((resolve) => {
        releaseFirst = resolve;
      }))
      .mockResolvedValueOnce({
        dimension: 'instructor',
        semester: '115-1',
        rowCount: 1,
        rows: [row('教師甲', '115-1::teacher')],
        causalClaimAllowed: false,
      });
    renderPage();
    await waitFor(() => expect(getLearningAnalyticsOfferings).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: '教師' }));
    releaseFirst({
      dimension: 'course',
      semester: '115-1',
      rowCount: 1,
      rows: [row('舊課程', '115-1::old')],
      causalClaimAllowed: false,
    });
    expect(await screen.findByText('教師甲')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('舊課程')).toBeNull());
    expect(screen.getByText(/目前範圍：115-1/)).toBeTruthy();
    expect(screen.getByText('0 人')).toBeTruthy();
  });

  test('says the range is cross-semester when the semester filter is cleared', async () => {
    const user = userEvent.setup();
    getLearningAnalyticsOfferings.mockResolvedValue({
      dimension: 'course',
      semester: null,
      rowCount: 1,
      rows: [row('跨學期課程', 'all::ge')],
      causalClaimAllowed: false,
    });
    renderPage();
    expect(await screen.findByText('跨學期課程')).toBeTruthy();
    const semester = screen.getAllByLabelText('學期').find((el) => el.tagName === 'SELECT');
    await user.selectOptions(semester, '');
    await user.click(screen.getByRole('button', { name: '套用篩選' }));
    expect(await screen.findByTestId('offering-cross-semester')).toHaveTextContent('目前範圍：跨學期');
  });

  test('opens advanced columns and a row detail without dropping the list', async () => {
    const user = userEvent.setup();
    getLearningAnalyticsOfferings.mockResolvedValue({
      dimension: 'course',
      semester: '115-1',
      rowCount: 1,
      rows: [row('通識英文（一）', '115-1::GE101')],
      causalClaimAllowed: false,
    });
    renderPage();
    expect(await screen.findByText('通識英文（一）')).toBeTruthy();
    await user.click(screen.getByLabelText('顯示進階欄位（技能定義／GSE）'));
    expect(screen.getByText('至少一項變好')).toBeTruthy();
    await user.click(screen.getByTitle('展開技能與學生明細'));
    expect(await screen.findByText('各技能明細')).toBeTruthy();
    expect(screen.getByText('通識英文（一）')).toBeTruthy();
    expect(screen.getAllByText('無可比較樣本').length).toBeGreaterThan(0);
  });

  test('shows a true zero only when the comparable sample is above zero', async () => {
    getLearningAnalyticsOfferings.mockResolvedValue({
      dimension: 'course',
      semester: '115-1',
      rowCount: 3,
      rows: [
        { ...row('零變化課程', '115-1::zero'), growthSampleSize: 6, avgRawDelta: 0 },
        { ...row('正變化課程', '115-1::up'), growthSampleSize: 6, avgRawDelta: 1.2 },
        { ...row('缺值課程', '115-1::missing'), growthSampleSize: 6, avgRawDelta: null },
      ],
      causalClaimAllowed: false,
    });
    renderPage();
    expect(await screen.findByText('零變化課程')).toBeTruthy();
    expect(screen.getByText('0.0')).toBeTruthy();
    expect(screen.getByText('+1.2')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    const warning = screen.getByTestId('offering-scale-warning').textContent;
    expect(warning).toContain('暫不建議把 GSE 或校正後變化當作正式比較');
    expect(warning).not.toContain('請重啟後端');
    expect(warning).toContain('contract：未提供');
  });

  test('uses result cards below the desktop breakpoint', async () => {
    const original = window.matchMedia;
    window.matchMedia = (query) => ({
      matches: String(query).includes('767'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    });
    try {
      getLearningAnalyticsOfferings.mockResolvedValue({
        dimension: 'course',
        semester: '115-1',
        rowCount: 1,
        rows: [row('手機課程', '115-1::mobile')],
        causalClaimAllowed: false,
      });
      renderPage();
      expect(await screen.findByTestId('offering-cards')).toBeTruthy();
      expect(screen.getByRole('heading', { name: '手機課程' })).toBeTruthy();
      expect(screen.getByText('4 人')).toBeTruthy();
      expect(screen.getByText('0 人')).toBeTruthy();
      expect(screen.getByText('樣本不足，無法判讀平均變化')).toBeTruthy();
      expect(screen.queryByRole('columnheader', { name: '參與人數' })).toBeNull();
    } finally {
      window.matchMedia = original;
    }
  });
});
