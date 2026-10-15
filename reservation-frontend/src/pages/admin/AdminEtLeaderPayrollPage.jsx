import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Row,
  Spinner,
  Table,
  Tabs,
  Tab,
} from 'react-bootstrap';
import { useOutletContext } from 'react-router-dom';
import { P } from '../../constants/permissions';
import { hasPermission } from '../../utils/accessControl';
import {
  downloadEtBlob,
  exportLeaderPayrollMonthly,
  fetchLeaderPayProfiles,
  fetchLeaderPayrollMonthly,
  extendLeaderMarking,
  releaseLeaderPay,
  saveLeaderPayProfile,
} from '../../services/etGroupingApi';
import { showErrorMessage, showSuccessMessage } from '../../utils/errorHandler';

function currentYearMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatUntil(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

function defaultExtensionLocal() {
  const when = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}`;
}

function money(n) {
  return Number(n || 0).toLocaleString('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function AdminEtLeaderPayrollPage() {
  const { token, accessProfile } = useOutletContext();
  const canView = hasPermission(accessProfile, P.CAN_VIEW_ET_GROUPING)
    || hasPermission(accessProfile, P.CAN_EXPORT_ET_GROUPING)
    || hasPermission(accessProfile, P.CAN_MANAGE_ET_GROUPING);
  const canManage = hasPermission(accessProfile, P.CAN_MANAGE_ET_GROUPING);
  const canExport = hasPermission(accessProfile, P.CAN_EXPORT_ET_GROUPING)
    || hasPermission(accessProfile, P.CAN_MANAGE_ET_GROUPING);

  const [tab, setTab] = useState('report');
  const [yearMonth, setYearMonth] = useState(currentYearMonth);
  const [loadingReport, setLoadingReport] = useState(false);
  const [report, setReport] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [exporting, setExporting] = useState(false);

  const [profiles, setProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [releaseTarget, setReleaseTarget] = useState(null);
  const [releaseNote, setReleaseNote] = useState('');
  const [releasing, setReleasing] = useState(false);
  const [extendTarget, setExtendTarget] = useState(null);
  const [extendNote, setExtendNote] = useState('');
  const [extendUntil, setExtendUntil] = useState(defaultExtensionLocal);
  const [extending, setExtending] = useState(false);

  const loadReport = useCallback(async () => {
    if (!token || !canView || !yearMonth) return;
    setLoadingReport(true);
    try {
      const data = await fetchLeaderPayrollMonthly(token, yearMonth);
      setReport(data);
      setExpanded(new Set());
    } catch (e) {
      showErrorMessage(e.message || '載入支薪月報失敗');
      setReport(null);
    } finally {
      setLoadingReport(false);
    }
  }, [token, canView, yearMonth]);

  const loadProfiles = useCallback(async () => {
    if (!token || !canView) return;
    setLoadingProfiles(true);
    try {
      const rows = await fetchLeaderPayProfiles(token);
      setProfiles(rows || []);
      const next = {};
      for (const row of rows || []) {
        next[row.leaderTeacherId] = {
          seniorityYears: String(row.seniorityYears ?? 0),
          hourlyRate: String(row.hourlyRate ?? 0),
          note: row.note || '',
        };
      }
      setDrafts(next);
    } catch (e) {
      showErrorMessage(e.message || '載入薪資設定失敗');
      setProfiles([]);
    } finally {
      setLoadingProfiles(false);
    }
  }, [token, canView]);

  useEffect(() => {
    if (tab === 'report') loadReport();
  }, [tab, loadReport]);

  useEffect(() => {
    if (tab === 'rates') loadProfiles();
  }, [tab, loadProfiles]);

  const totals = report?.totals;

  const toggleExpand = (leaderTeacherId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(leaderTeacherId)) next.delete(leaderTeacherId);
      else next.add(leaderTeacherId);
      return next;
    });
  };

  const handleExport = async () => {
    if (!canExport) return;
    setExporting(true);
    try {
      const { blob, filename } = await exportLeaderPayrollMonthly(token, yearMonth);
      downloadEtBlob(blob, filename);
      showSuccessMessage('已匯出支薪月報');
    } catch (e) {
      showErrorMessage(e.message || '匯出失敗');
    } finally {
      setExporting(false);
    }
  };

  const updateDraft = (id, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSaveProfile = async (leaderTeacherId) => {
    if (!canManage) return;
    const draft = drafts[leaderTeacherId];
    if (!draft) return;
    setSavingId(leaderTeacherId);
    try {
      const data = await saveLeaderPayProfile(token, leaderTeacherId, {
        seniorityYears: Number(draft.seniorityYears),
        hourlyRate: Number(draft.hourlyRate),
        note: draft.note,
      });
      setProfiles((prev) =>
        prev.map((row) => (row.leaderTeacherId === leaderTeacherId ? { ...row, ...data } : row))
      );
      showSuccessMessage(`已更新 ${data.name || 'Leader'} 薪資設定`);
    } catch (e) {
      showErrorMessage(e.message || '儲存失敗');
    } finally {
      setSavingId(null);
    }
  };

  const missingRateCount = useMemo(
    () => (report?.rows || []).filter((r) => Number(r.hourlyRate) <= 0).length,
    [report]
  );

  const handleExtend = async () => {
    if (!canManage || !extendTarget) return;
    setExtending(true);
    try {
      await extendLeaderMarking(token, {
        eventId: extendTarget.eventId,
        leaderTeacherId: extendTarget.leaderTeacherId,
        note: extendNote,
        until: new Date(extendUntil).toISOString(),
        open: true,
      });
      showSuccessMessage('已開放這位 Leader 補勾');
      setExtendTarget(null);
      setExtendNote('');
      setExtendUntil(defaultExtensionLocal());
      await loadReport();
    } catch (e) {
      showErrorMessage(e.message || '開放補勾失敗');
    } finally {
      setExtending(false);
    }
  };

  const handleRelease = async () => {
    if (!canManage || !releaseTarget) return;
    setReleasing(true);
    try {
      await releaseLeaderPay(token, {
        eventId: releaseTarget.eventId,
        leaderTeacherId: releaseTarget.leaderTeacherId,
        note: releaseNote,
        released: true,
      });
      showSuccessMessage('已放行這場計薪');
      setReleaseTarget(null);
      setReleaseNote('');
      await loadReport();
    } catch (e) {
      showErrorMessage(e.message || '放行失敗');
    } finally {
      setReleasing(false);
    }
  };

  if (!canView) {
    return <Alert variant="warning">您沒有檢視 Leader 支薪報表的權限。</Alert>;
  }

  return (
    <div className="admin-et-leader-payroll-page">
      <Card className="mb-3 border-0 shadow-sm">
        <Card.Body>
          <h1 className="h5 mb-1">Leader 支薪報表</h1>
          <p className="small text-muted mb-0">
            簽到之後，Leader 應在活動當下把必填任務勾完，當天最準。3 天內沒勾完的場次不計時數、不計金額。行政可以開放該 Leader 再補勾一次，補完才計薪。放行計薪只用於名單對不上、無法補勾的例外，原因會留在備註。
          </p>
        </Card.Body>
      </Card>

      <Tabs activeKey={tab} onSelect={(k) => k && setTab(k)} className="mb-3">
        <Tab eventKey="report" title="月結報表">
          <Card className="border-0 shadow-sm mb-3">
            <Card.Body>
              <Row className="g-2 align-items-end">
                <Col xs={6} md={3}>
                  <Form.Label className="small mb-1">月份</Form.Label>
                  <Form.Control
                    type="month"
                    size="sm"
                    value={yearMonth}
                    onChange={(e) => setYearMonth(e.target.value)}
                  />
                </Col>
                <Col xs="auto">
                  <Button variant="outline-secondary" size="sm" onClick={loadReport} disabled={loadingReport}>
                    重新整理
                  </Button>
                </Col>
                {canExport ? (
                  <Col xs="auto">
                    <Button variant="primary" size="sm" onClick={handleExport} disabled={exporting || loadingReport}>
                      {exporting ? '匯出中…' : '匯出 Excel'}
                    </Button>
                  </Col>
                ) : null}
              </Row>
              {missingRateCount > 0 ? (
                <Alert variant="warning" className="mt-3 mb-0 py-2 small">
                  有 {missingRateCount} 位 Leader 尚未設定時薪（小計為 0）。請至「時薪設定」補齊。
                </Alert>
              ) : null}
            </Card.Body>
          </Card>

          {loadingReport ? (
            <div className="d-flex align-items-center gap-2 py-4">
              <Spinner animation="border" size="sm" />
              <span>載入月結報表…</span>
            </div>
          ) : null}

          {!loadingReport && report ? (
            <>
              <div className="small text-muted mb-2">
                期間 {report.dateFrom}～{report.dateTo}｜
                Leader {totals?.leaderCount ?? 0} 人｜
                場次 {totals?.sessionCount ?? 0}｜
                時數 {totals?.hours ?? 0}｜
                合計 NT$ {money(totals?.amount)}
                {(report.pending || []).length ? `｜未計入 ${report.pending.length} 場` : ''}
              </div>
              {(report.pending || []).length ? (
                <Card className="border-0 shadow-sm mb-3">
                  <Card.Body>
                    <h2 className="h6">未計入</h2>
                    <p className="small text-muted">這些場次已簽到，但必填任務還沒勾完。3 天內請 Leader 自己勾完。超過 3 天可開放補勾，補完才進合計。放行計薪不會代替勾選。</p>
                    <Table responsive size="sm" className="mb-0 align-middle">
                      <thead>
                        <tr>
                          <th>Leader</th>
                          <th>日期</th>
                          <th>活動</th>
                          <th>未勾</th>
                          <th>表訂時數</th>
                          <th>完成後金額</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {report.pending.map((session) => (
                          <tr key={`${session.leaderTeacherId}-${session.eventId}`}>
                            <td>{session.leaderName}</td>
                            <td>{session.date}</td>
                            <td>{session.eventName}</td>
                            <td>{session.incompleteCount ?? '—'}</td>
                            <td>{session.scheduledHours}</td>
                            <td>NT$ {money(session.potentialAmount)}</td>
                            <td className="text-nowrap">
                              <div className="small text-muted mb-1">
                                {session.payStatus === 'expired'
                                  ? '已過 3 天'
                                  : session.extended
                                    ? `補勾至 ${formatUntil(session.markingOpenUntil)}`
                                    : `還有 ${session.daysLeft ?? 0} 天`}
                              </div>
                              {canManage && session.payStatus === 'expired' ? (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  className="me-1"
                                  onClick={() => {
                                    setExtendTarget(session);
                                    setExtendNote('');
                                    setExtendUntil(defaultExtensionLocal());
                                    setReleaseTarget(null);
                                  }}
                                >
                                  開放補勾
                                </Button>
                              ) : null}
                              {canManage && session.payStatus !== 'released' ? (
                                <Button
                                  size="sm"
                                  variant="outline-primary"
                                  onClick={() => {
                                    setReleaseTarget(session);
                                    setReleaseNote('');
                                    setExtendTarget(null);
                                  }}
                                >
                                  放行計薪
                                </Button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                    {extendTarget ? (
                      <div className="mt-3">
                        <Form.Label className="small mb-1">
                          開放 {extendTarget.leaderName}／{extendTarget.date} 補勾
                        </Form.Label>
                        <p className="small text-muted mb-2">
                          評分在活動當下最準。開放後這位 Leader 可以再補勾，最多 7 天，補完才會計薪。
                        </p>
                        <Form.Control
                          size="sm"
                          className="mb-2"
                          value={extendNote}
                          onChange={(e) => setExtendNote(e.target.value)}
                          placeholder="例如：當天網路不穩，隔天補勾"
                        />
                        <Form.Control
                          size="sm"
                          type="datetime-local"
                          value={extendUntil}
                          onChange={(e) => setExtendUntil(e.target.value)}
                        />
                        <div className="d-flex gap-2 mt-2">
                          <Button
                            size="sm"
                            onClick={handleExtend}
                            disabled={extending || extendNote.trim().length < 2 || !extendUntil}
                          >
                            {extending ? '儲存中…' : '確認開放'}
                          </Button>
                          <Button size="sm" variant="outline-secondary" onClick={() => setExtendTarget(null)}>
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    {releaseTarget ? (
                      <div className="mt-3">
                        <Form.Label className="small mb-1">
                          放行 {releaseTarget.leaderName}／{releaseTarget.date} 的原因
                        </Form.Label>
                        <Form.Control
                          size="sm"
                          value={releaseNote}
                          onChange={(e) => setReleaseNote(e.target.value)}
                          placeholder="例如：現場名單對不上，改由行政確認"
                        />
                        <div className="d-flex gap-2 mt-2">
                          <Button size="sm" onClick={handleRelease} disabled={releasing || releaseNote.trim().length < 2}>
                            {releasing ? '儲存中…' : '確認放行'}
                          </Button>
                          <Button size="sm" variant="outline-secondary" onClick={() => setReleaseTarget(null)}>
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </Card.Body>
                </Card>
              ) : null}
              <Table responsive hover size="sm" className="bg-white border align-middle">
                <thead>
                  <tr>
                    <th />
                    <th>姓名</th>
                    <th>學號</th>
                    <th>年資</th>
                    <th>月份</th>
                    <th className="text-end">出席場次</th>
                    <th className="text-end">時數</th>
                    <th className="text-end">時薪</th>
                    <th className="text-end">小計</th>
                    <th>備註</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.rows || []).length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center text-muted py-4">
                        本月尚無計薪出席紀錄
                      </td>
                    </tr>
                  ) : (
                    report.rows.map((row) => {
                      const open = expanded.has(row.leaderTeacherId);
                      return (
                        <React.Fragment key={row.leaderTeacherId}>
                          <tr>
                            <td>
                              <Button
                                size="sm"
                                variant="link"
                                className="p-0"
                                onClick={() => toggleExpand(row.leaderTeacherId)}
                              >
                                {open ? '收合' : '明細'}
                              </Button>
                            </td>
                            <td>{row.name}</td>
                            <td>{row.studentId || '—'}</td>
                            <td>{row.seniorityYears}</td>
                            <td>{row.yearMonth}</td>
                            <td className="text-end">{row.sessionCount}</td>
                            <td className="text-end">{row.hours}</td>
                            <td className="text-end">{money(row.hourlyRate)}</td>
                            <td className="text-end fw-semibold">{money(row.subtotal)}</td>
                            <td className="small">{row.note || '—'}</td>
                          </tr>
                          {open
                            ? (row.sessions || []).map((s) => (
                              <tr key={`${row.leaderTeacherId}-${s.eventId}`} className="table-light">
                                <td />
                                <td colSpan={3} className="small">
                                  {s.date} {s.eventName}
                                </td>
                                <td colSpan={2} className="small text-muted">
                                  {s.startTime}{s.endTime ? `–${s.endTime}` : ''}
                                  {(s.groupLabels || []).length
                                    ? `｜${s.groupLabels.join(', ')}`
                                    : ''}
                                </td>
                                <td className="text-end small">{s.hours}</td>
                                <td className="text-end small">{money(s.hourlyRate)}</td>
                                <td className="text-end small">{money(s.subtotal)}</td>
                                <td className="small">
                                  {s.status === 'late' ? <Badge bg="warning" text="dark" className="me-1">遲到</Badge> : null}
                                  {s.status === 'manual' ? <Badge bg="info" className="me-1">補登</Badge> : null}
                                  {s.note || ''}
                                </td>
                              </tr>
                            ))
                            : null}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
                {(report.rows || []).length > 0 ? (
                  <tfoot>
                    <tr className="fw-semibold">
                      <td colSpan={5}>合計</td>
                      <td className="text-end">{totals?.sessionCount}</td>
                      <td className="text-end">{totals?.hours}</td>
                      <td />
                      <td className="text-end">{money(totals?.amount)}</td>
                      <td />
                    </tr>
                  </tfoot>
                ) : null}
              </Table>
            </>
          ) : null}
        </Tab>

        <Tab eventKey="rates" title="時薪設定">
          {!canManage ? (
            <Alert variant="info" className="small">
              您可檢視時薪設定；修改需具備 ET 分組管理權限。
            </Alert>
          ) : null}
          {loadingProfiles ? (
            <div className="d-flex align-items-center gap-2 py-4">
              <Spinner animation="border" size="sm" />
              <span>載入時薪設定…</span>
            </div>
          ) : (
            <Table responsive hover size="sm" className="bg-white border align-middle">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>學號</th>
                  <th style={{ width: 100 }}>年資（年）</th>
                  <th style={{ width: 120 }}>時薪（NT$）</th>
                  <th>備註</th>
                  {canManage ? <th style={{ width: 90 }} /> : null}
                </tr>
              </thead>
              <tbody>
                {profiles.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 6 : 5} className="text-center text-muted py-4">
                      尚無 Leader 帳號
                    </td>
                  </tr>
                ) : (
                  profiles.map((row) => {
                    const draft = drafts[row.leaderTeacherId] || {
                      seniorityYears: '0',
                      hourlyRate: '0',
                      note: '',
                    };
                    return (
                      <tr key={row.leaderTeacherId}>
                        <td>
                          {row.name}
                          {!row.hasProfile ? (
                            <Badge bg="secondary" className="ms-1">未設定</Badge>
                          ) : null}
                        </td>
                        <td>{row.studentId || '—'}</td>
                        <td>
                          <Form.Control
                            size="sm"
                            type="number"
                            min="0"
                            step="0.5"
                            value={draft.seniorityYears}
                            disabled={!canManage}
                            onChange={(e) => updateDraft(row.leaderTeacherId, 'seniorityYears', e.target.value)}
                          />
                        </td>
                        <td>
                          <Form.Control
                            size="sm"
                            type="number"
                            min="0"
                            step="1"
                            value={draft.hourlyRate}
                            disabled={!canManage}
                            onChange={(e) => updateDraft(row.leaderTeacherId, 'hourlyRate', e.target.value)}
                          />
                        </td>
                        <td>
                          <Form.Control
                            size="sm"
                            value={draft.note}
                            disabled={!canManage}
                            placeholder="選填"
                            onChange={(e) => updateDraft(row.leaderTeacherId, 'note', e.target.value)}
                          />
                        </td>
                        {canManage ? (
                          <td>
                            <Button
                              size="sm"
                              variant="outline-primary"
                              disabled={savingId === row.leaderTeacherId}
                              onClick={() => handleSaveProfile(row.leaderTeacherId)}
                            >
                              {savingId === row.leaderTeacherId ? '儲存中…' : '儲存'}
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          )}
        </Tab>
      </Tabs>
    </div>
  );
}
