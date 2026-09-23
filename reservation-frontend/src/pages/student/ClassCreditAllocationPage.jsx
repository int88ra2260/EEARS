/**
 * 學生端：課堂加分配置（單課自動歸屬；多課可拆分）
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from 'react-bootstrap';
import StudentRecordShell from '../../components/student/StudentRecordShell';
import {
  fetchClassCreditAllocation,
  fetchClassCreditNavEnabled,
  saveClassCreditAllocation,
} from '../../services/classCreditAllocationApi';
import { validateReservationFields } from '../../utils/validators';
import {
  clearReservationIdentity,
  loadReservationIdentity,
  saveReservationIdentity,
} from '../../utils/studentIdentityStorage';
import { CLASS_DETAIL_SEMESTER_OPTIONS } from '../../utils/classDetailHelpers';
import { getCurrentSemester } from '../../utils/semesterUtils';
import '../../styles/public-ui.css';

const STORAGE_KEY = 'eears_class_credit_student';

function loadStoredStudent() {
  const shared = loadReservationIdentity();
  if (shared) return shared;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.studentId || !parsed?.studentName || !parsed?.studentEmail) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function saveStoredStudent(s) {
  saveReservationIdentity(s);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch (_) {
    /* ignore */
  }
}

function defaultSemesterValue() {
  const current = getCurrentSemester();
  if (current && CLASS_DETAIL_SEMESTER_OPTIONS.some((o) => o.value === current)) return current;
  return current || CLASS_DETAIL_SEMESTER_OPTIONS[0]?.value || '114-2';
}

function formatHours(h) {
  const n = Number(h);
  if (!Number.isFinite(n)) return '0';
  return String(Math.round(n * 100) / 100);
}

