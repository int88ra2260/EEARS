import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { P } from '../../../constants/permissions';
import { canAccessAdminRoute, getAdminRouteAccess, getAdminRouteDeniedReason } from '../../../constants/adminRouteAccess';
import { buildAccessProfile } from '../../../utils/accessControl';
import { formatStoredScore } from '../../../utils/classBestepDisplayHelpers';
import ClassBestepDataReading from './ClassBestepDataReading';
import ClassBestepStatisticsCards from './ClassBestepStatisticsCards';
import ClassBestepStudentModal from './ClassBestepStudentModal';
import ClassBestepStudentsTable from './ClassBestepStudentsTable';
import ClassOverviewTable from './ClassOverviewTable';
import ClassBestepOverview from '../../ClassBestepOverview';

function token(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `e30.${body}.sig`;
}

function profile(payload) {
  return buildAccessProfile(token(payload), payload.role || '');
}

const filters = { semester: '115-1', examType: 'all', page: 1, pageSize: 50, q: '' };
const pagination = { total: 1, totalPages: 1 };

describe('BESTEP experience copy', () => {
  test('keeps stored zero and treats blank scores as missing', () => {
    expect(formatStoredScore(0)).toBe('0');
    expect(formatStoredScore('0')).toBe('0');
    expect(formatStoredScore(null)).toBe('-');
    expect(formatStoredScore(undefined)).toBe('-');
    expect(formatStoredScore('')).toBe('-');
  });

  test('shows the legacy rate as returned, including 150 and a zero denominator result', () => {
    const { rerender } = render(
      <ClassBestepDataReading statistics={{ passRate: 150, passedCount: 3 }} />
    );
    expect(screen.getByText(/150%/)).toBeTruthy();
    expect(screen.getByText(/尚未核准為官方達標率/)).toBeTruthy();
    expect(screen.getByText(/不是同一母體/)).toBeTruthy();
    expect(screen.getByText(/B2 不能還原成 B2\+/)).toBeTruthy();
    expect(screen.getByText(/未報名不是缺考/)).toBeTruthy();
    expect(screen.getByText(/沒有修改匯出檔/)).toBeTruthy();
    expect(screen.getByTestId('bestep-reading').textContent).not.toMatch(/造成能力|成效最好/);

    rerender(<ClassBestepDataReading statistics={{ passRate: 0, passedCount: 0 }} />);
    expect(screen.getByText(/既有統計口徑是 0%/)).toBeTruthy();
    expect(screen.getByText(/通過人數 0/)).toBeTruthy();
  });

  test('does not invent a rate before statistics arrive', () => {
    render(<ClassBestepDataReading statistics={null} />);
    expect(screen.getByText(/不另算通過比例/)).toBeTruthy();
    expect(screen.getByTestId('bestep-reading').textContent).not.toMatch(/\d+%/);
  });

  test('cards keep 150 percent and do not label it as an approved attainment rate', () => {
    render(
      <ClassBestepStatisticsCards
        statistics={{ passedCount: 3, passRate: 150, avgScore: 0, totalStudents: 4 }}
      />
    );
    expect(screen.getByText('既有通過人數')).toBeTruthy();
    expect(screen.getByText(/既有統計口徑/)).toHaveTextContent('150%');
    expect(screen.getByText('尚未核准為官方達標率')).toBeTruthy();
    expect(screen.getByText('平均分: 0')).toBeTruthy();
    expect(screen.queryByText('達標人數')).toBeNull();
  });
});

