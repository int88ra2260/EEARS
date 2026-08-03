import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import {
  fetchEventGrouping,
  generateEventGrouping,
  patchEventGroupingAssignments,
  publishEventGrouping,
  fetchEtLeaderCandidates,
  assignEventGroupLeaders,
  applyEventLeaderPreferences,
} from '../../../../services/etGroupingApi';
import { showErrorMessage, showSuccessMessage } from '../../../../utils/errorHandler';
import './adminEventGroupingTab.css';

const DATA_QUALITY_LABELS = {
  high: { label: '英檢最佳', variant: 'success' },
  baseline_only: { label: '僅基線', variant: 'warning' },
  missing: { label: '待確認', variant: 'secondary' },
};

const SOURCE_LABELS = {
  auto: '能力分組',
  legacy: '預約順序',
  manual: '手動調整',
};

function formatGseDisplay(assignment) {
  if (!assignment) return '—';
  const cefr = assignment.cefrSnapshot || '';
  const gse = assignment.gseSnapshot;
  if (!cefr && gse == null) return '無資料';
  if (gse != null) return `${cefr || '?'} · ${gse}`;
  return cefr || '—';
}

function formatLeaderCandidateLabel(teacher) {
  if (!teacher) return '';
  if (teacher.studentId) return `${teacher.name}（${teacher.studentId}）`;
  return teacher.name;
}

function buildDefaultSelectedGroups(groupCount) {
  const total = Math.max(1, Number(groupCount) || 9);
  return Array.from({ length: total }, (_, index) => index + 1);
}

