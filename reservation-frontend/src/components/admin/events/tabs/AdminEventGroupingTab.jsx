import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Nav from 'react-bootstrap/Nav';
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
import { isEnglishTableEventType } from '../../../../utils/eventCapacityFields';
import AdminEventLeaderAttendancePanel from './AdminEventLeaderAttendancePanel';
import './adminEventGroupingTab.css';

const DATA_QUALITY_LABELS = {
  high: { label: '英檢最佳', variant: 'success' },
  baseline_only: { label: '僅基線', variant: 'warning' },
  missing: { label: '待確認', variant: 'secondary' },
};

const SOURCE_LABELS = {
  auto: '能力分組',
  legacy: '預約順序',
  random: '亂數',
  manual: '手動調整',
};

const STRATEGY = {
  LEGACY_ORDER: 'legacy_order',
  RANDOM: 'random',
  ALL_ABILITY: 'all_ability',
  MIXED_ABILITY_RANDOM: 'mixed_ability_random',
};

const STRATEGY_OPTIONS = [
  {
    value: STRATEGY.LEGACY_ORDER,
    title: '依預約順序平均分組',
    help: '先報名先排；輪流填入各組，避免某組先滿、其他組沒人。',
  },
  {
    value: STRATEGY.RANDOM,
    title: '亂數平均分組',
    help: '打亂後輪流填入各組，人數盡量平均。',
  },
  {
    value: STRATEGY.ALL_ABILITY,
    title: '全體依能力分組（推薦）',
    help: 'GSE 相近的學生同組；各組人數仍盡量平均。需已設定分組帶。',
  },
  {
    value: STRATEGY.MIXED_ABILITY_RANDOM,
    title: '部分組依能力、其餘亂數',
    help: '勾選的組：相近能力同組；其餘組：亂數平均分配。',
  },
];

const STEPS = [
  { key: 'setup', label: '1. 設定' },
  { key: 'review', label: '2. 預覽與微調' },
  { key: 'publish', label: '3. Leader 與發布' },
];

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

function inferStrategy(data) {
  const raw = data?.plan?.groupingStrategy || data?.plan?.groupingLayout || data?.slotConfig?.strategy;
  if (raw === STRATEGY.LEGACY_ORDER) return STRATEGY.LEGACY_ORDER;
  if (raw === STRATEGY.RANDOM) return STRATEGY.RANDOM;
  if (raw === STRATEGY.MIXED_ABILITY_RANDOM || raw === 'mixed') return STRATEGY.MIXED_ABILITY_RANDOM;
  if (raw === STRATEGY.ALL_ABILITY) return STRATEGY.ALL_ABILITY;
  if (raw === 'band_tables') return STRATEGY.ALL_ABILITY;
  const ability = data?.plan?.abilityGroupSlots || data?.slotConfig?.abilitySlots;
  const total = Math.max(1, Number(data?.event?.groupCount) || 9);
  if (Array.isArray(ability) && ability.length > 0 && ability.length < total) {
    return STRATEGY.MIXED_ABILITY_RANDOM;
  }
  if (raw === 'physical_slots') return STRATEGY.ALL_ABILITY;
  return STRATEGY.ALL_ABILITY;
}

function strategyLabel(strategy) {
  return STRATEGY_OPTIONS.find((opt) => opt.value === strategy)?.title || strategy;
}

function modeBadge(mode) {
  if (mode === 'ability') return { label: '能力', bg: 'primary' };
  if (mode === 'random') return { label: '亂數', bg: 'info' };
  return { label: '順序', bg: 'secondary' };
}

