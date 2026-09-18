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
  saveLeaderPayProfile,
} from '../../services/etGroupingApi';
import { showErrorMessage, showSuccessMessage } from '../../utils/errorHandler';

function currentYearMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
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

  if (!canView) {
    return <Alert variant="warning">您沒有檢視 Leader 支薪報表的權限。</Alert>;
  }

  return (
    <div className="admin-et-leader-payroll-page">
      <Card className="mb-3 border-0 shadow-sm">
        <Card.Body>
          <h1 className="h5 mb-1">Leader 支薪報表</h1>
          <p className="small text-muted mb-0">
            依出席簽到計算時數（活動開始至結束）；時薪依各 Leader 年資設定。遲到與行政補登仍計入支薪，並於備註標示。
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
              </div>
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
