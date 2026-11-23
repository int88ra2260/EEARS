import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  selectKpiDetailRows,
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
  onCountedRowsChange,
  onSave,
}) {
  const [keyword, setKeyword] = useState('');
  const [grades, setGrades] = useState([]);
  const [department, setDepartment] = useState('');
  const [attainment, setAttainment] = useState('all');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [sortKey, setSortKey] = useState('studentId');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const selectAllRef = useRef(null);

  const options = useMemo(() => kpiDetailFilterOptions(rows), [rows]);
  const view = useMemo(() => {
    const filtered = filterKpiDetailRows(rows, {
      keyword,
      grades,
      department,
      attainment,
    }, dimensions);
    const counted = selectKpiDetailRows(filtered, selectedIds);
    const sorted = sortKpiDetailRows(filtered, sortKey, sortDir);
    return {
      ...pageKpiDetailRows(sorted, page, pageSize),
      filtered,
      counted,
    };
  }, [rows, keyword, grades, department, attainment, selectedIds, dimensions, sortKey, sortDir, page, pageSize]);

  useEffect(() => {
    onCountedRowsChange?.(view.counted);
  }, [view.counted, onCountedRowsChange]);

  const filtersActive = Boolean(keyword.trim() || grades.length || department || attainment !== 'all');
  const selectedInView = view.filtered.filter((row) => selectedIds.has(row.studentId)).length;
  const allFilteredChecked = view.filtered.length > 0 && selectedInView === view.filtered.length;
  const rangeStart = view.total === 0 ? 0 : view.start + 1;
  const rangeEnd = view.start + view.rows.length;
  const columnCount = 4 + (dimensions.length * 2);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedInView > 0 && !allFilteredChecked;
    }
  }, [selectedInView, allFilteredChecked]);

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
    setGrades([]);
    setDepartment('');
    setAttainment('all');
    setPage(1);
  };

  const toggleGrade = (label) => {
    setGrades((current) => (
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label]
    ));
    setPage(1);
  };

  const toggleStudent = (studentId) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    const ids = view.filtered.map((row) => row.studentId);
    setSelectedIds((current) => {
      const next = new Set(current);
      const allOn = ids.length > 0 && ids.every((id) => next.has(id));
      if (allOn) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
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
        <div className="col-md-2">
          <Button
            type="button"
            size="sm"
            variant="outline-secondary"
            className="w-100"
            onClick={clearFilters}
            disabled={!filtersActive}
          >
            清除篩選
          </Button>
        </div>
      </div>

      <fieldset className="la-kpi-grade-checks mb-3">
        <legend className="small mb-1">年級</legend>
        <div className="d-flex flex-wrap align-items-center gap-3">
          {options.grades.map((item) => (
            <Form.Check
              key={item}
              type="checkbox"
              id={`kpi-detail-grade-${item}`}
              label={item}
              checked={grades.includes(item)}
              onChange={() => toggleGrade(item)}
            />
          ))}
          <span className="small text-muted">未勾選代表全部年級，可同時選多個年級。</span>
        </div>
      </fieldset>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <div className="small text-muted">
          符合 {formatCount(view.total)} / {formatCount(rows.length)} 人
          {view.total > 0 ? `，第 ${formatCount(rangeStart)}–${formatCount(rangeEnd)} 人` : ''}
          {selectedInView > 0 ? `，已勾選 ${formatCount(selectedInView)} 人` : ''}
          {'，'}
          卡片計算 {formatCount(view.counted.length)} 人
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline-secondary"
            onClick={() => setSelectedIds(new Set())}
            disabled={selectedIds.size === 0}
          >
            清除勾選
          </Button>
          {onSave ? (
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={onSave}
              disabled={view.counted.length === 0}
            >
              儲存追蹤名單
            </Button>
          ) : null}
        </div>
      </div>
      <div className="d-flex flex-wrap justify-content-end align-items-center gap-2 mb-2">
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
              <th className="la-kpi-check">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="form-check-input"
                  aria-label="勾選所有符合篩選的學生"
                  checked={allFilteredChecked}
                  disabled={view.filtered.length === 0}
                  onChange={toggleAllFiltered}
                />
              </th>
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
                <td className="la-kpi-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    aria-label={`選取 ${row.studentId}`}
                    checked={selectedIds.has(row.studentId)}
                    onChange={() => toggleStudent(row.studentId)}
                  />
                </td>
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
