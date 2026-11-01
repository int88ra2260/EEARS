import React, { useCallback, useEffect, useMemo, useState, useId, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, Form, Spinner, Alert, Button, Table } from 'react-bootstrap';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

import dayjs from 'dayjs';
import { getCurrentSemester, SEMESTER_OPTIONS } from '../../utils/semesterUtils';
import {
  fetchAnalyticsClasses,
  fetchAnalyticsEvents,
  fetchAnalyticsOverview,
  fetchAnalyticsTrends,
  fetchReservationCapacityBreakdown,
  parseApiError,
} from '../../services/reportsAdminApi';
import {
  CHART_SERIES,
  CHART_ANIM,
  CHART_AXIS_TICK,
  CHART_AXIS_LABEL,
  CHART_CURSOR_FILL,
  CHART_MARGIN,
  ChartCard,
  ChartGrid,
  ChartTooltip,
} from '../../components/charts';
import {
  OPS_LABELS,
  OPS_NOTES,
  OPS_POPULATION,
  OPS_TIME_FIELD,
  REGISTRATION_SUPPLEMENT_NOTES,
  finiteOrNull,
  formatActivityDateWindow,
  formatCount,
  formatPct1,
  isAllNumericZero,
} from './activityOpsPresentation';

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const dt = dayjs(dateStr);
  if (!dt.isValid()) return String(dateStr);
  return dt.format('MM/DD');
}

function getFirstArray(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of keys) {
    if (Array.isArray(obj[key])) return obj[key];
  }
  return null;
}

function normalizeCapacityItem(row) {
  const eventType = row?.eventType || row?.activityType || row?.type || '未分類';
  return {
    eventType: String(eventType || '未分類'),
    totalReservations: finiteOrNull(row?.totalReservations ?? row?.reservedCount ?? row?.reservationsCount),
    totalEventCapacity: finiteOrNull(row?.totalEventCapacity ?? row?.capacity ?? row?.maxCapacity),
    bookingRate: finiteOrNull(row?.bookingRate ?? row?.utilizationRate),
  };
}

function normalizeCapacityBreakdownPayload(json) {
  if (Array.isArray(json)) {
    return {
      byEventType: json.map(normalizeCapacityItem),
      byEvent: [],
      items: json,
      summary: null,
      semester: null,
    };
  }

  const candidates = [
    json,
    json?.data,
    json?.payload,
    json?.result,
    json?.breakdown,
    json?.capacityBreakdown,
    json?.reservationCapacityBreakdown,
    json?.data?.breakdown,
    json?.data?.capacityBreakdown,
    json?.data?.reservationCapacityBreakdown,
  ].filter((x) => x && typeof x === 'object');

  for (const item of candidates) {
    const items = getFirstArray(item, ['items', 'rows', 'data']);
    const byEventType = getFirstArray(item, [
      'byEventType',
      'byEventTypes',
      'byType',
      'eventTypes',
      'typeBreakdown',
    ]);
    const byEvent = getFirstArray(item, [
      'byEvent',
      'byEvents',
      'events',
      'eventBreakdown',
    ]);
    if (items) {
      return {
        byEventType: items.map(normalizeCapacityItem),
        byEvent: byEvent || [],
        items,
        summary: item.summary || null,
        semester: item.semester || null,
      };
    }
    if (byEventType) {
      return {
        byEventType: byEventType.map(normalizeCapacityItem),
        byEvent: byEvent || [],
        items: byEventType,
        summary: item.summary || null,
        semester: item.semester || null,
      };
    }
  }

  return null;
}

function summarizeApiData(json) {
  if (json == null) return 'empty';
  if (Array.isArray(json)) return `array(${json.length})`;
  if (typeof json !== 'object') return String(json).slice(0, 120);
  try {
    return JSON.stringify(json).slice(0, 300);
  } catch (_) {
    return '[unserializable object]';
  }
}

function describeApiShape(json) {
  if (json == null) return 'empty';
  if (Array.isArray(json)) return `array(${json.length})`;
  if (typeof json !== 'object') return typeof json;
  const keys = Object.keys(json).slice(0, 8);
  const dataKeys = json.data && typeof json.data === 'object' ? Object.keys(json.data).slice(0, 8) : [];
  return dataKeys.length
    ? `keys: ${keys.join(', ') || '(none)'}; data keys: ${dataKeys.join(', ')}`
    : `keys: ${keys.join(', ') || '(none)'}`;
}

