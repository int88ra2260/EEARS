import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';

import MetricCard from '../../components/learningAnalytics/MetricCard';
import LearningAnalyticsPanelHeader from '../../components/learningAnalytics/LearningAnalyticsPanelHeader';
import KpiPolicyEditorModal from '../../components/learningAnalytics/KpiPolicyEditorModal';
import StudentTrajectoryLink from '../../components/learningAnalytics/StudentTrajectoryLink';
import { SEMESTER_OPTIONS, getCurrentSemester } from '../../utils/semesterUtils';
import {
  archiveLearningAnalyticsKpiPolicy,
  cloneLearningAnalyticsKpiPolicy,
  createLearningAnalyticsKpiPolicy,
  exportLearningAnalyticsKpiGaps,
  exportLearningAnalyticsKpiReport,
  listLearningAnalyticsKpiPolicies,
  runLearningAnalyticsKpiReport,
  unarchiveLearningAnalyticsKpiPolicy,
  updateLearningAnalyticsKpiPolicy,
} from '../../services/learningAnalyticsService';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { P } from '../../constants/permissions';
import useConfirm from '../../components/ui/useConfirm';

function formatPct(rate) {
  if (rate == null || !Number.isFinite(Number(rate))) return '—';
  return `${(Number(rate) * 100).toFixed(1)}%`;
}

function formatProof(proof) {
  if (!proof) return '—';
  const bits = [
    proof.instrument,
    proof.examDate,
    proof.combined != null ? `合計 ${proof.combined}` : null,
  ].filter(Boolean);
  return bits.join(' · ') || '—';
}

const SKILL_LABELS = {
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
};

