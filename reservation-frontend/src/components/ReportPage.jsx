import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Form, Button, Alert, Modal } from 'react-bootstrap';
import { SEMESTER_OPTIONS } from '../utils/semesterUtils';
import { handleAPIError, showSuccessMessage } from '../utils/errorHandler';
import { fetchClient } from '../utils/fetchClient';
import { parseFilenameFromContentDisposition } from '../utils/reportDownload';
import { hasPermission } from '../utils/accessControl';
import { P } from '../constants/permissions';
import '../pages/admin/operationsSurfaces.css';

const REPORTS = [
  {
    id: 'overview',
    title: '活動營運總覽工作簿',
    purpose: '留存某一學期的活動預約，並附上既有的班級行政追蹤。',
    range: '所選學期活動日期內的活動與預約，另含班級行政追蹤。',
    sheets: '報表摘要、活動預約營運、班級行政追蹤',
    detail: '這不是活動營運總覽畫面的逐列存檔。工作簿沿用既有欄名：總預約數、預約率、簽到出席率（預約）。這些數字與總覽頁同一組結果，欄名與畫面上的「預約筆數」「預約名額比」「預約列簽到率」不同。只有學期會進入檔案。下載檔名會標成 overview 與該學期。',
  },
  {
    id: 'high-risk',
    title: '高關注名單工作簿',
    purpose: '匯出所選學期班級名冊裡、依既有 high 規則列出的學生，供行政追蹤。',
    range: '所選學期的班級名冊，只含目前標成 high 的學生。',
    sheets: '報表摘要、高風險名單',
    detail: '這份檔案依所選學期重新產生，不套用高關注名單頁的搜尋字，也不是學習成效不足的判定。工作表名稱仍是既有的「高風險名單」。下載檔名會標成 high-risk 與該學期。',
  },
];

const METRIC_HELP_SUMMARY = (
  <>
    <p className="mb-2">
      活動營運總覽工作簿的活動表，使用與活動營運總覽相同的預約筆數、名額與簽到列。檔案裡的欄名仍是既有報表用詞。
    </p>
    <p className="mb-2">
      高關注名單工作簿的母體是班級名冊，只列出既有 high。它與活動營運總覽的預約母體不同。
    </p>
    <p className="mb-0">
      generatedAt 是按下下載時的產生時間，不是資料快照完成時間。檔案不含學習成效分析的 B2 或技能指標。
    </p>
  </>
);

function fallbackFilename(scope, semester, format) {
  const ext = format === 'xlsx' ? 'xlsx' : 'pdf';
  const safeSem = String(semester || 'semester').replace(/[^\w.-]+/g, '_');
  return `EEARS_${scope}_${safeSem}_fallback.${ext}`;
}

export default function ReportPage() {
  const outlet = useOutletContext() || {};
  const token = outlet.token || localStorage.getItem('token');
  const canExport = !outlet.accessProfile || hasPermission(outlet.accessProfile, P.CAN_EXPORT_REPORTS);

  const [semester, setSemester] = useState('114-1');
  const [format] = useState('xlsx');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [showMetricsModal, setShowMetricsModal] = useState(false);

  const getUrl = (scope) => {
    const qs = `semester=${encodeURIComponent(semester)}&format=${encodeURIComponent(format)}`;
    if (scope === 'high-risk') return `/api/reports/high-risk?${qs}`;
    return `/api/reports/overview?${qs}`;
  };

  const onDownload = async (scope) => {
    setError('');
    setSuccess('');
    setDownloading(true);
    try {
      const url = getUrl(scope);
      const res = await fetchClient(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const requestId = res.headers.get('x-request-id') || res.headers.get('X-Request-Id') || null;
        const json = await res.json().catch(() => ({}));
        if (res.status === 501) {
          const baseMsg = json?.error || 'PDF 匯出目前尚未啟用，請先使用 Excel 匯出。';
          const err = new Error(requestId ? `${baseMsg}（錯誤識別碼：${requestId}）` : baseMsg);
          err.requestId = requestId;
          err.status = 501;
          throw err;
        }
        if (res.status === 413) {
          const msg413 = json?.error || json?.message || '匯出資料量過大';
          const err = new Error(msg413);
          err.requestId = requestId;
          err.status = 413;
          if (requestId) err.message = `${msg413}（錯誤識別碼：${requestId}）`;
          throw err;
        }
        const msg = json?.error || json?.message || '下載失敗';
        const err = new Error(msg);
        err.requestId = requestId;
        err.status = res.status;
        if (requestId) err.message = `${msg}（錯誤識別碼：${requestId}）`;
        throw err;
      }
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') || res.headers.get('Content-Disposition');
      const serverName = parseFilenameFromContentDisposition(cd);
      const downloadName = serverName || fallbackFilename(scope, semester, format);

      const a = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      const okMsg = `報表已下載：${downloadName}`;
      setSuccess(okMsg);
      showSuccessMessage(okMsg);
    } catch (e) {
      const fallback = handleAPIError(e);
      const msg =
        e?.message && typeof e.message === 'string' && e.message.trim()
          ? e.message
          : fallback?.display || fallback?.zh || '下載失敗';
      setError(msg);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="container-fluid px-2 px-md-3">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="h4 mb-2">營運報表下載</h1>
          <p className="text-muted mb-0">選擇一份既有工作簿與學期。按下下載後，伺服器會依該學期重新產生 Excel。格式只有 xlsx。</p>
        </div>
        <Button variant="outline-primary" size="sm" onClick={() => setShowMetricsModal(true)}>
          查看口徑說明
        </Button>
      </div>

      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Modal show={showMetricsModal} onHide={() => setShowMetricsModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>指標定義摘要</Modal.Title>
        </Modal.Header>
        <Modal.Body className="small">{METRIC_HELP_SUMMARY}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowMetricsModal(false)}>
            關閉
          </Button>
        </Modal.Footer>
      </Modal>

      <Form.Group className="mb-3" style={{ maxWidth: 240 }}>
        <Form.Label htmlFor="report-semester">學期</Form.Label>
        <Form.Select id="report-semester" value={semester} onChange={(e) => setSemester(e.target.value)}>
          {SEMESTER_OPTIONS.filter((o) => o.value).map((o) => (
            <option key={o.value} value={o.value}>{o.label || o.value}</option>
          ))}
        </Form.Select>
      </Form.Group>

      {REPORTS.map((item) => (
        <article key={item.id} className="ops-report-card">
          <h2>{item.title}</h2>
          <p className="mb-2">{item.purpose}</p>
          <p className="small mb-1"><strong>學期：</strong>{semester}</p>
          <p className="small mb-1"><strong>格式：</strong>xlsx</p>
          <p className="small mb-2"><strong>資料範圍：</strong>{item.range}</p>
          <details className="small mb-3">
            <summary>查看資料範圍與口徑</summary>
            <p className="mb-1 mt-2"><strong>工作表：</strong>{item.sheets}</p>
            <p className="text-muted mb-0">{item.detail}</p>
          </details>
          <Button
            variant="primary"
            onClick={() => onDownload(item.id)}
            disabled={downloading || !canExport}
            data-testid={`report-download-${item.id}`}
          >
            {downloading ? '產生中…' : `下載這份 Excel（${semester}）`}
          </Button>
        </article>
      ))}

      {!canExport && (
        <Alert variant="warning">這個帳號沒有報表下載權限，無法取得工作簿。</Alert>
      )}
    </div>
  );
}