function KpiCard({ metricKey, title, value, note }) {
  const noteId = useId();
  const [open, setOpen] = useState(false);

  return (
    <div className="col-12 col-sm-6 col-xl-4">
      <Card className="h-100">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div className="text-muted small">{title}</div>
            {note ? (
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-nowrap"
                aria-expanded={open}
                aria-controls={noteId}
                aria-label={`${title}說明`}
                onClick={() => setOpen((current) => !current)}
              >
                說明
              </button>
            ) : null}
          </div>
          <div className="fs-4 fw-semibold mt-1" data-testid={`ops-value-${metricKey}`}>
            {value}
          </div>
          {open && note ? (
            <div id={noteId} className="small text-muted mt-2">
              {note.map((line) => (
                <p key={line} className="mb-1">{line}</p>
              ))}
            </div>
          ) : null}
        </Card.Body>
      </Card>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const outlet = useOutletContext() || {};
  const token = outlet.token || localStorage.getItem('token');

  const [semester, setSemester] = useState(getCurrentSemester() || '114-1');

  const [resLoading, setResLoading] = useState(false);
  const [resError, setResError] = useState('');
  const [reservationOverview, setReservationOverview] = useState(null);
  const [capacityBreakdown, setCapacityBreakdown] = useState({ byEventType: [], byEvent: [] });
  const [capacityBreakdownError, setCapacityBreakdownError] = useState('');

  const [chartsLoading, setChartsLoading] = useState(false);
  const [chartsError, setChartsError] = useState('');
  const [activityTrend, setActivityTrend] = useState([]);
  const [attendanceTrend, setAttendanceTrend] = useState([]);
  const [classRankings, setClassRankings] = useState([]);
  const loadSeq = useRef(0);

  const refreshing = resLoading || chartsLoading;

  const load = useCallback(async () => {
    if (!token) {
      setResLoading(false);
      setChartsLoading(false);
      return;
    }
    const requestedSemester = semester;
    const requestId = loadSeq.current + 1;
    loadSeq.current = requestId;
    const kind = 'reservation';

    setResLoading(true);
    setResError('');
    setReservationOverview(null);
    setCapacityBreakdown({ byEventType: [], byEvent: [] });
    setCapacityBreakdownError('');

    setChartsLoading(true);
    setChartsError('');
    setActivityTrend([]);
    setAttendanceTrend([]);
    setClassRankings([]);

    const resP = (async () => {
      try {
        const [json, breakdownFirst] = await Promise.all([
          fetchAnalyticsOverview(token, requestedSemester, { kind }),
          fetchReservationCapacityBreakdown(token, requestedSemester),
        ]);
        if (loadSeq.current !== requestId) return;
        setReservationOverview(json || null);
        const overviewBreakdownData = normalizeCapacityBreakdownPayload(json);

        let bdRes = breakdownFirst.res;
        let bdJson = breakdownFirst.json;
        if (bdRes.ok && Object.keys(bdJson || {}).length === 0) {
          const retry = await fetchReservationCapacityBreakdown(token, requestedSemester, { retry: true });
          if (loadSeq.current !== requestId) return;
          bdRes = retry.res;
          bdJson = retry.json;
        }
        const bdData = normalizeCapacityBreakdownPayload(bdJson) || overviewBreakdownData;
        if (import.meta.env.DEV) {
          const keys = bdJson && typeof bdJson === 'object' && !Array.isArray(bdJson) ? Object.keys(bdJson) : [];
          console.debug('[EEARS Analytics] reservation-capacity-breakdown response', {
            status: bdRes.status,
            keys,
            normalizedItemCount: bdData?.byEventType?.length || 0,
            semester: bdData?.semester || requestedSemester,
          });
        }
        if (loadSeq.current !== requestId) return;
        if (bdData) {
          setCapacityBreakdown({
            byEventType: bdData.byEventType,
            byEvent: bdData.byEvent,
          });
          setCapacityBreakdownError('');
        } else {
          setCapacityBreakdown({ byEventType: [], byEvent: [] });
          const bdMsg = parseApiError(bdRes, bdJson);
          setCapacityBreakdownError(
            bdRes.ok
              ? `分項名額資料格式異常（HTTP ${bdRes.status}; ${describeApiShape(bdJson)}; raw: ${summarizeApiData(bdJson)}），請重新整理或聯絡管理員。`
              : bdMsg
          );
        }
      } catch (e) {
        if (loadSeq.current !== requestId) return;
        setResError(e?.message || '載入失敗');
        setReservationOverview(null);
        setCapacityBreakdown({ byEventType: [], byEvent: [] });
        setCapacityBreakdownError('');
      } finally {
        if (loadSeq.current === requestId) setResLoading(false);
      }
    })();

    const chartsP = (async () => {
      try {
        const [trendsJson, eventsJson, classesJson] = await Promise.all([
          fetchAnalyticsTrends(token, requestedSemester, kind),
          fetchAnalyticsEvents(token, requestedSemester),
          fetchAnalyticsClasses(token, requestedSemester),
        ]);
        if (loadSeq.current !== requestId) return;

        setActivityTrend(trendsJson?.activityTrend || []);
        setAttendanceTrend(eventsJson?.attendanceTrend || []);
        setClassRankings(classesJson?.rankings || []);
      } catch (e) {
        if (loadSeq.current !== requestId) return;
        setChartsError(e?.message || '圖表資料載入失敗');
        setActivityTrend([]);
        setAttendanceTrend([]);
        setClassRankings([]);
      } finally {
        if (loadSeq.current === requestId) setChartsLoading(false);
      }
    })();

    await Promise.all([resP, chartsP]);
  }, [token, semester]);

  useEffect(() => {
    load();
  }, [load]);

  const activityDateWindow = useMemo(() => formatActivityDateWindow(semester), [semester]);

  const reservationKpis = useMemo(() => {
    if (!reservationOverview) {
      return {
        totalReservations: null,
        totalEventCapacity: null,
        bookingRate: null,
        attendanceRate: null,
        violationRate: null,
        englishPassRate: null,
      };
    }
    return {
      totalReservations: finiteOrNull(reservationOverview.totalReservations),
      totalEventCapacity: finiteOrNull(reservationOverview.totalEventCapacity),
      bookingRate: finiteOrNull(reservationOverview.bookingRate),
      attendanceRate: finiteOrNull(reservationOverview.attendanceRate),
      violationRate: finiteOrNull(reservationOverview.violationRate),
      englishPassRate: finiteOrNull(reservationOverview.englishPassRate),
    };
  }, [reservationOverview]);

  const activityChartData = useMemo(() => {
    return (activityTrend || []).map((p) => ({
      date: formatDateLabel(p.date),
      reservationsCount: finiteOrNull(p.reservationsCount),
      rawDate: p.date,
    }));
  }, [activityTrend]);

  const attendanceChartData = useMemo(() => {
    return (attendanceTrend || []).map((p) => ({
      date: formatDateLabel(p.date),
      attendanceRate: finiteOrNull(p.attendanceRate),
      rawDate: p.date,
    }));
  }, [attendanceTrend]);

  const classChartData = useMemo(() => {
    return (classRankings || []).map((c) => ({
      classKey: c.className ? c.className : `Class ${c.classId}`,
      classId: c.classId,
      violationRate: finiteOrNull(c.violationRate),
      attendanceRate: finiteOrNull(c.attendanceRate),
      reservationsCount: finiteOrNull(c.reservationsCount),
    }));
  }, [classRankings]);

  const reservationAllZero =
    !resLoading &&
    !resError &&
    reservationOverview &&
    isAllNumericZero([
      reservationKpis.totalReservations,
      reservationKpis.totalEventCapacity,
      reservationKpis.bookingRate,
      reservationKpis.attendanceRate,
      reservationKpis.violationRate,
    ]);

  const chartsNoData =
    !chartsLoading &&
    !chartsError &&
    (activityChartData || []).every((p) => finiteOrNull(p.reservationsCount) === 0) &&
    (attendanceChartData || []).length === 0 &&
    (classChartData || []).length === 0;

  const clearVisibleStats = () => {
    setReservationOverview(null);
    setCapacityBreakdown({ byEventType: [], byEvent: [] });
    setResError('');
    setCapacityBreakdownError('');
    setResLoading(true);
    setChartsLoading(true);
    setChartsError('');
    setActivityTrend([]);
    setAttendanceTrend([]);
    setClassRankings([]);
  };

  return (
    <div className="container-fluid px-2 px-md-3">
      <div className="d-flex flex-wrap justify-content-end align-items-start gap-2 mb-2">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <Form.Group className="mb-0">
            <Form.Label className="small text-muted me-2 mb-0" htmlFor="ops-semester">學期</Form.Label>
            <div style={{ width: '100%', maxWidth: 220 }}>
              <Form.Select
                id="ops-semester"
                aria-label="學期"
                value={semester}
                onChange={(e) => {
                  setSemester(e.target.value);
                  clearVisibleStats();
                }}
                className="w-100"
                disabled={refreshing}
              >
                {SEMESTER_OPTIONS.filter((o) => o.value).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Form.Select>
            </div>
          </Form.Group>
          <Button variant="outline-primary" size="sm" onClick={() => load()} disabled={refreshing || !token}>
            {refreshing ? '更新中…' : '重新整理'}
          </Button>
        </div>
      </div>
      <p className="text-muted small mb-3">
        本頁只呈現<strong>活動營運</strong>：中心提供多少名額、有多少預約、簽到差距，以及哪些類型較忙。學習成果與 B2 達標請至「學習成效分析」。
      </p>

      <Card className="mb-4">
        <Card.Header className="fw-semibold">活動營運總覽</Card.Header>
        <Card.Body>
          <div data-testid="ops-context" className="mb-3">
            <p className="mb-1">學期 <strong>{semester}</strong></p>
            <p className="mb-1">
              活動日期{' '}
              <strong>{activityDateWindow || '此學期尚未列入共用日期設定'}</strong>
            </p>
            <p className="text-muted small mb-1">{OPS_POPULATION}</p>
            <p className="text-muted small mb-1">主要時間欄位：{OPS_TIME_FIELD}</p>
            <p className="text-muted small mb-0">報名資料補充資訊使用報名學期標籤，不使用這個活動日期。</p>
          </div>
          {resLoading && (
            <div className="text-center py-3" role="status">
              <Spinner animation="border" size="sm" className="me-2" />
              載入中…
            </div>
          )}
          {resError && !resLoading && <Alert variant="danger">{resError}</Alert>}
          {!resLoading && !resError && reservationAllZero && (
            <Alert variant="secondary" className="py-2 small mb-3">
              所選活動日期區間內，名額、預約筆數、預約名額比、簽到與違規狀態比皆為 0。
            </Alert>
          )}
          {!resLoading && !resError && reservationOverview && (
            <div data-testid="ops-core-kpis">
              <section className="mb-4" aria-labelledby="ops-supply">
                <h2 id="ops-supply" className="h6 mb-1">資源供給</h2>
                <p className="text-muted small mb-2">本學期中心提供多少活動名額？</p>
                <div className="row g-3">
                  <KpiCard
                    metricKey="capacity"
                    title={OPS_LABELS.totalEventCapacity}
                    value={formatCount(reservationKpis.totalEventCapacity)}
                    note={OPS_NOTES.totalEventCapacity}
                  />
                </div>
              </section>
              <section className="mb-4" aria-labelledby="ops-demand">
                <h2 id="ops-demand" className="h6 mb-1">預約需求</h2>
                <p className="text-muted small mb-2">目前有多少預約，相對名額的比例是多少？</p>
                <div className="row g-3">
                  <KpiCard
                    metricKey="reservations"
                    title={OPS_LABELS.totalReservations}
                    value={formatCount(reservationKpis.totalReservations)}
                    note={OPS_NOTES.totalReservations}
                  />
                  <KpiCard
                    metricKey="booking"
                    title={OPS_LABELS.bookingRate}
                    value={formatPct1(reservationKpis.bookingRate)}
                    note={OPS_NOTES.bookingRate}
                  />
                </div>
              </section>
              <section className="mb-4" aria-labelledby="ops-attendance">
                <h2 id="ops-attendance" className="h6 mb-1">簽到與使用</h2>
                <p className="text-muted small mb-2">預約列裡，有多少已經簽到？</p>
                <div className="row g-3">
                  <KpiCard
                    metricKey="attendance"
                    title={OPS_LABELS.attendanceRate}
                    value={formatPct1(reservationKpis.attendanceRate)}
                    note={OPS_NOTES.attendanceRate}
                  />
                </div>
              </section>
              <section className="mb-0" aria-labelledby="ops-exceptions">
                <h2 id="ops-exceptions" className="h6 mb-1">行政例外</h2>
                <p className="text-muted small mb-2">預約列裡，有多少已登記違規？</p>
                <div className="row g-3">
                  <KpiCard
                    metricKey="violation"
                    title={OPS_LABELS.violationRate}
                    value={formatPct1(reservationKpis.violationRate)}
                    note={OPS_NOTES.violationRate}
                  />
                </div>
              </section>
            </div>
          )}
          {!resLoading && !resError && reservationOverview && (
            <>
              <hr className="my-4" />
              <h2 className="h6 fw-semibold mb-2">活動類型與場次</h2>
              <p className="text-muted small mb-3">
                類型表與場次表是同一份分項的不同粒度。類型列不與另一種形狀再加總。口徑與上方預約名額比相同：預約筆數 ÷ 活動名額。
                活動日期 <strong>{activityDateWindow || semester}</strong>。
              </p>
              {capacityBreakdownError && (
                <Alert variant="warning" className="py-2 small mb-3">
                  分項資料載入失敗：{capacityBreakdownError}
                </Alert>
              )}
              {capacityBreakdown.byEventType.length === 0 && capacityBreakdown.byEvent.length === 0 && !capacityBreakdownError && (
                <Alert variant="secondary" className="py-2 small mb-0">
                  於<strong>{activityDateWindow || semester}</strong>
                  內查無活動資料，故無法分項統計。若實際已有活動，請確認活動日期是否落在此區間，或活動日欄位是否為可解析之日期（建議
                  YYYY-MM-DD）。
                </Alert>
              )}
              {capacityBreakdown.byEventType.length > 0 && (
                <div className="mb-4" data-testid="capacity-by-type">
                  <div className="text-muted small mb-2">依活動類型</div>
                  <div className="table-responsive">
                    <Table striped bordered hover size="sm" className="mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>活動類型</th>
                          <th className="text-end">活動名額</th>
                          <th className="text-end">預約筆數</th>
                          <th className="text-end">預約名額比</th>
                        </tr>
                      </thead>
                      <tbody>
                        {capacityBreakdown.byEventType.map((row) => (
                          <tr key={row.eventType}>
                            <td>{row.eventType}</td>
                            <td className="text-end">{formatCount(row.totalEventCapacity)}</td>
                            <td className="text-end">{formatCount(row.totalReservations)}</td>
                            <td className="text-end">{formatPct1(row.bookingRate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              )}
              {capacityBreakdown.byEvent.length > 0 && (
                <div data-testid="capacity-by-event">
                  <div className="text-muted small mb-2">依場次（活動）</div>
                  <div className="table-responsive" style={{ maxHeight: 420, overflowY: 'auto' }}>
                    <Table striped bordered hover size="sm" className="mb-0">
                      <thead className="table-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr>
                          <th>日期</th>
                          <th>活動名稱</th>
                          <th>類型</th>
                          <th className="text-end">名額</th>
                          <th className="text-end">已預約</th>
                          <th className="text-end">預約名額比</th>
                        </tr>
                      </thead>
                      <tbody>
                        {capacityBreakdown.byEvent.map((row) => (
                          <tr key={row.eventId}>
                            <td>{formatDateLabel(row.eventDate)}</td>
                            <td>{row.eventName}</td>
                            <td>{row.eventType}</td>
                            <td className="text-end">{formatCount(row.maxCapacity)}</td>
                            <td className="text-end">{formatCount(row.totalReservations)}</td>
                            <td className="text-end">{formatPct1(row.bookingRate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          )}
          {!resLoading && !resError && reservationOverview && (
            <details className="mt-4" data-testid="ops-registration-supplement">
              <summary>報名資料補充資訊</summary>
              <div className="small text-muted mt-2">
                <div className="text-body">{OPS_LABELS.englishPassRate}</div>
                <div className="fs-5 fw-semibold text-body my-1" data-testid="ops-value-english">
                  {formatPct1(reservationKpis.englishPassRate)}
                </div>
                {REGISTRATION_SUPPLEMENT_NOTES.map((line) => (
                  <p key={line} className="mb-1">{line}</p>
                ))}
              </div>
            </details>
          )}
        </Card.Body>
      </Card>

      {/* 圖表（預約營運）— 共用 chart kit */}
      <div className="mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
          <div>
            <h5 className="mb-1">活動趨勢與班級排行</h5>
            <p className="text-muted small mb-0">預約營運：活動趨勢、預約列簽到率與班級違規狀態排行。</p>
          </div>
        </div>

        {chartsLoading && (
          <div className="row g-3">
            <div className="col-12 col-lg-6"><ChartCard loading /></div>
            <div className="col-12 col-lg-6"><ChartCard loading /></div>
            <div className="col-12"><ChartCard loading /></div>
          </div>
        )}
        {chartsError && !chartsLoading && <Alert variant="danger">{chartsError}</Alert>}
        {!chartsLoading && !chartsError && chartsNoData && (
          <ChartCard
            empty
            emptyHint="尚無足夠資料產生圖表（活動趨勢、簽到趨勢或班級排行皆為空）。"
          />
        )}
        {!chartsLoading && !chartsError && !chartsNoData && (
          <>
            <div className="row g-3 mb-3">
              <div className="col-12 col-lg-6">
                <ChartCard
                  title="活動趨勢（依活動日期）"
                  description="每日預約筆數"
                  plotHeight={320}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activityChartData} margin={CHART_MARGIN.line}>
                      <ChartGrid vertical={false} />
                      <XAxis
                        dataKey="date"
                        minTickGap={20}
                        tick={CHART_AXIS_TICK}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={CHART_AXIS_TICK}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <RechartsTooltip
                        content={(tipProps) => (
                          <ChartTooltip
                            {...tipProps}
                            formatName={() => '預約筆數'}
                            formatValue={(v) => (finiteOrNull(v) === null ? '—' : `${v} 筆`)}
                          />
                        )}
                      />
                      <Line
                        type="monotone"
                        dataKey="reservationsCount"
                        name="預約筆數"
                        stroke={CHART_SERIES.primary}
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                        isAnimationActive
                        animationDuration={CHART_ANIM.duration}
                        animationEasing={CHART_ANIM.easing}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="col-12 col-lg-6">
                <ChartCard
                  title="預約列簽到率（依活動日期）"
                  description="每日已簽到預約列 ÷ 當日預約列"
                  plotHeight={320}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={attendanceChartData} margin={CHART_MARGIN.line}>
                      <ChartGrid vertical={false} />
                      <XAxis
                        dataKey="date"
                        minTickGap={20}
                        tick={CHART_AXIS_TICK}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={CHART_AXIS_TICK}
                        tickFormatter={(v) => `${v}%`}
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip
                        content={(tipProps) => (
                          <ChartTooltip
                            {...tipProps}
                            formatName={() => '預約列簽到率'}
                            formatValue={(v) => formatPct1(v)}
                          />
                        )}
                      />
                      <Line
                        type="monotone"
                        dataKey="attendanceRate"
                        name="預約列簽到率"
                        stroke={CHART_SERIES.success}
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                        isAnimationActive
                        animationDuration={CHART_ANIM.duration}
                        animationEasing={CHART_ANIM.easing}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </div>

            <div className="row g-3">
              <div className="col-12">
                <ChartCard
                  title="班級排行（Top 10，依預約列違規狀態比）"
                  description="比例越高越需要行政追蹤。這仍是班級內的預約列狀態比。"
                  plotHeight={340}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classChartData} margin={CHART_MARGIN.bar}>
                      <ChartGrid vertical={false} />
                      <XAxis
                        dataKey="classKey"
                        interval={0}
                        tick={CHART_AXIS_LABEL}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={CHART_AXIS_TICK}
                        tickFormatter={(v) => `${v}%`}
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip
                        cursor={CHART_CURSOR_FILL}
                        content={(tipProps) => (
                          <ChartTooltip
                            {...tipProps}
                            formatName={() => '預約列違規狀態比'}
                            formatValue={(v) => formatPct1(v)}
                          />
                        )}
                      />
                      <Bar
                        dataKey="violationRate"
                        name="預約列違規狀態比"
                        radius={[10, 10, 0, 0]}
                        maxBarSize={48}
                        isAnimationActive
                        animationDuration={CHART_ANIM.duration}
                        animationEasing={CHART_ANIM.easing}
                      >
                        {(classChartData || []).map((_, index) => (
                          <Cell
                            key={`class-bar-${index}`}
                            fill={CHART_SERIES.danger}
                            fillOpacity={Math.max(0.4, 1 - index * 0.07)}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