export default function ClassCreditAllocationPage() {
  const navigate = useNavigate();
  const [navEnabled, setNavEnabled] = useState(null);
  const [student, setStudent] = useState(() => loadStoredStudent());
  const [form, setForm] = useState(() => loadStoredStudent() || {
    studentId: '',
    studentName: '',
    studentEmail: '',
  });
  const [semester, setSemester] = useState(defaultSemesterValue);
  const [dashboard, setDashboard] = useState(null);
  const [draftHours, setDraftHours] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchClassCreditNavEnabled().then((enabled) => {
      if (!cancelled) setNavEnabled(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDashboard = useCallback(async (identity, sem) => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const data = await fetchClassCreditAllocation(identity, sem);
      setDashboard(data);
      const next = {};
      (data.classes || []).forEach((c) => {
        next[c.classId] = String(c.allocatedHours ?? 0);
      });
      setDraftHours(next);
    } catch (e) {
      setDashboard(null);
      setError(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!navEnabled || !student) return undefined;
    loadDashboard(student, semester);
    return undefined;
  }, [navEnabled, student, semester, loadDashboard]);

  useEffect(() => {
    if (dashboard?.classCount !== 1) return undefined;
    navigate('/student/progress', { replace: true });
    return undefined;
  }, [dashboard, navigate]);

  const handleIdentify = (e) => {
    e.preventDefault();
    const s = {
      studentId: form.studentId.trim().toUpperCase(),
      studentName: form.studentName.trim(),
      studentEmail: form.studentEmail.trim().toLowerCase(),
    };
    const { isValid, fieldErrors: nextErrors } = validateReservationFields(s);
    if (!isValid) {
      setFieldErrors(nextErrors);
      setError('');
      return;
    }
    setFieldErrors({});
    saveStoredStudent(s);
    setStudent(s);
  };

  const draftTotal = useMemo(() => {
    return Object.values(draftHours).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }, [draftHours]);

  const handleSave = async () => {
    if (!student || !dashboard?.canEdit) return;
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const allocations = (dashboard.classes || []).map((c) => ({
        classId: c.classId,
        hours: Number(draftHours[c.classId]) || 0,
      }));
      const data = await saveClassCreditAllocation(student, semester, allocations);
      setDashboard(data);
      const next = {};
      (data.classes || []).forEach((c) => {
        next[c.classId] = String(c.allocatedHours ?? 0);
      });
      setDraftHours(next);
      setSuccessMsg('已儲存課堂加分配置');
    } catch (e) {
      setError(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (navEnabled === null) {
    return (
      <div className="container py-5 text-center">
        <Spinner animation="border" />
      </div>
    );
  }

  if (!navEnabled) {
    return (
      <div className="container py-4" style={{ maxWidth: 720 }}>
        <StudentRecordShell lead="此功能目前未開放。">
          <Alert variant="secondary">
            課堂加分配置入口已關閉。若需配置時數，請洽英語中心。
          </Alert>
        </StudentRecordShell>
      </div>
    );
  }

  if (dashboard?.classCount === 1) {
    return (
      <div className="container py-5 text-center">
        <Spinner animation="border" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="container py-4" style={{ maxWidth: 720 }}>
        <StudentRecordShell lead="將參與活動累計的時數／點數指定到本學期修習的課程。">
        <Card>
          <Card.Body>
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
                    />
                    <Form.Control.Feedback type="invalid">{fieldErrors.studentId}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>姓名</Form.Label>
                    <Form.Control
                      value={form.studentName}
                      onChange={(e) => setForm({ ...form, studentName: e.target.value })}
                      isInvalid={!!fieldErrors.studentName}
                    />
                    <Form.Control.Feedback type="invalid">{fieldErrors.studentName}</Form.Control.Feedback>
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
                    />
                    <Form.Control.Feedback type="invalid">{fieldErrors.studentEmail}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
              </Row>
              <Button type="submit" variant="primary" className="mt-3">進入配置</Button>
            </Form>
          </Card.Body>
        </Card>
        </StudentRecordShell>
      </div>
    );
  }

  return (
    <div className="container py-4" style={{ maxWidth: 960 }}>
      <StudentRecordShell lead={`${student.studentName}（${student.studentId}）`}>
      <div className="d-flex justify-content-end mb-3">
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => {
            clearReservationIdentity();
            try {
              localStorage.removeItem(STORAGE_KEY);
            } catch (_) {
              /* ignore */
            }
            setStudent(null);
            setForm({ studentId: '', studentName: '', studentEmail: '' });
            setDashboard(null);
          }}
        >
          登出
        </Button>
      </div>

      <Card className="mb-3">
        <Card.Body className="d-flex flex-wrap gap-3 align-items-end">
          <Form.Group style={{ minWidth: 160 }}>
            <Form.Label>學期</Form.Label>
            <Form.Select
              value={semester}
              onChange={(e) => {
                setSemester(e.target.value);
              }}
            >
              {CLASS_DETAIL_SEMESTER_OPTIONS.some((o) => o.value === semester) ? null : (
                <option value={semester}>{semester}學期</option>
              )}
              {CLASS_DETAIL_SEMESTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Button
            variant="outline-primary"
            disabled={loading}
            onClick={() => loadDashboard(student, semester)}
          >
            重新載入
          </Button>
        </Card.Body>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}
      {successMsg && <Alert variant="success">{successMsg}</Alert>}
      {loading && (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      )}

      {!loading && dashboard && (
        <>
          <Row className="g-3 mb-3">
            <Col md={3}>
              <Card className="h-100">
                <Card.Body>
                  <div className="text-muted small">待分配時數</div>
                  <div className="fs-4 fw-semibold">{formatHours(dashboard.earnedHours)} 時</div>
                  <div className="small text-muted">{dashboard.earnedPoints} 點（已排除計入護照）</div>
                  {Number(dashboard.poolAdjustmentHours) ? (
                    <div className="small text-muted">
                      含後台{dashboard.poolAdjustmentHours > 0 ? '增加' : '扣除'} {formatHours(Math.abs(dashboard.poolAdjustmentHours))} 時
                    </div>
                  ) : null}
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-100">
                <Card.Body>
                  <div className="text-muted small">已配置時數</div>
                  <div className="fs-4 fw-semibold">{formatHours(dashboard.allocatedHours)} 時</div>
                  <div className="small text-muted">剩餘 {formatHours(dashboard.remainingHours)} 時</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-100">
                <Card.Body>
                  <div className="text-muted small">全站累計（僅參考）</div>
                  <div className="fs-4 fw-semibold">{formatHours(dashboard.siteTotalHours)} 時</div>
                  <div className="small text-muted">{dashboard.sitePointScore} 點</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-100">
                <Card.Body>
                  <div className="text-muted small">配置截止日</div>
                  <div className="fs-5 fw-semibold">{dashboard.deadline || '尚未設定'}</div>
                  {dashboard.locked ? (
                    <Badge bg="warning" text="dark">已截止</Badge>
                  ) : dashboard.autoAllocated ? (
                    <Badge bg="success">單課自動歸屬</Badge>
                  ) : (
                    <Badge bg="primary">可編輯</Badge>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Alert variant="info" className="small">
            簽到時若勾選「計入護照」，該場次不會進入待分配時數。
            本學期若只有一門課，系統會自動把全部可配置時數歸該課；多門課請自行拆分，逾期未配置時老師端會顯示「未配置」。
          </Alert>

          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span>本學期課程</span>
              {dashboard.canEdit && (
                <span className="small text-muted">
                  草稿合計：{formatHours(draftTotal)} / {formatHours(dashboard.earnedHours)} 時
                </span>
              )}
            </Card.Header>
            <Card.Body className="p-0">
              {(dashboard.classes || []).length === 0 ? (
                <div className="p-4 text-muted">本學期名冊中找不到您的班級。</div>
              ) : (
                <Table responsive className="mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>課程</th>
                      <th>老師</th>
                      <th>配置時數</th>
                      <th>計點</th>
                      <th>狀態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.classes.map((c) => (
                      <tr key={c.classId}>
                        <td>{c.className}</td>
                        <td>{c.teacherName || '—'}</td>
                        <td style={{ maxWidth: 140 }}>
                          {dashboard.canEdit ? (
                            <Form.Control
                              type="number"
                              min="0"
                              step="0.25"
                              value={draftHours[c.classId] ?? '0'}
                              onChange={(e) => setDraftHours((prev) => ({
                                ...prev,
                                [c.classId]: e.target.value,
                              }))}
                            />
                          ) : (
                            formatHours(c.displayHours ?? c.allocatedHours)
                          )}
                          {Number(c.adjustmentHours) ? (
                            <div className="small text-muted">
                              含後台調整 {formatHours(c.adjustmentHours)} 時
                            </div>
                          ) : null}
                        </td>
                        <td>
                          {dashboard.canEdit
                            ? Math.round((Number(draftHours[c.classId]) || 0) * 20) / 10
                            : (c.displayPoints ?? c.allocatedPoints)}
                        </td>
                        <td>
                          {c.allocationStatusLabel
                            ? <Badge bg="secondary">{c.allocationStatusLabel}</Badge>
                            : (dashboard.autoAllocated ? <Badge bg="success">自動歸屬</Badge> : '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
            {dashboard.canEdit && (
              <Card.Footer className="d-flex justify-content-end">
                <Button variant="primary" disabled={saving} onClick={handleSave}>
                  {saving ? '儲存中…' : '儲存配置'}
                </Button>
              </Card.Footer>
            )}
          </Card>
        </>
      )}
      </StudentRecordShell>
    </div>
  );
}
