import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { P } from '../../constants/permissions';
import { buildAccessProfile, hasAnyPermission } from '../../utils/accessControl';
import { getCurrentSemester, SEMESTER_OPTIONS } from '../../utils/semesterUtils';
import B2KpiSection from '../../components/learningJourneyV3/B2KpiSection';
import BreakdownTabs from '../../components/learningJourneyV3/BreakdownTabs';
import BreakdownTable from '../../components/learningJourneyV3/BreakdownTable';
import StudentTable from '../../components/learningJourneyV3/StudentTable';
import LearningJourneyAnalyticsPanel from '../../components/learningJourneyV3/LearningJourneyAnalyticsPanel';
import StudentFilters, { DEFAULT_STUDENT_FILTERS } from '../../components/learningJourneyV3/StudentFilters';
import {
  getLearningJourneyV3B2Report,
  getLearningJourneyV3Breakdown,
  getLearningJourneyV3Students,
} from '../../services/learningJourneyV3Api';

const DASHBOARD_SEMESTER_OPTIONS = SEMESTER_OPTIONS.filter((o) => o.value);
const DEFAULT_SEMESTER = getCurrentSemester() || DASHBOARD_SEMESTER_OPTIONS[0]?.value || '114-2';
const STUDENT_PAGE_LIMIT = 20;
const STUDENT_QUERY_KEYS = [
  'semester',
  'page',
  'keyword',
  'grade',
  'department',
  'b2Skill',
  'sortBy',
  'sortDirection',
  'limit'
];

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return i > 0 ? i : fallback;
}

function filtersFromSearch(searchParams) {
  return {
    ...DEFAULT_STUDENT_FILTERS,
    keyword: searchParams.get('keyword') || '',
    grade: searchParams.get('grade') || '',
    department: searchParams.get('department') || '',
    b2Skill: searchParams.get('b2Skill') || '',
    sortBy: searchParams.get('sortBy') || DEFAULT_STUDENT_FILTERS.sortBy,
    sortOrder: searchParams.get('sortDirection') || searchParams.get('sortOrder') || DEFAULT_STUDENT_FILTERS.sortOrder
  };
}

function pageFromSearch(searchParams) {
  return parsePositiveInt(searchParams.get('page'), 1);
}

function limitFromSearch(searchParams) {
  return parsePositiveInt(searchParams.get('limit'), STUDENT_PAGE_LIMIT);
}

function studentQueryFromSearch(searchText, fallbackSemesterId) {
  const params = new URLSearchParams(searchText || '');
  const page = pageFromSearch(params);
  const limit = limitFromSearch(params);
  const filters = filtersFromSearch(params);
  return {
    semesterId: (params.get('semester') || fallbackSemesterId || '').trim(),
    page,
    limit,
    offset: (page - 1) * limit,
    keyword: filters.keyword,
    grade: filters.grade,
    department: filters.department,
    b2Skill: filters.b2Skill,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder
  };
}

