// 培力英檢抵免審核（資料來源：english_test_registrations，有 B2 成績者）
import React, { useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Form,
  Spinner,
  Alert,
  Badge,
  Modal,
  Row,
  Col
} from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useEnglishTestExemption } from '../../hooks/useEnglishTestExemption';

const EXAM_TYPE_LABEL = {
  LRSW: '聽說讀寫',
  LR: '聽讀',
  SW: '說寫',
  NON: '不報考'
};

const VERIFIED_OPTIONS = [
  { value: 'LRSW', label: '聽讀說寫' },
  { value: 'LR', label: '聽讀' },
  { value: 'SW', label: '說寫' },
  { value: 'NONE', label: '無' }
];

function parseB2Files(raw) {
  if (!raw) return [];
  try {
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(p)) return p.filter(Boolean);
    return [p];
  } catch {
    return [raw];
  }
}

function fileToUrl(path) {
  if (!path) return '';
  const s = String(path).replace(/^\/+/, '');
  if (s.startsWith('uploads/')) return `/${s}`;
  return `/uploads/${s}`;
}

export default function ExemptionReviewSection({ token }) {
  const navigate = useNavigate();
  const {
    semester,
    setSemester,
    search,
    setSearch,
    page,
    setPage,
    loading,
    error,
    rows,
    total,
    totalPages,
    showModal,
    setShowModal,
    selected,
    pendingNav,
    setPendingNav,
    reviewAction,
    setReviewAction,
    verifiedType,
    setVerifiedType,
    reviewNote,
    setReviewNote,
    saving,
    lightbox,
    setLightbox,
    openReview,
    submitReview,
    applySearch,
  } = useEnglishTestExemption({ token });

  const goBestepClass = (row) => {
    if (row.bestepClassId) {
      navigate(`/admin/classes/${row.bestepClassId}/bestep?semester=${encodeURIComponent(semester)}`);
    } else {
      try {
        window.dispatchEvent(
          new CustomEvent('eears:toast', {
            detail: { message: '此學期查無班級名冊對應，無法前往班級 BESTEP', variant: 'warning' }
          })
        );
      } catch (_) {}
    }
  };

  const selectedIndexInPage = selected
    ? rows.findIndex((r) => r.id === selected.id)
    : -1;

  const canNavigatePrevious =
    !saving &&
    selected &&
    (selectedIndexInPage > 0 || page > 1);

  const canNavigateNext =
    !saving &&
    selected &&
    ((selectedIndexInPage >= 0 && selectedIndexInPage < rows.length - 1) || page < totalPages);

  const navigateModalPrevNext = async (dir) => {
    if (!selected || saving) return;

    // 1) 優先在同一頁切換
    const idx = rows.findIndex((r) => r.id === selected.id);
    if (dir === 'prev' && idx > 0) {
      openReview(rows[idx - 1]);
      return;
    }
    if (dir === 'next' && idx >= 0 && idx < rows.length - 1) {
      openReview(rows[idx + 1]);
      return;
    }

    // 2) 邊界：切換分頁並在載入完成後打開上一筆/下一筆
    if (dir === 'prev' && page > 1) {
      setPendingNav('prev');
      setPage((p) => Math.max(1, p - 1));
      return;
    }
    if (dir === 'next' && page < totalPages) {
      setPendingNav('next');
      setPage((p) => Math.min(totalPages, p + 1));
      return;
    }
  };

  useEffect(() => {
    if (!pendingNav || !showModal) return;
    if (!rows || rows.length === 0) return;

    if (pendingNav === 'prev') {
      openReview(rows[rows.length - 1]);
    } else if (pendingNav === 'next') {
      openReview(rows[0]);
    }
    setPendingNav(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingNav, rows, showModal]);

  return (
    <div>
      <Card className="mb-3">
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col md={2}>
              <Form.Label className="small">學期</Form.Label>
              <Form.Select
                value={semester}
                onChange={(e) => {
                  setSemester(e.target.value);
                  setPage(1);
                }}
              >
                <option value="114-1">114-1</option>
                <option value="113-2">113-2</option>
                <option value="114-2">114-2</option>
                <option value="115-1">115-1</option>
                <option value="115-2">115-2</option>
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label className="small">搜尋學號／姓名</Form.Label>
              <Form.Control
                placeholder="可選"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              />
            </Col>
            <Col md="auto">
              <Button
                variant="primary"
                onClick={applySearch}
              >
                查詢
              </Button>
            </Col>
          </Row>
          <p className="text-muted small mt-2 mb-0">
            僅列出「有填寫 B2 成績」之報名紀錄（依學期篩選）。
          </p>
        </Card.Body>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : (
        <Table responsive striped bordered hover size="sm">
          <thead>
            <tr>
              <th>學號</th>
              <th>姓名</th>
              <th>報考項目</th>
              <th>學生填寫抵免項目</th>
              <th>審核狀態</th>
              <th>附件</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-muted py-4">
                  無符合資料
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.studentId}</td>
                  <td>{row.name || row.studentNameZh}</td>
                  <td>{EXAM_TYPE_LABEL[row.examType] || row.examType || '—'}</td>
                  <td>{row.studentRequestedExemptionLabel || '—'}</td>
                  <td>
                    <Badge bg={
                      row.exemption_review_status === 'approved' ? 'success' :
                      row.exemption_review_status === 'rejected' ? 'danger' :
                      row.exemption_review_status === 'revision' ? 'warning' :
                      row.exemption_review_status === 'pending' ? 'info' : 'secondary'
                    }>
                      {row.exemptionStatusLabel}
                    </Badge>
                  </td>
                  <td>
                    {row.b2CertificateFile ? (
                      <Badge bg="light" text="dark">有</Badge>
                    ) : (
                      <span className="text-muted">無</span>
                    )}
                  </td>
                  <td>
                    <Button size="sm" variant="outline-primary" className="me-1" onClick={() => openReview(row)}>
                      審核
                    </Button>
                    <Button size="sm" variant="outline-info" onClick={() => goBestepClass(row)}>
                      班級 BESTEP
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      )}

      {totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center">
          <small className="text-muted">共 {total} 筆</small>
          <div>
            <Button
              size="sm"
              variant="outline-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              上一頁
            </Button>
            <span className="mx-2 small">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一頁
            </Button>
          </div>
        </div>
      )}

      <Modal
        show={showModal}
        onHide={() => !saving && setShowModal(false)}
        size="xl"
        contentClassName="position-relative"
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>抵免審核 — {selected?.name} ({selected?.studentId})</Modal.Title>
        </Modal.Header>

        {/* 上一筆（跨頁/同頁） */}
        {canNavigatePrevious && (
          <button
            type="button"
            className="btn btn-light position-absolute top-50 start-0 translate-middle-y d-flex align-items-center justify-content-center border-2 border-primary bg-primary text-white shadow"
            style={{
              width: '44px',
              height: '44px',
              left: '-26px',
              zIndex: 1060,
              clipPath: 'polygon(100% 0, 100% 100%, 0 50%)',
              borderRadius: '4px 0 0 4px'
            }}
            onClick={() => navigateModalPrevNext('prev')}
            title="上一筆（當前篩選）"
            aria-label="上一筆"
          >
            <i className="fas fa-chevron-left" />
          </button>
        )}

        {/* 下一筆（跨頁/同頁） */}
        {canNavigateNext && (
          <button
            type="button"
            className="btn btn-light position-absolute top-50 end-0 translate-middle-y d-flex align-items-center justify-content-center border-2 border-primary bg-primary text-white shadow"
            style={{
              width: '44px',
              height: '44px',
              right: '-26px',
              zIndex: 1060,
              clipPath: 'polygon(0 0, 0 100%, 100% 50%)',
              borderRadius: '0 4px 4px 0'
            }}
            onClick={() => navigateModalPrevNext('next')}
            title="下一筆（當前篩選）"
            aria-label="下一筆"
          >
            <i className="fas fa-chevron-right" />
          </button>
        )}

        <Modal.Body>
          {selected && (
            <Row>
              <Col md={6}>
                <h6 className="border-bottom pb-2">學生填寫成績（B2）／原始抵免參考</h6>
                <p className="small mb-1">
                  <strong>原始抵免項目（依成績推估）：</strong>
                  {selected.studentRequestedExemptionLabel}
                </p>
                <table className="table table-sm table-bordered small">
                  <tbody>
                    <tr><td>聽力</td><td>{selected.listeningExamType || '—'}</td><td>{selected.listeningScore || '—'}</td></tr>
                    <tr><td>閱讀</td><td>{selected.readingExamType || '—'}</td><td>{selected.readingScore || '—'}</td></tr>
                    <tr><td>口說</td><td>{selected.speakingExamType || '—'}</td><td>{selected.speakingScore || '—'}</td></tr>
                    <tr><td>寫作</td><td>{selected.writingExamType || '—'}</td><td>{selected.writingScore || '—'}</td></tr>
                  </tbody>
                </table>
              </Col>
              <Col md={6}>
                <h6 className="border-bottom pb-2">證明圖片</h6>
                <div className="d-flex flex-wrap gap-2">
                  {parseB2Files(selected.b2CertificateFile).map((f, i) => {
                    const url = fileToUrl(f);
                    const isPdf = /\.pdf$/i.test(url);
                    return (
                      <div key={i} className="border rounded p-1" style={{ maxWidth: '48%' }}>
                        {isPdf ? (
                          <a href={url} target="_blank" rel="noreferrer">開啟 PDF</a>
                        ) : (
                          <img
                            src={url}
                            alt=""
                            style={{ maxWidth: '100%', cursor: 'zoom-in' }}
                            onClick={() => setLightbox(url)}
                          />
                        )}
                      </div>
                    );
                  })}
                  {!selected.b2CertificateFile && <span className="text-muted">無上傳檔案</span>}
                </div>
              </Col>
            </Row>
          )}

          <hr />
          <h6>審核操作</h6>
          <Form.Group className="mb-2">
            <Form.Label>結果</Form.Label>
            <Form.Select
              value={reviewAction}
              onChange={(e) => setReviewAction(e.target.value)}
            >
              <option value="pending">審核中</option>
              <option value="approved">通過（Approve）</option>
              <option value="rejected">拒絕（Reject）</option>
              <option value="revision">退回修正（Revision）</option>
            </Form.Select>
          </Form.Group>
          {reviewAction === 'approved' && (
            <Form.Group className="mb-2">
              <Form.Label>最終抵免項目（verified）</Form.Label>
              <Form.Select value={verifiedType} onChange={(e) => setVerifiedType(e.target.value)}>
                {VERIFIED_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Form.Select>
            </Form.Group>
          )}
          <Form.Group>
            <Form.Label>備註</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>
            取消
          </Button>
          <Button variant="primary" onClick={submitReview} disabled={saving}>
            {saving ? '儲存中…' : '儲存審核'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={!!lightbox} onHide={() => setLightbox(null)} size="lg" centered>
        <Modal.Body className="text-center p-0">
          {lightbox && (
            <img src={lightbox} alt="" style={{ maxWidth: '100%' }} />
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}
