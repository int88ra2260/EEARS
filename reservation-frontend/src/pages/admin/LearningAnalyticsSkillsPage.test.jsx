import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import LearningAnalyticsSkillsPage from './LearningAnalyticsSkillsPage';
import { getLearningAnalyticsMeta, getLearningAnalyticsSkills } from '../../services/learningAnalyticsService';

vi.mock('../../services/learningAnalyticsService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getLearningAnalyticsMeta: vi.fn(),
    getLearningAnalyticsSkills: vi.fn(),
  };
});

const meta = {
  snapshots: [{ snapshotVersion: 'synth-1', label: '合成快照', scope: 'global' }],
  warnings: [],
  recommendedSnapshotVersion: 'synth-1',
  snapshotVersionCount: 1,
  hasAnalyticData: true,
  filterOptions: {
    cohorts: [],
    colleges: [],
    departments: [],
    instruments: ['BESTEP'],
    skills: ['listening', 'reading', 'speaking', 'writing'],
  },
};

function skill(name, sampleSize, actual) {
  return {
    skill: name,
    sampleSize,
    actualGseGrowthAverage: actual,
    rawGrowthAverage: actual,
    growthStudentRatio: sampleSize > 0 && actual > 0 ? 0.5 : (sampleSize > 0 ? 0 : null),
    improvedCount: sampleSize > 0 && actual > 0 ? 2 : 0,
  };
}