export default function AdminEventGroupingTab({ tabProps }) {
  const { token, eventId, canManage, canExport, onExport, eventType } = tabProps;
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [grouping, setGrouping] = useState(null);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [leaderCandidates, setLeaderCandidates] = useState([]);
  const [rememberLeaderPreference, setRememberLeaderPreference] = useState(true);
  const [groupingLayout, setGroupingLayout] = useState('physical_slots');

  const isEnglishTable = (eventType || 'English Table') === 'English Table';
  const groupCount = grouping?.event?.groupCount || 9;

  const syncSelectedGroups = useCallback((data) => {
    const total = Math.max(1, Number(data?.event?.groupCount) || 9);
    const fromPlan = data?.plan?.abilityGroupSlots;
    if (Array.isArray(fromPlan) && fromPlan.length > 0) {
      setSelectedGroups(fromPlan.filter((n) => n >= 1 && n <= total));
      return;
    }
    const fromSlots = data?.slotConfig?.abilitySlots;
    if (Array.isArray(fromSlots) && fromSlots.length > 0) {
      setSelectedGroups(fromSlots.filter((n) => n >= 1 && n <= total));
      return;
    }
    // 尚未產生分組時預設不勾選，讓「全選」可切換全選／全不選
    setSelectedGroups([]);
  }, []);

  const loadGrouping = useCallback(async () => {
    if (!token || !eventId || !isEnglishTable) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchEventGrouping(token, eventId);
      setGrouping(data);
      setGroupingLayout(data?.plan?.groupingLayout || 'physical_slots');
      syncSelectedGroups(data);
    } catch (e) {
      setError(e.message || '載入分組資料失敗');
      setGrouping(null);
    } finally {
      setLoading(false);
    }
  }, [token, eventId, isEnglishTable, syncSelectedGroups]);

  useEffect(() => {
    loadGrouping();
  }, [loadGrouping]);

  useEffect(() => {
    if (!canManage || !token) return;
    fetchEtLeaderCandidates(token)
      .then((rows) => setLeaderCandidates(rows || []))
      .catch(() => setLeaderCandidates([]));
  }, [canManage, token]);

  useEffect(() => {
    const el = document.getElementById('grouping-select-all');
    if (el) {
      el.indeterminate = selectedGroups.length > 0
        && selectedGroups.length < Math.max(1, Number(grouping?.event?.groupCount) || 9);
    }
  }, [selectedGroups, grouping?.event?.groupCount]);

  const allGroupsSelected = useMemo(
    () => groupCount > 0 && selectedGroups.length === groupCount,
    [selectedGroups.length, groupCount],
  );

  const groupOptions = useMemo(() => {
    const physical = buildDefaultSelectedGroups(groupCount).map((n) => `Group ${n}`);
    const fromSummary = (grouping?.groupSummary || []).map((g) => g.groupLabel);
    return [...new Set([...physical, ...fromSummary])].sort((a, b) => {
      const numA = Number(String(a).replace(/^Group\s+/i, ''));
      const numB = Number(String(b).replace(/^Group\s+/i, ''));
      if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
      return String(a).localeCompare(String(b));
    });
  }, [groupCount, grouping?.groupSummary]);

  const slotModeMap = useMemo(() => {
    const map = new Map();
    for (const slot of grouping?.slotConfig?.slots || []) {
      map.set(slot.groupNumber, slot.mode);
    }
    for (const num of selectedGroups) {
      if (!map.has(num)) map.set(num, 'ability');
    }
    return map;
  }, [grouping?.slotConfig?.slots, selectedGroups]);

  const toggleGroup = (groupNumber) => {
    setSelectedGroups((prev) => {
      if (prev.includes(groupNumber)) {
        return prev.filter((n) => n !== groupNumber);
      }
      return [...prev, groupNumber].sort((a, b) => a - b);
    });
  };

  const toggleAllGroups = () => {
    if (allGroupsSelected) {
      setSelectedGroups([]);
      return;
    }
    setSelectedGroups(buildDefaultSelectedGroups(groupCount));
  };

  const isBandTablesLayout = groupingLayout === 'band_tables';

  const handleGenerate = async (force = false) => {
    if (!isBandTablesLayout && !selectedGroups.length) {
      showErrorMessage('請至少選擇一個組別進行能力分組');
      return;
    }
    setActionLoading('generate');
    try {
      const data = await generateEventGrouping(token, eventId, {
        force,
        groupSlots: isBandTablesLayout ? null : selectedGroups,
        groupingLayout,
      });
      setGrouping(data);
      setGroupingLayout(data?.plan?.groupingLayout || groupingLayout);
      syncSelectedGroups(data);
      showSuccessMessage(force ? '已覆寫並重新產生分組' : '已產生能力分組建議');
    } catch (e) {
      if (e.code === 'GROUPING_ALREADY_PUBLISHED' && !force) {
        const ok = window.confirm('分組已發布，是否要覆寫並重新自動分組？');
        if (ok) return handleGenerate(true);
      }
      showErrorMessage(e.message || '自動分組失敗');
    } finally {
      setActionLoading('');
    }
  };

  const handlePublish = async () => {
    if (!window.confirm('發布後將寫入簽到名單的組別欄位，確定要發布？')) return;
    setActionLoading('publish');
    try {
      const data = await publishEventGrouping(token, eventId);
      setGrouping(data);
      syncSelectedGroups(data);
      showSuccessMessage('分組已發布至簽到名單');
      if (tabProps.onPublished) tabProps.onPublished();
    } catch (e) {
      showErrorMessage(e.message || '發布分組失敗');
    } finally {
      setActionLoading('');
    }
  };

  const handleLeaderChange = async (groupLabel, leaderTeacherId) => {
    if (!canManage || !groupLabel) return;
    setActionLoading(`leader-${groupLabel}`);
    try {
      await assignEventGroupLeaders(token, eventId, [{
        groupLabel,
        leaderTeacherId: leaderTeacherId ? Number(leaderTeacherId) : null,
      }], { rememberPreference: rememberLeaderPreference });
      const data = await fetchEventGrouping(token, eventId);
      setGrouping(data);
      showSuccessMessage(rememberLeaderPreference ? '已更新並記住學期偏好' : '已更新 Leader 指派');
    } catch (e) {
      showErrorMessage(e.message || '指派 Leader 失敗');
    } finally {
      setActionLoading('');
    }
  };

  const handleApplyLeaderPreferences = async () => {
    if (!canManage) return;
    setActionLoading('apply-pref');
    try {
      await applyEventLeaderPreferences(token, eventId);
      const data = await fetchEventGrouping(token, eventId);
      setGrouping(data);
      showSuccessMessage('已套用學期 Leader 偏好');
    } catch (e) {
      showErrorMessage(e.message || '套用偏好失敗');
    } finally {
      setActionLoading('');
    }
  };

  const handleGroupChange = async (student, newGroupLabel) => {
    if (!canManage || !newGroupLabel || newGroupLabel === student.assignment?.groupLabel) return;
    const summary = grouping?.groupSummary?.find((g) => g.groupLabel === newGroupLabel);
    setActionLoading(`patch-${student.reservationId}`);
    try {
      const data = await patchEventGroupingAssignments(token, eventId, [{
        reservationId: student.reservationId,
        studentId: student.studentId,
        groupLabel: newGroupLabel,
        bandCode: summary?.bandCode || student.assignment?.bandCode,
      }]);
      setGrouping(data);
      showSuccessMessage('已更新組別');
    } catch (e) {
      showErrorMessage(e.message || '更新組別失敗');
    } finally {
      setActionLoading('');
    }
  };

  if (!isEnglishTable) {
    return <Alert variant="info">僅 English Table 活動支援能力分組。</Alert>;
  }

  if (loading) {
    return (
      <div className="d-flex align-items-center gap-2 py-4">
        <Spinner animation="border" size="sm" />
        <span>載入分組資料…</span>
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  const plan = grouping?.plan;
  const planStatus = plan?.status || 'none';
  const activeLayout = plan?.groupingLayout || groupingLayout;
  const groupingMode = grouping?.event?.groupingMode || 'legacy_sequential';
  const perGroupCapacity = grouping?.event?.perGroupCapacity || 4;
  const legacyGroupCount = groupCount - selectedGroups.length;

  return (
    <div className="admin-event-grouping-tab">
      <Alert variant="light" className="border mb-3 admin-event-grouping-tab__intro">
        <div className="small text-muted mb-1">分組依據</div>
        <div>
          學習歷程 GSE 能力量尺（與 LVA 一致），非官方英檢成績。無資料學生進入「待確認」組，不阻擋預約。
        </div>
      </Alert>

      <Row className="g-3 mb-3 admin-event-grouping-tab__stats">
        <Col xs={6} md={3}>
          <Card className="h-100 admin-event-grouping-tab__stat-card">
            <Card.Body className="py-3">
              <div className="text-muted small">分組模式</div>
              <div className="fw-semibold">
                {groupingMode === 'ability' ? '能力導向' : '舊制（預約順序）'}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3}>
          <Card className="h-100 admin-event-grouping-tab__stat-card">
            <Card.Body className="py-3">
              <div className="text-muted small">計畫狀態</div>
              <div>
                <Badge bg={planStatus === 'published' ? 'success' : planStatus === 'draft' ? 'warning' : 'secondary'}>
                  {planStatus === 'published' ? '已發布' : planStatus === 'draft' ? '草稿' : '尚未產生'}
                </Badge>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3}>
          <Card className="h-100 admin-event-grouping-tab__stat-card">
            <Card.Body className="py-3">
              <div className="text-muted small">組別設定</div>
              <div className="fw-semibold">{groupCount} 組 × {perGroupCapacity} 人</div>
              <div className="small text-muted mt-1">於活動建立時設定</div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3}>
          <Card className="h-100 admin-event-grouping-tab__stat-card">
            <Card.Body className="py-3">
              <div className="text-muted small">報名人數</div>
              <div className="fw-semibold">{grouping?.students?.length || 0} 人</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {canManage && (
        <Card className="mb-3">
          <Card.Header className="py-2 fw-semibold">分組布局</Card.Header>
          <Card.Body>
            <div className="d-flex flex-wrap gap-3">
              <Form.Check
                type="radio"
                id="layout-physical"
                name="groupingLayout"
                label="實體組別（Group 1–N，可混合能力／順序）"
                checked={groupingLayout === 'physical_slots'}
                disabled={Boolean(actionLoading)}
                onChange={() => setGroupingLayout('physical_slots')}
              />
              <Form.Check
                type="radio"
                id="layout-band-tables"
                name="groupingLayout"
                label="能力帶分桌（ET-B1-1 等，依分組帶 tableCount）"
                checked={groupingLayout === 'band_tables'}
                disabled={Boolean(actionLoading)}
                onChange={() => setGroupingLayout('band_tables')}
              />
            </div>
            {activeLayout === 'band_tables' && plan ? (
              <div className="small text-muted mt-2">
                目前計畫使用能力帶分桌布局。
              </div>
            ) : null}
          </Card.Body>
        </Card>
      )}

      {canManage && !isBandTablesLayout && (
        <Card className="mb-3">
          <Card.Header className="d-flex flex-wrap align-items-center justify-content-between gap-2 py-2">
            <span className="fw-semibold">能力分組組別</span>
            <Form.Check
              type="checkbox"
              id="grouping-select-all"
              label={allGroupsSelected ? '取消全選' : '全選'}
              checked={allGroupsSelected}
              onChange={toggleAllGroups}
              disabled={Boolean(actionLoading)}
            />
          </Card.Header>
          <Card.Body>
            <div className="admin-event-grouping-tab__group-grid mb-2">
              {buildDefaultSelectedGroups(groupCount).map((num) => {
                const checked = selectedGroups.includes(num);
                const mode = slotModeMap.get(num) || (checked ? 'ability' : 'legacy');
                return (
                  <Form.Check
                    key={num}
                    type="checkbox"
                    id={`ability-group-${num}`}
                    className="admin-event-grouping-tab__group-check"
                    label={(
                      <span>
                        Group {num}
                        {mode === 'ability' ? (
                          <Badge bg="primary" className="ms-1">能力</Badge>
                        ) : (
                          <Badge bg="secondary" className="ms-1">順序</Badge>
                        )}
                      </span>
                    )}
                    checked={checked}
                    disabled={Boolean(actionLoading)}
                    onChange={() => toggleGroup(num)}
                  />
                );
              })}
            </div>
            <div className="small text-muted">
              {selectedGroups.length === 0
                ? '尚未選擇組別。請勾選要以 GSE 能力分組的組別，或按「全選」。'
                : (
                  <>
                    已選 {selectedGroups.length} / {groupCount} 組將依 GSE 能力分組；
                    {legacyGroupCount > 0
                      ? ` 其餘 ${legacyGroupCount} 組維持預約順序分配。`
                      : ' 全部組別皆使用能力分組。'}
                  </>
                )}
            </div>
          </Card.Body>
        </Card>
      )}

      {canManage && (grouping?.slotConfig?.slots?.length > 0) && (
        <Card className="mb-3">
          <Card.Header className="py-2 fw-semibold d-flex flex-wrap align-items-center gap-2">
            <span>Leader 指派</span>
            <Button
              size="sm"
              variant="outline-primary"
              className="ms-auto"
              disabled={Boolean(actionLoading)}
              onClick={handleApplyLeaderPreferences}
            >
              {actionLoading === 'apply-pref' ? '套用中…' : '套用學期偏好'}
            </Button>
          </Card.Header>
          <Card.Body>
            <Form.Check
              type="checkbox"
              id="remember-leader-pref-event"
              className="small mb-3"
              label="指派後記住學期偏好"
              checked={rememberLeaderPreference}
              onChange={(e) => setRememberLeaderPreference(e.target.checked)}
            />
            <Row className="g-2">
              {grouping.slotConfig.slots.map((slot) => (
                <Col key={slot.groupLabel} md={4} lg={3}>
                  <Form.Group>
                    <Form.Label className="small mb-1">
                      {slot.groupLabel}
                      <Badge bg="light" text="dark" className="ms-1 border">{slot.count} 人</Badge>
                    </Form.Label>
                    <Form.Select
                      size="sm"
                      value={slot.leaderTeacherId || ''}
                      disabled={Boolean(actionLoading)}
                      onChange={(e) => handleLeaderChange(slot.groupLabel, e.target.value)}
                    >
                      <option value="">— 未指派 —</option>
                      {leaderCandidates.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>{formatLeaderCandidateLabel(teacher)}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              ))}
            </Row>
          </Card.Body>
        </Card>
      )}

      {(canManage || canExport) && canExport ? (
        <div className="d-flex flex-wrap gap-2 mb-3">
          <Button
            variant="outline-secondary"
            disabled={Boolean(actionLoading)}
            onClick={onExport}
          >
            匯出分組 Excel
          </Button>
        </div>
      ) : null}

      {canManage && (
        <div className="d-flex flex-wrap gap-2 mb-3">
          <Button
            variant="primary"
            disabled={Boolean(actionLoading) || (!isBandTablesLayout && !selectedGroups.length)}
            onClick={() => handleGenerate(false)}
          >
            {actionLoading === 'generate' ? '產生中…' : (isBandTablesLayout ? '依能力帶分桌' : '依 GSE 自動分組')}
          </Button>
          <Button
            variant="success"
            disabled={Boolean(actionLoading) || !plan || plan.status !== 'draft'}
            onClick={handlePublish}
          >
            {actionLoading === 'publish' ? '發布中…' : '發布至簽到名單'}
          </Button>
          <Button variant="outline-secondary" disabled={Boolean(actionLoading)} onClick={loadGrouping}>
            重新載入
          </Button>
        </div>
      )}

      {grouping?.slotConfig?.slots?.length > 0 && (
        <div className="mb-3 d-flex flex-wrap gap-2">
          {grouping.slotConfig.slots.map((slot) => (
            <Badge
              key={slot.groupLabel}
              bg={slot.mode === 'ability' ? 'primary' : 'light'}
              text={slot.mode === 'ability' ? undefined : 'dark'}
              className={`border px-2 py-2 ${slot.mode === 'legacy' ? '' : ''}`}
            >
              {slot.groupLabel}
              <span className="ms-1 opacity-75">({slot.count})</span>
              <span className="ms-1 small">{slot.mode === 'ability' ? '能力' : '順序'}</span>
            </Badge>
          ))}
        </div>
      )}

      <div className="table-responsive">
        <Table striped bordered hover size="sm" className="mb-0 align-middle">
          <thead>
            <tr>
              <th>學號</th>
              <th>姓名</th>
              <th>GSE 快照</th>
              <th>資料品質</th>
              <th>分配方式</th>
              <th>建議組別</th>
              <th>簽到名單組別</th>
            </tr>
          </thead>
          <tbody>
            {(grouping?.students || []).map((student) => {
              const quality = student.assignment?.dataQuality || 'missing';
              const qMeta = DATA_QUALITY_LABELS[quality] || DATA_QUALITY_LABELS.missing;
              const patching = actionLoading === `patch-${student.reservationId}`;
              const source = student.assignment?.source || '';
              return (
                <tr key={student.reservationId}>
                  <td>
                    <Link
                      to={`/admin/learning-journey/students/${encodeURIComponent(student.studentId)}`}
                      className="font-monospace small"
                    >
                      {student.studentId}
                    </Link>
                    <div>
                      <Link
                        to={`/admin/et-grouping/student-trends?studentId=${encodeURIComponent(student.studentId)}`}
                        className="small text-muted"
                      >
                        ET 趨勢
                      </Link>
                    </div>
                  </td>
                  <td>{student.studentName}</td>
                  <td>{formatGseDisplay(student.assignment)}</td>
                  <td><Badge bg={qMeta.variant}>{qMeta.label}</Badge></td>
                  <td>{SOURCE_LABELS[source] || '—'}</td>
                  <td>
                    {canManage && groupOptions.length > 0 ? (
                      <Form.Select
                        size="sm"
                        value={student.assignment?.groupLabel || ''}
                        disabled={patching || Boolean(actionLoading)}
                        onChange={(e) => handleGroupChange(student, e.target.value)}
                      >
                        <option value="">—</option>
                        {groupOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </Form.Select>
                    ) : (
                      student.assignment?.groupLabel || '—'
                    )}
                  </td>
                  <td>{student.currentGroup || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
