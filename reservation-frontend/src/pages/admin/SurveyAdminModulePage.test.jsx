import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import SurveyAdminModulePage from './SurveyAdminModulePage';
import { buildAccessProfile } from '../../utils/accessControl';

vi.mock('../../components/ui/useToast', () => ({
  default: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../components/ui/useConfirm', () => ({
  default: () => ({ confirm: vi.fn() }),
}));

let outletContext;
let moduleState;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => outletContext,
  };
});

vi.mock('../../hooks/useSurveyAdminModule', () => ({
  useSurveyAdminModule: () => moduleState,
}));

function jwt(payload) {
  return `e30.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;
}

function profileFor(payload, role) {
  return buildAccessProfile(jwt(payload), role);
}

function moduleValue(overrides = {}) {
  return {
    loading: false,
    error: '',
    q: '',
    setQ: vi.fn(),
    filteredRows: [],
    load: vi.fn(),
    showCreate: false,
    createForm: { name: '', surveyKey: '', description: '', category: '', targetType: '' },
    setCreateForm: vi.fn(),
    createSubmitting: false,
    openCreate: vi.fn(),
    closeCreate: vi.fn(),
    submitCreate: vi.fn(),
    versionsUi: { show: false },
    openVersions: vi.fn(),
    closeVersions: vi.fn(),
    createDraftVersion: vi.fn(),
    startEditVersion: vi.fn(),
    cancelEditVersion: vi.fn(),
    updateVersionsField: vi.fn(),
    saveVersion: vi.fn(),
    publishVersion: vi.fn(),
    deleteVersion: vi.fn(),
    deleteSurvey: vi.fn(),
    exportSurveyJson: vi.fn(),
    copyPublicSurveyLink: vi.fn(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SurveyAdminModulePage />
    </MemoryRouter>
  );
}

describe('survey center empty state', () => {
  beforeEach(() => {
    outletContext = {
      token: 'staff-token',
      userRole: 'admin',
      accessProfile: profileFor({ role: 'admin' }, 'admin'),
    };
    moduleState = moduleValue();
  });

  test('shows survey rows instead of the empty state', () => {
    moduleState = moduleValue({
      filteredRows: [{
        id: 1,
        name: 'English Table 回饋',
        surveyKey: 'english_table',
        status: 'published',
        publishedVersionNumber: 2,
        isEnabled: true,
        isRequired: false,
        responseCount: 4,
        updatedAt: '2026-10-01T00:00:00.000Z',
      }],
    });
    renderPage();
    expect(screen.getByText('English Table 回饋')).toBeInTheDocument();
    expect(screen.queryByText('尚無問卷')).toBeNull();
  });

  test('shows the shared empty state only when no surveys exist', () => {
    renderPage();
    expect(screen.getByText('尚無問卷')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '啟用規則' })).toHaveAttribute('href', '/admin/survey-rules');
    expect(screen.queryByRole('button', { name: '前往建立' })).toBeNull();
    expect(screen.getByRole('button', { name: '新增問卷' })).toBeInTheDocument();
  });

  test('treats a blank search as no surveys rather than a failed search', () => {
    moduleState = moduleValue({ q: '   ' });
    renderPage();
    expect(screen.getByText('尚無問卷')).toBeInTheDocument();
    expect(screen.queryByText('查無符合搜尋條件的問卷。')).toBeNull();
  });

  test('keeps search with no matches distinct from having no surveys', () => {
    moduleState = moduleValue({ q: '不存在的代碼' });
    renderPage();
    expect(screen.getByText('查無符合搜尋條件的問卷。')).toBeInTheDocument();
    expect(screen.queryByText('尚無問卷')).toBeNull();
  });

  test('does not treat loading or errors as an empty survey list', () => {
    moduleState = moduleValue({ loading: true });
    const loadingView = renderPage();
    expect(screen.queryByText('尚無問卷')).toBeNull();
    loadingView.unmount();

    moduleState = moduleValue({ error: '問卷清單暫時無法取得' });
    renderPage();
    expect(screen.getByText('問卷清單暫時無法取得')).toBeInTheDocument();
    expect(screen.queryByText('尚無問卷')).toBeNull();
  });

  test('keeps the existing permission message', () => {
    outletContext = {
      token: 'staff-token',
      userRole: 'worker',
      accessProfile: profileFor({ role: 'worker', workerLevel: 'event_ops' }, 'worker'),
    };
    renderPage();
    expect(screen.getByText('您沒有檢視問卷模組的權限。')).toBeInTheDocument();
    expect(screen.queryByText('尚無問卷')).toBeNull();
  });
});
