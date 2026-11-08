import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import LeadersTeamPage from './LeadersTeamPage';
import { LEADERS_TEAM } from '../data/leadersTeam';

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({
    lang: 'zh',
    t: (path, vars) => {
      if (path === 'leadersTeam.pageTitle') return 'LEADERS 團隊';
      if (path === 'leadersTeam.pageLead') return 'English Table 的帶桌團隊。';
      if (path === 'leadersTeam.introTitle') return '關於 LEADERS';
      if (path === 'leadersTeam.intro') return '每一桌由一位 Leader 陪同學開口。';
      if (path === 'leadersTeam.role') return 'English Table Leader';
      if (path === 'leadersTeam.nameplateMeta') return 'NSYSU EMI · English Table LEADERS';
      if (path === 'leadersTeam.photoAlt') return `${vars.name} 照片`;
      if (path === 'leadersTeam.videoTitle') return `${vars.name} 自我介紹`;
      if (path === 'leadersTeam.pause') return '暫停';
      if (path === 'leadersTeam.play') return '播放';
      if (path === 'leadersTeam.prev') return '上一張';
      if (path === 'leadersTeam.next') return '下一張';
      if (path === 'leadersTeam.slideNiceAlt') return 'Nice to Meet You 合影';
      if (path === 'leadersTeam.slideHallAlt') return '階梯教室合影';
      if (path === 'leadersTeam.slideAwardsAlt') return '頒獎合影';
      if (path === 'leadersTeam.slideStatus') return `第 ${vars.current} 張，共 ${vars.total} 張`;
      if (path === 'nav.home') return '首頁';
      if (path === 'nav.activities') return '活動';
      if (path === 'activities.englishTable') return 'English Table';
      return path;
    },
  }),
}));

describe('LeadersTeamPage', () => {
  test('lists every leader nameplate and links back to English Table', () => {
    render(
      <MemoryRouter>
        <LeadersTeamPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'LEADERS 團隊' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(LEADERS_TEAM.length);
    LEADERS_TEAM.forEach((leader) => {
      expect(screen.getByRole('heading', { level: 2, name: leader.name })).toBeInTheDocument();
    });
    expect(screen.getAllByText('NSYSU EMI · English Table LEADERS')).toHaveLength(LEADERS_TEAM.length);
    expect(screen.queryByText(/B\d{6,}/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'leadersTeam.bookEnglishTable' })).toHaveAttribute(
      'href',
      '/activities/english-table',
    );
  });

  test('moves through the three photos with the arrows and can pause', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LeadersTeamPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('img', { name: 'Nice to Meet You 合影' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '下一張' }));
    expect(screen.getByRole('img', { name: '階梯教室合影' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '上一張' }));
    expect(screen.getByRole('img', { name: 'Nice to Meet You 合影' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '暫停' }));
    expect(screen.getByRole('button', { name: '暫停' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: '播放' }));
    expect(screen.getByRole('button', { name: '播放' })).toHaveAttribute('aria-pressed', 'true');
  });
});
