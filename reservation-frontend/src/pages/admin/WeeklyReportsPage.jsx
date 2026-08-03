import React, { useState, useEffect, useCallback } from 'react';
import { fetchClient } from '../../utils/fetchClient';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function WeeklyReportsPage() {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    week: 1,
    title: '',
    startDate: '',
    endDate: '',
    content: '',
  });

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchClient('/api/weekly-reports');
      if (!res.ok) throw new Error('無法載入週報列表');
      const data = await res.json();
      setReports(data.reports || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleCreate = async () => {
    try {
      setActionLoading(true);
      const res = await fetchClient('/api/weekly-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '建立失敗');
      }
      
      setShowCreateModal(false);
      setFormData({ year: new Date().getFullYear(), week: 1, title: '', startDate: '', endDate: '', content: '' });
      loadReports();
      
      window.dispatchEvent(new CustomEvent('eears:toast', {
        detail: { message: '週報已建立', variant: 'success' }
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedReport) return;
    
    try {
      setActionLoading(true);
      const res = await fetchClient(`/api/weekly-reports/${selectedReport.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          startDate: formData.startDate,
          endDate: formData.endDate,
          content: formData.content,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '更新失敗');
      }
      
      setShowEditModal(false);
      loadReports();
      
      window.dispatchEvent(new CustomEvent('eears:toast', {
        detail: { message: '週報已更新', variant: 'success' }
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = async (report) => {
    if (!window.confirm(`確定要送審「${report.title}」嗎？`)) return;
    
    try {
      setActionLoading(true);
      const res = await fetchClient(`/api/weekly-reports/${report.id}/submit`, {
        method: 'POST',
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '送審失敗');
      }
      
      loadReports();
      
      window.dispatchEvent(new CustomEvent('eears:toast', {
        detail: { message: '週報已送審', variant: 'success' }
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async (report) => {
    if (!window.confirm(`確定要發布「${report.title}」嗎？`)) return;
    
    try {
      setActionLoading(true);
      const res = await fetchClient(`/api/weekly-reports/${report.id}/publish`, {
        method: 'POST',
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '發布失敗');
      }
      
      loadReports();
      
      window.dispatchEvent(new CustomEvent('eears:toast', {
        detail: { message: '週報已發布', variant: 'success' }
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (report) => {
    if (!window.confirm(`確定要刪除「${report.title}」嗎？此操作無法復原。`)) return;
    
    try {
      setActionLoading(true);
      const res = await fetchClient(`/api/weekly-reports/${report.id}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '刪除失敗');
      }
      
      loadReports();
      
      window.dispatchEvent(new CustomEvent('eears:toast', {
        detail: { message: '週報已刪除', variant: 'success' }
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = async (report) => {
    try {
      const res = await fetchClient(`/api/weekly-reports/${report.id}`);
      if (!res.ok) throw new Error('無法載入週報');
      const data = await res.json();
      
      setSelectedReport(data);
      setFormData({
        year: data.year,
        week: data.week,
        title: data.title,
        startDate: data.startDate,
        endDate: data.endDate,
        content: data.content || '',
      });
      setShowEditModal(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const openPreviewModal = async (report) => {
    try {
      const res = await fetchClient(`/api/weekly-reports/${report.id}`);
      if (!res.ok) throw new Error('無法載入週報');
      const data = await res.json();
      
      setSelectedReport(data);
      setShowPreviewModal(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: 'bg-secondary',
      pending: 'bg-warning text-dark',
      published: 'bg-success',
    };
    const labels = {
      draft: '草稿',
      pending: '待審',
      published: '已發布',
    };
    return <span className={`badge ${badges[status]}`}>{labels[status]}</span>;
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="mb-1">英語中心週報</h4>
          <p className="text-muted mb-0">
            管理英語中心週報，建立後請點選「送審」按鈕，上傳核閱完後交給提撰寫。
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setFormData({ year: new Date().getFullYear(), week: getISOWeek(new Date()), title: '', startDate: '', endDate: '', content: '' });
            setShowCreateModal(true);
          }}
        >
          <i className="fas fa-plus me-1"></i>
          新增週報
        </button>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible" role="alert">
          <i className="fas fa-exclamation-circle me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)}></button>
        </div>
      )}

      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">載入中...</span>
              </div>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="fas fa-inbox fa-3x mb-3 d-block"></i>
              <p>尚無週報資料</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '120px' }}>週數</th>
                    <th>標題</th>
                    <th style={{ width: '200px' }}>週次</th>
                    <th style={{ width: '100px' }}>狀態</th>
                    <th style={{ width: '200px' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id}>
                      <td>
                        <span className="badge bg-primary">{report.weekCode}</span>
                      </td>
                      <td>{report.title}</td>
                      <td className="text-muted">{report.dateRange}</td>
                      <td>{getStatusBadge(report.status)}</td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          {report.status !== 'published' && (
                            <button
                              className="btn btn-outline-primary"
                              onClick={() => openEditModal(report)}
                              disabled={actionLoading}
                            >
                              編輯
                            </button>
                          )}
                          <button
                            className="btn btn-outline-secondary"
                            onClick={() => openPreviewModal(report)}
                            disabled={actionLoading}
                          >
                            預覽
                          </button>
                          {report.status === 'draft' && (
                            <button
                              className="btn btn-outline-warning"
                              onClick={() => handleSubmit(report)}
                              disabled={actionLoading}
                            >
                              送審
                            </button>
                          )}
                          {report.status === 'pending' && (
                            <button
                              className="btn btn-outline-success"
                              onClick={() => handlePublish(report)}
                              disabled={actionLoading}
                            >
                              發布
                            </button>
                          )}
                          {report.status !== 'published' && (
                            <button
                              className="btn btn-outline-danger"
                              onClick={() => handleDelete(report)}
                              disabled={actionLoading}
                            >
                              刪除
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 新增週報 Modal */}
      {showCreateModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">新增週報</h5>
                <button type="button" className="btn-close" onClick={() => setShowCreateModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="form-label">年份</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">週數</label>
                    <input
                      type="number"
                      className="form-control"
                      min="1"
                      max="53"
                      value={formData.week}
                      onChange={(e) => setFormData({ ...formData, week: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">起始日期</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">結束日期</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">標題</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="例如：EEARS Weekly 第 32 期"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">內容 (Markdown)</label>
                    <textarea
                      className="form-control font-monospace"
                      rows="12"
                      placeholder="請輸入週報內容..."
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  取消
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreate}
                  disabled={actionLoading || !formData.title || !formData.startDate || !formData.endDate}
                >
                  {actionLoading ? '建立中...' : '建立'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 編輯週報 Modal */}
      {showEditModal && selectedReport && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">編輯週報 - {selectedReport.weekCode}</h5>
                <button type="button" className="btn-close" onClick={() => setShowEditModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">起始日期</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">結束日期</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">標題</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">內容 (Markdown)</label>
                    <textarea
                      className="form-control font-monospace"
                      rows="15"
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  取消
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleEdit}
                  disabled={actionLoading}
                >
                  {actionLoading ? '儲存中...' : '儲存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 預覽週報 Modal */}
      {showPreviewModal && selectedReport && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {selectedReport.title}
                  <span className="ms-2">{getStatusBadge(selectedReport.status)}</span>
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowPreviewModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3 text-muted">
                  <small>
                    週次：{selectedReport.weekCode} | 
                    期間：{selectedReport.startDate} ~ {selectedReport.endDate}
                  </small>
                </div>
                <div className="markdown-content border rounded p-4 bg-light">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedReport.content || '*（尚無內容）*'}
                  </ReactMarkdown>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPreviewModal(false)}>
                  關閉
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .markdown-content {
          line-height: 1.7;
        }
        .markdown-content h1 { font-size: 1.75rem; border-bottom: 2px solid #dee2e6; padding-bottom: 0.5rem; margin-bottom: 1rem; }
        .markdown-content h2 { font-size: 1.4rem; border-bottom: 1px solid #dee2e6; padding-bottom: 0.3rem; margin-top: 1.5rem; margin-bottom: 0.75rem; }
        .markdown-content h3 { font-size: 1.2rem; margin-top: 1.25rem; margin-bottom: 0.5rem; }
        .markdown-content table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
        .markdown-content th, .markdown-content td { border: 1px solid #dee2e6; padding: 0.5rem 0.75rem; text-align: left; }
        .markdown-content th { background-color: #f8f9fa; font-weight: 600; }
        .markdown-content tr:nth-child(even) { background-color: #f8f9fa; }
        .markdown-content ul, .markdown-content ol { margin: 0.5rem 0; padding-left: 1.5rem; }
        .markdown-content li { margin: 0.25rem 0; }
        .markdown-content code { background-color: #e9ecef; padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-size: 0.875em; }
        .markdown-content pre { background-color: #f8f9fa; padding: 1rem; border-radius: 0.375rem; overflow-x: auto; }
        .markdown-content pre code { background: none; padding: 0; }
      `}</style>
    </div>
  );
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
