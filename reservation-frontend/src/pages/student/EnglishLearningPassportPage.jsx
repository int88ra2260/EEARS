import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Col, Form, ProgressBar, Row, Spinner, Alert } from 'react-bootstrap';
import StatusBadge from '../../components/ui/StatusBadge';
import ElpStatusBadge from '../../components/englishLearningPassport/ElpStatusBadge';
import {
  fetchElpDashboard,
  applyElpPassport,
  loadElpStudent,
  saveElpStudent,
  deleteElpSubmission,
  openElpCertificationCertificate,
} from '../../services/englishLearningPassportApi';
import { RULE_LIMIT_HINTS } from '../../constants/elpFormConfig';
import elpStudentGuideImage from '../../assets/elp-student-guide.png';
import '../../components/englishLearningPassport/elp.css';

const THRESHOLD = 100;

function PassportGuideFigure() {
  return (
    <section className="elp-guide-card" aria-labelledby="elp-guide-title">
      <div className="elp-guide-card__header">
        <div>
          <p className="elp-guide-card__kicker">學生使用說明</p>
          <h2 id="elp-guide-title">英語實踐歷程檔案快速指南</h2>
          <p>
            先申請護照，審核通過後提交任務附件並累積點數；滿 100 點即可申請英語能力標準認證。
          </p>
        </div>
        <a
          className="elp-guide-card__open"
          href={elpStudentGuideImage}
          target="_blank"
          rel="noreferrer"
        >
          開啟大圖
        </a>
      </div>
      <a
        className="elp-guide-card__image-link"
        href={elpStudentGuideImage}
        target="_blank"
        rel="noreferrer"
        aria-label="開啟英語實踐歷程檔案快速指南大圖"
      >
        <img
          className="elp-guide-card__image"
          src={elpStudentGuideImage}
          alt="EEARS 英語實踐歷程檔案學生使用說明，包含申請護照、等待核准、完成任務並上傳、查看累積點數、滿 100 點申請認證等流程"
        />
      </a>
    </section>
  );
}

