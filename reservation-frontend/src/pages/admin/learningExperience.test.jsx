import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { canAccessAdminRoute } from '../../constants/adminRouteAccess';
import { buildAccessProfile } from '../../utils/accessControl';
import { LA_TERM_HELP } from '../../components/learningAnalytics/learningAnalyticsFilterConstants';
import GrowthMetricsExplainer from '../../components/learningAnalytics/GrowthMetricsExplainer';
import { buildAnalyticsHub } from './analyticsHubModel';
import {
  describeResourceCoverage,
  describeResourceExposure,
  formatObservedCount,
  formatObservedDelta,
  offeringScopeLabel,
  shouldApplyAnalyticsResult,
} from './learningParticipationReading';
import LearningAnalyticsResourcesPage from './LearningAnalyticsResourcesPage';
import { getLearningAnalyticsMeta, getLearningAnalyticsResources } from '../../services/learningAnalyticsService';

vi.mock('../../services/learningAnalyticsService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getLearningAnalyticsMeta: vi.fn(),
    getLearningAnalyticsResources: vi.fn(),
  };
});

function token(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `e30.${body}.sig`;
}

function profile(payload) {
  return buildAccessProfile(token(payload), payload.role || '');
}

const meta = {
  snapshots: [],
  warnings: [],
  tableCounts: { lj_student_events: 4 },
  recommendedSnapshotVersion: 'synthetic-snapshot',
  hasAnalyticData: true,
};

const geRow = {
  resourceType: 'GE',
  participantCount: 2,
  growthSampleSize: 0,
  rawGrowthAverage: null,
  evidenceLevel: 'descriptive_low',
  causalClaimAllowed: false,
  mainSkills: ['reading'],
  interpretation: '描述性趨勢；不能作因果宣稱。',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <LearningAnalyticsResourcesPage />
    </MemoryRouter>
  );
}

describe('learning participation reading', () => {
  test('keeps zero and leaves null unmarked', () => {
    expect(formatObservedCount(0)).toBe('0');
    expect(formatObservedCount(null)).toBe('—');
    expect(formatObservedCount(undefined)).toBe('—');
    const reading = describeResourceExposure([geRow]);
    expect(reading.missing).toContain('不會改寫成未觀察');
    expect(reading.population).toContain('不是資源事件次數');
    expect(reading.anonymity).toContain('不會把匿名軌跡配成');
    expect(reading.causation).toContain('不代表該資源造成能力提升');
    expect(reading.apiInterpretation).toBe(geRow.interpretation);
    expect(describeResourceCoverage(geRow)).toContain('沒有可比較的前後測');
    expect(describeResourceCoverage({ participantCount: 0, growthSampleSize: 0 })).toBe('沒有人參與');
    expect(describeResourceCoverage({ participantCount: null, growthSampleSize: 0 })).toContain('尚未回傳');
    expect(offeringScopeLabel('')).toBe('目前範圍：跨學期');
    expect(offeringScopeLabel('115-1')).toBe('目前範圍：115-1');
    expect(shouldApplyAnalyticsResult(1, 2)).toBe(false);
    expect(shouldApplyAnalyticsResult(2, 2)).toBe(true);
    expect(formatObservedDelta(0, 0)).toBe('無可比較樣本');
    expect(formatObservedDelta(null, 0)).toBe('無可比較樣本');
    expect(formatObservedDelta(0, 4)).toBe('0.0');
    expect(formatObservedDelta(1.25, 4)).toBe('+1.3');
    expect(formatObservedDelta(-0.4, 4)).toBe('-0.4');
    expect(formatObservedDelta(null, 4)).toBe('—');
    expect(formatObservedDelta(0, null)).toBe('—');
  });

  test('does not treat a closed causal flag as permission to claim an effect', () => {
    expect(describeResourceExposure([{ causalClaimAllowed: false }]).causation).toContain('不代表');
    expect(describeResourceExposure([{ causalClaimAllowed: true }]).causation).toContain('仍不把它寫成');
  });

  test('hub learning entries stay on existing routes and hide when permission is missing', () => {
    const admin = buildAnalyticsHub(profile({ role: 'admin' }));
    const learning = admin.sections.find((section) => section.id === 'learning');
    expect(learning.links.map((link) => link.to)).toEqual([
      '/admin/learning-analytics/resources',
      '/admin/learning-analytics/students',
      '/admin/learning-analytics/offerings',
      '/admin/learning-analytics/overview',
    ]);
    expect(learning.links.every((link) => link.allowed)).toBe(true);
    expect(JSON.stringify(learning)).not.toMatch(/studentId|SYN-STU|@/);
    expect(learning.summary).toContain('不能解讀成某個活動造成了進步');

    const executive = profile({ role: 'teacher', teacherLevel: 'executive' });
    const learningStaff = profile({
      role: 'teacher',
      teacherLevel: 'regular',
      permissions: {
        can_view_analytics: false,
        can_view_classes: false,
        can_view_learning_analytics: true,
      },
    });
    const classOnly = profile({
      role: 'teacher',
      teacherLevel: 'regular',
      permissions: { can_view_analytics: false },
    });
    const activityOnly = profile({
      role: 'teacher',
      teacherLevel: 'regular',
      permissions: { can_view_classes: false },
    });
    const eventLead = profile({ role: 'office_staff', staffLevel: 'event_lead' });
    const anonymous = buildAccessProfile('');
    for (const current of [executive, learningStaff]) {
      expect(canAccessAdminRoute(current, '/admin/learning-analytics/resources')).toBe(true);
    }
    for (const current of [classOnly, activityOnly, eventLead, anonymous]) {
      expect(canAccessAdminRoute(current, '/admin/learning-analytics/resources')).toBe(false);
      expect(canAccessAdminRoute(current, '/admin/learning-analytics/skills')).toBe(false);
    }
  });

  test('keeps adjusted growth exploratory', () => {
    expect(LA_TERM_HELP.adjustedGrowth).toContain('探索性估計');
    expect(LA_TERM_HELP.adjustedGrowth).toContain('不是因果證明');
    render(
      <MemoryRouter>
        <GrowthMetricsExplainer />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: '這幾個數字分別在比什麼？' })).toBeTruthy();
  });
});