export default function LearningJourneyDashboardPage() {
  const { setAdminPageMeta } = useOutletContext() || {};
  const token = localStorage.getItem('token') || '';
  const [searchParams, setSearchParams] = useSearchParams();
  const searchText = searchParams.toString();
  const querySemester = (searchParams.get('semester') || '').trim();
  const queryPage = pageFromSearch(searchParams);
  const queryLimit = limitFromSearch(searchParams);
  const queryOffset = (queryPage - 1) * queryLimit;
  const accessProfile = useMemo(() => buildAccessProfile(token), [token]);
  const canViewLj = hasAnyPermission(accessProfile, [
    P.CAN_VIEW_ENGLISH_TEST_TRACKING,
    P.CAN_MANAGE_ENGLISH_TEST_TRACKING
  ]);
  const teacherView = accessProfile.isTeacher && !accessProfile.isExecutive;

  useEffect(() => {
    if (!setAdminPageMeta) return undefined;
    setAdminPageMeta({
      pageTitle: teacherView ? '我的授課學生學習歷程' : '全校學習歷程總覽',
    });
    return () => setAdminPageMeta(null);
  }, [setAdminPageMeta, teacherView]);

  const [semesterId, setSemesterId] = useState(() => querySemester || DEFAULT_SEMESTER);
  const [activeBreakdown, setActiveBreakdown] = useState('grade');
  const initialSemesterSynced = useRef(false);

  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState('');
  const [b2Report, setB2Report] = useState(null);

  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState('');
  const [students, setStudents] = useState([]);
  const [studentFilters, setStudentFilters] = useState(() => filtersFromSearch(searchParams));
  const [studentsPagination, setStudentsPagination] = useState({
    limit: queryLimit,
    offset: queryOffset,
    total: 0,
    returned: 0
  });
  const [studentFilterOptions, setStudentFilterOptions] = useState({ departments: [], grades: [] });
  const [studentsReloadToken, setStudentsReloadToken] = useState(0);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownError, setBreakdownError] = useState('');
  const [breakdownRows, setBreakdownRows] = useState([]);
  const studentQuery = useMemo(
    () => studentQueryFromSearch(searchText, semesterId),
    [searchText, semesterId]
  );
  const normalizedBreakdownRows = useMemo(
    () =>
      (breakdownRows || []).map((row) => ({
        key: `${activeBreakdown}-${row.group}`,
        label: row.group,
        count: row.totalStudents,
        skills: row.skills || {}
      })),
    [breakdownRows, activeBreakdown]
  );

  const updateStudentQuery = useCallback((patch = {}, { resetPage = false } = {}) => {
    const next = new URLSearchParams(searchParams);
    STUDENT_QUERY_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        const value = patch[key];
        if (value === undefined || value === null || String(value).trim() === '') {
          next.delete(key);
        } else {
          next.set(key, String(value).trim());
        }
      }
    });
    if (resetPage) {
      next.delete('page');
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const updateDashboardSemester = (nextValue) => {
    setSemesterId(nextValue);
    updateStudentQuery({ semester: nextValue }, { resetPage: true });
  };

  const loadB2Report = useCallback(async (semesterOverride) => {
    const sem = String((semesterOverride ?? semesterId) || '').trim();
    if (!sem || !token) return;
    setKpiLoading(true);
    setKpiError('');
    try {
      const data = await getLearningJourneyV3B2Report(token, sem);
      setB2Report(data || null);
    } catch (err) {
      setB2Report(null);
      setKpiError(err.message || '讀取 B2 KPI 失敗');
    } finally {
      setKpiLoading(false);
    }
  }, [token, semesterId]);

  useEffect(() => {
    if (initialSemesterSynced.current) return;
    initialSemesterSynced.current = true;
    if (!querySemester) {
      updateStudentQuery({ semester: DEFAULT_SEMESTER }, { resetPage: true });
    }
  }, [querySemester, updateStudentQuery]);

  useEffect(() => {
    const sem = String(semesterId || '').trim();
    if (!sem) return;
    loadB2Report(sem);
    setStudentsReloadToken((v) => v + 1);
  }, [semesterId, loadB2Report]);

  useEffect(() => {
    const params = new URLSearchParams(searchText);
    const nextFilters = filtersFromSearch(params);
    const nextSemester = (params.get('semester') || '').trim();
    const rawPage = params.get('page');
    if (rawPage && pageFromSearch(params) === 1 && rawPage !== '1') {
      const next = new URLSearchParams(searchText);
      next.delete('page');
      setSearchParams(next, { replace: true });
      return;
    }
    setStudentFilters(nextFilters);
    setStudentsPagination((prev) => ({
      ...prev,
      limit: studentQuery.limit,
      offset: studentQuery.offset
    }));
    if (nextSemester) {
      setSemesterId(nextSemester);
    }
  }, [searchText, setSearchParams, studentQuery.limit, studentQuery.offset]);

  useEffect(() => {
    const nextKeyword = String(studentFilters.keyword || '').trim();
    if (nextKeyword === studentQuery.keyword) return undefined;
    const timer = setTimeout(() => {
      updateStudentQuery({ keyword: nextKeyword }, { resetPage: true });
    }, 400);
    return () => clearTimeout(timer);
  }, [studentFilters.keyword, studentQuery.keyword, updateStudentQuery]);

  useEffect(() => {
    const sem = String(studentQuery.semesterId || '').trim();
    if (!sem) return;
    const controller = new AbortController();
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    setStudentsLoading(true);
    setStudentsError('');
    getLearningJourneyV3Students(token, sem, {
      keyword: studentQuery.keyword,
      grade: studentQuery.grade,
      department: studentQuery.department,
      b2Skill: studentQuery.b2Skill,
      sortBy: studentQuery.sortBy,
      sortOrder: studentQuery.sortOrder,
      limit: studentQuery.limit,
      offset: studentQuery.offset
    }, {
      signal: controller.signal
    })
      .then((data) => {
        const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
        if (typeof console !== 'undefined' && console.debug) {
          console.debug('[LearningJourneyStudentTable] fetch ms', Math.round(elapsed), {
            semesterId: sem,
            page: studentQuery.page,
            limit: studentQuery.limit,
            offset: studentQuery.offset,
            total: data?.pagination?.total
          });
        }
        const nextLimit = Number(data?.pagination?.limit ?? studentQuery.limit);
        const nextTotal = Number(data?.pagination?.total ?? 0);
        const nextTotalPages = Math.max(1, Math.ceil(nextTotal / Math.max(nextLimit, 1)));
        if (nextTotal > 0 && studentQuery.page > nextTotalPages) {
          updateStudentQuery({ page: nextTotalPages });
          return;
        }
        setStudents(Array.isArray(data?.items) ? data.items : []);
        setStudentsPagination((prev) => ({
          limit: nextLimit,
          offset: Number(data?.pagination?.offset ?? prev.offset),
          total: nextTotal,
          returned: Number(data?.pagination?.returned ?? 0)
        }));
        setStudentFilterOptions({
          departments: Array.isArray(data?.filters?.departments) ? data.filters.departments : [],
          grades: Array.isArray(data?.filters?.grades) ? data.filters.grades : []
        });
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setStudentsError(err.message || '讀取學生清單失敗');
      })
      .finally(() => {
        if (!controller.signal.aborted) setStudentsLoading(false);
      });
    return () => controller.abort();
  }, [
    token,
    studentsReloadToken,
    studentQuery,
    updateStudentQuery
  ]);

  useEffect(() => {
    const sem = String(semesterId || '').trim();
    if (!sem) return;
    setBreakdownLoading(true);
    setBreakdownError('');
    getLearningJourneyV3Breakdown(token, sem, activeBreakdown)
      .then((data) => setBreakdownRows(Array.isArray(data) ? data : []))
      .catch((err) => {
        setBreakdownRows([]);
        setBreakdownError(err.message || '讀取分項統計失敗');
      })
      .finally(() => setBreakdownLoading(false));
  }, [token, semesterId, activeBreakdown]);

  if (!canViewLj) {
    return (
      <div className="container-fluid py-3">
        <div className="alert alert-warning mb-0">您沒有檢視英語學習歷程的權限。</div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <p className="text-muted mb-0">
          依學期查看 CEFR B2 以上人數、分項統計與學生清單。請用下方「學生清單」以學號或姓名搜尋。
        </p>
      </div>

      <div className="card mb-3">
        <div className="card-header fw-semibold d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span title="Common European Framework of Reference：B2 以上人數">B2 程度（四技能）</span>
          <div className="d-flex align-items-center gap-2">
            <label htmlFor="lj-dashboard-semester" className="small text-muted mb-0">學期</label>
            <select
              id="lj-dashboard-semester"
              className="form-select form-select-sm"
              style={{ width: '9rem' }}
              value={semesterId}
              onChange={(e) => updateDashboardSemester(e.target.value)}
            >
              {DASHBOARD_SEMESTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="card-body">
          <B2KpiSection loading={kpiLoading} report={b2Report} error={kpiError} />
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header fw-semibold">成效分析摘要</div>
        <div className="card-body">
          <LearningJourneyAnalyticsPanel token={token} semesterId={semesterId} />
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header fw-semibold">分項統計</div>
        <div className="card-body">
          <BreakdownTabs activeTab={activeBreakdown} onChange={setActiveBreakdown} />
          <div className="mt-3">
            <BreakdownTable
              loading={breakdownLoading}
              error={breakdownError}
              rows={normalizedBreakdownRows}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header fw-semibold">學生清單</div>
        <div className="card-body">
          <StudentFilters
            value={studentFilters}
            grades={studentFilterOptions.grades}
            departments={studentFilterOptions.departments}
            loading={studentsLoading}
            onChange={(next, changedKey) => {
              setStudentFilters(next);
              if (changedKey === 'keyword') return;
              updateStudentQuery({
                keyword: next.keyword,
                grade: next.grade,
                department: next.department,
                b2Skill: next.b2Skill,
                sortBy: next.sortBy,
                sortDirection: next.sortOrder
              }, { resetPage: true });
            }}
            onKeywordCommit={(keyword) => {
              const next = { ...studentFilters, keyword };
              setStudentFilters(next);
              updateStudentQuery({ keyword }, { resetPage: true });
            }}
            onReset={() => {
              setStudentFilters(DEFAULT_STUDENT_FILTERS);
              updateStudentQuery({
                keyword: '',
                grade: '',
                department: '',
                b2Skill: '',
                sortBy: '',
                sortDirection: '',
                page: ''
              });
            }}
          />
          <StudentTable
            loading={studentsLoading}
            error={studentsError}
            students={students}
            semesterId={semesterId}
            pagination={studentsPagination}
            onPageChange={(nextOffset) => {
              const nextPage = Math.floor(Math.max(0, nextOffset) / Math.max(studentsPagination.limit, 1)) + 1;
              updateStudentQuery({ page: nextPage });
            }}
          />
        </div>
      </div>
    </div>
  );
}
