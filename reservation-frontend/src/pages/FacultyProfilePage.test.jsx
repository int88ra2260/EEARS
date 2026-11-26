import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import AboutPage from './AboutPage';
import FacultyProfilePage from './FacultyProfilePage';
import useStaffMembers from '../hooks/useStaffMembers';

vi.mock('motion', () => ({
  animate: () => ({ stop() {} }),
  inView: () => () => {},
}));

vi.mock('../hooks/useStaffMembers', () => ({
  default: vi.fn(),
}));

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({
    lang: 'zh',
    t: (key) => ({
      'aboutPage.facultyTitle': '師資介紹',
      'aboutPage.facultyProfileToggle': '學歷、經歷與著作',
      'aboutPage.phoneExt': '分機',
    }[key] || key),
  }),
}));

const HUANG = {
  id: 'huang-shuping',
  name: { zh: '黃舒屏', en: 'Shu-Ping Huang' },
  role: { zh: '西灣學院副院長／全英語卓越教學中心執行長', en: 'Director' },
  email: 'sphuang@mail.nsysu.edu.tw',
  extension: '3170',
  profile: {
    sections: [
      {
        labelZh: '學歷',
        labelEn: 'Education',
        bodyZh: '國立台灣大學語言學研究所 博士\n國立台灣大學外國語文學系 學士',
        bodyEn: '',
      },
    ],
  },
};

const WITHOUT_PROFILE = {
  id: 'elayna-ahpuck',
  name: { zh: '歐伊蘭', en: 'Elayna Ah Puck' },
  role: { zh: 'EMI 顧問', en: 'EMI Consultant' },
};

function renderProfile(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/about/faculty/:memberId" element={<FacultyProfilePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FacultyProfilePage', () => {
  beforeEach(() => {
    useStaffMembers.mockReturnValue({
      faculty: [HUANG, WITHOUT_PROFILE],
      adminStaff: [],
      loading: false,
    });
  });

  test('shows the faculty resume and a way back to the directory', () => {
    renderProfile('/about/faculty/huang-shuping');

    expect(screen.getByRole('heading', { name: '黃舒屏' })).toBeInTheDocument();
    expect(screen.getByText('西灣學院副院長')).toBeInTheDocument();
    expect(screen.getByText('全英語卓越教學中心執行長')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '學歷' })).toBeInTheDocument();
    expect(screen.getByText('國立台灣大學語言學研究所 博士')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回師資介紹' })).toHaveAttribute('href', '/about#faculty');
    expect(screen.getByRole('link', { name: 'sphuang@mail.nsysu.edu.tw' })).toHaveAttribute(
      'href',
      'mailto:sphuang@mail.nsysu.edu.tw',
    );
  });

  test('explains when the profile does not exist', () => {
    renderProfile('/about/faculty/missing-person');

    expect(screen.getByRole('heading', { name: '找不到這位師資' })).toBeInTheDocument();
  });
});

describe('AboutPage faculty cards', () => {
  beforeEach(() => {
    window.matchMedia = () => ({ matches: true });
    useStaffMembers.mockReturnValue({
      faculty: [HUANG, WITHOUT_PROFILE],
      adminStaff: [],
      loading: false,
    });
  });

  test('links to a profile page instead of expanding the card', () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: '學歷、經歷與著作' })).toHaveAttribute(
      'href',
      '/about/faculty/huang-shuping',
    );
    expect(screen.queryByText('國立台灣大學語言學研究所 博士')).not.toBeInTheDocument();
  });

  test('jumps within the page from below the hero', () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('navigation', { name: '本頁章節' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '中心介紹' })).toHaveAttribute('href', '#overview');
    expect(screen.getByRole('link', { name: '師資與行政' })).toHaveAttribute('href', '#team');
    expect(screen.getByRole('link', { name: '聯絡' })).toHaveAttribute('href', '#contact');
  });
});
