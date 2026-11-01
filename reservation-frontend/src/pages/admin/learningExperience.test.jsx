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
import { describeResourceExposure, formatObservedCount } from './learningParticipationReading';
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
    expect((await screen.findAllByText('通識英文')).length).toBe(2);
    expect(screen.getByText('可觀察事件次數')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByRole('link', { name: '開啟技能成長' }).getAttribute('href')).toBe('/admin/learning-analytics/skills');
    expect(screen.queryByText('SYN-STU')).toBeNull();
    await user.click(screen.getByRole('button', { name: '怎麼讀這頁' }));
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
