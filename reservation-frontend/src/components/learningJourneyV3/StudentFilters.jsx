import React from 'react';

const DEFAULT_SORT_BY = 'studentId';
const DEFAULT_SORT_ORDER = 'asc';

export const DEFAULT_STUDENT_FILTERS = Object.freeze({
  keyword: '',
  grade: '',
  department: '',
  b2Skill: '',
  sortBy: DEFAULT_SORT_BY,
  sortOrder: DEFAULT_SORT_ORDER
});

export default function StudentFilters({
  value,
  grades,
  departments,
  loading,
  onChange,
  onKeywordCommit,
  onReset
}) {
  const v = value || DEFAULT_STUDENT_FILTERS;
  const setField = (key, fieldValue) => onChange({ ...v, [key]: fieldValue }, key);

  return (
    <div className="border rounded p-3 mb-3 bg-light-subtle">
      <div className="row g-2 align-items-end">
        <div className="col-lg-3">
          <label className="form-label small mb-1">關鍵字（學號/姓名）</label>
          <input
            className="form-control"
            value={v.keyword}
            onChange={(e) => setField('keyword', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onKeywordCommit?.(e.currentTarget.value);
            }}
            placeholder="輸入學號或姓名"
            disabled={loading}
          />
        </div>
        <div className="col-lg-2">
          <label className="form-label small mb-1">年級</label>
          <select className="form-select" value={v.grade} onChange={(e) => setField('grade', e.target.value)} disabled={loading}>
            <option value="">全部</option>
            {grades.map((g) => <option key={g} value={g}>{g}</option>)}
            {!grades.includes('其他') ? <option value="其他">其他</option> : null}
          </select>
        </div>
        <div className="col-lg-2">
          <label className="form-label small mb-1">系所</label>
          <select className="form-select" value={v.department} onChange={(e) => setField('department', e.target.value)} disabled={loading}>
            <option value="">全部</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="col-lg-2">
          <label className="form-label small mb-1">技能 B2 篩選</label>
          <select className="form-select" value={v.b2Skill} onChange={(e) => setField('b2Skill', e.target.value)} disabled={loading}>
            <option value="">全部</option>
            <option value="listening">聽力 B2+</option>
            <option value="reading">閱讀 B2+</option>
            <option value="speaking">口說 B2+</option>
            <option value="writing">寫作 B2+</option>
          </select>
        </div>
        <div className="col-lg-2">
          <label className="form-label small mb-1">排序欄位</label>
          <select className="form-select" value={v.sortBy} onChange={(e) => setField('sortBy', e.target.value)} disabled={loading}>
            <option value="studentId">學號</option>
            <option value="studentName">姓名</option>
            <option value="department">系所</option>
            <option value="grade">年級</option>
            <option value="listening">聽力</option>
            <option value="reading">閱讀</option>
            <option value="speaking">口說</option>
            <option value="writing">寫作</option>
          </select>
        </div>
        <div className="col-lg-1">
          <label className="form-label small mb-1">方向</label>
          <select className="form-select" value={v.sortOrder} onChange={(e) => setField('sortOrder', e.target.value)} disabled={loading}>
            <option value="asc">升冪</option>
            <option value="desc">降冪</option>
          </select>
        </div>
      </div>
      <div className="mt-2">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onReset} disabled={loading}>
          重設篩選
        </button>
      </div>
    </div>
  );
}
