import React, { useState } from 'react';
import { getLearningJourneyResearchExport } from '../../services/learningJourneyV3Api';

function downloadCsv(filename, text) {
  const bom = '\uFEFF';
  const payload = String(text || '').charCodeAt(0) === 0xFEFF ? text : `${bom}${text}`;
  const blob = new Blob([payload], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LearningJourneyExportPanel({ token, canManage }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastSnapshot, setLastSnapshot] = useState('');

  const handleExport = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const result = await getLearningJourneyResearchExport(token, { format: 'csv' });
      if (result?.csv) {
        downloadCsv(`lj-research-${Date.now()}.csv`, result.csv);
        setLastSnapshot(result.snapshotVersion || '');
      } else if (result?.data?.csv) {
        downloadCsv(`lj-research-${Date.now()}.csv`, result.data.csv);
        setLastSnapshot(result.data.snapshotVersion || '');
      } else {
        setError('匯出回應格式異常');
      }
    } catch (err) {
      setError(err?.message || '匯出失敗');
    } finally {
      setLoading(false);
    }
  };

  if (!canManage) return null;

  return (
    <div className="card mb-3">
      <div className="card-header fw-semibold">研究資料匯出</div>
      <div className="card-body">
        <p className="small text-muted mb-2">
          長格式 CSV（UTF-8 BOM，Excel 可直接開啟中文欄位），含 analytic_student 與 analytic_exam。
        </p>
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={handleExport} disabled={loading}>
          {loading ? '匯出中…' : '下載研究匯出 CSV'}
        </button>
        {lastSnapshot && <div className="small text-muted mt-2">上次快照：{lastSnapshot}</div>}
        {error && <div className="alert alert-danger py-2 mt-2 mb-0">{error}</div>}
      </div>
    </div>
  );
}