describe('BESTEP class entry and detail', () => {
  test('the class list uses the row class id and does not add a second button', () => {
    const onViewBestep = vi.fn();
    render(
      <ClassOverviewTable
        loading={false}
        data={[{
          classId: 'SYN-CLASS',
          className: '合成班',
          teacherName: '合成教師',
          studentCount: 2,
          participatedCount: 0,
          coverage: 0,
          attendedCountTotal: 0,
          avgAttendPerStudent: 0,
          noShowCountTotal: 0,
        }]}
        filters={{ ...filters, page: 1, pageSize: 20 }}
        pagination={pagination}
        canManageClasses={false}
        onFilterChange={vi.fn()}
        onViewDetail={vi.fn()}
        onViewBestep={onViewBestep}
        onDelete={vi.fn()}
      />
    );
    const buttons = screen.getAllByRole('button', { name: '查看 BESTEP 分析' });
    expect(buttons).toHaveLength(1);
    buttons[0].click();
    expect(onViewBestep).toHaveBeenCalledWith('SYN-CLASS');
    expect(getAdminRouteAccess('/admin/classes/SYN-CLASS/bestep').pattern)
      .toBe('/admin/classes/:classId/bestep');
  });

  test('detail keeps zero scores and does not call unknown attendance absent', async () => {
    const user = userEvent.setup();
    render(
      <ClassBestepStudentModal
        show
        student={{
          studentId: 'SYN-N1',
          studentName: '合成甲',
          personalRegistration: { status: 'success', examTypeLabel: '聽讀說寫', exemptionType: '無', regId: 1 },
          attendance: { L: { attended: null }, R: { attended: false }, S: {}, W: { attended: true } },
          score: {
            totalScore: 0,
            listeningScore: 0,
            readingScore: null,
            speakingScore: '',
            writingScore: undefined,
            listeningLevel: 'B2',
            passed: false,
          },
        }}
        onHide={vi.fn()}
        onOpenRegistration={vi.fn()}
      />
    );
    expect(screen.getByText(/總分:/).textContent).toContain('0');
    expect(screen.getByText(/聽力:/).textContent).toContain('0');
    expect(screen.getByText(/閱讀:/).textContent).toContain('-');
    expect(screen.getByText(/口說:/).textContent).toContain('-');
    expect(screen.getByText(/寫作:/).textContent).toContain('-');
    expect(screen.getByText('L 未確認')).toBeTruthy();
    expect(screen.getByText('R 缺席')).toBeTruthy();
    expect(screen.getByText('S 未確認')).toBeTruthy();
    expect(screen.getByText('W 出席')).toBeTruthy();
    expect(screen.getByText('L 未確認').textContent).not.toContain('缺席');
    await user.tab();
    expect(document.activeElement?.tagName).not.toBe('BODY');
  });

  test('table loading, empty, and export hint stay on the real table', () => {
    const { rerender } = render(
      <ClassBestepStudentsTable
        loading
        students={[]}
        filters={filters}
        pagination={{ total: 0, totalPages: 0 }}
        exporting={false}
        onFilterChange={vi.fn()}
        onExport={vi.fn()}
        onShowStudentDetail={vi.fn()}
        onOpenStudentJourney={vi.fn()}
      />
    );
    expect(screen.getByText('載入中...')).toBeTruthy();
    expect(screen.getByText(/可能以空白呈現/)).toBeTruthy();

    rerender(
      <ClassBestepStudentsTable
        loading={false}
        students={[]}
        filters={filters}
        pagination={{ total: 0, totalPages: 0 }}
        exporting={false}
        onFilterChange={vi.fn()}
        onExport={vi.fn()}
        onShowStudentDetail={vi.fn()}
        onOpenStudentJourney={vi.fn()}
      />
    );
    expect(screen.getByText('沒有找到符合條件的資料')).toBeTruthy();
  });

  test('overview error is an alert and does not invent a pass rate', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: '合成載入失敗' }),
    })));
    render(
      <MemoryRouter initialEntries={['/admin/classes/SYN-CLASS/bestep']}>
        <Routes>
          <Route path="/admin/classes/:classId/bestep" element={<ClassBestepOverview />} />
        </Routes>
      </MemoryRouter>
    );
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toMatch(/150%|0%/);
    expect(screen.getByText(/不另算通過比例/)).toBeTruthy();
    expect(screen.queryByText('SYN-N1')).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('BESTEP route permissions follow the existing rules', () => {
  const bestep = '/admin/classes/SYN-CLASS/bestep';
  const classes = '/admin/classes';

  test('admin, executive, managers, and a class viewer can open the class page', () => {
    const allowed = [
      profile({ role: 'admin' }),
      profile({ role: 'teacher', teacherLevel: 'executive' }),
      profile({ role: 'teacher', teacherLevel: 'et_manager' }),
      profile({ role: 'teacher', teacherLevel: 'regular' }),
      profile({ role: 'office_staff', staffLevel: 'curriculum_lead' }),
    ];
    allowed.forEach((accessProfile) => {
      expect(canAccessAdminRoute(accessProfile, classes)).toBe(true);
      expect(canAccessAdminRoute(accessProfile, bestep)).toBe(true);
    });
    const classOnly = profile({
      role: 'teacher',
      teacherLevel: 'regular',
      permissions: { can_view_analytics: false },
    });
    expect(classOnly.permissionSet.has(P.CAN_VIEW_CLASSES)).toBe(true);
    expect(classOnly.permissionSet.has(P.CAN_EXPORT_BESTEP)).toBe(false);
    expect(canAccessAdminRoute(classOnly, bestep)).toBe(true);
  });

  test('export-only staff can open a known class page but not the class list', () => {
    const bestepLead = profile({ role: 'office_staff', staffLevel: 'bestep_lead' });
    expect(bestepLead.permissionSet.has(P.CAN_EXPORT_BESTEP)).toBe(true);
    expect(canAccessAdminRoute(bestepLead, classes)).toBe(false);
    expect(canAccessAdminRoute(bestepLead, bestep)).toBe(true);
  });

  test('event staff, analytics-only, and signed-out users cannot open it', () => {
    const eventLead = profile({ role: 'office_staff', staffLevel: 'event_lead' });
    const analyticsOnly = profile({
      role: 'teacher',
      teacherLevel: 'regular',
      permissions: { can_view_classes: false },
    });
    expect(canAccessAdminRoute(eventLead, classes)).toBe(false);
    expect(canAccessAdminRoute(eventLead, bestep)).toBe(false);
    expect(canAccessAdminRoute(analyticsOnly, bestep)).toBe(false);
    expect(getAdminRouteDeniedReason({}, bestep)).toMatchObject({ code: 'unauthenticated' });
    expect(getAdminRouteDeniedReason(null, classes)).toMatchObject({ code: 'unauthenticated' });
  });
});

