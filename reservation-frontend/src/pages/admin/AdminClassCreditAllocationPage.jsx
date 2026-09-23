import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table,
} from 'react-bootstrap';
import ClassCreditDeadlinePanel from '../../components/admin/classes/ClassCreditDeadlinePanel';
import {
  createClassCreditAdjustment,
  deleteClassCreditAdjustment,
  fetchAdminClassCreditStudent,
} from '../../services/classCreditAllocationApi';
import { CLASS_DETAIL_SEMESTER_OPTIONS } from '../../utils/classDetailHelpers';
import { getCurrentSemester } from '../../utils/semesterUtils';
import { showErrorMessage, showSuccessMessage } from '../../utils/errorHandler';

function formatHours(h) {
  if (h == null || h === '') return '0';
  const n = Number(h);
  if (!Number.isFinite(n)) return '0';
  const text = String(Math.round(n * 100) / 100);
  return n > 0 ? `+${text}` : text;
}

function formatPlainHours(h) {
  if (h == null || h === '') return '0';
  const n = Number(h);
  if (!Number.isFinite(n)) return '0';
  return String(Math.round(n * 100) / 100);
}

export default function AdminClassCreditAllocationPage() {
  const { token } = useOutletContext() || {};
  const semesterOptions = CLASS_DETAIL_SEMESTER_OPTIONS;
  const defaultSemester = useMemo(() => {
    const current = getCurrentSemester();
    if (semesterOptions.some((o) => o.value === current)) return current;
    return semesterOptions[0]?.value || '114-2';
  }, [semesterOptions]);

  const [semester, setSemester] = useState(defaultSemester);
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [direction, setDirection] = useState('add');
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');

  const lookup = async (nextSemester = semester, nextStudentId = studentId) => {
    const sid = String(nextStudentId || '').trim();
    if (!sid) {
      setError('請填寫學號');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminClassCreditStudent(token, nextSemester, sid);
      setResult(data);
      setStudentId(data.studentId || sid);
    } catch (e) {
      setResult(null);
      setError(e.message || '查詢失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    lookup();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!result) return;
    setSaving(true);
    try {
      await createClassCreditAdjustment(token, {
        semester: result.semester,
        studentId: result.studentId,
        direction,
        hours: Number(hours),
        note,
      });
      showSuccessMessage(direction === 'deduct' ? '已從總時數扣除' : '已增加總時數');
      setHours('');
      setNote('');
      await lookup(result.semester, result.studentId);
    } catch (err) {
      showErrorMessage(err.message || '新增失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!result) return;
    setDeletingId(id);
    try {
      await deleteClassCreditAdjustment(token, id);
      showSuccessMessage('已刪除時數調整');
      await lookup(result.semester, result.studentId);
    } catch (err) {
      showErrorMessage(err.message || '刪除失敗');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="container-fluid">
      <ClassCreditDeadlinePanel token={token} />

      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">查詢學生時數</h5>
          <div className="small text-muted mt-1">
            特殊情況可增加或扣除學生本學期的總時數，不指定課程，也不受截止日鎖定。
          </div>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSearch}>
            <Row className="g-3 align-items-end">
              <Col md={3}>
                <Form.Label>學期</Form.Label>
                <Form.Select value={semester} onChange={(e) => setSemester(e.target.value)}>
                  {semesterOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={4}>
                <Form.Label>學號</Form.Label>
                <Form.Control
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="例如 A12345678"
                />
              </Col>
              <Col md="auto">
                <Button type="submit" disabled={loading}>
                  {loading ? '查詢中…' : '查詢'}
                </Button>
              </Col>
            </Row>
          </Form>
          {error && <Alert variant="danger" className="mt-3 mb-0">{error}</Alert>}
        </Card.Body>
      </Card>

      {loading && !result ? (
        <div className="py-3"><Spinner size="sm" /> 載入中…</div>
      ) : null}

      {result && (
        <>
          <Card className="mb-4">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <div>
                <h5 className="mb-0">
                  {result.studentName || '未具名'}
                  <span className="text-muted fw-normal ms-2">{result.studentId}</span>
                </h5>
                <div className="small text-muted mt-1">{result.semester}</div>
              </div>
              {result.locked ? <Badge bg="warning" text="dark">配置已截止</Badge> : <Badge bg="success">學生可配置</Badge>}
            </Card.Header>
            <Card.Body>
              {(result.classes || []).length === 0 ? (
                <Alert variant="warning" className="mb-0">本學期名冊中找不到此學號，無法新增時數。</Alert>
              ) : (
                <>
                  <Row className="g-3 mb-3">
                    <Col md={3}>
                      <div className="small text-muted">總時數</div>
                      <div className="fw-semibold">{formatPlainHours(result.earnedHours)} 時</div>
                      <div className="small text-muted">
                        簽到 {formatPlainHours(result.checkinHours ?? result.earnedHours)}
                        {Number(result.poolAdjustmentHours)
                          ? `，後台 ${formatHours(result.poolAdjustmentHours)}`
                          : ''}
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="small text-muted">學生已配置</div>
                      <div className="fw-semibold">{formatPlainHours(result.allocatedHours)} 時</div>
                    </Col>
                    <Col md={3}>
                      <div className="small text-muted">全站累計（僅參考）</div>
                      <div className="fw-semibold">{formatPlainHours(result.siteTotalHours)} 時</div>
                    </Col>
                    <Col md={3}>
                      <div className="small text-muted">配置截止日</div>
                      <div className="fw-semibold">{result.deadline || '未設定'}</div>
                    </Col>
                  </Row>
                  {Number(result.allocatedHours) > Number(result.earnedHours) + 0.001 && (
                    <Alert variant="warning" className="small">
                      學生已配置的時數超過調整後總時數。修多門課時，系統不會自動改各班已配置的數字。
                    </Alert>
                  )}
                  <Table responsive hover size="sm" className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>課程</th>
                        <th>學生配置</th>
                        <th>課程調整</th>
                        <th>該班時數</th>
                        <th>狀態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.classes.map((c) => (
                        <tr key={c.classId}>
                          <td>
                            {c.className}
                            <div className="small text-muted">{c.teacherName || '—'}</div>
                          </td>
                          <td>{formatPlainHours(c.allocatedHours)} 時</td>
                          <td>{formatHours(c.adjustmentHours)} 時</td>
                          <td className="fw-semibold">{formatPlainHours(c.displayHours)} 時 / {c.displayPoints} 點</td>
                          <td>{c.allocationStatusLabel || (result.autoAllocated ? '自動歸屬' : '—')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </>
              )}
            </Card.Body>
          </Card>

          {(result.classes || []).length > 0 && (
            <Card className="mb-4">
              <Card.Header>
                <h5 className="mb-0">調整總時數</h5>
              </Card.Header>
              <Card.Body>
                <Form onSubmit={handleCreate} className="mb-4">
                  <Row className="g-3 align-items-end">
                    <Col md="auto">
                      <Form.Label>調整方式</Form.Label>
                      <div className="d-flex">
                        <Button
                          type="button"
                          variant={direction === 'add' ? 'primary' : 'outline-primary'}
                          onClick={() => setDirection('add')}
                        >
                          增加
                        </Button>
                        <Button
                          type="button"
                          className="ms-2"
                          variant={direction === 'deduct' ? 'danger' : 'outline-danger'}
                          onClick={() => setDirection('deduct')}
                        >
                          扣除
                        </Button>
                      </div>
                    </Col>
                    <Col md={2}>
                      <Form.Label>時數</Form.Label>
                      <Form.Control
                        type="number"
                        min="0.25"
                        step="0.25"
                        required
                        value={hours}
                        onChange={(e) => setHours(e.target.value)}
                        placeholder="0.75"
                      />
                    </Col>
                    <Col md={4}>
                      <Form.Label>原因</Form.Label>
                      <Form.Control
                        required
                        maxLength={200}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="例如補登、重複計算"
                      />
                    </Col>
                    <Col md="auto">
                      <Button
                        type="submit"
                        variant={direction === 'deduct' ? 'danger' : 'primary'}
                        disabled={saving || !(Number(hours) > 0)}
                      >
                        {saving ? '處理中…' : (direction === 'deduct' ? '扣除時數' : '增加時數')}
                      </Button>
                    </Col>
                  </Row>
                  <div className="small text-muted mt-2">
                    只填正數。只修一門課時，總時數會自動反映到該班；修多門課時，增加的時數進入待分配，由學生自行配置。
                  </div>
                </Form>

                {(result.adjustments || []).length === 0 ? (
                  <div className="text-muted">尚無後台調整。</div>
                ) : (
                  <Table responsive hover size="sm" className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>調整</th>
                        <th>時數</th>
                        <th>原因</th>
                        <th>時間</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {result.adjustments.map((row) => (
                        <tr key={row.id}>
                          <td>
                            {row.scope === 'class' ? (
                              <span>課程 {row.className || `#${row.classId}`}</span>
                            ) : (
                              <Badge bg={row.hours < 0 ? 'danger' : 'success'}>
                                {row.hours < 0 ? '扣除' : '增加'}
                              </Badge>
                            )}
                          </td>
                          <td>{formatPlainHours(Math.abs(Number(row.hours) || 0))} 時</td>
                          <td>{row.note}</td>
                          <td className="small text-muted">
                            {row.createdAt ? new Date(row.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '—'}
                          </td>
                          <td className="text-end">
                            <Button
                              size="sm"
                              variant="outline-danger"
                              disabled={deletingId === row.id}
                              onClick={() => handleDelete(row.id)}
                            >
                              {deletingId === row.id ? '刪除中…' : '刪除'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card.Body>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
