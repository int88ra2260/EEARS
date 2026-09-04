import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  Button, Card, Col, Form, Modal, Nav, Row, Spinner, Table, Tab,
} from 'react-bootstrap';
import useConfirm from '../../components/ui/useConfirm';
import { useToastContext } from '../../components/ui/ToastProvider';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { P } from '../../constants/permissions';
import {
  adminFetchPassports,
  adminFetchSubmissions,
  adminApprovePassport,
  adminRejectPassport,
  adminFetchRules,
  adminExportPassports,
  adminDeleteRule,
  adminDeletePassport,
  adminBatchDeletePassports,
  adminBatchRejectPassports,
} from '../../services/englishLearningPassportApi';
import '../../components/englishLearningPassport/elp.css';
import EnglishLearningRuleEditModal from '../../components/englishLearningPassport/EnglishLearningRuleEditModal';
import EnglishLearningSubmissionReviewModal from '../../components/englishLearningPassport/EnglishLearningSubmissionReviewModal';
import ElpStatusBadge from '../../components/englishLearningPassport/ElpStatusBadge';
import ElpStudentPageUiEditor from '../../components/englishLearningPassport/ElpStudentPageUiEditor';

const PASSPORT_STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待審核' },
  { value: 'active', label: '已核准' },
  { value: 'rejected', label: '已退回' },
  { value: 'completed', label: '已完成' },
  { value: 'revoked', label: '已停用' },
];

const SUBMISSION_STATUS_OPTIONS = [
  { value: 'submitted', label: '提交待審' },
  { value: 'approved', label: '已核准' },
  { value: 'rejected', label: '已退回' },
  { value: 'draft', label: '草稿' },
  { value: '', label: '全部' },
];

