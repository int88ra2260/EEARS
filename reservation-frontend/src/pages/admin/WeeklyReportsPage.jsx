import React, { useState, useEffect, useCallback } from 'react';
import { fetchClient } from '../../utils/fetchClient';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function WeeklyReportsPage() {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [content, setContent] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchClient('/api/weekly-reports');
      if (!res.ok) throw new Error('無法載入週報列表');
      const data = await res.json();
      setReports(data.reports || []);
      
      if (data.reports?.length > 0 && !selectedReport) {
        loadReportContent(data.reports[0].filename);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedReport]);

  const loadReportContent = async (filename) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchClient(`/api/weekly-reports/${encodeURIComponent(filename)}`);
      if (!res.ok) throw new Error('無法載入週報內容');
      const data = await res.json();
      setSelectedReport(filename);
      setContent(data.content);
      setEditContent(data.content);
      setEditMode(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedReport) return;
    
    try {
      setSaving(true);
      setError(null);
      const res = await fetchClient(`/api/weekly-reports/${encodeURIComponent(selectedReport)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });
      
      if (!res.ok) throw new Error('儲存失敗');
      
      setContent(editContent);
      setEditMode(false);
      
      window.dispatchEvent(new CustomEvent('eears:toast', {
        detail: { message: '週報已更新', variant: 'success' }
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const currentReportInfo = reports.find(r => r.filename === selectedReport);

  return (
    <div className="container-fluid py-4">
      <div className="row">
        <div className="col-12 col-lg-3 mb-4">
          <div className="card">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">
                <i className="fas fa-calendar-week me-2"></i>
                週報列表
              </h5>
            </div>
            <div className="card-body p-0">
              {loading && reports.length === 0 ? (
                <div className="text-center py-4">
                  <div className="spinner-border spinner-border-sm text-primary" role="status">
                    <span className="visually-hidden">載入中...</span>
                  </div>
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center text-muted py-4">
                  <i className="fas fa-inbox fa-2x mb-2 d-block"></i>
                  尚無週報
                </div>
              ) : (
                <ul className="list-group list-group-flush">
                  {reports.map((report) => (
                    <li
                      key={report.filename}
                      className={`list-group-item list-group-item-action ${
                        selectedReport === report.filename ? 'active' : ''
                      }`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => loadReportContent(report.filename)}
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fw-semibold">
                            {report.year ? `${report.year} W${String(report.week).padStart(2, '0')}` : report.title}
                          </div>
                          {report.startDate && (
                            <small className={selectedReport === report.filename ? 'text-white-50' : 'text-muted'}>
                              {report.startDate} ~ {report.endDate}
                            </small>
                          )}
                        </div>
                        <i className="fas fa-chevron-right"></i>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-9">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                {currentReportInfo?.title || '週報內容'}
              </h5>
              <div>
                {selectedReport && !editMode && (
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => setEditMode(true)}
                  >
                    <i className="fas fa-edit me-1"></i>
                    編輯
                  </button>
                )}
                {editMode && (
                  <>
                    <button
                      className="btn btn-outline-secondary btn-sm me-2"
                      onClick={() => {
                        setEditContent(content);
                        setEditMode(false);
                      }}
                      disabled={saving}
                    >
                      取消
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                          儲存中...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-save me-1"></i>
                          儲存
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="card-body">
              {error && (
                <div className="alert alert-danger" role="alert">
                  <i className="fas fa-exclamation-circle me-2"></i>
                  {error}
                </div>
              )}
              
              {loading && selectedReport ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">載入中...</span>
                  </div>
                </div>
              ) : !selectedReport ? (
                <div className="text-center text-muted py-5">
                  <i className="fas fa-file-alt fa-3x mb-3 d-block"></i>
                  <p>請從左側選擇週報</p>
                </div>
              ) : editMode ? (
                <textarea
                  className="form-control font-monospace"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  style={{ minHeight: '70vh', fontSize: '0.9rem' }}
                />
              ) : (
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .markdown-content {
          line-height: 1.7;
        }
        .markdown-content h1 {
          font-size: 1.75rem;
          border-bottom: 2px solid #dee2e6;
          padding-bottom: 0.5rem;
          margin-bottom: 1rem;
        }
        .markdown-content h2 {
          font-size: 1.4rem;
          border-bottom: 1px solid #dee2e6;
          padding-bottom: 0.3rem;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .markdown-content h3 {
          font-size: 1.2rem;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .markdown-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
        }
        .markdown-content th,
        .markdown-content td {
          border: 1px solid #dee2e6;
          padding: 0.5rem 0.75rem;
          text-align: left;
        }
        .markdown-content th {
          background-color: #f8f9fa;
          font-weight: 600;
        }
        .markdown-content tr:nth-child(even) {
          background-color: #f8f9fa;
        }
        .markdown-content ul,
        .markdown-content ol {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
        }
        .markdown-content li {
          margin: 0.25rem 0;
        }
        .markdown-content code {
          background-color: #f8f9fa;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-size: 0.875em;
        }
        .markdown-content pre {
          background-color: #f8f9fa;
          padding: 1rem;
          border-radius: 0.375rem;
          overflow-x: auto;
        }
        .markdown-content pre code {
          background: none;
          padding: 0;
        }
        .markdown-content hr {
          border: none;
          border-top: 1px solid #dee2e6;
          margin: 1.5rem 0;
        }
        .markdown-content blockquote {
          border-left: 4px solid #0d6efd;
          padding-left: 1rem;
          margin: 1rem 0;
          color: #6c757d;
        }
      `}</style>
    </div>
  );
}
