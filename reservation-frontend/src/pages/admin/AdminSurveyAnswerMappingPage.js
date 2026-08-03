import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Table from 'react-bootstrap/Table';
import Modal from 'react-bootstrap/Modal';
import Spinner from 'react-bootstrap/Spinner';
import StatusBadge from '../../components/ui/StatusBadge';
import Dropdown from 'react-bootstrap/Dropdown';
import ProgressBar from 'react-bootstrap/ProgressBar';
import useToast from '../../components/ui/useToast';
import SurveyWorkflowGuide from '../../components/admin/survey/SurveyWorkflowGuide';
import SurveyOpsQuickLinks from '../../components/admin/survey/SurveyOpsQuickLinks';
import {
  approveAnswerMapping,
  createAnswerMappings,
  fetchAnswerMappings,
  fetchSurveyCenterOptions,
  proposeAnswerMappings,
  rejectAnswerMapping,
  saveAnswerMapping,
} from '../../services/surveyAdminApi';
import {
  MAPPING_STATUS_LABELS,
  MAPPING_TYPE_LABELS,
  surveyLabelById,
  versionLabelById,
} from '../../constants/surveyAdminUx';
import { surveyMappingStatusToVariant } from '../../utils/statusBadgeUtils';

const defaultFilters = {
  surveyId: '',
  surveyVersionId: '',
  status: 'all',
  sourceQuestionKey: '',
  targetQuestionKey: '',
};

const defaultForm = {
  surveyId: '',
  surveyVersionId: '',
  sourceQuestionKey: '',
  targetQuestionKey: '',
  sourceLabel: '',
  targetLabel: '',
  mappingType: 'manual',
  confidenceScore: '0.8',
  notes: '',
};

function confidencePercent(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n * 100)));
}

function MappingStatusBadge({ status }) {
  const key = String(status || '').toLowerCase();
  return (
    <StatusBadge variant={surveyMappingStatusToVariant(key)} size="sm">
      {MAPPING_STATUS_LABELS[key] || status || '—'}
    </StatusBadge>
  );
}