describe('learning resources page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getLearningAnalyticsMeta.mockResolvedValue(meta);
  });

  test('shows students and events separately, then clears them while the next response loads', async () => {
    const user = userEvent.setup();
    let releaseSecond;
    getLearningAnalyticsResources
      .mockResolvedValueOnce({
        causalClaimAllowed: false,
        resourceEffectiveness: [geRow],
        skillExposure: { byResource: [{ resourceType: 'GE', events: 5 }], causalClaimAllowed: false },
      })
      .mockImplementationOnce(() => new Promise((resolve) => {
        releaseSecond = resolve;
      }));
    renderPage();
    expect((await screen.findAllByText('通識英文')).length).toBe(1);
    expect(screen.getByText('參與事件次數')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('有人參與，但沒有可比較的前後測')).toBeTruthy();
    expect(screen.getByText('無可比較樣本')).toBeTruthy();
    expect(screen.queryByText('0.0')).toBeNull();
    expect(screen.queryByLabelText('學期')).toBeNull();
    await user.click(screen.getByRole('button', { name: '怎麼讀這頁' }));
    expect(screen.getByRole('link', { name: '開啟技能成長' }).getAttribute('href')).toBe('/admin/learning-analytics/skills');
    expect(screen.queryByText('SYN-STU')).toBeNull();
    expect(screen.getByText(geRow.interpretation)).toBeTruthy();
    expect(screen.getByText(/這份資源回應沒有排除原因明細/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '套用篩選' }));
    await waitFor(() => expect(screen.queryAllByText('通識英文')).toEqual([]));
    expect(screen.getByRole('status')).toBeTruthy();
    releaseSecond({
      resourceEffectiveness: [{
        ...geRow,
        resourceType: 'EAP',
        participantCount: null,
        growthSampleSize: null,
      }],
      skillExposure: { byResource: [{ resourceType: 'EAP', events: 0 }] },
    });
    expect((await screen.findAllByText('EAP 寫作／學術英文')).length).toBeGreaterThan(0);
    const table = screen.getAllByRole('table')[0];
    expect(within(table).getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('通識英文')).toEqual([]);
  });

  test('renders zero, positive, negative, and missing averages on the page', async () => {
    getLearningAnalyticsResources.mockResolvedValue({
      causalClaimAllowed: false,
      resourceEffectiveness: [
        { ...geRow, rawGrowthAverage: 0 },
        { ...geRow, resourceType: 'ENGLISH_TABLE', participantCount: 6, growthSampleSize: 4, rawGrowthAverage: 0 },
        { ...geRow, resourceType: 'JOB_TALK', participantCount: 6, growthSampleSize: 4, rawGrowthAverage: 1.2 },
        { ...geRow, resourceType: 'WORKSHOP', participantCount: 6, growthSampleSize: 4, rawGrowthAverage: -0.4 },
        { ...geRow, resourceType: 'ESP', participantCount: 6, growthSampleSize: 4, rawGrowthAverage: null },
      ],
      skillExposure: { byResource: [] },
    });
    renderPage();
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    const textOf = (label) => rows.find((row) => row.textContent.includes(label)).textContent;
    expect(textOf('通識英文')).toContain('無可比較樣本');
    expect(textOf('通識英文')).not.toContain('0.0');
    expect(textOf('English Table')).toContain('0.0');
    expect(textOf('Job Talk')).toContain('+1.2');
    expect(textOf('工作坊')).toContain('-0.4');
    expect(textOf('ESP 專業英文')).toContain('—');
    expect(textOf('ESP 專業英文')).not.toContain('0.0');
  });

  test('keeps an empty snapshot from becoming a zero or a no-learning claim', async () => {
    getLearningAnalyticsResources.mockResolvedValue({ resourceEffectiveness: [], skillExposure: { byResource: [] } });
    renderPage();
    expect(await screen.findByText(/尚無可用紀錄。不能推論沒有學習。/)).toBeTruthy();
    expect(screen.queryAllByText('0')).toEqual([]);
  });

  test('shows an error without leftover resource counts', async () => {
    getLearningAnalyticsResources.mockRejectedValue(Object.assign(new Error('SQL exploded'), { status: 500 }));
    renderPage();
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((node) => node.textContent.includes('SQL exploded'))).toBe(true);
    expect(screen.queryByText('通識英文')).toBeNull();
    expect(screen.getByTestId('learning-reading').textContent).toContain('不代表資源造成能力提升');
  });
});