export default function EnglishLearningPassportPage() {
  const navigate = useNavigate();
  const [student, setStudent] = useState(() => loadElpStudent());
  const [form, setForm] = useState({ studentId: '', studentName: '', studentEmail: '' });
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const loadSeqRef = useRef(0);

  const loadDashboard = useCallback(async (s) => {
    if (!s?.studentId) return;
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError('');
    try {
      const data = await fetchElpDashboard(s);
      if (seq !== loadSeqRef.current) return;
      setDashboard(data);
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      if (e.message?.includes('身分')) {
        setStudent(null);
        localStorage.removeItem('eears_elp_student');
      }
      const msg = e.code === 'RATE_LIMIT_EXCEEDED'
        ? '查詢過於頻繁，請稍候 1～2 分鐘後再試'
        : (e.message || '載入失敗');
      setError(msg);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (student) {
      setForm(student);
      loadDashboard(student);
    }
  }, [student, loadDashboard]);

  const handleIdentify = (e) => {
    e.preventDefault();
    const s = {
      studentId: form.studentId.trim(),
      studentName: form.studentName.trim(),
      studentEmail: form.studentEmail.trim(),
    };
    if (!s.studentId || !s.studentName || !s.studentEmail) {
      setError('請填寫學號、姓名與 Email');
      return;
    }
    saveElpStudent(s);
    setStudent(s);
  };

  const handleApply = async () => {
    setApplying(true);
    setError('');
    try {
      await applyElpPassport(student, '');
      await loadDashboard(student);
    } catch (e) {
      setError(e.message || '申請失敗');
    } finally {
      setApplying(false);
    }
  };

  const handleDeleteSubmission = async (submissionId) => {
    if (!window.confirm('確定要刪除此紀錄？刪除後無法復原。')) return;
    setDeletingId(submissionId);
    setError('');
    try {
      await deleteElpSubmission(student, submissionId);
      await loadDashboard(student);
    } catch (e) {
      setError(e.message || '刪除失敗');
    } finally {
      setDeletingId(null);
    }
  };

  const renderSubmissionRow = (s, { showDelete = false } = {}) => (
    <div
      key={s.id}
      className={`list-group-item status-${s.status}`}
    >
      <div className="d-flex justify-content-between align-items-center gap-2">
        <Link
          to={`/student/english-learning-passport/submissions/${s.id}`}
          className="flex-grow-1 text-decoration-none text-body"
        >
          <strong>{s.title || s.ruleCode}</strong>
          <div className="small text-muted">{s.activityDate || '—'} · 申請 {s.pointsRequested} 點</div>
          {s.status === 'rejected' && s.rejectionReason && (
            <div className="small text-danger mt-1">退件：{s.rejectionReason}</div>
          )}
        </Link>
        <div className="d-flex align-items-center gap-2 flex-shrink-0">
          <ElpStatusBadge status={s.status} size="sm" />
          {showDelete && (
            <Button
              size="sm"
              variant="outline-danger"
              disabled={deletingId === s.id}
              onClick={() => handleDeleteSubmission(s.id)}
            >
              {deletingId === s.id ? '刪除中…' : '刪除'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  if (!student) {
    return (
      <div className="elp-page">
        <div className="elp-hero">
          <h1 className="h3 mb-2">英語實踐歷程護照</h1>
          <p className="text-muted mb-0">
            透過完成指定英語學習任務累積點數，滿 100 點可申請英語文能力標準認證。
          </p>
        </div>
        <PassportGuideFigure />
        <Card>
          <Card.Body>
            <h2 className="h5 mb-3">身分驗證</h2>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form onSubmit={handleIdentify}>
              <Row className="g-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>學號</Form.Label>
                    <Form.Control
                      value={form.studentId}
                      onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>姓名</Form.Label>
                    <Form.Control
                      value={form.studentName}
                      onChange={(e) => setForm({ ...form, studentName: e.target.value })}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      type="email"
                      value={form.studentEmail}
                      onChange={(e) => setForm({ ...form, studentEmail: e.target.value })}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Button type="submit" variant="primary" className="mt-3">進入我的護照</Button>
            </Form>
          </Card.Body>
        </Card>
      </div>
    );
  }

  const passport = dashboard?.passport;
  const summary = dashboard?.summary;
  const rules = dashboard?.rules || [];
  const submissions = dashboard?.submissions || [];
  const draftSubmissions = submissions.filter((s) => s.status === 'draft');
  const otherSubmissions = submissions.filter((s) => s.status !== 'draft');
  const points = passport?.totalApprovedPoints || 0;
  const pct = Math.min(100, Math.round((points / THRESHOLD) * 100));

  return (
    <div className="elp-page">
      <div className="elp-hero">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
          <div>
            <h1 className="h3 mb-1">英語實踐歷程護照</h1>
            <p className="text-muted mb-0 small">{student.studentName}（{student.studentId}）</p>
          </div>
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => { localStorage.removeItem('eears_elp_student'); setStudent(null); }}
          >
            切換身分
          </Button>
        </div>

        {passport && (
          <div className="mt-3">
            <div className="d-flex align-items-center gap-2 mb-2">
              <span>護照狀態：</span>
              <ElpStatusBadge status={passport.status} />
              {passport.certificationStatus === 'pending' && (
                <StatusBadge variant="info" size="md">最終認證審核中</StatusBadge>
              )}
              {passport.certificationStatus === 'approved' && (
                <StatusBadge variant="success" size="md">已通過英語能力認證</StatusBadge>
              )}
            </div>
            {passport.certificationStatus === 'approved' && (
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="outline-success"
                  onClick={() => openElpCertificationCertificate(student)}
                >
                  匯出認證單（PDF）
                </Button>
                <span className="small text-muted ms-2">開啟審核表後可列印或另存為 PDF</span>
              </div>
            )}
            {passport.status === 'active' && (
              <div className="elp-progress-wrap">
                <div className="d-flex justify-content-between small mb-1">
                  <span>累積點數</span>
                  <strong>{points} / {THRESHOLD} 點</strong>
                </div>
                <ProgressBar now={pct} label={`${pct}%`} />
              </div>
            )}
          </div>
        )}
      </div>

      <PassportGuideFigure />

      {error && <Alert variant="danger">{error}</Alert>}
      {loading && <div className="text-center py-4"><Spinner animation="border" /></div>}

      {!loading && !passport && (
        <Card>
          <Card.Body className="text-center py-4">
            <p className="mb-3">您尚未申請英語實踐歷程護照。</p>
            <Button variant="primary" onClick={handleApply} disabled={applying}>
              {applying ? '申請中…' : '申請護照'}
            </Button>
          </Card.Body>
        </Card>
      )}

      {!loading && passport?.status === 'pending' && (
        <Alert variant="warning">護照申請審核中，核准後即可開始累積點數。</Alert>
      )}

      {!loading && passport?.status === 'rejected' && (
        <Alert variant="danger">
          護照申請已退回：{passport.rejectionReason || '請聯繫英語中心'}
          <div className="mt-2">
            <Button size="sm" variant="outline-primary" onClick={handleApply} disabled={applying}>
              重新申請
            </Button>
          </div>
        </Alert>
      )}

      {!loading && passport?.status === 'active' && summary && (
        <>
          <div className="elp-stat-grid">
            <div className="elp-stat-card"><strong>{summary.approvedPoints}</strong><span className="small text-muted">已核准點數</span></div>
            <div className="elp-stat-card"><strong>{summary.pendingPoints}</strong><span className="small text-muted">待審核點數</span></div>
            <div className="elp-stat-card"><strong>{summary.rejectedCount}</strong><span className="small text-muted">退件紀錄</span></div>
          </div>

          {passport.canRequestCertification && (
            <Alert variant="success" className="d-flex flex-wrap align-items-center justify-content-between gap-2">
              <span>已達 {THRESHOLD} 點認證門檻！</span>
              <Button variant="success" onClick={() => navigate('/student/english-learning-passport/certification')}>
                申請英語能力標準認證
              </Button>
            </Alert>
          )}

          <h2 className="h5 mt-4 mb-2">可提交項目</h2>
          <div className="elp-rule-grid">
            {rules.map((rule) => (
              <div key={rule.code} className="elp-rule-card">
                <h6>{rule.name}</h6>
                <span className="elp-rule-hint">{RULE_LIMIT_HINTS[rule.code] || `基礎 ${rule.basePoints} 點`}</span>
                <Button
                  size="sm"
                  variant="outline-primary"
                  className="mt-auto"
                  onClick={() => navigate(`/student/english-learning-passport/submissions/new?rule=${rule.code}`)}
                >
                  提交紀錄
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && draftSubmissions.length > 0 && (
        <>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4 mb-2">
            <h2 className="h5 mb-0">我的草稿</h2>
            <Button
              size="sm"
              variant="outline-primary"
              onClick={() => navigate('/student/english-learning-passport/submissions/new')}
            >
              新增項目
            </Button>
          </div>
          <div className="elp-submission-list list-group">
            {draftSubmissions.map((s) => renderSubmissionRow(s, { showDelete: true }))}
          </div>
        </>
      )}

      {!loading && otherSubmissions.length > 0 && (
        <>
          <h2 className="h5 mt-4 mb-2">提交紀錄</h2>
          <div className="elp-submission-list list-group">
            {otherSubmissions.slice(0, 10).map((s) => renderSubmissionRow(
              s,
              { showDelete: s.status === 'rejected' },
            ))}
          </div>
        </>
      )}
    </div>
  );
}
