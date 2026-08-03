import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Form,
  Spinner,
  Alert,
  Badge,
} from 'react-bootstrap';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { SEMESTER_OPTIONS } from '../utils/semesterUtils';
import { handleAPIError } from '../utils/errorHandler';
import {
  fetchTrendByClass,
  fetchTrendByStudent,
  fetchTrendOverview,
} from '../services/reportsAdminApi';
import {
  trendMetricTitle,
  formatTrendMetricCell,
} from '../utils/analyticsMetricLabels';

function trendDirectionBadge(rate, { invert = false } = {}) {
  if (rate === null || rate === undefined || Number.isNaN(Number(rate))) {
    return <Badge bg="secondary">無法比較</Badge>;
  }
  const n = Number(rate);
  const good = invert ? n < 0 : n > 0;
  const bad = invert ? n > 0 : n < 0;
  if (Math.abs(n) < 0.01) return <Badge bg="secondary">持平</Badge>;
  if (good) return <Badge bg="success">改善</Badge>;
  if (bad) return <Badge bg="warning" text="dark">需關注</Badge>;
  return <Badge bg="secondary">持平</Badge>;
}

function teachingProxyBadge(growth) {
  if (growth === null || growth === undefined || growth === '—') {
    return <Badge bg="secondary">無法比較</Badge>;
  }
  const n = Number(growth);
  if (Number.isNaN(n)) return <Badge bg="secondary">無法比較</Badge>;
  if (n > 0.5) return <Badge bg="success">上升（proxy）</Badge>;
  if (n < -0.5) return <Badge bg="warning" text="dark">下降（proxy）</Badge>;
  return <Badge bg="secondary">大致持平（proxy）</Badge>;
}