function resolveStepFromPlan(planStatus) {
  if (planStatus === 'published') return 'publish';
  if (planStatus === 'draft') return 'review';
  return 'setup';
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
  const [strategy, setStrategy] = useState(STRATEGY.ALL_ABILITY);
  const [step, setStep] = useState('setup');
  const [reviewView, setReviewView] = useState('board');
  const [studentFilter, setStudentFilter] = useState('all');
  const [expandedGroup, setExpandedGroup] = useState(null);

  const isEnglishTable = isEnglishTableEventType(eventType);
  const groupCount = grouping?.event?.groupCount || 9;
  const isMixed = strategy === STRATEGY.MIXED_ABILITY_RANDOM;
  const needsBands = strategy === STRATEGY.ALL_ABILITY || strategy === STRATEGY.MIXED_ABILITY_RANDOM;

  const syncFromGrouping = useCallback((data, { advanceStep = false } = {}) => {
    const total = Math.max(1, Number(data?.event?.groupCount) || 9);
    const nextStrategy = inferStrategy(data);
    setStrategy(nextStrategy);

    const fromPlan = data?.plan?.abilityGroupSlots;
    const fromSlots = data?.slotConfig?.abilitySlots;
    if (Array.isArray(fromPlan) && fromPlan.length > 0) {
      setSelectedGroups(fromPlan.filter((n) => n >= 1 && n <= total));
    } else if (Array.isArray(fromSlots) && fromSlots.length > 0) {
      setSelectedGroups(fromSlots.filter((n) => n >= 1 && n <= total));
    } else {
      setSelectedGroups(buildDefaultSelectedGroups(total));
    }

    const status = data?.plan?.status || 'none';
    if (advanceStep) {
      setStep(status === 'draft' ? 'review' : resolveStepFromPlan(status));
    }
  }, []);

  const loadGrouping = useCallback(async () => {
    if (!token || !eventId || !isEnglishTable) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchEventGrouping(token, eventId);
      setGrouping(data);
      syncFromGrouping(data);
      setStep(resolveStepFromPlan(data?.plan?.status || 'none'));
    } catch (e) {
      setError(e.message || '載入分組資料失敗');
      setGrouping(null);
    } finally {
      setLoading(false);
    }
  }, [token, eventId, isEnglishTable, syncFromGrouping]);

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

  const bands = grouping?.bands || [];
  const hasBands = bands.length > 0;
  const students = useMemo(() => grouping?.students || [], [grouping?.students]);
  const perGroupCapacity = grouping?.event?.perGroupCapacity || 4;
  const plan = grouping?.plan;
  const planStatus = plan?.status || 'none';
  const groupingMode = grouping?.event?.groupingMode || 'legacy_sequential';
  const legacyGroupCount = Math.max(0, groupCount - selectedGroups.length);

  const qualitySummary = useMemo(() => {
    const counts = { high: 0, baseline_only: 0, missing: 0, assigned: 0, unassigned: 0 };
    for (const student of students) {
      if (!student.assignment) {
        counts.unassigned += 1;
        continue;
      }
      counts.assigned += 1;
      const q = student.assignment.dataQuality || 'missing';
      if (counts[q] != null) counts[q] += 1;
      else counts.missing += 1;
    }
    return counts;
  }, [students]);

  const overflowCount = useMemo(
    () => students.filter((s) => String(s.assignment?.groupLabel || '').includes('overflow')).length,
    [students],
  );

  const boardSlots = useMemo(() => {
    const slots = grouping?.slotConfig?.slots || [];
    if (slots.length) return slots;
    return (grouping?.groupSummary || []).map((row) => ({
      groupLabel: row.groupLabel,
      count: row.count,
      mode: 'ability',
      leaderTeacherId: null,
      leaderName: null,
    }));
  }, [grouping]);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const label = student.assignment?.groupLabel || '';
      const quality = student.assignment?.dataQuality || (student.assignment ? 'missing' : null);
      if (studentFilter === 'missing') {
        return quality === 'missing' || !student.assignment;
      }
      if (studentFilter === 'overflow') {
        return String(label).includes('overflow');
      }
      if (studentFilter === 'no_leader') {
        if (!label || label === '未分組') return false;
        const slot = boardSlots.find((s) => s.groupLabel === label);
        return !slot?.leaderTeacherId;
      }
      if (studentFilter === 'unsynced') {
        const suggested = student.assignment?.groupLabel || '';
        const current = student.currentGroup || '';
        return Boolean(suggested) && suggested !== current;
      }
      return true;
    });
  }, [students, studentFilter, boardSlots]);

  const applyStrategy = (next) => {
    setStrategy(next);
    if (next === STRATEGY.ALL_ABILITY || next === STRATEGY.LEGACY_ORDER || next === STRATEGY.RANDOM) {
      setSelectedGroups(buildDefaultSelectedGroups(groupCount));
    } else if (next === STRATEGY.MIXED_ABILITY_RANDOM && selectedGroups.length === 0) {
      // 預設勾選前半組為能力組，方便理解「混合」
      const half = Math.max(1, Math.floor(groupCount / 2));
      setSelectedGroups(buildDefaultSelectedGroups(groupCount).slice(0, half));
    }
  };

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

  const handleGenerate = async (force = false) => {
    if (isMixed && !selectedGroups.length) {
      showErrorMessage('請至少勾選一個要以能力分組的組別');
      return;
    }
    if (needsBands && !hasBands) {
      showErrorMessage('尚未設定分組帶，請先至分組帶設定頁完成設定');
      return;
    }
    setActionLoading('generate');
    try {
      const data = await generateEventGrouping(token, eventId, {
        force,
        groupSlots: isMixed ? selectedGroups : null,
        groupingStrategy: strategy,
      });
      setGrouping(data);
      syncFromGrouping(data, { advanceStep: true });
      setStep('review');
      setReviewView('board');
      showSuccessMessage(force ? '已覆寫並重新產生分組' : '已產生分組建議');
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
      syncFromGrouping(data);
      setStep('publish');
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

  const canGenerate = canManage
    && (!needsBands || hasBands)
    && (!isMixed || selectedGroups.length > 0);
  const hasDraftOrPublished = planStatus === 'draft' || planStatus === 'published';
  const unsyncedCount = students.filter((s) => {
    const suggested = s.assignment?.groupLabel || '';
    const current = s.currentGroup || '';
    return suggested && suggested !== current;
  }).length;

  const renderStudentRow = (student) => {
    const quality = student.assignment?.dataQuality || 'missing';
    const qMeta = DATA_QUALITY_LABELS[quality] || DATA_QUALITY_LABELS.missing;
    const patching = actionLoading === `patch-${student.reservationId}`;
    const source = student.assignment?.source || '';
    const suggested = student.assignment?.groupLabel || '';
    const current = student.currentGroup || '';
    const unsynced = Boolean(suggested) && suggested !== current;

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
        <td>
          {student.assignment ? (
            <Badge bg={qMeta.variant}>{qMeta.label}</Badge>
          ) : (
            <Badge bg="light" text="dark">尚未分組</Badge>
          )}
        </td>
        <td>{SOURCE_LABELS[source] || '—'}</td>
        <td>
          {canManage && groupOptions.length > 0 && student.assignment ? (
            <Form.Select
              size="sm"
              value={suggested}
              disabled={patching || Boolean(actionLoading)}
              onChange={(e) => handleGroupChange(student, e.target.value)}
            >
              <option value="">—</option>
              {groupOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </Form.Select>
          ) : (
            suggested || '—'
          )}
          {unsynced ? (
            <div className="small text-warning mt-1">與簽到不同步</div>
          ) : null}
        </td>
        <td>
          {current || '—'}
          {planStatus === 'draft' && !current ? (
            <div className="small text-muted">尚未同步</div>
          ) : null}
        </td>
      </tr>
    );
  };

  return (
    <div className="admin-event-grouping-tab">
      <Alert variant="light" className="border mb-3 admin-event-grouping-tab__intro">
        <div className="small text-muted mb-1">分組依據</div>
        <div>
          學習歷程 GSE 能力量尺（與 LVA 一致），非官方英檢成績。無資料學生進入「待確認」，不阻擋預約。
        </div>
      </Alert>

      <div className="admin-event-grouping-tab__stepper mb-3" role="navigation" aria-label="分組步驟">
        {STEPS.map((item) => {
          const active = step === item.key;
          const reachable = item.key === 'setup'
            || (item.key === 'review' && hasDraftOrPublished)
            || (item.key === 'publish' && hasDraftOrPublished);
          return (
            <button
              key={item.key}
              type="button"
              className={`admin-event-grouping-tab__step ${active ? 'is-active' : ''} ${reachable ? '' : 'is-disabled'}`}
              disabled={!reachable}
              onClick={() => reachable && setStep(item.key)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <Row className="g-3 mb-3 admin-event-grouping-tab__stats">
        <Col xs={6} md={3}>
          <Card className="h-100 admin-event-grouping-tab__stat-card">
            <Card.Body className="py-3">
              <div className="text-muted small">計畫狀態</div>
              <Badge bg={planStatus === 'published' ? 'success' : planStatus === 'draft' ? 'warning' : 'secondary'}>
                {planStatus === 'published' ? '已發布' : planStatus === 'draft' ? '草稿' : '尚未產生'}
              </Badge>
              <div className="small text-muted mt-1">
                {groupingMode === 'ability' ? '能力導向已寫入' : '簽到仍為舊制順序'}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3}>
          <Card className="h-100 admin-event-grouping-tab__stat-card">
            <Card.Body className="py-3">
              <div className="text-muted small">組別設定</div>
              <div className="fw-semibold">{groupCount} 組 × {perGroupCapacity} 人</div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3}>
          <Card className="h-100 admin-event-grouping-tab__stat-card">
            <Card.Body className="py-3">
              <div className="text-muted small">報名／已建議</div>
              <div className="fw-semibold">
                {students.length}／{qualitySummary.assigned}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3}>
          <Card className="h-100 admin-event-grouping-tab__stat-card">
            <Card.Body className="py-3">
              <div className="text-muted small">與簽到同步</div>
              <div className="fw-semibold">
                {planStatus === 'published' && unsyncedCount === 0
                  ? '已同步'
                  : unsyncedCount > 0
                    ? `${unsyncedCount} 人不同步`
                    : '尚未發布'}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {needsBands && !hasBands ? (
        <Alert variant="warning" className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <span>尚未設定分組帶，無法使用「依能力」相關策略。</span>
          <Button as={Link} to="/admin/et-grouping/settings" size="sm" variant="outline-dark">
            前往分組帶設定
          </Button>
        </Alert>
      ) : null}

      {step === 'setup' && canManage ? (
        <Card className="mb-3">
          <Card.Header className="py-2 fw-semibold">選擇分組策略</Card.Header>
          <Card.Body>
            <p className="small text-muted mb-3">
              無論哪種策略，系統都會把學生<strong>平均分配</strong>到各組（輪流／均分），避免預約未滿時某組先塞滿、其他組沒人。
            </p>
            <div className="d-flex flex-column gap-3 mb-3">
              {STRATEGY_OPTIONS.map((opt) => (
                <div key={opt.value} className="border rounded p-2">
                  <Form.Check
                    type="radio"
                    id={`strategy-${opt.value}`}
                    name="groupingStrategy"
                    label={<span className="fw-semibold">{opt.title}</span>}
                    checked={strategy === opt.value}
                    disabled={Boolean(actionLoading)}
                    onChange={() => applyStrategy(opt.value)}
                  />
                  <div className="small text-muted ms-4 mt-1">{opt.help}</div>
                </div>
              ))}
            </div>

            {isMixed ? (
              <div className="border rounded p-3 mb-3 bg-light">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                  <span className="fw-semibold small">勾選「依能力」的組別（其餘為亂數）</span>
                  <Form.Check
                    type="checkbox"
                    id="grouping-select-all"
                    label={allGroupsSelected ? '取消全選' : '全選'}
                    checked={allGroupsSelected}
                    onChange={toggleAllGroups}
                    disabled={Boolean(actionLoading)}
                  />
                </div>
                <div className="admin-event-grouping-tab__group-grid mb-2">
                  {buildDefaultSelectedGroups(groupCount).map((num) => {
                    const checked = selectedGroups.includes(num);
                    const badge = modeBadge(checked ? 'ability' : 'random');
                    return (
                      <Form.Check
                        key={num}
                        type="checkbox"
                        id={`ability-group-${num}`}
                        className="admin-event-grouping-tab__group-check"
                        label={(
                          <span>
                            Group {num}
                            <Badge bg={badge.bg} className="ms-1">{badge.label}</Badge>
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
                  已選 {selectedGroups.length} / {groupCount} 組依能力；
                  {legacyGroupCount > 0 ? `其餘 ${legacyGroupCount} 組亂數平均分配。` : '全部組別皆依能力（等同全體能力策略）。'}
                </div>
              </div>
            ) : null}

            <Alert variant="light" className="border small mb-3">
              <div className="fw-semibold mb-1">產生前摘要</div>
              <ul className="mb-0 ps-3">
                <li>
                  <strong>{students.length}</strong> 人 → {groupCount} 組
                  {students.length > 0 ? (
                    <>
                      （約每組 {Math.floor(students.length / groupCount)}–
                      {Math.ceil(students.length / groupCount)} 人，上限 {perGroupCapacity}）
                    </>
                  ) : null}
                </li>
                <li>策略：{strategyLabel(strategy)}</li>
                {needsBands ? (
                  <li>
                    分組帶：
                    {hasBands ? (
                      <>
                        已設定 <strong>{bands.length}</strong> 帶
                        <Button
                          as={Link}
                          to="/admin/et-grouping/settings"
                          variant="link"
                          size="sm"
                          className="py-0 px-1 align-baseline"
                        >
                          編輯
                        </Button>
                      </>
                    ) : '尚未設定（能力策略需要）'}
                  </li>
                ) : null}
                {qualitySummary.assigned > 0 ? (
                  <li>
                    現有建議品質：英檢最佳 {qualitySummary.high}、僅基線 {qualitySummary.baseline_only}、待確認 {qualitySummary.missing}
                  </li>
                ) : (
                  <li>產生後可檢視每位學生的組別與資料品質。</li>
                )}
              </ul>
            </Alert>

            <div className="d-flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={Boolean(actionLoading) || !canGenerate}
                onClick={() => handleGenerate(false)}
              >
                {actionLoading === 'generate' ? '產生中…' : '產生分組建議'}
              </Button>
              {planStatus === 'published' ? (
                <Button
                  variant="outline-warning"
                  disabled={Boolean(actionLoading) || !canGenerate}
                  onClick={() => handleGenerate(true)}
                >
                  覆寫並重新產生
                </Button>
              ) : null}
              <Button variant="outline-secondary" disabled={Boolean(actionLoading)} onClick={loadGrouping}>
                重新載入
              </Button>
              {canExport ? (
                <Button variant="outline-secondary" disabled={Boolean(actionLoading)} onClick={onExport}>
                  匯出 Excel
                </Button>
              ) : null}
              {hasDraftOrPublished ? (
                <Button variant="outline-primary" disabled={Boolean(actionLoading)} onClick={() => setStep('review')}>
                  前往預覽
                </Button>
              ) : null}
            </div>
          </Card.Body>
        </Card>
      ) : null}

      {step === 'review' ? (
        <>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <Nav variant="pills" className="admin-event-grouping-tab__view-pills">
              <Nav.Item>
                <Nav.Link active={reviewView === 'board'} onClick={() => setReviewView('board')}>
                  依組看板
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link active={reviewView === 'table'} onClick={() => setReviewView('table')}>
                  全部學生
                </Nav.Link>
              </Nav.Item>
            </Nav>
            <Form.Select
              size="sm"
              style={{ maxWidth: 200 }}
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
            >
              <option value="all">篩選：全部</option>
              <option value="missing">待確認／無資料</option>
              <option value="overflow">溢位 overflow</option>
              <option value="no_leader">尚未指派 Leader</option>
              <option value="unsynced">與簽到不同步</option>
            </Form.Select>
            <div className="ms-auto d-flex flex-wrap gap-2">
              {canManage ? (
                <Button
                  variant="outline-primary"
                  size="sm"
                  disabled={Boolean(actionLoading) || !canGenerate}
                  onClick={() => handleGenerate(planStatus === 'published')}
                >
                  {actionLoading === 'generate' ? '產生中…' : '重新產生'}
                </Button>
              ) : null}
              <Button variant="outline-secondary" size="sm" disabled={Boolean(actionLoading)} onClick={() => setStep('setup')}>
                回到設定
              </Button>
              <Button variant="primary" size="sm" disabled={Boolean(actionLoading)} onClick={() => setStep('publish')}>
                下一步：Leader／發布
              </Button>
            </div>
          </div>

          {overflowCount > 0 ? (
            <Alert variant="warning" className="py-2 small">
              有 {overflowCount} 人落在 overflow 組，請至看板或名單調整。
            </Alert>
          ) : null}

          {reviewView === 'board' ? (
            <Row className="g-3 mb-3">
              {boardSlots.map((slot) => {
                const members = students.filter((s) => s.assignment?.groupLabel === slot.groupLabel);
                const open = expandedGroup === slot.groupLabel;
                const missingInGroup = members.filter((m) => m.assignment?.dataQuality === 'missing').length;
                return (
                  <Col key={slot.groupLabel} md={6} lg={4} xl={3}>
                    <Card className="admin-event-grouping-tab__board-card h-100">
                      <Card.Body className="py-3">
                        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                          <div>
                            <div className="fw-semibold">{slot.groupLabel}</div>
                            <div className="small text-muted">
                              {slot.count ?? members.length}／{perGroupCapacity} 人
                              {' · '}{modeBadge(slot.mode).label}
                            </div>
                          </div>
                          <Badge bg={modeBadge(slot.mode).bg}>
                            {modeBadge(slot.mode).label}
                          </Badge>
                        </div>
                        <div className="small mb-2">
                          Leader：{slot.leaderName || <span className="text-muted">未指派</span>}
                        </div>
                        {missingInGroup > 0 ? (
                          <div className="small text-secondary mb-2">待確認 {missingInGroup} 人</div>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          onClick={() => setExpandedGroup(open ? null : slot.groupLabel)}
                        >
                          {open ? '收合名單' : '展開名單'}
                        </Button>
                        {open ? (
                          <ul className="small mt-2 mb-0 ps-3">
                            {members.map((m) => (
                              <li key={m.reservationId}>
                                {m.studentId} {m.studentName}
                                {' · '}
                                {formatGseDisplay(m.assignment)}
                              </li>
                            ))}
                            {!members.length ? <li className="text-muted">尚無學生</li> : null}
                          </ul>
                        ) : null}
                      </Card.Body>
                    </Card>
                  </Col>
                );
              })}
              {!boardSlots.length ? (
                <Col>
                  <Alert variant="secondary">尚無組別結果，請先於「設定」產生分組。</Alert>
                </Col>
              ) : null}
            </Row>
          ) : null}

          {(reviewView === 'table' || studentFilter !== 'all') && (
            <div className="table-responsive mb-3">
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
                  {filteredStudents.length ? (
                    filteredStudents.map(renderStudentRow)
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center text-muted">沒有符合篩選的學生</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          )}
        </>
      ) : null}

      {step === 'publish' ? (
        <>
          {canManage && boardSlots.length > 0 ? (
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
                <div className="table-responsive">
                  <Table size="sm" bordered className="align-middle mb-0">
                    <thead>
                      <tr>
                        <th>組別</th>
                        <th>人數</th>
                        <th>Leader</th>
                      </tr>
                    </thead>
                    <tbody>
                      {boardSlots.map((slot) => (
                        <tr key={slot.groupLabel}>
                          <td>{slot.groupLabel}</td>
                          <td>{slot.count ?? 0}</td>
                          <td>
                            <Form.Select
                              size="sm"
                              value={slot.leaderTeacherId || ''}
                              disabled={Boolean(actionLoading)}
                              onChange={(e) => handleLeaderChange(slot.groupLabel, e.target.value)}
                            >
                              <option value="">— 未指派 —</option>
                              {leaderCandidates.map((teacher) => (
                                <option key={teacher.id} value={teacher.id}>
                                  {formatLeaderCandidateLabel(teacher)}
                                </option>
                              ))}
                            </Form.Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          ) : null}

          {canManage ? (
            <AdminEventLeaderAttendancePanel
              token={token}
              eventId={eventId}
              canManage={canManage}
            />
          ) : null}

          <Card className="mb-3">
            <Card.Body>
              <div className="fw-semibold mb-2">發布至簽到名單</div>
              <p className="small text-muted mb-3">
                發布後會把「建議組別」寫入預約的組別欄位，簽到頁與匯出將使用此結果。
                {planStatus === 'published' && unsyncedCount > 0
                  ? ` 目前有 ${unsyncedCount} 人建議與簽到不一致，請重新發布。`
                  : null}
              </p>
              <div className="d-flex flex-wrap gap-2">
                {canManage ? (
                  <Button
                    variant="success"
                    disabled={Boolean(actionLoading) || !plan || qualitySummary.assigned === 0}
                    onClick={handlePublish}
                  >
                    {actionLoading === 'publish'
                      ? '發布中…'
                      : planStatus === 'published'
                        ? (unsyncedCount > 0 ? '重新發布以同步' : '再次發布')
                        : '發布至簽到名單'}
                  </Button>
                ) : null}
                <Button variant="outline-secondary" disabled={Boolean(actionLoading)} onClick={() => setStep('review')}>
                  回到預覽
                </Button>
                {canManage ? (
                  <Button variant="outline-primary" disabled={Boolean(actionLoading)} onClick={() => setStep('setup')}>
                    調整策略並重產
                  </Button>
                ) : null}
                {canExport ? (
                  <Button variant="outline-secondary" disabled={Boolean(actionLoading)} onClick={onExport}>
                    匯出 Excel
                  </Button>
                ) : null}
              </div>
              {planStatus === 'published' && unsyncedCount === 0 ? (
                <Alert variant="success" className="small py-2 mt-3 mb-0">
                  已發布且與簽到名單一致。
                </Alert>
              ) : null}
            </Card.Body>
          </Card>
        </>
      ) : null}

      {!canManage && step === 'setup' ? (
        <Alert variant="secondary">您目前為檢視權限；可切換至預覽查看分組結果。</Alert>
      ) : null}
    </div>
  );
}