function adminToken() {
  const body = Buffer.from(JSON.stringify({
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  return `e30.${body}.sig`;
}

async function skillCard(name) {
  const title = await screen.findByText(name, { selector: '.la-skill-growth-card__title' });
  return title.closest('.la-skill-growth-card');
}

function renderPage(token = 'e30.e30.sig') {
  localStorage.setItem('token', token);
  return render(
    <MemoryRouter initialEntries={['/admin/learning-analytics/skills']}>
      <LearningAnalyticsSkillsPage />
    </MemoryRouter>
  );
}

describe('skill growth workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    getLearningAnalyticsMeta.mockResolvedValue(meta);
    getLearningAnalyticsSkills.mockResolvedValue({
      snapshotVersion: 'synth-1',
      causalClaimAllowed: false,
      growth: {
        summary: { retestCount: 6, excludedPlaceholderScoreRows: 1 },
        bySkill: [
          skill('listening', 0, null),
          skill('reading', 6, 0),
          skill('speaking', 6, 1.5),
        ],
        byStartingGse: [],
        episodes: [],
        improvedStudentsBySkill: {},
      },
      growthEpisodes: { retestStudentCount: 6, bySkill: [], sampleEpisodes: [] },
      adjustedGrowth: { bySkill: [] },
    });
  });

  test('separates missing skills, zero samples, observed zero, and positive change', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: '群體與技能比較' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '技能成長' })).toHaveAttribute('aria-current', 'page');
    expect((await screen.findAllByText('無可比較樣本')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('0.0').length).toBeGreaterThan(0);
    expect(screen.getByText('+1.5')).toBeInTheDocument();
    expect(screen.getAllByText('未提供可判讀資料').length).toBeGreaterThan(0);
    expect(screen.queryByText('沒有測驗資料')).not.toBeInTheDocument();
    expect(screen.getByText('平均沒有變化')).toBeInTheDocument();
    expect(screen.getByText(/口說具有可觀察的前後測變化/)).toBeInTheDocument();
    expect(screen.getByText(/閱讀具有可比較的測驗紀錄，平均變化是 0\.0/)).toBeInTheDocument();
    expect(screen.getByText(/已排除 1 筆前後測：原始分為 0 或 1/)).toBeInTheDocument();
    expect(screen.queryByText(/最明確/)).not.toBeInTheDocument();
    expect(screen.queryByText(/進步最多/)).not.toBeInTheDocument();
    expect(screen.queryByText('未見成長')).not.toBeInTheDocument();
    expect(screen.queryByText(/教學介入不足/)).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /英檢工具/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /技能/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /曾重測英檢/ })).toBeInTheDocument();
  });

  test('describes a negative mean without ranking skills', async () => {
    getLearningAnalyticsSkills.mockResolvedValue({
      snapshotVersion: 'synth-1',
      causalClaimAllowed: false,
      growth: {
        summary: { retestCount: 8, excludedPlaceholderScoreRows: 2 },
        bySkill: [skill('speaking', 8, -2.3)],
        byStartingGse: [],
        episodes: [],
        improvedStudentsBySkill: {},
      },
      growthEpisodes: { bySkill: [], sampleEpisodes: [] },
      adjustedGrowth: { bySkill: [] },
    });
    renderPage();
    const card = await skillCard('口說');
    expect(within(card).getByText('-2.3')).toBeInTheDocument();
    expect(within(card).getByText('平均下降')).toBeInTheDocument();
    expect(screen.getByText(/口說的可比較樣本平均變化是負的/)).toBeInTheDocument();
    expect(screen.getAllByText('未提供可判讀資料').length).toBeGreaterThan(0);
    expect(screen.queryByText(/最明確|進步最多|最有效/)).not.toBeInTheDocument();
  });

  test('shows a dash when the mean is null and treats a null payload as unreadable', async () => {
    getLearningAnalyticsSkills.mockResolvedValue({
      snapshotVersion: 'synth-1',
      causalClaimAllowed: false,
      growth: {
        summary: { retestCount: 8, excludedPlaceholderScoreRows: 0 },
        bySkill: [skill('writing', 8, null)],
        byStartingGse: [],
        episodes: [],
        improvedStudentsBySkill: {},
      },
      growthEpisodes: { bySkill: [], sampleEpisodes: [] },
      adjustedGrowth: { bySkill: [] },
    });
    const view = renderPage();
    const writing = await skillCard('寫作');
    expect(within(writing).getByText('資料不足')).toBeInTheDocument();
    expect(within(writing).getByText('—')).toBeInTheDocument();
    expect(screen.getByText('目前沒有足以判讀方向的技能資料。')).toBeInTheDocument();

    getLearningAnalyticsSkills.mockResolvedValue(null);
    view.unmount();
    renderPage();
    expect(await screen.findByText('這份回應沒有技能資料。不能解讀成沒有測驗。')).toBeInTheDocument();
    expect(screen.queryByText('沒有測驗資料')).not.toBeInTheDocument();
    expect(screen.queryByText('+1.5')).not.toBeInTheDocument();
  });

  test('shows the raw-data handoff only when export permission exists', async () => {
    HTMLElement.prototype.scrollIntoView = () => {};
    getLearningAnalyticsSkills.mockResolvedValue({
      snapshotVersion: 'synth-1',
      causalClaimAllowed: false,
      growth: {
        summary: { retestCount: 6, excludedPlaceholderScoreRows: 0 },
        bySkill: [skill('speaking', 6, 1.5)],
        byStartingGse: [],
        episodes: [],
        improvedStudentsBySkill: {
          speaking: { studentIds: ['B11000001'], total: 1, truncated: false },
        },
      },
      growthEpisodes: { bySkill: [], sampleEpisodes: [] },
      adjustedGrowth: { bySkill: [] },
    });

    const denied = renderPage();
    const speaking = await skillCard('口說');
    fireEvent.click(within(speaking).getByRole('button', { name: /有進步學生/ }));
    expect(await screen.findByText(/口說有進步的學生/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '前往原始資料匯出' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '看這批人的 B2 達標' })).toBeInTheDocument();
    denied.unmount();

    renderPage(adminToken());
    const allowed = await skillCard('口說');
    fireEvent.click(within(allowed).getByRole('button', { name: /有進步學生/ }));
    expect(await screen.findByRole('button', { name: '前往原始資料匯出' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '匯出這批人的資料' })).not.toBeInTheDocument();
  });
});
