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
      <strong>Learning Journey 達標率（canonical）</strong>：來自英語學習歷程 active roster 與 et 技能成績，至少一項最佳技能達 B2+；與報名表的
      hasCEFRB2 <strong>無關</strong>。
    </p>
    <p className="mb-2">
      <strong>Legacy B2 標記比例</strong>：來自 <code>english_test_registrations.hasCEFRB2</code> 之營運欄位，<strong>不得</strong>稱為 LJ
      達標率。
    </p>
    <p className="mb-2">
      <strong>班級名冊高風險</strong>：母體為 <code>class_memberships</code>，與 LJ 名冊內高風險人數<strong>不同母體</strong>。
    </p>
    <p className="mb-2">
      <strong>教學綜合指標（proxy）</strong>：班級層級 KPI 加權合成，<strong>不代表</strong>個別教師因果影響；API 可能仍使用
      <code>teacherImpact</code> 鍵名。
    </p>
    <p className="mb-0">
      <strong>generatedAt／updatedAt</strong>：generatedAt 為指標計算時間；updatedAt 若未接資料治理可能為 null，不代表匯入完成時間。完整匯出欄位見{' '}
      <code>docs/analytics-and-reports-export-spec.md</code>。
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
  const [classId, setClassId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [semester, setSemester] = useState('114-1');
  /** 正式建議僅 Excel；PDF 未安裝 pdfkit 時 API 回 501 */
  const [format] = useState('xlsx');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [showMetricsModal, setShowMetricsModal] = useState(false);

  const getUrl = () => {
    const qs = `semester=${encodeURIComponent(semester)}&format=${encodeURIComponent(format)}`;
    if (scope === 'class') return `/api/reports/class/${encodeURIComponent(classId)}?${qs}`;
    if (scope === 'teacher') return `/api/reports/teacher/${encodeURIComponent(teacherId)}?${qs}`;
    if (scope === 'high-risk') return `/api/reports/high-risk?${qs}`;
    return `/api/reports/overview?${qs}`;
  };

  const scopeDescription = useMemo(() => {
    if (scope === 'overview') return '多工作表：報表摘要、LJ 核心 KPI、活動預約營運、班級行政 KPI（詳見 export spec）。';
    if (scope === 'class') return '單一班級本學期 KPI 與班級名冊高風險人數等（需班級 ID）。';
    if (scope === 'teacher') return '教師本學期班級彙總（需教師 ID）；與「我的教學儀表板」資料來源相近。';
    return '班級名冊母體、僅列高風險（high）；Excel 專用。';
  }, [scope]);

  const onDownload = async () => {
    setError('');
    setSuccess('');
    if (scope === 'class' && !classId.trim()) return setError('請輸入班級 ID');
    if (scope === 'teacher' && !teacherId.trim()) return setError('請輸入教師 ID');
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
        <h1 className="h5 mb-0 text-primary">報表下載</h1>
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
                <option value="overview">行政總覽（Overview）</option>
                <option value="high-risk">高風險學生名單（班級名冊母體）</option>
                <option value="class">單一班級報表（Class）</option>
                <option value="teacher">教學儀表板報表（Teacher）</option>
              </Form.Select>
              <Form.Text className="text-muted">{scopeDescription}</Form.Text>
            </Form.Group>
            {scope === 'class' && (
              <Form.Group>
                <Form.Label>班級 ID</Form.Label>
                <Form.Control
                  placeholder="請輸入班級識別碼"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                />
              </Form.Group>
            )}
            {scope === 'teacher' && (
              <Form.Group>
                <Form.Label>教師 ID</Form.Label>
                <Form.Control
                  placeholder="請輸入教師帳號識別碼"
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                />
              </Form.Group>
            )}
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
