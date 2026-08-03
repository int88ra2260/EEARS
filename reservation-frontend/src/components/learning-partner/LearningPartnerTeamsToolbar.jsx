import React from 'react';
import { Form } from 'react-bootstrap';
import { SEMESTER_OPTIONS } from '../../utils/semesterUtils';
import { TEAM_STATUS_MAP } from '../../utils/learningPartnerDisplayHelpers';

export default function LearningPartnerTeamsToolbar({
  semesterFilter,
  onSemesterChange,
  statusFilter,
  onStatusFilterChange,
  statusCounts,
  searchTerm,
  onSearchTermChange,
  exporting,
  onExport,
  teamsCount,
}) {
  return (
    <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
      <div className="d-flex gap-2 flex-wrap align-items-center">
        <Form.Select
          value={semesterFilter}
          onChange={(e) => onSemesterChange(e.target.value)}
          style={{ minWidth: '150px' }}
        >
          <option value="">全部學期</option>
          {SEMESTER_OPTIONS.filter((opt) => opt.value !== '').map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Form.Select>

        <div className="btn-group" role="group">
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => onStatusFilterChange('all')}
          >
            全部 <span className="badge bg-secondary">{statusCounts.all || 0}</span>
          </button>
          {Object.keys(TEAM_STATUS_MAP).map((status) => (
            <button
              key={status}
              type="button"
              className={`btn btn-sm ${statusFilter === status ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => onStatusFilterChange(status)}
            >
              {TEAM_STATUS_MAP[status].text}{' '}
              <span className="badge bg-secondary">{statusCounts[status] || 0}</span>
            </button>
          ))}
        </div>

        <div className="input-group" style={{ minWidth: '250px' }}>
          <span className="input-group-text">
            <i className="fas fa-search"></i>
          </span>
          <input
            type="text"
            className="form-control"
            placeholder="搜尋團體編號、學號、姓名..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
          />
        </div>
      </div>

      <button
        className="btn btn-success"
        onClick={onExport}
        disabled={exporting || teamsCount === 0}
      >
        {exporting ? (
          <>
            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
            匯出中...
          </>
        ) : (
          <>
            <i className="fas fa-download me-2"></i>
            匯出 CSV
          </>
        )}
      </button>
    </div>
  );
}
