import React from 'react';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';

const EMPTY_COPY = {
  'no-data': {
    title: '尚無可顯示的分析資料',
    detail: '請至學習歷程維運執行背景重建（全部）。',
  },
  'no-match': {
    title: '這組條件下沒有符合的學生',
    detail: '放寬條件後再按套用。',
  },
  'low-sample': {
    title: '樣本太少，先不要比較',
    detail: '人數不足時，平均與排序容易被少數人拉動。',
  },
};

export default function LearningAnalyticsStatus({
  loading = false,
  error = '',
  emptyKind = null,
  emptyMessage = '',
}) {
  if (error) {
    return <Alert variant="danger" className="mt-3 mb-0">{error}</Alert>;
  }
  if (loading) {
    return (
      <div className="text-center py-5" role="status">
        <Spinner animation="border" />
        <div className="text-muted mt-2 small">正在依目前條件載入…</div>
      </div>
    );
  }
  if (!emptyKind || !EMPTY_COPY[emptyKind]) return null;
  const copy = EMPTY_COPY[emptyKind];
  return (
    <Alert variant={emptyKind === 'no-data' ? 'warning' : 'info'} className="mt-3 mb-0">
      <div className="fw-semibold mb-1">{copy.title}</div>
      <div>{emptyMessage || copy.detail}</div>
    </Alert>
  );
}