export default function LearningAnalyticsKpiReportPage() {
  const token = localStorage.getItem('token') || '';
  const accessProfile = useMemo(() => buildAccessProfile(token), [token]);
  const canManage = hasPermission(accessProfile, P.CAN_MANAGE_LEARNING_ANALYTICS_SETTINGS);
  const canExport = hasPermission(accessProfile, P.CAN_EXPORT_LEARNING_ANALYTICS);
  const { confirm } = useConfirm();

  const [policies, setPolicies] = useState([]);
  const [policyId, setPolicyId] = useState('');
  const [semesterId, setSemesterId] = useState(() => getCurrentSemester() || '');
  const [showArchived, setShowArchived] = useState(false);
  const [loadingPolicies, setLoadingPolicies] = useState(true);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingGaps, setExportingGaps] = useState(false);
  const [busyPolicyId, setBusyPolicyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [report, setReport] = useState(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState('create');
  const [editorPolicy, setEditorPolicy] = useState(null);
  const [editorTemplate, setEditorTemplate] = useState(null);

  const selectedPolicy = useMemo(
    () => policies.find((p) => String(p.id) === String(policyId)) || null,
    [policies, policyId]
  );

  const activePolicies = useMemo(
    () => policies.filter((p) => !p.isArchived),
    [policies]
  );

  const loadPolicies = useCallback(async () => {
    if (!token) return;
    setLoadingPolicies(true);
    setError('');
    try {
      const data = await listLearningAnalyticsKpiPolicies(token, {
        includeArchived: canManage && showArchived ? '1' : undefined,
      });
      const list = Array.isArray(data) ? data : [];
      setPolicies(list);
      setPolicyId((prev) => {
        if (prev && list.some((p) => String(p.id) === String(prev) && !p.isArchived)) return prev;
        const preferred = list.find((p) => !p.isArchived && p.policyKey === 'ay115-sitting-pair-sum')
          || list.find((p) => !p.isArchived)
          || list[0];
        return preferred ? String(preferred.id) : '';
      });
    } catch (e) {
      setError(e.message || '載入政策失敗');
    } finally {
      setLoadingPolicies(false);
    }
  }, [token, canManage, showArchived]);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  const openCreate = (template = null) => {
    setEditorMode('create');
    setEditorPolicy(null);
    setEditorTemplate(template || selectedPolicy || activePolicies[0] || null);
    setEditorOpen(true);
  };

  const openEdit = (policy) => {
    setEditorMode('edit');
    setEditorPolicy(policy);
    setEditorTemplate(null);
    setEditorOpen(true);
  };

  const handleEditorSubmit = async (payload) => {
    if (editorMode === 'create') {
      const created = await createLearningAnalyticsKpiPolicy(token, payload);
      setNotice(`已新建政策「${created.name}」`);
      await loadPolicies();
      setPolicyId(String(created.id));
      return;
    }
    const updated = await updateLearningAnalyticsKpiPolicy(token, editorPolicy.id, payload);
    setNotice(`已更新政策「${updated.name}」`);
    await loadPolicies();
    setPolicyId(String(updated.id));
  };

  const handleClone = async (policy) => {
    if (!policy || !canManage) return;
    setBusyPolicyId(policy.id);
    setError('');
    try {
      const cloned = await cloneLearningAnalyticsKpiPolicy(token, policy.id, {});
      setNotice(`已複製為「${cloned.name}」，可直接編輯副本。`);
      await loadPolicies();
      setPolicyId(String(cloned.id));
      openEdit(cloned);
    } catch (e) {
      setError(e.message || '複製政策失敗');
    } finally {
      setBusyPolicyId(null);
    }
  };

  const handleArchive = async (policy) => {
    if (!policy || !canManage || policy.isBuiltin) return;
    const ok = await confirm({
      title: '封存政策',
      description: `確定封存「${policy.name}」？封存後不會出現在報表下拉（可再取消封存）。`,
      confirmText: '封存',
      variant: 'danger',
    });
    if (!ok) return;
    setBusyPolicyId(policy.id);
    setError('');
    try {
      await archiveLearningAnalyticsKpiPolicy(token, policy.id);
      setNotice(`已封存「${policy.name}」`);
      await loadPolicies();
    } catch (e) {
      setError(e.message || '封存失敗');
    } finally {
      setBusyPolicyId(null);
    }
  };

  const handleUnarchive = async (policy) => {
    if (!policy || !canManage) return;
    setBusyPolicyId(policy.id);
    setError('');
    try {
      await unarchiveLearningAnalyticsKpiPolicy(token, policy.id);
      setNotice(`已取消封存「${policy.name}」`);
      await loadPolicies();
      setPolicyId(String(policy.id));
    } catch (e) {
      setError(e.message || '取消封存失敗');
    } finally {
      setBusyPolicyId(null);
    }
  };

  const handleRun = async () => {
    if (!policyId || !semesterId) {
      setError('請選擇政策與名冊學期');
      return;
    }
    if (selectedPolicy?.isArchived) {
      setError('已封存政策無法執行報表，請先取消封存或改選其他政策');
      return;
    }
    setRunning(true);
    setError('');
    setNotice('');
    try {
      const data = await runLearningAnalyticsKpiReport(token, {
        policyId: Number(policyId),
        semesterId,
        includeRows: true,
      });
      setReport(data);
    } catch (e) {
      setError(e.message || '執行報表失敗');
      setReport(null);
    } finally {
      setRunning(false);
    }
  };

  const handleExport = async () => {
    if (!policyId || !semesterId) {
      setError('請選擇政策與名冊學期');
      return;
    }
    setExporting(true);
    setError('');
    try {
      const { blob, fileName } = await exportLearningAnalyticsKpiReport(token, {
        policyId,
        semesterId,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || '匯出失敗');
    } finally {
      setExporting(false);
    }
  };

  const handleExportGaps = async () => {
    if (!policyId || !semesterId) {
      setError('請選擇政策與名冊學期');
      return;
    }
    setExportingGaps(true);
    setError('');
    try {
      const { blob, fileName } = await exportLearningAnalyticsKpiGaps(token, {
        policyId,
        semesterId,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      setNotice('已匯出缺口名單（未達標／缺重測／無考試）');
    } catch (e) {
      setError(e.message || '匯出缺口名單失敗');
    } finally {
      setExportingGaps(false);
    }
  };

  const semesterOptions = SEMESTER_OPTIONS.filter((o) => o.value);

  return (
    <div className="la-page-body">
      <LearningAnalyticsPanelHeader
        title="B2 KPI 報表"
        lead="依政策庫鎖定達標規則（同場合計或單項歷史最佳），對名冊學生產出聽讀／說寫（或四技能）達標人數與比例。可隨時切換政策，不限單一學年一種看法。"
      />

      {error ? <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert> : null}
      {notice ? <Alert variant="success" onClose={() => setNotice('')} dismissible>{notice}</Alert> : null}

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          {loadingPolicies ? (
            <div className="text-muted d-flex align-items-center gap-2">
              <Spinner size="sm" animation="border" /> 載入政策庫…
            </div>
          ) : (
            <div className="row g-3 align-items-end">
              <div className="col-md-5">
                <Form.Label>KPI 政策</Form.Label>
                <Form.Select
                  value={policyId}
                  onChange={(e) => setPolicyId(e.target.value)}
                >
                  {activePolicies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.isBuiltin ? '（內建）' : ''}
                      {p.academicYear ? ` · ${p.academicYear}學年` : ''}
                    </option>
                  ))}
                </Form.Select>
                {selectedPolicy?.isBuiltin ? (
                  <div className="form-text text-warning-emphasis">
                    內建政策唯讀。若要改門檻／規則／年級範圍，請複製後編輯副本。
                  </div>
                ) : selectedPolicy?.description ? (
                  <div className="form-text">{selectedPolicy.description}</div>
                ) : null}
                {selectedPolicy?.definition?.population ? (
                  <div className="form-text">
                    名冊年級：
                    {selectedPolicy.definition.population.gradeMin != null
                      || selectedPolicy.definition.population.gradeMax != null
                      ? `大${selectedPolicy.definition.population.gradeMin ?? '?'}至大${selectedPolicy.definition.population.gradeMax ?? '?'}`
                      : '不限'}
                    （依選定學期在學名冊）
                  </div>
                ) : null}
              </div>
              <div className="col-md-3">
                <Form.Label>名冊學期（分母）</Form.Label>
                <Form.Control
                  list="la-kpi-semester-options"
                  value={semesterId}
                  placeholder="例：115-1"
                  onChange={(e) => setSemesterId(e.target.value.trim())}
                />
                <datalist id="la-kpi-semester-options">
                  {semesterOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label || o.value}</option>
                  ))}
                </datalist>
              </div>
              <div className="col-md-4 d-flex flex-wrap gap-2">
                <Button variant="primary" onClick={handleRun} disabled={running || !policyId || !semesterId}>
                  {running ? '計算中…' : '執行報表'}
                </Button>
                {canExport ? (
                  <>
                    <Button
                      variant="outline-secondary"
                      onClick={handleExport}
                      disabled={exporting || exportingGaps || !policyId || !semesterId}
                    >
                      {exporting ? '匯出中…' : '匯出 Excel'}
                    </Button>
                    <Button
                      variant="outline-primary"
                      onClick={handleExportGaps}
                      disabled={exporting || exportingGaps || !policyId || !semesterId}
                    >
                      {exportingGaps ? '匯出中…' : '匯出缺口名單'}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          )}

          {selectedPolicy?.definition?.notes?.length ? (
            <ul className="small text-muted mb-0 mt-3">
              {selectedPolicy.definition.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {canManage ? (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
              <div>
                <h2 className="h5 mb-1">政策庫管理</h2>
                <p className="small text-muted mb-0">
                  新建／編輯自訂政策；內建政策僅可複製。封存為軟刪除，可再還原。
                </p>
              </div>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <Button size="sm" variant="primary" onClick={() => openCreate(selectedPolicy)}>
                  新建政策
                </Button>
                <Form.Check
                  type="switch"
                  id="kpi-show-archived"
                  label="顯示已封存"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
              </div>
            </div>

            <div className="table-responsive">
              <Table hover size="sm" className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>名稱</th>
                    <th>鍵值</th>
                    <th>學年</th>
                    <th>狀態</th>
                    <th className="text-end">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.map((policy) => {
                    const busy = busyPolicyId === policy.id;
                    return (
                      <tr key={policy.id} className={String(policy.id) === String(policyId) ? 'table-light' : undefined}>
                        <td>
                          <div className="fw-semibold">{policy.name}</div>
                          {policy.description ? (
                            <div className="small text-muted text-truncate" style={{ maxWidth: 280 }}>
                              {policy.description}
                            </div>
                          ) : null}
                        </td>
                        <td className="small"><code>{policy.policyKey}</code></td>
                        <td>{policy.academicYear || '—'}</td>
                        <td>
                          {policy.isBuiltin ? <Badge bg="secondary" className="me-1">內建唯讀</Badge> : null}
                          {policy.isArchived ? <Badge bg="warning" text="dark">已封存</Badge> : <Badge bg="success">使用中</Badge>}
                        </td>
                        <td className="text-end">
                          <div className="d-inline-flex flex-wrap gap-1 justify-content-end">
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              disabled={busy}
                              onClick={() => setPolicyId(String(policy.id))}
                            >
                              選用
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-primary"
                              disabled={busy}
                              onClick={() => handleClone(policy)}
                            >
                              複製
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-primary"
                              disabled={busy}
                              onClick={() => openEdit(policy)}
                            >
                              {policy.isBuiltin ? '檢視' : '編輯'}
                            </Button>
                            {!policy.isBuiltin && !policy.isArchived ? (
                              <Button
                                size="sm"
                                variant="outline-danger"
                                disabled={busy}
                                onClick={() => handleArchive(policy)}
                              >
                                封存
                              </Button>
                            ) : null}
                            {!policy.isBuiltin && policy.isArchived ? (
                              <Button
                                size="sm"
                                variant="outline-success"
                                disabled={busy}
                                onClick={() => handleUnarchive(policy)}
                              >
                                取消封存
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </div>
        </div>
      ) : (
        <Alert variant="light" className="border mb-3 small text-muted">
          政策庫新建／編輯／封存需「學習成效分析設定」權限。目前可選用既有政策執行報表。
        </Alert>
      )}

      {report ? (
        <>
          <div className="row g-3 mb-3">
            <div className="col-md-3">
              <MetricCard
                label="納入人數（分母）"
                value={report.population?.totalStudents ?? '—'}
                hint={report.population?.semesterId}
              />
            </div>
            <div className="col-md-3">
              <MetricCard
                label="年級範圍"
                value={report.population?.gradeFilter?.label || '不限年級'}
                hint={report.population?.rosterStats
                  ? `名冊 ${report.population.rosterStats.rosterTotal} → 納入 ${report.population.rosterStats.included}`
                  : report.population?.note}
              />
            </div>
            {(report.summary?.dimensions || []).map((dim) => (
              <div className="col-md-3" key={dim.id}>
                <MetricCard
                  label={dim.label}
                  value={formatPct(dim.rate)}
                  hint={`${dim.passedCount} / ${report.population?.totalStudents ?? 0} 人`}
                />
              </div>
            ))}
          </div>
          {report.population?.gradeFilter?.enabled ? (
            <Alert variant="light" className="border small mb-3">
              年級依「{report.population.semesterId}」在學名冊篩選為
              {' '}
              <strong>{report.population.gradeFilter.label}</strong>
              。名冊共 {report.population.rosterStats?.rosterTotal ?? '—'} 人，
              納入 {report.population.rosterStats?.included ?? '—'} 人
              {report.population.rosterStats?.excludedByGrade
                ? `（年級不符排除 ${report.population.rosterStats.excludedByGrade}`
                : ''}
              {report.population.rosterStats?.excludedMissingGrade
                ? `${report.population.rosterStats?.excludedByGrade ? '；' : '（'}缺年級排除 ${report.population.rosterStats.excludedMissingGrade}）`
                : (report.population.rosterStats?.excludedByGrade ? '）' : '')}
              。
            </Alert>
          ) : null}

          {report.summary?.skillBreakdown ? (
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-body">
                <LearningAnalyticsPanelHeader
                  title="分項對照（非官方成對 KPI）"
                  lead="歷史最佳單項 CEFR≥B2。成對缺一技能時此處仍可能顯示該技能達標。"
                />
                <div className="row g-3">
                  {Object.entries(report.summary.skillBreakdown).map(([skill, cell]) => (
                    <div className="col-md-3" key={skill}>
                      <MetricCard
                        label={`${SKILL_LABELS[skill] || skill} 達 B2+`}
                        value={formatPct(cell.rate)}
                        hint={`${cell.count} 人`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <LearningAnalyticsPanelHeader
                title="學生明細"
                lead={`政策：${report.policy?.name} · 產生於 ${report.generatedAt || ''} · 點學號可開個人軌跡`}
              />
              <div className="table-responsive">
                <Table hover size="sm" className="mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>學號</th>
                      <th>年級</th>
                      {(report.summary?.dimensions || []).map((dim) => (
                        <React.Fragment key={dim.id}>
                          <th>{dim.label}</th>
                          <th>證明</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(report.rows || []).slice(0, 200).map((row) => (
                      <tr key={row.studentId}>
                        <td>
                          <StudentTrajectoryLink studentId={row.studentId} from="kpi">
                            {row.studentId}
                          </StudentTrajectoryLink>
                        </td>
                        <td>{row.grade || '—'}</td>
                        {(report.summary?.dimensions || []).map((dim) => {
                          const cell = row.dimensions?.[dim.id];
                          return (
                            <React.Fragment key={dim.id}>
                              <td>{cell?.passed ? 'Y' : 'N'}</td>
                              <td className="small text-muted">{formatProof(cell?.proof)}</td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              {(report.rows || []).length > 200 ? (
                <div className="form-text mt-2">畫面僅預覽前 200 列；完整名單請匯出 Excel。</div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      <KpiPolicyEditorModal
        show={editorOpen}
        mode={editorMode}
        policy={editorPolicy}
        templatePolicy={editorTemplate}
        onHide={() => setEditorOpen(false)}
        onSubmit={handleEditorSubmit}
      />
    </div>
  );
}
