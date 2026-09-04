import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Col, Form, ProgressBar, Row, Spinner, Alert } from 'react-bootstrap';
import StatusBadge from '../../components/ui/StatusBadge';
import ElpStatusBadge from '../../components/englishLearningPassport/ElpStatusBadge';
import ElpEmailVerificationPanel from '../../components/englishLearningPassport/ElpEmailVerificationPanel';
import ContentText from '../../components/siteContent/ContentText';
import ContentImage from '../../components/siteContent/ContentImage';
import { useLanguage } from '../../context/LanguageContext';
import { useSiteContentVisualEdit } from '../../context/SiteContentVisualEditContext';
import { validateElpStudentFields } from '../../utils/validators';
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
const GUIDE_IMAGE_KEY = 'elpPage.guideImageUrl';

function resolveGuideImageUrl(t) {
  const custom = String(t(GUIDE_IMAGE_KEY) || '').trim();
  if (!custom || custom === GUIDE_IMAGE_KEY) return elpStudentGuideImage;
  if (/^https?:\/\//i.test(custom) || custom.startsWith('/')) return custom;
  return elpStudentGuideImage;
}

function PassportGuideFigure() {
  const { t } = useLanguage();
  const visual = useSiteContentVisualEdit();
  const imageSrc = resolveGuideImageUrl(t);
  const editingImage = visual?.enabled && visual.isEditable(GUIDE_IMAGE_KEY);

  const imageNode = (
    <ContentImage
      k={GUIDE_IMAGE_KEY}
      className="elp-guide-card__image"
      src={imageSrc}
      alt={t('elpPage.guideImageAlt')}
    />
  );

  return (
    <section className="elp-guide-card" aria-labelledby="elp-guide-title">
      <div className="elp-guide-card__header">
        <div>
          <ContentText k="elpPage.guideKicker" as="p" className="elp-guide-card__kicker" />
          <ContentText k="elpPage.guideTitle" as="h2" id="elp-guide-title" />
          <ContentText k="elpPage.guideDesc" as="p" />
        </div>
        {editingImage ? (
          <span className="elp-guide-card__open text-muted small">預覽模式：點圖換圖</span>
        ) : (
          <a
            className="elp-guide-card__open"
            href={imageSrc}
            target="_blank"
            rel="noreferrer"
          >
            <ContentText k="elpPage.guideOpenLarge" as="span" />
          </a>
        )}
      </div>
      {editingImage ? (
        <div className="elp-guide-card__image-link elp-guide-card__image-link--editable">
          {imageNode}
        </div>
      ) : (
        <a
          className="elp-guide-card__image-link"
          href={imageSrc}
          target="_blank"
          rel="noreferrer"
          aria-label={t('elpPage.guideOpenLarge')}
        >
          {imageNode}
        </a>
      )}
    </section>
  );
}

export default function EnglishLearningPassportPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [student, setStudent] = useState(() => loadElpStudent());
  const [form, setForm] = useState({ studentId: '', studentName: '', studentEmail: '' });
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [applying, setApplying] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [emailVerificationToken, setEmailVerificationToken] = useState(null);
  const [verifiedEmail, setVerifiedEmail] = useState(null);
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
      studentId: form.studentId.trim().toUpperCase(),
      studentName: form.studentName.trim(),
      studentEmail: form.studentEmail.trim().toLowerCase(),
    };
    const { isValid, fieldErrors: nextFieldErrors } = validateElpStudentFields(s);
    if (!isValid) {
      setFieldErrors(nextFieldErrors);
      setError('');
      return;
    }
    setFieldErrors({});
    setError('');
    setEmailVerificationToken(null);
    setVerifiedEmail(null);
    saveElpStudent(s);
    setStudent(s);
  };

  const handleApply = async () => {
    if (!emailVerificationToken || verifiedEmail !== student?.studentEmail) {
      setError('請先完成信箱驗證碼驗證後再申請護照');
      return;
    }
    setApplying(true);
    setError('');
    try {
      await applyElpPassport(student, '', emailVerificationToken);
      setEmailVerificationToken(null);
      setVerifiedEmail(null);
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
          <ContentText k="elpPage.heroTitle" as="h1" className="h3 mb-2" />
          <ContentText k="elpPage.heroDesc" as="p" className="text-muted mb-0" />
        </div>
        <PassportGuideFigure />
        <Card>
          <Card.Body>
            <ContentText k="elpPage.identifyTitle" as="h2" className="h5 mb-3" />
            {error && <Alert variant="danger">{error}</Alert>}
            <Form onSubmit={handleIdentify} noValidate>
              <Row className="g-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>學號</Form.Label>
                    <Form.Control
                      value={form.studentId}
                      onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                      isInvalid={!!fieldErrors.studentId}
                      aria-describedby={fieldErrors.studentId ? 'elp-student-id-error' : undefined}
                      placeholder="例：B123456789"
                    />
                    <Form.Control.Feedback type="invalid" id="elp-student-id-error">
                      {fieldErrors.studentId}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>姓名</Form.Label>
                    <Form.Control
                      value={form.studentName}
                      onChange={(e) => setForm({ ...form, studentName: e.target.value })}
                      isInvalid={!!fieldErrors.studentName}
                      aria-describedby={fieldErrors.studentName ? 'elp-student-name-error' : undefined}
                    />
                    <Form.Control.Feedback type="invalid" id="elp-student-name-error">
                      {fieldErrors.studentName}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      type="email"
                      value={form.studentEmail}
                      onChange={(e) => setForm({ ...form, studentEmail: e.target.value })}
                      isInvalid={!!fieldErrors.studentEmail}
                      aria-describedby={fieldErrors.studentEmail ? 'elp-student-email-error' : undefined}
                      placeholder="學號@student.nsysu.edu.tw"
                    />
                    <Form.Control.Feedback type="invalid" id="elp-student-email-error">
                      {fieldErrors.studentEmail}
                    </Form.Control.Feedback>
                    {!fieldErrors.studentEmail && (
                      <Form.Text className="text-muted">
                        <ContentText k="elpPage.emailHint" as="span" />
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
              </Row>
              <Button type="submit" variant="primary" className="mt-3">
                <ContentText k="elpPage.identifySubmit" as="span" />
              </Button>
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
  const emailVerifiedOk =
    !!emailVerificationToken
    && verifiedEmail === student.studentEmail;

  return (
    <div className="elp-page">
      <div className="elp-hero">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
          <div>
            <ContentText k="elpPage.heroTitle" as="h1" className="h3 mb-1" />
            <p className="text-muted mb-0 small">{student.studentName}（{student.studentId}）</p>
          </div>
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => {
              localStorage.removeItem('eears_elp_student');
              setStudent(null);
              setEmailVerificationToken(null);
              setVerifiedEmail(null);
            }}
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
              {(passport.certificationStatus === 'approved' || passport.hasCompletedCertification) && (
                <StatusBadge variant="success" size="md">已通過英語能力認證</StatusBadge>
              )}
            </div>
            {(passport.certificationStatus === 'approved' || passport.hasCompletedCertification) && (
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="outline-success"
                  onClick={() => openElpCertificationCertificate(student)}
                >
                  <ContentText k="elpPage.exportCertificate" as="span" />
                </Button>
                <span className="small text-muted ms-2">開啟審核表後可列印或另存為 PDF</span>
              </div>
            )}
            {(passport.status === 'active' || passport.status === 'completed') && (
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
          <Card.Body className="py-4">
            <p className="mb-3 text-center">
              <ContentText k="elpPage.applyLead" as="span" />
            </p>
            <div className="mx-auto" style={{ maxWidth: 480 }}>
              <ElpEmailVerificationPanel
                email={student.studentEmail}
                studentId={student.studentId}
                emailVerificationToken={emailVerificationToken}
                verifiedEmail={verifiedEmail}
                onTokenChange={({ token, verifiedEmail: nextEmail }) => {
                  setEmailVerificationToken(token);
                  setVerifiedEmail(nextEmail);
                }}
              />
            </div>
            <div className="d-flex flex-wrap justify-content-center gap-2 mt-2">
              <Button
                variant="primary"
                onClick={handleApply}
                disabled={applying || !emailVerifiedOk}
              >
                {applying ? '申請中…' : <ContentText k="elpPage.applyButton" as="span" />}
              </Button>
              <Link to="/student/progress" className="btn btn-outline-primary">
                查看我的英語進度
              </Link>
              <Link to="/course-guide" className="btn btn-outline-secondary">
                修課與認證說明
              </Link>
              <Link to="/events" className="btn btn-outline-secondary">
                先去預約場次
              </Link>
            </div>
          </Card.Body>
        </Card>
      )}

      {!loading && passport?.status === 'pending' && (
        <Alert variant="warning">
          護照申請審核中，核准後即可開始累積點數。等待期間仍可預約活動或先做 5 分鐘練習。
          <div className="mt-2 d-flex flex-wrap gap-2">
            <Link to="/events" className="btn btn-sm btn-outline-primary">查看本週場次</Link>
            <Link to="/learning-resources" className="btn btn-sm btn-outline-secondary">現在就練</Link>
          </div>
        </Alert>
      )}

      {!loading && passport?.status === 'rejected' && (
        <Alert variant="danger">
          護照申請已退回：{passport.rejectionReason || '請聯繫英語中心'}
          <div className="mt-3 mx-auto" style={{ maxWidth: 480 }}>
            <ElpEmailVerificationPanel
              email={student.studentEmail}
              studentId={student.studentId}
              emailVerificationToken={emailVerificationToken}
              verifiedEmail={verifiedEmail}
              onTokenChange={({ token, verifiedEmail: nextEmail }) => {
                setEmailVerificationToken(token);
                setVerifiedEmail(nextEmail);
              }}
            />
          </div>
          <div className="mt-2">
            <Button
              size="sm"
              variant="outline-primary"
              onClick={handleApply}
              disabled={applying || !emailVerifiedOk}
            >
              重新申請
            </Button>
          </div>
        </Alert>
      )}

      {!loading && (passport?.status === 'active' || passport?.status === 'completed') && summary && (
        <>
          <div className="elp-stat-grid">
            <div className="elp-stat-card"><strong>{summary.approvedPoints}</strong><span className="small text-muted">已核准點數</span></div>
            <div className="elp-stat-card"><strong>{summary.pendingPoints}</strong><span className="small text-muted">待審核點數</span></div>
            <div className="elp-stat-card"><strong>{summary.rejectedCount}</strong><span className="small text-muted">退件紀錄</span></div>
          </div>

          {passport.hasCompletedCertification && (
            <Alert variant="success" className="d-flex flex-wrap align-items-center justify-content-between gap-2">
              <ContentText k="elpPage.completedMessage" as="span" />
              <Button variant="success" onClick={() => openElpCertificationCertificate(student)}>
                <ContentText k="elpPage.exportCertificate" as="span" />
              </Button>
            </Alert>
          )}

          {passport.status === 'active' && (
            <>
              <ContentText k="elpPage.submitSectionTitle" as="h2" className="h5 mt-4 mb-2" />
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
                      <ContentText k="elpPage.submitAction" as="span" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
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