function RejectModal({ show, onHide, onConfirm, title }) {
  const [reason, setReason] = useState('');
  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton><Modal.Title>{title}</Modal.Title></Modal.Header>
      <Modal.Body>
        <Form.Group>
          <Form.Label>退件原因 <span className="text-danger">*</span></Form.Label>
          <Form.Control as="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>取消</Button>
        <Button variant="danger" disabled={!reason.trim()} onClick={() => { onConfirm(reason); setReason(''); }}>確認退回</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default function EnglishLearningPassportsAdminPage() {
  const { token, userRole, accessProfile: ctxProfile } = useOutletContext();
  const accessProfile = ctxProfile || buildAccessProfile(token || '', userRole || '');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { confirm } = useConfirm();
  const toast = useToastContext();

  const canView = hasPermission(accessProfile, P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS);
  const canManage = hasPermission(accessProfile, P.CAN_MANAGE_ENGLISH_LEARNING_PASSPORTS);
  const canReview = hasPermission(accessProfile, P.CAN_REVIEW_ENGLISH_LEARNING_SUBMISSIONS);
  const canExport = hasPermission(accessProfile, P.CAN_EXPORT_ENGLISH_LEARNING_PASSPORTS);
  const canRules = hasPermission(accessProfile, P.CAN_MANAGE_ENGLISH_LEARNING_RULES);
  const canMutateRules = canView || canRules;

  const rawTab = searchParams.get('tab') || 'passports';
  const initialTab = rawTab === 'certifications' ? 'passports' : rawTab;
  const [tab, setTab] = useState(initialTab);
  const [passports, setPassports] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || 'pending',
    studentId: '',
    studentName: '',
    studentEmail: '',
  });
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [forceDelete, setForceDelete] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [reviewSub, setReviewSub] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [creatingRule, setCreatingRule] = useState(false);

  const passportQuery = useMemo(() => ({
    status: filters.status || undefined,
    studentId: filters.studentId || undefined,
    studentName: filters.studentName || undefined,
    studentEmail: filters.studentEmail || undefined,
  }), [filters]);

  const reload = useCallback(async () => {
    if (!token) return;
    if (tab === 'page-ui') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (tab === 'passports' && canView) {
        setPassports(await adminFetchPassports(token, passportQuery));
        setSelectedIds(new Set());
      }
      if (tab === 'submissions' && canReview) {
        setSubmissions(await adminFetchSubmissions(token, {
          status: filters.status === '' ? undefined : (filters.status || 'submitted'),
          studentId: filters.studentId || undefined,
        }));
      }
      if (tab === 'rules' && (canRules || canView)) {
        setRules(await adminFetchRules(token));
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, tab, passportQuery, filters.status, filters.studentId, canView, canReview, canRules, toast]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab && urlTab !== tab) setTab(urlTab);
  }, [searchParams, tab]);

  const handleSelectTab = (key) => {
    const next = key || 'passports';
    setTab(next);
    setSelectedIds(new Set());
    if (next === 'passports' && !['pending', 'active', 'rejected', 'completed', 'revoked', ''].includes(filters.status)) {
      setFilters((f) => ({ ...f, status: 'pending' }));
    }
    if (next === 'submissions' && !['submitted', 'approved', 'rejected', 'draft', ''].includes(filters.status)) {
      setFilters((f) => ({ ...f, status: 'submitted' }));
    }
    navigate(`?tab=${next}`, { replace: true });
  };

  const allVisibleSelected = passports.length > 0 && passports.every((p) => selectedIds.has(p.id));
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(passports.map((p) => p.id)));
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApprovePassport = async (id) => {
    const ok = await confirm({ title: '核准護照申請', description: '確定核准此護照申請？' });
    if (!ok) return;
    try {
      await adminApprovePassport(token, id);
      toast.success('已核准');
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const handleRejectPassport = async (reason) => {
    try {
      if (rejectTarget?.type === 'batch') {
        setBatchBusy(true);
        const result = await adminBatchRejectPassports(token, rejectTarget.ids, reason);
        toast.success(`已退回 ${result.rejected?.length || 0} 筆${result.failed?.length ? `，失敗 ${result.failed.length} 筆` : ''}`);
        setRejectTarget(null);
        reload();
        return;
      }
      await adminRejectPassport(token, rejectTarget.id, reason);
      toast.success('已退回');
      setRejectTarget(null);
      reload();
    } catch (e) { toast.error(e.message); }
    finally { setBatchBusy(false); }
  };

  const handleDeleteOne = async (passport) => {
    const needsForce = !['pending', 'rejected'].includes(passport.status);
    const ok = await confirm({
      title: '刪除護照',
      description: needsForce
        ? `「${passport.studentId}」狀態為 ${passport.status}，刪除後無法復原（含點數申請與附件）。確定強制刪除？`
        : `確定刪除「${passport.studentId} / ${passport.studentName}」？刪除後無法復原。`,
    });
    if (!ok) return;
    try {
      await adminDeletePassport(token, passport.id, { force: needsForce || forceDelete });
      toast.success('已刪除');
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const handleBatchDelete = async () => {
    if (!selectedList.length) {
      toast.error('請先勾選要刪除的護照');
      return;
    }
    const ok = await confirm({
      title: '批量刪除護照',
      description: forceDelete
        ? `將刪除已選 ${selectedList.length} 筆（含已核准／已完成，無法復原）。確定？`
        : `將刪除已選 ${selectedList.length} 筆中「待審核／已退回」的紀錄。已核准者需勾選強制刪除。確定？`,
    });
    if (!ok) return;
    setBatchBusy(true);
    try {
      const result = await adminBatchDeletePassports(token, selectedList, { force: forceDelete });
      toast.success(`已刪除 ${result.deleted?.length || 0} 筆${result.failed?.length ? `，失敗 ${result.failed.length} 筆` : ''}`);
      if (result.failed?.length) {
        const sample = result.failed.slice(0, 3).map((f) => `#${f.id}: ${f.message}`).join('；');
        toast.error(sample);
      }
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBatchBusy(false);
    }
  };

  const handleBatchReject = () => {
    if (!selectedList.length) {
      toast.error('請先勾選要退回的護照');
      return;
    }
    setRejectTarget({ type: 'batch', ids: selectedList });
  };

  const openReview = (submission) => {
    setReviewSub(submission);
  };

  const handleExport = async () => {
    try {
      const { blob, fileName } = await adminExportPassports(token, passportQuery);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error(e.message); }
  };

  const handleDeleteRule = async (rule) => {
    const ok = await confirm({
      title: '刪除點數規則',
      description: `確定要刪除「${rule.name}」（${rule.code}）嗎？若已有學生申請使用此規則，系統將拒絕刪除。`,
    });
    if (!ok) return;
    try {
      await adminDeleteRule(token, rule.id);
      toast.success('規則已刪除');
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const statusOptions = tab === 'submissions' ? SUBMISSION_STATUS_OPTIONS : PASSPORT_STATUS_OPTIONS;
  const showDataFilters = tab === 'passports' || tab === 'submissions';

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap justify-content-end align-items-center mb-3 gap-2">
        {canExport && tab !== 'page-ui' && (
          <Button variant="outline-success" size="sm" onClick={handleExport}>匯出 Excel</Button>
        )}
      </div>

      {showDataFilters && (
      <Card className="mb-3">
        <Card.Body className="py-2">
          <Row className="g-2 align-items-end">
            <Col md={2}>
              <Form.Label className="small mb-0">學號</Form.Label>
              <Form.Control
                size="sm"
                value={filters.studentId}
                onChange={(e) => setFilters({ ...filters, studentId: e.target.value })}
                placeholder="關鍵字"
              />
            </Col>
            {tab === 'passports' && (
              <>
                <Col md={2}>
                  <Form.Label className="small mb-0">姓名</Form.Label>
                  <Form.Control
                    size="sm"
                    value={filters.studentName}
                    onChange={(e) => setFilters({ ...filters, studentName: e.target.value })}
                    placeholder="關鍵字"
                  />
                </Col>
                <Col md={2}>
                  <Form.Label className="small mb-0">Email</Form.Label>
                  <Form.Control
                    size="sm"
                    value={filters.studentEmail}
                    onChange={(e) => setFilters({ ...filters, studentEmail: e.target.value })}
                    placeholder="關鍵字"
                  />
                </Col>
              </>
            )}
            <Col md={2}>
              <Form.Label className="small mb-0">狀態</Form.Label>
              <Form.Select
                size="sm"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                {statusOptions.map((opt) => (
                  <option key={`${opt.value}-${opt.label}`} value={opt.value}>{opt.label}</option>
                ))}
              </Form.Select>
            </Col>
            <Col xs="auto">
              <Button size="sm" variant="primary" onClick={reload}>查詢</Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      )}

      <Tab.Container activeKey={tab} onSelect={handleSelectTab}>
        <Nav variant="tabs" className="elp-admin-tabs mb-3">
          {canView && <Nav.Item><Nav.Link eventKey="passports">護照申請</Nav.Link></Nav.Item>}
          {canReview && <Nav.Item><Nav.Link eventKey="submissions">點數審核</Nav.Link></Nav.Item>}
          {(canRules || canView) && <Nav.Item><Nav.Link eventKey="rules">規則設定</Nav.Link></Nav.Item>}
          {canManage && <Nav.Item><Nav.Link eventKey="page-ui">學生頁面</Nav.Link></Nav.Item>}
        </Nav>

        {tab === 'page-ui' && canManage ? (
          <ElpStudentPageUiEditor token={token} />
        ) : loading ? (
          <div className="text-center py-5"><Spinner animation="border" /></div>
        ) : (
          <Tab.Content>
            <Tab.Pane eventKey="passports">
              {canManage && (
                <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                  <span className="small text-muted">已選 {selectedList.length} 筆</span>
                  <Button
                    size="sm"
                    variant="outline-danger"
                    disabled={!selectedList.length || batchBusy}
                    onClick={handleBatchDelete}
                  >
                    批量刪除
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-warning"
                    disabled={!selectedList.length || batchBusy}
                    onClick={handleBatchReject}
                  >
                    批量退回
                  </Button>
                  <Form.Check
                    type="checkbox"
                    id="elp-force-delete"
                    className="ms-2 small"
                    label="強制刪除已核准／已完成"
                    checked={forceDelete}
                    onChange={(e) => setForceDelete(e.target.checked)}
                  />
                </div>
              )}
              <Table responsive hover size="sm">
                <thead>
                  <tr>
                    {canManage && (
                      <th style={{ width: 36 }}>
                        <Form.Check
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAll}
                          aria-label="全選"
                        />
                      </th>
                    )}
                    <th>學號</th><th>姓名</th><th>Email</th><th>狀態</th><th>點數</th><th>申請時間</th><th />
                  </tr>
                </thead>
                <tbody>
                  {passports.length === 0 ? (
                    <tr>
                      <td colSpan={canManage ? 8 : 7} className="text-muted text-center py-4">查無資料</td>
                    </tr>
                  ) : passports.map((p) => (
                    <tr key={p.id}>
                      {canManage && (
                        <td>
                          <Form.Check
                            type="checkbox"
                            checked={selectedIds.has(p.id)}
                            onChange={() => toggleSelectOne(p.id)}
                            aria-label={`選擇 ${p.studentId}`}
                          />
                        </td>
                      )}
                      <td className="text-break" style={{ maxWidth: 180 }}>{p.studentId}</td>
                      <td className="text-break" style={{ maxWidth: 140 }}>{p.studentName}</td>
                      <td className="text-break" style={{ maxWidth: 200 }}>{p.studentEmail}</td>
                      <td><ElpStatusBadge status={p.status} /></td>
                      <td>{p.totalApprovedPoints}</td>
                      <td>{p.createdAt?.slice(0, 10)}</td>
                      <td className="text-nowrap">
                        <Button size="sm" variant="link" onClick={() => navigate(`/admin/english-learning-passports/${p.id}`)}>查看</Button>
                        {canManage && p.status === 'pending' && (
                          <>
                            <Button size="sm" variant="link" className="text-success" onClick={() => handleApprovePassport(p.id)}>核准</Button>
                            <Button size="sm" variant="link" className="text-danger" onClick={() => setRejectTarget({ type: 'passport', id: p.id })}>退回</Button>
                          </>
                        )}
                        {canManage && (
                          <Button size="sm" variant="link" className="text-danger" onClick={() => handleDeleteOne(p)}>刪除</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Tab.Pane>

            <Tab.Pane eventKey="submissions">
              <Table responsive hover size="sm">
                <thead>
                  <tr>
                    <th>學號</th><th>姓名</th><th>類型</th><th>名稱</th><th>申請點數</th><th>狀態</th><th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => (
                    <tr key={s.id}>
                      <td>{s.studentId}</td>
                      <td>{s.studentName}</td>
                      <td>{s.ruleCode}</td>
                      <td>{s.title || '—'}</td>
                      <td>{s.pointsRequested}</td>
                      <td><ElpStatusBadge status={s.status} /></td>
                      <td className="text-nowrap">
                        {s.status === 'submitted' && canReview && (
                          <Button size="sm" variant="primary" onClick={() => openReview(s)}>審核</Button>
                        )}
                        {s.status !== 'submitted' && canReview && (
                          <Button size="sm" variant="outline-secondary" onClick={() => openReview(s)}>查看</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Tab.Pane>

            <Tab.Pane eventKey="rules">
              {canMutateRules && (
                <div className="d-flex justify-content-end mb-2">
                  <Button size="sm" onClick={() => setCreatingRule(true)}>新增規則</Button>
                </div>
              )}
              <Table responsive size="sm">
                <thead>
                  <tr>
                    <th>代碼</th><th>名稱</th><th>點數</th><th>週上限</th><th>總上限</th><th>單次</th><th>啟用</th>
                    {canMutateRules && <th />}
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id}>
                      <td><code>{r.code}</code></td>
                      <td>{r.name}</td>
                      <td>{r.basePoints}</td>
                      <td>{r.maxPointsPerWeek ?? '—'}</td>
                      <td>{r.maxPointsTotal ?? '—'}</td>
                      <td>{r.isOnceOnly ? '是' : '否'}</td>
                      <td>{r.isEnabled ? '是' : '否'}</td>
                      {canMutateRules && (
                        <td className="text-nowrap">
                          <Button size="sm" variant="outline-primary" className="me-1" onClick={() => setEditingRule(r)}>
                            編輯
                          </Button>
                          <Button size="sm" variant="outline-danger" onClick={() => handleDeleteRule(r)}>
                            刪除
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Tab.Pane>
          </Tab.Content>
        )}
      </Tab.Container>

      <RejectModal
        show={!!rejectTarget}
        onHide={() => setRejectTarget(null)}
        title={
          rejectTarget?.type === 'batch'
            ? `批量退回護照（${rejectTarget.ids?.length || 0} 筆）`
            : '退回護照申請'
        }
        onConfirm={async (reason) => {
          await handleRejectPassport(reason);
        }}
      />

      <EnglishLearningSubmissionReviewModal
        show={!!reviewSub}
        onHide={() => setReviewSub(null)}
        submission={reviewSub}
        token={token}
        onDone={reload}
      />

      <EnglishLearningRuleEditModal
        show={!!editingRule}
        rule={editingRule}
        token={token}
        onHide={() => setEditingRule(null)}
        onSaved={() => {
          toast.success('規則已更新');
          reload();
        }}
      />

      <EnglishLearningRuleEditModal
        show={creatingRule}
        isCreate
        rule={null}
        token={token}
        onHide={() => setCreatingRule(false)}
        onSaved={() => {
          toast.success('規則已新增');
          reload();
        }}
      />
    </div>
  );
}
