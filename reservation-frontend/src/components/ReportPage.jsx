import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, Form, Button, Alert, Modal } from 'react-bootstrap';
import { SEMESTER_OPTIONS } from '../utils/semesterUtils';
import { handleAPIError, showSuccessMessage } from '../utils/errorHandler';
import { fetchClient } from '../utils/fetchClient';
import { parseFilenameFromContentDisposition } from '../utils/reportDownload';

const METRIC_HELP_SUMMARY = (
  <>
    <p className="mb-2">
      <strong>活動營運總覽</strong>：只包含活動預約數、名額利用率、簽到出席率、違規率，以及班級名冊層級的行政追蹤指標。
    </p>
    <p className="mb-2">
      <strong>高風險學生名單</strong>：母體為 <code>class_memberships</code> 班級名冊，只列出 riskLevel=high 的行政追蹤名單。
    </p>
    <p className="mb-2">
      <strong>不含正式學習成效</strong>：B2 KPI、學生能力軌跡、技能成長、系所比較與課／師／活動成效分析，請至「學習成效分析」。
    </p>
    <p className="mb-0">
      <strong>generatedAt</strong>：報表產生時間；不是資料匯入或分析快照完成時間。
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

  const [scope, setScope] = useState('overview');
  const [semester, setSemester] = useState('114-1');
  /** 正式建議僅 Excel；PDF 未安裝 pdfkit 時 API 回 501 */
  const [format] = useState('xlsx');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [showMetricsModal, setShowMetricsModal] = useState(false);

  const getUrl = () => {
    const qs = `semester=${encodeURIComponent(semester)}&format=${encodeURIComponent(format)}`;
    if (scope === 'high-risk') return `/api/reports/high-risk?${qs}`;
    return `/api/reports/overview?${qs}`;
  };

  const scopeDescription = useMemo(() => {
    if (scope === 'overview') return '多工作表：報表摘要、活動預約營運、班級行政追蹤。';
    return '班級名冊母體、僅列高風險（high），供行政追蹤與輔導分流使用。';
  }, [scope]);

  const onDownload = async () => {
    setError('');
    setSuccess('');
    setDownloading(true);
    try {
      const url = getUrl();
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
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="h5 mb-0 text-primary">營運報表下載</h1>
        <Button variant="outline-primary" size="sm" onClick={() => setShowMetricsModal(true)}>
          查看指標定義摘要
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

      <Alert variant="info" className="small py-2">
        <strong>正式建議格式：Excel（.xlsx）。</strong>
        PDF 匯出需後端安裝 pdfkit 並完成版型驗證；目前環境<strong>未啟用</strong>，若強制以 PDF 請求將回傳 501（
        <code>PDF_EXPORT_UNAVAILABLE</code>）。下載檔名以伺服器 <code>Content-Disposition</code> 為準。
      </Alert>

      <Card className="border-primary-subtle">
        <Card.Body>
          <div className="d-flex gap-2 flex-wrap align-items-end">
            <Form.Group>
              <Form.Label>報表範圍</Form.Label>
              <Form.Select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="overview">活動營運總覽（Overview）</option>
                <option value="high-risk">高風險學生名單（班級名冊母體）</option>
              </Form.Select>
              <Form.Text className="text-muted">{scopeDescription}</Form.Text>
            </Form.Group>
            <Form.Group>
              <Form.Label>學期</Form.Label>
              <Form.Select value={semester} onChange={(e) => setSemester(e.target.value)}>
                {SEMESTER_OPTIONS.filter((o) => o.value).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label || o.value}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Button variant="primary" onClick={onDownload} disabled={downloading}>
              {downloading ? '下載中…' : '下載 Excel 報表'}
            </Button>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