describe('BESTEP export and pass-rate formula stay on the existing contract', () => {
  test('frontend export still calls the existing endpoint and the formula is unchanged', () => {
    const api = readFileSync(resolve(process.cwd(), 'src/services/classAdminApi.js'), 'utf8');
    const service = readFileSync(resolve(process.cwd(), '../reservation-backend/services/bestepClassService.js'), 'utf8');
    expect(api).toContain('/bestep-overview/export');
    expect(service).toContain('const passRate = summary.registeredCount > 0');
    expect(service).toContain('passedCount / summary.registeredCount');
    expect(service).toContain('if (attended === null)');
  });
});

describe('attendance exemption stays out of the attendance cell', () => {
  test('an approved exemption does not become attendance text', () => {
    render(
      <ClassBestepStudentsTable
        loading={false}
        students={[{
          studentId: 'SYN-EX',
          studentName: '合成免',
          department: '外文',
          personalRegistration: {
            status: 'success',
            examTypeLabel: '聽讀說寫',
            exemptionType: '聽讀說寫',
          },
          attendance: { L: { attended: null } },
          score: null,
        }]}
        filters={filters}
        pagination={pagination}
        exporting={false}
        onFilterChange={vi.fn()}
        onExport={vi.fn()}
        onShowStudentDetail={vi.fn()}
        onOpenStudentJourney={vi.fn()}
      />
    );
    const cells = within(screen.getByText('SYN-EX').closest('tr')).getAllByRole('cell');
    expect(cells[4]).toHaveTextContent('聽讀說寫');
    expect(cells[7]).toHaveTextContent('未確認');
    expect(cells[7]).not.toHaveTextContent('抵免');
    expect(cells[8]).toHaveTextContent('未匯入');
  });
});
