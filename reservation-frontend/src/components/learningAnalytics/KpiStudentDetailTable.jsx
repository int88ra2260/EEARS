import React, { useMemo, useState } from 'react';
import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Form from 'react-bootstrap/Form';
import Table from 'react-bootstrap/Table';
import ColumnHead, { HEAD } from './ColumnHead';
import { formatCount } from './learningAnalyticsFormat';
import StudentTrajectoryLink from './StudentTrajectoryLink';
import {
  KPI_DETAIL_PAGE_SIZES,
  filterKpiDetailRows,
  kpiDetailFilterOptions,
  pageKpiDetailRows,
  sortKpiDetailRows,
} from '../../utils/kpiStudentDetailTable';

function formatProof(proof) {
  if (!proof) return '—';
  const bits = [
    proof.instrument,
    proof.examDate,
    proof.combined != null ? `合計 ${proof.combined}` : null,
  ].filter(Boolean);
  return bits.join(' · ') || '—';
}

function SortableHead({
  label,
  hint,
  sortKey,
  activeKey,
  dir,
  onSort,
}) {
  const active = activeKey === sortKey;
  const directionLabel = active
    ? (dir === 'asc' ? '由小到大' : '由大到小')
    : '尚未排序';
  return (
    <th aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={`la-kpi-sort${active ? ' is-active' : ''}`}
        aria-label={`${label}，${directionLabel}，點一下變更排序`}
        onClick={() => onSort(sortKey)}
      >
        <ColumnHead name={label} hint={hint} />
        <span className="la-kpi-sort-mark" aria-hidden="true">
          {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}

export default function KpiStudentDetailTable({
  rows = [],
  dimensions = [],
}) {
  const [keyword, setKeyword] = useState('');
  const [grade, setGrade] = useState('');
  const [department, setDepartment] = useState('');
  const [attainment, setAttainment] = useState('all');
  const [sortKey, setSortKey] = useState('studentId');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const options = useMemo(() => kpiDetailFilterOptions(rows), [rows]);
  const view = useMemo(() => {
    const filtered = filterKpiDetailRows(rows, {
      keyword,
      grade,
      department,
      attainment,
    }, dimensions);
    const sorted = sortKpiDetailRows(filtered, sortKey, sortDir);
    return pageKpiDetailRows(sorted, page, pageSize);
  }, [rows, keyword, grade, department, attainment, dimensions, sortKey, sortDir, page, pageSize]);

  const filtersActive = Boolean(keyword.trim() || grade || department || attainment !== 'all');
  const rangeStart = view.total === 0 ? 0 : view.start + 1;
  const rangeEnd = view.start + view.rows.length;
  const columnCount = 3 + (dimensions.length * 2);

  const changeFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  const onSort = (key) => {
    setPage(1);
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(String(key).startsWith('dim:') ? 'desc' : 'asc');
  };

  const clearFilters = () => {
    setKeyword('');
    setGrade('');
    setDepartment('');
    setAttainment('all');
    setPage(1);
  };

  return (
    <div>
      <div className="row g-2 align-items-end mb-3">
        <div className="col-md-3">
          <Form.Label className="small mb-1" htmlFor="kpi-detail-keyword">學號</Form.Label>
          <Form.Control
            id="kpi-detail-keyword"
            size="sm"
            value={keyword}
            placeholder="輸入部分或完整學號"
            onChange={changeFilter(setKeyword)}
          />
        </div>
        <div className="col-md-2">
          <Form.Label className="small mb-1" htmlFor="kpi-detail-grade">年級</Form.Label>
          <Form.Select id="kpi-detail-grade" size="sm" value={grade} onChange={changeFilter(setGrade)}>
            <option value="">全部年級</option>
            {options.grades.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </Form.Select>
        </div>
        <div className="col-md-3">
          <Form.Label className="small mb-1" htmlFor="kpi-detail-department">系所</Form.Label>
          <Form.Select
            id="kpi-detail-department"
            size="sm"
            value={department}
            onChange={changeFilter(setDepartment)}
          >
            <option value="">全部系所</option>
            {options.departments.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </Form.Select>
        </div>
        <div className="col-md-3">
          <Form.Label className="small mb-1" htmlFor="kpi-detail-attainment">達標</Form.Label>
          <Form.Select
            id="kpi-detail-attainment"
            size="sm"
            value={attainment}
            onChange={changeFilter(setAttainment)}
          >
            <option value="all">全部</option>
            <option value="passed">各項都達標</option>
            <option value="unmet">至少一項未達標</option>
            {dimensions.map((dim) => (
              <React.Fragment key={dim.id}>
                <option value={`dim:${dim.id}:Y`}>{dim.label} 達標</option>
                <option value={`dim:${dim.id}:N`}>{dim.label} 未達標</option>
              </React.Fragment>
            ))}
          </Form.Select>
        </div>
        <div className="col-md-1">
          <Button
            type="button"
            size="sm"
            variant="outline-secondary"
            className="w-100"
            onClick={clearFilters}
            disabled={!filtersActive}
          >
            清除
          </Button>
        </div>
      </div>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <div className="small text-muted">
          符合 {formatCount(view.total)} / {formatCount(rows.length)} 人
          {view.total > 0 ? `，第 ${formatCount(rangeStart)}–${formatCount(rangeEnd)} 人` : ''}
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="small text-muted">每頁</span>
          <Form.Select
            size="sm"
            aria-label="每頁人數"
            value={pageSize}
            style={{ width: '6.5rem' }}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            {KPI_DETAIL_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>{size} 人</option>
            ))}
          </Form.Select>
          <ButtonGroup size="sm" aria-label="學生明細分頁">
            <Button
              type="button"
              variant="outline-secondary"
              disabled={view.page <= 1}
              onClick={() => setPage(1)}
            >
              第一頁
            </Button>
            <Button
              type="button"
              variant="outline-secondary"
              disabled={view.page <= 1}
              onClick={() => setPage(view.page - 1)}
            >
              上一頁
            </Button>
            <Button
              type="button"
              variant="outline-secondary"
              disabled={view.page >= view.pageCount}
              onClick={() => setPage(view.page + 1)}
            >
              下一頁
            </Button>
            <Button
              type="button"
              variant="outline-secondary"
              disabled={view.page >= view.pageCount}
              onClick={() => setPage(view.pageCount)}
            >
              最後一頁
            </Button>
          </ButtonGroup>
        </div>
      </div>

      <div className="table-responsive">
        <Table hover size="sm" className="mb-0 align-middle la-kpi-table">
          <thead>
            <tr>
              <SortableHead
                label="學號"
                hint="名冊上的學號。點學號可開個人軌跡。"
                sortKey="studentId"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
              />
              <SortableHead
                label="年級"
                hint="選定學期在學名冊的年級。"
                sortKey="grade"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
              />
              <SortableHead
                label="系所"
                hint="選定學期在學名冊的系所。"
                sortKey="department"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
              />
              {dimensions.map((dim) => (
                <React.Fragment key={dim.id}>
                  <SortableHead
                    label={dim.label}
                    hint="是否達到這項門檻。Y 是達標，N 是未達標。"
                    sortKey={`dim:${dim.id}`}
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={onSort}
                  />
                  <th><ColumnHead {...HEAD.proof} /></th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.rows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="text-muted">
                  沒有符合篩選的學生。
                </td>
              </tr>
            ) : view.rows.map((row) => (
              <tr key={row.studentId}>
                <td>
                  <StudentTrajectoryLink studentId={row.studentId} from="kpi">
                    {row.studentId}
                  </StudentTrajectoryLink>
                </td>
                <td>{row.grade || '—'}</td>
                <td>{row.department || '—'}</td>
                {dimensions.map((dim) => {
                  const cell = row.dimensions?.[dim.id];
                  return (
                    <React.Fragment key={dim.id}>
                      <td>{cell?.passed ? 'Y' : 'N'}</td>
                      <td className="small text-muted">{formatProof(cell?.proof)}</td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
