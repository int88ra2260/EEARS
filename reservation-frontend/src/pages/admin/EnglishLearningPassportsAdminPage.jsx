import React, { useCallback, useEffect, useState } from 'react';
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
  adminApproveCertification,
  adminRejectCertification,
  adminFetchCertificationRequests,
  adminFetchRules,
  adminExportPassports,
  adminDeleteRule,
} from '../../services/englishLearningPassportApi';
import '../../components/englishLearningPassport/elp.css';
import EnglishLearningRuleEditModal from '../../components/englishLearningPassport/EnglishLearningRuleEditModal';
import EnglishLearningSubmissionReviewModal from '../../components/englishLearningPassport/EnglishLearningSubmissionReviewModal';
import ElpStatusBadge from '../../components/englishLearningPassport/ElpStatusBadge';

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

  const initialTab = searchParams.get('tab') || 'passports';
  const [tab, setTab] = useState(initialTab);
  const [passports, setPassports] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [certs, setCerts] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', studentId: '' });
  const [rejectTarget, setRejectTarget] = useState(null);
  const [reviewSub, setReviewSub] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [creatingRule, setCreatingRule] = useState(false);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (tab === 'passports' && canView) {
        setPassports(await adminFetchPassports(token, filters));
      }
      if (tab === 'submissions' && canReview) {
        setSubmissions(await adminFetchSubmissions(token, { status: filters.status || 'submitted', studentId: filters.studentId }));
      }
      if (tab === 'certifications' && canReview) {
        setCerts(await adminFetchCertificationRequests(token));
      }
      if (tab === 'rules' && (canRules || canView)) {
        setRules(await adminFetchRules(token));
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, tab, filters, canView, canReview, canRules, toast]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab && urlTab !== tab) setTab(urlTab);
  }, [searchParams, tab]);

  const handleSelectTab = (key) => {
    const next = key || 'passports';
    setTab(next);
    navigate(`?tab=${next}`, { replace: true });
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
      await adminRejectPassport(token, rejectTarget.id, reason);
      toast.success('已退回');
      setRejectTarget(null);
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const openReview = (submission) => {
    setReviewSub(submission);
  };

  const handleApproveCert = async (id) => {
    const ok = await confirm({ title: '核准最終認證', description: '確定核准英語能力標準認證？' });
    if (!ok) return;
    try {
      await adminApproveCertification(token, id);
      toast.success('已核准最終認證');
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const handleExport = async () => {
    try {
      const { blob, fileName } = await adminExportPassports(token, filters);
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

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap justify-content-end align-items-center mb-3 gap-2">
        {canExport && (
          <Button variant="outline-success" size="sm" onClick={handleExport}>匯出 Excel</Button>
        )}
      </div>

      <Card className="mb-3">
        <Card.Body className="py-2">
          <Row className="g-2 align-items-end">
            <Col md={3}>
              <Form.Label className="small mb-0">學號</Form.Label>
              <Form.Control size="sm" value={filters.studentId} onChange={(e) => setFilters({ ...filters, studentId: e.target.value })} />
            </Col>
            <Col md={3}>
              <Form.Label className="small mb-0">狀態</Form.Label>
              <Form.Select size="sm" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="">全部</option>
                <option value="pending">待審核</option>
                <option value="active">已核准</option>
                <option value="rejected">已退回</option>
                <option value="completed">已完成</option>
                <option value="submitted">提交待審</option>
              </Form.Select>
            </Col>
            <Col xs="auto">
              <Button size="sm" variant="primary" onClick={reload}>查詢</Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Tab.Container activeKey={tab} onSelect={handleSelectTab}>
        <Nav variant="tabs" className="elp-admin-tabs mb-3">
          {canView && <Nav.Item><Nav.Link eventKey="passports">護照申請</Nav.Link></Nav.Item>}
          {canReview && <Nav.Item><Nav.Link eventKey="submissions">點數審核</Nav.Link></Nav.Item>}
          {canReview && <Nav.Item><Nav.Link eventKey="certifications">最終認證</Nav.Link></Nav.Item>}
          {(canRules || canView) && <Nav.Item><Nav.Link eventKey="rules">規則設定</Nav.Link></Nav.Item>}
        </Nav>

        {loading ? (
          <div className="text-center py-5"><Spinner animation="border" /></div>
        ) : (
          <Tab.Content>
            <Tab.Pane eventKey="passports">
              <Table responsive hover size="sm">
                <thead>
                  <tr>
                    <th>學號</th><th>姓名</th><th>Email</th><th>狀態</th><th>點數</th><th>申請時間</th><th />
                  </tr>
                </thead>
                <tbody>
                  {passports.map((p) => (
                    <tr key={p.id}>
                      <td>{p.studentId}</td>
                      <td>{p.studentName}</td>
                      <td>{p.studentEmail}</td>
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

            <Tab.Pane eventKey="certifications">
              <Table responsive hover size="sm">
                <thead>
                  <tr><th>學號</th><th>姓名</th><th>點數</th><th>申請時間</th><th /></tr>
                </thead>
                <tbody>
                  {certs.map((p) => (
                    <tr key={p.id}>
                      <td>{p.studentId}</td>
                      <td>{p.studentName}</td>
                      <td>{p.totalApprovedPoints}</td>
                      <td>{p.certificationRequestedAt?.slice(0, 10)}</td>
                      <td className="text-nowrap">
                        <Button size="sm" variant="success" onClick={() => handleApproveCert(p.id)}>核准</Button>
                        <Button size="sm" variant="outline-danger" onClick={() => setRejectTarget({ type: 'cert', id: p.id })}>退回</Button>
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
        title={rejectTarget?.type === 'cert' ? '退回最終認證' : '退回護照申請'}
        onConfirm={async (reason) => {
          if (rejectTarget?.type === 'cert') {
            try {
              await adminRejectCertification(token, rejectTarget.id, reason);
              toast.success('已退回');
              setRejectTarget(null);
              reload();
            } catch (e) { toast.error(e.message); }
          } else {
            await handleRejectPassport(reason);
          }
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
