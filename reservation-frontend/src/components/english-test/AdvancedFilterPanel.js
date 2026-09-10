// components/english-test/AdvancedFilterPanel.js
import React, { useState, useEffect } from 'react';
import { getCurrentSemester, SEMESTER_OPTIONS } from '../../utils/semesterUtils';

export default function AdvancedFilterPanel({ 
  onFilterChange, 
  initialFilters = {},
  sortConfig = { key: 'id', direction: 'ASC' },
  onSortChange,
  searchTerm = '',
  onSearchChange,
  currentStatusFilter = 'pending'
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: initialFilters.dateFrom || '',
    dateTo: initialFilters.dateTo || '',
    examTypes: initialFilters.examTypes || [],
    isLowIncome: initialFilters.isLowIncome || '',
    hasDisabilityCard: initialFilters.hasDisabilityCard || '',
    semester: initialFilters.semester || getCurrentSemester() || '' // 預設為當前學期
  });

  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // 測驗類型選項
  const examTypeOptions = [
    { value: 'LRSW', label: '四項全考' },
    { value: 'LR', label: '只考聽讀' },
    { value: 'SW', label: '只考說寫' },
    { value: 'NON', label: '不報考' }
  ];

  const sortFieldOptions = [
    { value: 'id', label: '報名編號' },
    { value: 'successSequence', label: '報名成功序號' },
    { value: 'status', label: '狀態' },
    { value: 'studentId', label: '學號' },
    { value: 'name', label: '姓名' },
    { value: 'createdAt', label: '報名時間' }
  ];

  // 使用共用的學期選項
  const semesterOptions = SEMESTER_OPTIONS;

  // 處理篩選變更
  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange && onFilterChange(newFilters);
  };

  // 處理測驗類型複選
  const handleExamTypeToggle = (value) => {
    const newTypes = filters.examTypes.includes(value)
      ? filters.examTypes.filter(t => t !== value)
      : [...filters.examTypes, value];
    handleFilterChange('examTypes', newTypes);
  };

  // 重置篩選
  const handleReset = () => {
    const emptyFilters = {
      dateFrom: '',
      dateTo: '',
      examTypes: [],
      isLowIncome: '',
      hasDisabilityCard: '',
      semester: ''
    };
    setFilters(emptyFilters);
    onFilterChange && onFilterChange(emptyFilters);
  };

  // 搜尋建議（簡單實作，可擴展為從 API 取得）
  useEffect(() => {
    if (searchTerm && searchTerm.length >= 2) {
      // 這裡可以從 API 取得建議，目前使用簡單邏輯
      // 未來可以實作：從最近搜尋記錄或 API 取得建議
      const suggestions = [];
      setSearchSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } else {
      setSearchSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchTerm]);

  // 高亮搜尋關鍵字
  const highlightText = (text, keyword) => {
    if (!keyword) return text;
    const regex = new RegExp(`(${keyword})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} style={{ backgroundColor: '#ffeb3b', padding: '0' }}>
          {part}
        </mark>
      ) : part
    );
  };

  const statusLabelMap = { pending: '審核中', approved: '已通過', success: '報名成功', revision: '請修正', failed: '報名失敗' };
  const currentLabel = statusLabelMap[currentStatusFilter] || currentStatusFilter;

  return (
    <div className="card mb-4">
      <div
        className="card-body py-2"
        onClick={() => collapsed && setCollapsed(false)}
      >
        <div className="d-flex justify-content-between align-items-center">
          <button
            type="button"
            className="btn btn-link btn-sm p-0 text-decoration-none text-dark fw-semibold"
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
            aria-controls="advanced-filter-content"
          >
            <i className={`fas fa-chevron-${collapsed ? 'down' : 'up'} me-2`} aria-hidden />
            進階篩選
            {currentStatusFilter && (
              <span className="badge bg-light text-dark ms-2">目前標籤：{currentLabel}</span>
            )}
          </button>
          <div className="d-flex gap-2">
            {!collapsed && (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={(e) => { e.stopPropagation(); handleReset(); }}
              >
                <i className="fas fa-redo me-1" /> 重置
              </button>
            )}
          </div>
        </div>
      </div>
      <div id="advanced-filter-content" className={collapsed ? 'collapse' : 'collapse show'}>
        <div className="card-body pt-0">
        <div className="row g-3">
          {/* 搜尋框：與目前狀態標籤共同篩選 */}
          <div className="col-md-6">
            <label className="form-label">
              搜尋（學號、姓名、Email）
              {searchTerm && (
                <span className="badge bg-info ms-2">搜尋中</span>
              )}
            </label>
            <div className="position-relative">
              <input
                type="text"
                className="form-control"
                value={searchTerm}
                onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                onFocus={() => searchSuggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="輸入學號、姓名或 Email，在目前狀態下篩選"
                aria-label="搜尋學號、姓名或 Email"
              />
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="list-group position-absolute w-100" style={{ zIndex: 1000, top: '100%' }}>
                  {searchSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      className="list-group-item list-group-item-action"
                      onClick={() => {
                        onSearchChange && onSearchChange(suggestion);
                        setShowSuggestions(false);
                      }}
                    >
                      {highlightText(suggestion, searchTerm)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 日期範圍 */}
          <div className="col-md-3">
            <label className="form-label">報名日期（起始）</label>
            <input
              type="date"
              className="form-control"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">報名日期（結束）</label>
            <input
              type="date"
              className="form-control"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>

          {/* 測驗類型篩選（可複選） */}
          <div className="col-md-6">
            <label className="form-label">測驗類型（可複選）</label>
            <div className="d-flex flex-wrap gap-2">
              {examTypeOptions.map(option => (
                <div key={option.value} className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`examType-${option.value}`}
                    checked={filters.examTypes.includes(option.value)}
                    onChange={() => handleExamTypeToggle(option.value)}
                  />
                  <label className="form-check-label" htmlFor={`examType-${option.value}`}>
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
            {filters.examTypes.includes('NON') && (
              <div className="form-text mt-1">
                不報考紀錄狀態為「請修正」；勾選後會自動切到「全部」狀態標籤以便列出。
              </div>
            )}
          </div>

          {/* 學期篩選 */}
          <div className="col-md-3">
            <label className="form-label">學期</label>
            <select
              className="form-select"
              value={filters.semester}
              onChange={(e) => handleFilterChange('semester', e.target.value)}
            >
              {semesterOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 特殊身分篩選 */}
          <div className="col-md-3">
            <label className="form-label">中低收入戶</label>
            <select
              className="form-select"
              value={filters.isLowIncome}
              onChange={(e) => handleFilterChange('isLowIncome', e.target.value)}
            >
              <option value="">全部</option>
              <option value="否">否</option>
              <option value="中低收入戶">中低收入戶</option>
              <option value="低收入戶">低收入戶</option>
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label">身心障礙手冊</label>
            <select
              className="form-select"
              value={filters.hasDisabilityCard}
              onChange={(e) => handleFilterChange('hasDisabilityCard', e.target.value)}
            >
              <option value="">全部</option>
              <option value="是">是</option>
              <option value="否">否</option>
            </select>
          </div>

          {/* 排序選項 */}
          <div className="col-md-3">
            <label className="form-label">排序依據</label>
            <select
              className="form-select"
              value={sortConfig.key}
              onChange={(e) => {
                onSortChange && onSortChange({ ...sortConfig, key: e.target.value });
              }}
            >
              {sortFieldOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label">排序方向</label>
            <select
              className="form-select"
              value={sortConfig.direction}
              onChange={(e) => {
                onSortChange && onSortChange({ ...sortConfig, direction: e.target.value });
              }}
            >
              <option value="ASC">由小到大</option>
              <option value="DESC">由大到小</option>
            </select>
          </div>
        </div>

        {/* 顯示已套用的篩選條件 */}
        {(filters.dateFrom || filters.dateTo || filters.examTypes.length > 0 || 
          filters.isLowIncome || filters.hasDisabilityCard || filters.semester) && (
          <div className="mt-3">
            <small className="text-muted">已套用篩選：</small>
            <div className="d-flex flex-wrap gap-2 mt-1">
              {filters.semester && (
                <span className="badge bg-primary">
                  學期：{semesterOptions.find(o => o.value === filters.semester)?.label}
                  <button
                    className="btn-close btn-close-white ms-2"
                    style={{ fontSize: '0.7rem' }}
                    onClick={() => handleFilterChange('semester', '')}
                  ></button>
                </span>
              )}
              {filters.dateFrom && filters.dateTo && (
                <span className="badge bg-primary">
                  日期：{filters.dateFrom} ~ {filters.dateTo}
                  <button
                    className="btn-close btn-close-white ms-2"
                    style={{ fontSize: '0.7rem' }}
                    onClick={() => {
                      handleFilterChange('dateFrom', '');
                      handleFilterChange('dateTo', '');
                    }}
                  ></button>
                </span>
              )}
              {filters.examTypes.length > 0 && (
                <span className="badge bg-primary">
                  測驗類型：{filters.examTypes.map(t => 
                    examTypeOptions.find(o => o.value === t)?.label
                  ).join(', ')}
                  <button
                    className="btn-close btn-close-white ms-2"
                    style={{ fontSize: '0.7rem' }}
                    onClick={() => handleFilterChange('examTypes', [])}
                  ></button>
                </span>
              )}
              {filters.isLowIncome && (
                <span className="badge bg-primary">
                  中低收入戶：{filters.isLowIncome}
                  <button
                    className="btn-close btn-close-white ms-2"
                    style={{ fontSize: '0.7rem' }}
                    onClick={() => handleFilterChange('isLowIncome', '')}
                  ></button>
                </span>
              )}
              {filters.hasDisabilityCard && (
                <span className="badge bg-primary">
                  身心障礙：{filters.hasDisabilityCard}
                  <button
                    className="btn-close btn-close-white ms-2"
                    style={{ fontSize: '0.7rem' }}
                    onClick={() => handleFilterChange('hasDisabilityCard', '')}
                  ></button>
                </span>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