export default function TrendDashboardPage() {
  const outlet = useOutletContext() || {};
  const token = outlet.token || localStorage.getItem('token');

  const [mode, setMode] = useState('overview');
  const [studentId, setStudentId] = useState('');
  const [classId, setClassId] = useState('');
  const [fromSemester, setFromSemester] = useState('113-2');
  const [toSemester, setToSemester] = useState('115-1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      let json;
      if (mode === 'overview') {
        json = await fetchTrendOverview(token, fromSemester, toSemester);
      } else if (mode === 'student') {
        if (!studentId.trim()) throw new Error('請輸入學生學號');
        json = await fetchTrendByStudent(token, studentId.trim(), fromSemester, toSemester);
      } else {
        if (!classId.trim()) throw new Error('請輸入班級 ID');
        json = await fetchTrendByClass(token, classId.trim(), fromSemester, toSemester);
      }
      setData(json);
    } catch (e) {
      const errMsg = handleAPIError(e);
      setError(errMsg?.display || errMsg?.zh || '載入失敗');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, mode, studentId, classId, fromSemester, toSemester]);

  useEffect(() => {
    load();
  }, [load]);

  const semesters = useMemo(() => data?.semesters || [], [data]);
  const canCompareSemesters = semesters.length >= 2;

  const chartRows = useMemo(() => {
    if (!data?.metrics || !semesters.length) return [];
    return semesters.map((sem, idx) => {
      const row = { semester: sem };
      Object.keys(data.metrics).forEach((k) => {
        const arr = data.metrics[k];
        row[k] = arr && arr[idx] !== undefined ? arr[idx] : null;
      });
      return row;
    });
  }, [data, semesters]);

  const hasNumericSeries = (key) =>
    chartRows.some((r) => {
      const v = r[key];
      return v !== null && v !== undefined && typeof v === 'number';
    });

  const teachingTwoPoint = useMemo(() => {
    const ti = data?.decisionKpis?.teacherImpact;
    if (!ti?.previousSemester || !ti?.currentSemester) return [];
    return [
      { semester: ti.previousSemester, 教學綜合分: ti.previousAvgTeachingScore },
      { semester: ti.currentSemester, 教學綜合分: ti.currentAvgTeachingScore },
    ];
  }, [data]);

  const pctTick = (v) => `${Number(v).toFixed(0)}%`;
  const chartEmpty =
    !chartRows.length ||
    (!hasNumericSeries('participationRate') &&
      !hasNumericSeries('riskHighCount') &&
      !hasNumericSeries('bestepPassRate') &&
      teachingTwoPoint.length < 2);

  const rechartsFmtPct = (v) => [`${Number(v).toFixed(1)}%`, ''];

  return (
    <div className="container-fluid px-2 px-md-3">
      <Alert variant="info" className="small py-2 mb-3">
        趨勢指標基於 <strong>class_memberships</strong> 與 <code>kpiService</code> 聚合（班級行政管理口徑），與 LJ active roster 之 canonical
        達標<strong>不同</strong>。下方「決策輔助指標」含教學綜合 proxy 變化，<strong>不代表</strong>教師因果影響。
      </Alert>
      <Card className="mb-3 border-primary-subtle">
        <Card.Body>
          <div className="d-flex flex-wrap gap-2 align-items-end">
            <Form.Group>
              <Form.Label>檢視模式</Form.Label>
              <Form.Select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="overview">全校趨勢</option>
                <option value="class">單一班級</option>
                <option value="student">單一學生</option>
              </Form.Select>
            </Form.Group>
            {mode === 'student' && (
              <Form.Group>
                <Form.Label>學生學號</Form.Label>
                <Form.Control
                  placeholder="學號"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                />
              </Form.Group>
            )}
            {mode === 'class' && (
              <Form.Group>
                <Form.Label>班級 ID</Form.Label>
                <Form.Control
                  placeholder="數字班級編號"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                />
              </Form.Group>
            )}
            <Form.Group>
              <Form.Label>起始學期</Form.Label>
              <Form.Select value={fromSemester} onChange={(e) => setFromSemester(e.target.value)}>
                {SEMESTER_OPTIONS.filter((o) => o.value).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label || o.value}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group>
              <Form.Label>結束學期</Form.Label>
              <Form.Select value={toSemester} onChange={(e) => setToSemester(e.target.value)}>
                {SEMESTER_OPTIONS.filter((o) => o.value).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label || o.value}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Button variant="primary" onClick={load} disabled={loading}>
              {loading ? '更新中…' : '查詢'}
            </Button>
          </div>
        </Card.Body>
      </Card>

      {loading && (
        <div className="text-center py-4">
          <Spinner animation="border" className="text-primary" />
          <div className="text-muted small mt-2">載入趨勢資料…</div>
        </div>
      )}
      {error && <Alert variant="danger">{error}</Alert>}

      {!loading && data && (
        <>
          {!canCompareSemesters && (
            <Alert variant="warning" className="small">
              目前查詢範圍僅包含<strong>一個</strong>學期，無法計算跨期決策輔助指標；請調整學期起迄至少涵蓋兩個學期。
            </Alert>
          )}

          <Card className="mb-3">
            <Card.Header className="fw-semibold bg-primary-subtle">趨勢圖表（中文指標）</Card.Header>
            <Card.Body>
              {chartEmpty ? (
                <Alert variant="secondary" className="mb-0 small">
                  尚無足夠資料產生圖表（或所選範圍內無 class_memberships 資料）。
                </Alert>
              ) : (
                <div className="row g-3">
                  {hasNumericSeries('participationRate') && (
                    <div className="col-12 col-lg-6">
                      <div className="text-muted small mb-1">跨學期參與率</div>
                      <div style={{ height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartRows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="semester" tick={{ fontSize: 12 }} />
                            <YAxis domain={[0, 100]} tickFormatter={pctTick} />
                            <RechartsTooltip formatter={rechartsFmtPct} labelFormatter={(l) => `學期：${l}`} />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="participationRate"
                              name="參與率"
                              stroke="#0d6efd"
                              strokeWidth={2}
                              dot
                              connectNulls
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  {hasNumericSeries('riskHighCount') && (
                    <div className="col-12 col-lg-6">
                      <div className="text-muted small mb-1">高風險學生數（班級名冊母體）</div>
                      <div style={{ height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartRows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="semester" tick={{ fontSize: 12 }} />
                            <YAxis allowDecimals={false} />
                            <RechartsTooltip
                              formatter={(v) => [`${v} 人`, '高風險學生數']}
                              labelFormatter={(l) => `學期：${l}`}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="riskHighCount"
                              name="高風險學生數"
                              stroke="#dc3545"
                              strokeWidth={2}
                              dot
                              connectNulls
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  {hasNumericSeries('bestepPassRate') && (
                    <div className="col-12 col-lg-6">
                      <div className="text-muted small mb-1">BESTEP 通過率</div>
                      <div style={{ height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartRows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="semester" tick={{ fontSize: 12 }} />
                            <YAxis domain={[0, 100]} tickFormatter={pctTick} />
                            <RechartsTooltip formatter={rechartsFmtPct} labelFormatter={(l) => `學期：${l}`} />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="bestepPassRate"
                              name="BESTEP 通過率"
                              stroke="#198754"
                              strokeWidth={2}
                              dot
                              connectNulls
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  {teachingTwoPoint.length === 2 && (
                    <div className="col-12 col-lg-6">
                      <div className="text-muted small mb-1">
                        教學綜合指標（proxy，僅末兩學期可比較）
                      </div>
                      <div style={{ height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={teachingTwoPoint} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="semester" tick={{ fontSize: 12 }} />
                            <YAxis domain={['auto', 'auto']} />
                            <RechartsTooltip
                              formatter={(v) => [`${v}`, '教學綜合分（proxy）']}
                              labelFormatter={(l) => `學期：${l}`}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="教學綜合分"
                              name="教學綜合分（proxy）"
                              stroke="#6f42c1"
                              strokeWidth={2}
                              dot={{ r: 5 }}
                              connectNulls
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <Form.Text className="text-muted">
                        此線僅連接 API 提供之末兩學期全校平均教學綜合分，非逐學期完整序列。
                      </Form.Text>
                    </div>
                  )}
                </div>
              )}
            </Card.Body>
          </Card>

          <Card className="mb-3">
            <Card.Header className="fw-semibold">趨勢數值表</Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table striped hover size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th>指標</th>
                      {semesters.map((sem) => (
                        <th key={sem}>{sem}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.metrics || {}).map(([k, arr]) => (
                      <tr key={k}>
                        <td className="text-nowrap" title={k}>
                          {trendMetricTitle(k)}
                        </td>
                        {(arr || []).map((v, idx) => (
                          <td key={`${k}-${idx}`}>{formatTrendMetricCell(k, v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>

          {data.decisionKpis && (
            <Card className="mb-3 border-info">
              <Card.Header className="fw-semibold">決策輔助指標（跨期變化）</Card.Header>
              <Card.Body>
                <p className="text-muted small">
                  以下為相鄰兩個學期之變化率或 proxy 差分，供行政追蹤參考；不應解讀為個別教師因果。
                </p>
                {!canCompareSemesters && (
                  <Alert variant="light" border className="small py-2">
                    需要至少<strong>兩個</strong>學期才能比較決策輔助指標。
                  </Alert>
                )}
                {canCompareSemesters && (
                  <div className="d-flex flex-column gap-3">
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <span>參與率變化（班級名冊 KPI）：</span>
                      <strong>
                        {data.decisionKpis.participationImprovementRate != null
                          ? `${data.decisionKpis.participationImprovementRate}%`
                          : '—'}
                      </strong>
                      {trendDirectionBadge(data.decisionKpis.participationImprovementRate)}
                    </div>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <span>高風險人數變化（班級名冊；數值下降通常較佳）：</span>
                      <strong>
                        {data.decisionKpis.highRiskImprovementRate != null
                          ? `${data.decisionKpis.highRiskImprovementRate}%`
                          : '—'}
                      </strong>
                      {trendDirectionBadge(data.decisionKpis.highRiskImprovementRate, { invert: true })}
                    </div>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <span>教學綜合指標變化（proxy，API 鍵 teacherImpact.growth）：</span>
                      <strong>{data.decisionKpis.teacherImpact?.growth ?? '—'}</strong>
                      {teachingProxyBadge(data.decisionKpis.teacherImpact?.growth)}
                    </div>
                  </div>
                )}
                <p className="text-muted small mb-0 mt-3">
                  教學綜合分由班級層級 KPI 加權合成，僅供趨勢參考；不得解讀為個別教師對學生成果之因果影響。
                </p>
              </Card.Body>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