function MappingFilterChip({ active, variant, onClick, children }) {
  return (
    <StatusBadge
      variant={active ? variant : 'neutral'}
      size="sm"
      role="button"
      tabIndex={0}
      className="mapping-filter-chip"
      style={{ cursor: 'pointer' }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </StatusBadge>
  );
}

export default function AdminSurveyAnswerMappingPage() {
  const { token } = useOutletContext();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const [draftFilters, setDraftFilters] = useState(defaultFilters);
  const [options, setOptions] = useState({ surveys: [], versions: [] });
  const [rows, setRows] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [proposalModal, setProposalModal] = useState({ show: false, loading: false, items: [] });
  const [rejectModal, setRejectModal] = useState({ show: false, id: null, notes: '' });

  const loadOptions = useCallback(async () => {
    const data = await fetchSurveyCenterOptions(token);
    setOptions({ surveys: data.surveys || [], versions: data.versions || [] });
  }, [token]);

  const loadRows = useCallback(async () => {
    const q = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v != null) q.set(k, v);
    });
    const data = await fetchAnswerMappings(token, q);
    setRows(Array.isArray(data) ? data : []);
  }, [filters, token]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([loadOptions(), loadRows()]);
    } catch (e) {
      toast.danger(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [loadOptions, loadRows, toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!loading) {
      loadRows().catch((e) => toast.danger(e.message || '載入對照表失敗'));
    }
  }, [loading, loadRows, toast]);

  const statusCounts = useMemo(() => {
    const counts = { pending: 0, approved: 0, rejected: 0 };
    rows.forEach((r) => {
      const s = String(r.status || '').toLowerCase();
      if (counts[s] != null) counts[s] += 1;
    });
    return counts;
  }, [rows]);

  const filteredVersions = useMemo(
    () =>
      options.versions.filter(
        (v) => !form.surveyId || String(v.surveyId) === String(form.surveyId)
      ),
    [options.versions, form.surveyId]
  );

  const applyDraftFilters = () => {
    setFilters({ ...draftFilters });
  };

  const resetFilters = () => {
    setDraftFilters(defaultFilters);
    setFilters(defaultFilters);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...defaultForm,
      surveyId: filters.surveyId || '',
      surveyVersionId: filters.surveyVersionId || '',
    });
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      surveyId: row.surveyId != null ? String(row.surveyId) : '',
      surveyVersionId: row.surveyVersionId != null ? String(row.surveyVersionId) : '',
      sourceQuestionKey: row.sourceQuestionKey || '',
      targetQuestionKey: row.targetQuestionKey || '',
      sourceLabel: row.sourceLabel || '',
      targetLabel: row.targetLabel || '',
      mappingType: row.mappingType || 'manual',
      confidenceScore: String(row.confidenceScore ?? ''),
      notes: row.notes || '',
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.sourceQuestionKey?.trim() || !form.targetQuestionKey?.trim()) {
      throw new Error('請填寫舊題目代碼與新題目代碼');
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        surveyId: form.surveyId ? Number(form.surveyId) : null,
        surveyVersionId: form.surveyVersionId ? Number(form.surveyVersionId) : null,
        confidenceScore: Number(form.confidenceScore || 0),
      };
      const url = editing
        ? `/api/admin/surveys/answer-mappings/${editing.id}`
        : '/api/admin/surveys/answer-mappings';
      const method = editing ? 'PUT' : 'POST';
      await saveAnswerMapping(token, { method, url, payload });
      toast.success(editing ? '對照已更新' : '對照已建立');
      setShowModal(false);
      await loadRows();
    } finally {
      setSaving(false);
    }
  };

  const approve = async (id, { silent = false, skipReload = false } = {}) => {
    await approveAnswerMapping(token, id, {});
    if (!silent) toast.success('對照已核准');
    if (!skipReload) loadRows();
  };

  const confirmReject = async () => {
    const { id, notes } = rejectModal;
    if (!id) return;
    await rejectAnswerMapping(token, id, { notes: notes.trim() || '由管理員拒絕' });
    toast.success('對照已拒絕');
    setRejectModal({ show: false, id: null, notes: '' });
    loadRows();
  };

  const bulkApproveHighConfidence = async () => {
    const pending = rows.filter(
      (r) => r.status === 'pending' && Number(r.confidenceScore || 0) >= 0.9
    );
    if (!pending.length) {
      toast.info('沒有信心度 ≥ 0.9 的待核准項目');
      return;
    }
    if (!window.confirm(`確定一次核准 ${pending.length} 筆高信心對照？`)) return;
    for (const r of pending) {
      // eslint-disable-next-line no-await-in-loop
      await approve(r.id, { silent: true, skipReload: true });
    }
    await loadRows();
    toast.success(`已核准 ${pending.length} 筆高信心對照`);
  };

  const fetchProposals = async () => {
    if (!filters.surveyId) {
      toast.info('請先選擇問卷，再產生建議對照');
      return;
    }
    setProposalModal({ show: true, loading: true, items: [] });
    try {
      const payload = {
        surveyId: filters.surveyId || null,
        surveyVersionId: filters.surveyVersionId || null,
      };
      const data = await proposeAnswerMappings(token, payload);
      const items = (data.proposals || []).map((p, idx) => ({ ...p, _key: idx }));
      setProposalModal({ show: true, loading: false, items });
      if (!items.length) toast.info('目前沒有可自動建議的對照');
    } catch (e) {
      toast.danger(e.message || '建議產生失敗');
      setProposalModal({ show: false, loading: false, items: [] });
    }
  };

  const createSelectedProposals = async (selected) => {
    if (!selected.length) {
      toast.info('請至少勾選一筆建議');
      return;
    }
    setSaving(true);
    try {
      for (const p of selected) {
        // eslint-disable-next-line no-await-in-loop
        await createAnswerMappings(token, p);
      }
      toast.success(`已建立 ${selected.length} 筆待核准對照`);
      setProposalModal({ show: false, loading: false, items: [] });
      await loadRows();
      setFilters((f) => ({ ...f, status: 'pending' }));
      setDraftFilters((f) => ({ ...f, status: 'pending' }));
    } finally {
      setSaving(false);
    }
  };

  const [selectedProposalKeys, setSelectedProposalKeys] = useState(new Set());

  useEffect(() => {
    if (!proposalModal.show) setSelectedProposalKeys(new Set());
    else {
      const high = new Set(
        proposalModal.items
          .filter((p) => Number(p.confidenceScore || 0) >= 0.9)
          .map((p) => p._key)
      );
      setSelectedProposalKeys(high);
    }
  }, [proposalModal.show, proposalModal.items]);

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
        <div>
          <h2 className="h4 text-primary mb-1">問卷答案對照</h2>
          <div className="text-muted small">
            題目代碼變更時，將舊答案對應到新題目；
            <strong className="text-success">核准後</strong>才納入統計與分析。
          </div>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Button variant="outline-primary" onClick={refresh} disabled={loading}>
            重新整理
          </Button>
          <Button variant="outline-secondary" onClick={fetchProposals}>
            自動建議對照
          </Button>
          <Button onClick={openCreate}>手動新增</Button>
        </div>
      </div>

      <SurveyWorkflowGuide variant="mapping" defaultOpen={false} />

      <SurveyOpsQuickLinks
        links={[
          {
            to: '/admin/survey-health',
            label: '資料品質',
            description: '查看無法對照的作答筆數',
          },
          {
            to: '/admin/survey-center',
            label: '問卷中心',
            description: '確認目前已發布題目代碼',
          },
        ]}
      />

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body>
          <div className="d-flex flex-wrap gap-2 mb-3">
            <MappingFilterChip
              active={filters.status === 'pending'}
              variant="warning"
              onClick={() => {
                setFilters((f) => ({ ...f, status: 'pending' }));
                setDraftFilters((f) => ({ ...f, status: 'pending' }));
              }}
            >
              待核准 {statusCounts.pending}
            </MappingFilterChip>
            <MappingFilterChip
              active={filters.status === 'approved'}
              variant="success"
              onClick={() => {
                setFilters((f) => ({ ...f, status: 'approved' }));
                setDraftFilters((f) => ({ ...f, status: 'approved' }));
              }}
            >
              已核准 {statusCounts.approved}
            </MappingFilterChip>
            <MappingFilterChip
              active={filters.status === 'rejected'}
              variant="danger"
              onClick={() => {
                setFilters((f) => ({ ...f, status: 'rejected' }));
                setDraftFilters((f) => ({ ...f, status: 'rejected' }));
              }}
            >
              已拒絕 {statusCounts.rejected}
            </MappingFilterChip>
            {statusCounts.pending > 0 ? (
              <Button size="sm" variant="outline-success" onClick={bulkApproveHighConfidence}>
                一次核准高信心（≥0.9）
              </Button>
            ) : null}
          </div>

          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <Form.Label className="small text-muted mb-0">問卷</Form.Label>
              <Form.Select
                value={draftFilters.surveyId}
                onChange={(e) =>
                  setDraftFilters((f) => ({ ...f, surveyId: e.target.value, surveyVersionId: '' }))
                }
              >
                <option value="">全部問卷</option>
                {options.surveys.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title || s.name || s.surveyKey}
                  </option>
                ))}
              </Form.Select>
            </div>
            <div className="col-md-2">
              <Form.Label className="small text-muted mb-0">版本</Form.Label>
              <Form.Select
                value={draftFilters.surveyVersionId}
                onChange={(e) =>
                  setDraftFilters((f) => ({ ...f, surveyVersionId: e.target.value }))
                }
              >
                <option value="">全部版本</option>
                {options.versions
                  .filter((v) => !draftFilters.surveyId || String(v.surveyId) === String(draftFilters.surveyId))
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      第 {v.versionNumber} 版
                    </option>
                  ))}
              </Form.Select>
            </div>
            <div className="col-md-2">
              <Form.Label className="small text-muted mb-0">狀態</Form.Label>
              <Form.Select
                value={draftFilters.status}
                onChange={(e) => setDraftFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="all">全部狀態</option>
                <option value="pending">待核准</option>
                <option value="approved">已核准</option>
                <option value="rejected">已拒絕</option>
              </Form.Select>
            </div>
            <div className="col-md-2">
              <Form.Label className="small text-muted mb-0">舊題目代碼</Form.Label>
              <Form.Control
                placeholder="關鍵字"
                value={draftFilters.sourceQuestionKey}
                onChange={(e) =>
                  setDraftFilters((f) => ({ ...f, sourceQuestionKey: e.target.value }))
                }
                onKeyDown={(e) => e.key === 'Enter' && applyDraftFilters()}
              />
            </div>
            <div className="col-md-2">
              <Form.Label className="small text-muted mb-0">新題目代碼</Form.Label>
              <Form.Control
                placeholder="關鍵字"
                value={draftFilters.targetQuestionKey}
                onChange={(e) =>
                  setDraftFilters((f) => ({ ...f, targetQuestionKey: e.target.value }))
                }
                onKeyDown={(e) => e.key === 'Enter' && applyDraftFilters()}
              />
            </div>
            <div className="col-md-3 d-flex gap-2">
              <Button variant="primary" onClick={applyDraftFilters}>
                查詢
              </Button>
              <Button variant="outline-secondary" onClick={resetFilters}>
                重設
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white d-flex justify-content-between align-items-center">
          <span className="fw-semibold">對照列表</span>
          <span className="text-muted small">共 {rows.length} 筆</span>
        </Card.Header>
        <Card.Body className="p-0 position-relative">
          {loading ? (
            <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white bg-opacity-75 z-1">
              <Spinner animation="border" size="sm" />
            </div>
          ) : null}
          <Table size="sm" hover responsive className="mb-0">
            <thead>
              <tr>
                <th>問卷／版本</th>
                <th>舊題目 → 新題目</th>
                <th>題目標題</th>
                <th>方式</th>
                <th>信心度</th>
                <th>狀態</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-5">
                    {filters.surveyId
                      ? '此條件下尚無對照；可嘗試「自動建議對照」或手動新增。'
                      : '請選擇問卷後查詢，或使用「自動建議對照」（需先選問卷）。'}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="small">
                      <div>{surveyLabelById(options.surveys, r.surveyId)}</div>
                      <div className="text-muted">{versionLabelById(options.versions, r.surveyVersionId)}</div>
                    </td>
                    <td>
                      <code className="small">{r.sourceQuestionKey}</code>
                      <span className="text-muted mx-1">→</span>
                      <code className="small text-primary">{r.targetQuestionKey}</code>
                    </td>
                    <td className="small text-muted">
                      {(r.sourceLabel || r.targetLabel) ? (
                        <>
                          {r.sourceLabel ? <div>舊：{r.sourceLabel}</div> : null}
                          {r.targetLabel ? <div>新：{r.targetLabel}</div> : null}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="small">{MAPPING_TYPE_LABELS[r.mappingType] || r.mappingType}</td>
                    <td style={{ minWidth: 100 }}>
                      <div className="small mb-1">{r.confidenceScore ?? '—'}</div>
                      <ProgressBar
                        now={confidencePercent(r.confidenceScore)}
                        variant={confidencePercent(r.confidenceScore) >= 90 ? 'success' : 'warning'}
                        style={{ height: 4 }}
                      />
                    </td>
                    <td>
                      <MappingStatusBadge status={r.status} />
                    </td>
                    <td>
                      <Dropdown align="end">
                        <Dropdown.Toggle size="sm" variant="outline-primary" id={`map-act-${r.id}`}>
                          操作
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                          <Dropdown.Item onClick={() => openEdit(r)}>編輯</Dropdown.Item>
                          {r.status === 'pending' ? (
                            <>
                              <Dropdown.Item onClick={() => approve(r.id).catch((e) => toast.danger(e.message))}>
                                核准
                              </Dropdown.Item>
                              <Dropdown.Item
                                onClick={() =>
                                  setRejectModal({ show: true, id: r.id, notes: '' })
                                }
                              >
                                拒絕…
                              </Dropdown.Item>
                            </>
                          ) : null}
                        </Dropdown.Menu>
                      </Dropdown>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editing ? '編輯答案對照' : '新增答案對照'}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="row g-3">
          <div className="col-md-6">
            <Form.Label className="small text-muted mb-0">問卷</Form.Label>
            <Form.Select
              value={form.surveyId}
              onChange={(e) =>
                setForm((f) => ({ ...f, surveyId: e.target.value, surveyVersionId: '' }))
              }
            >
              <option value="">（全問卷通用）</option>
              {options.surveys.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || s.name}
                </option>
              ))}
            </Form.Select>
          </div>
          <div className="col-md-6">
            <Form.Label className="small text-muted mb-0">版本</Form.Label>
            <Form.Select
              value={form.surveyVersionId}
              onChange={(e) => setForm((f) => ({ ...f, surveyVersionId: e.target.value }))}
              disabled={!form.surveyId}
            >
              <option value="">（全版本通用）</option>
              {filteredVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  第 {v.versionNumber} 版
                </option>
              ))}
            </Form.Select>
          </div>
          <div className="col-md-6">
            <Form.Label className="small text-muted mb-0">舊題目代碼 *</Form.Label>
            <Form.Control
              value={form.sourceQuestionKey}
              onChange={(e) => setForm((f) => ({ ...f, sourceQuestionKey: e.target.value }))}
              placeholder="例如 legacy_q1"
            />
          </div>
          <div className="col-md-6">
            <Form.Label className="small text-muted mb-0">新題目代碼 *</Form.Label>
            <Form.Control
              value={form.targetQuestionKey}
              onChange={(e) => setForm((f) => ({ ...f, targetQuestionKey: e.target.value }))}
              placeholder="例如 q1"
            />
          </div>
          <div className="col-md-6">
            <Form.Label className="small text-muted mb-0">舊題目標題（選填）</Form.Label>
            <Form.Control
              value={form.sourceLabel}
              onChange={(e) => setForm((f) => ({ ...f, sourceLabel: e.target.value }))}
            />
          </div>
          <div className="col-md-6">
            <Form.Label className="small text-muted mb-0">新題目標題（選填）</Form.Label>
            <Form.Control
              value={form.targetLabel}
              onChange={(e) => setForm((f) => ({ ...f, targetLabel: e.target.value }))}
            />
          </div>
          <div className="col-md-6">
            <Form.Label className="small text-muted mb-0">對照方式</Form.Label>
            <Form.Select
              value={form.mappingType}
              onChange={(e) => setForm((f) => ({ ...f, mappingType: e.target.value }))}
            >
              {Object.entries(MAPPING_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Form.Select>
          </div>
          <div className="col-md-6">
            <Form.Label className="small text-muted mb-0">信心度（0–1）</Form.Label>
            <Form.Control
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={form.confidenceScore}
              onChange={(e) => setForm((f) => ({ ...f, confidenceScore: e.target.value }))}
            />
          </div>
          <div className="col-12">
            <Form.Label className="small text-muted mb-0">備註</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            取消
          </Button>
          <Button
            onClick={() => save().catch((e) => toast.danger(e.message || '儲存失敗'))}
            disabled={saving}
          >
            {saving ? '儲存中…' : '儲存'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={proposalModal.show}
        onHide={() => setProposalModal({ show: false, loading: false, items: [] })}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>自動建議對照（請勾選後建立）</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {proposalModal.loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          ) : null}
          {!proposalModal.loading && proposalModal.items.length === 0 ? (
            <div className="text-muted small">沒有可建議的對照。請確認已選問卷／版本，且作答中有舊題目代碼。</div>
          ) : null}
          {!proposalModal.loading && proposalModal.items.length > 0 ? (
            <Table size="sm" hover>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <Form.Check
                      checked={selectedProposalKeys.size === proposalModal.items.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProposalKeys(new Set(proposalModal.items.map((p) => p._key)));
                        } else {
                          setSelectedProposalKeys(new Set());
                        }
                      }}
                    />
                  </th>
                  <th>舊 → 新</th>
                  <th>方式</th>
                  <th>信心度</th>
                </tr>
              </thead>
              <tbody>
                {proposalModal.items.map((p) => (
                  <tr key={p._key}>
                    <td>
                      <Form.Check
                        checked={selectedProposalKeys.has(p._key)}
                        onChange={(e) => {
                          setSelectedProposalKeys((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(p._key);
                            else next.delete(p._key);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td>
                      <code>{p.sourceQuestionKey}</code> → <code>{p.targetQuestionKey}</code>
                    </td>
                    <td>{MAPPING_TYPE_LABELS[p.mappingType] || p.mappingType}</td>
                    <td>{p.confidenceScore}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setProposalModal({ show: false, loading: false, items: [] })}>
            取消
          </Button>
          <Button
            disabled={saving || !selectedProposalKeys.size}
            onClick={() => {
              const selected = proposalModal.items.filter((p) => selectedProposalKeys.has(p._key));
              createSelectedProposals(selected).catch((e) => toast.danger(e.message));
            }}
          >
            建立已勾選（{selectedProposalKeys.size}）
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={rejectModal.show} onHide={() => setRejectModal({ show: false, id: null, notes: '' })} centered>
        <Modal.Header closeButton>
          <Modal.Title>拒絕對照</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Label className="small text-muted">拒絕原因（選填，會寫入備註）</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            value={rejectModal.notes}
            onChange={(e) => setRejectModal((s) => ({ ...s, notes: e.target.value }))}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setRejectModal({ show: false, id: null, notes: '' })}>
            取消
          </Button>
          <Button variant="danger" onClick={() => confirmReject().catch((e) => toast.danger(e.message))}>
            確認拒絕
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
