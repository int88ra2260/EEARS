import React, { useCallback, useEffect, useMemo, useState, useId } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, Form, Spinner, Alert, OverlayTrigger, Tooltip, Button, Table } from 'react-bootstrap';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';

import dayjs from 'dayjs';
import { getCurrentSemester, SEMESTER_OPTIONS, SEMESTER_RANGES } from '../../utils/semesterUtils';
import {
  fetchAnalyticsClasses,
  fetchAnalyticsEvents,
  fetchAnalyticsOverview,
  fetchAnalyticsTrends,
  fetchReservationCapacityBreakdown,
  parseApiError,
} from '../../services/reportsAdminApi';

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const dt = dayjs(dateStr);
  if (!dt.isValid()) return String(dateStr);
  return dt.format('MM/DD');
}

function formatPct1(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return '—';
  return `${x.toFixed(1)}%`;
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
  const totalReservations = Number(row?.totalReservations ?? row?.reservedCount ?? row?.reservationsCount ?? 0);
  const totalEventCapacity = Number(row?.totalEventCapacity ?? row?.capacity ?? row?.maxCapacity ?? 0);
  const bookingRate = Number(row?.bookingRate ?? row?.utilizationRate ?? 0);
  return {
    eventType: String(eventType || '未分類'),
    totalReservations,
    totalEventCapacity,
    bookingRate,
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

function KpiCard({ title, value, suffix = '', hint }) {
  const tipId = useId();
  const titleNode = hint ? (
    <OverlayTrigger placement="top" overlay={<Tooltip id={tipId}>{hint}</Tooltip>}>
      <span className="text-muted small" style={{ cursor: 'help', borderBottom: '1px dotted #999' }}>
        {title}
      </span>
    </OverlayTrigger>
  ) : (
    <div className="text-muted small">{title}</div>
  );

  return (
    <div className="col-12 col-md-6 col-xl-4">
      <Card className="h-100">
        <Card.Body>
          {titleNode}
          <div className="fs-4 fw-semibold mt-1">
            {value}
            {suffix}
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const outlet = useOutletContext() || {};
  const token = outlet.token || localStorage.getItem('token');

  const [semester, setSemester] = useState(getCurrentSemester() || '114-1');

  const [coreLoading, setCoreLoading] = useState(false);
  const [coreError, setCoreError] = useState('');
  const [adminOverview, setAdminOverview] = useState(null);

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

  const refreshing = coreLoading || resLoading || chartsLoading;

  const load = useCallback(async () => {
    if (!token) return;
    const kind = 'reservation';

    setCoreLoading(true);
    setCoreError('');
    setAdminOverview(null);

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

    const coreP = (async () => {
      try {
        const json = await fetchAnalyticsOverview(token, semester);
        setAdminOverview(json || null);
      } catch (e) {
        setCoreError(e?.message || '載入失敗');
        setAdminOverview(null);
      } finally {
        setCoreLoading(false);
      }
    })();

    const resP = (async () => {
      try {
        const [json, breakdownFirst] = await Promise.all([
          fetchAnalyticsOverview(token, semester, { kind }),
          fetchReservationCapacityBreakdown(token, semester),
        ]);
        setReservationOverview(json || null);
        const overviewBreakdownData = normalizeCapacityBreakdownPayload(json);

        let bdRes = breakdownFirst.res;
        let bdJson = breakdownFirst.json;
        if (bdRes.ok && Object.keys(bdJson || {}).length === 0) {
          const retry = await fetchReservationCapacityBreakdown(token, semester, { retry: true });
          bdRes = retry.res;
          bdJson = retry.json;
        }
        const bdData = normalizeCapacityBreakdownPayload(bdJson) || overviewBreakdownData;
        if (process.env.NODE_ENV === 'development') {
          const keys = bdJson && typeof bdJson === 'object' && !Array.isArray(bdJson) ? Object.keys(bdJson) : [];
          console.debug('[EEARS Analytics] reservation-capacity-breakdown response', {
            status: bdRes.status,
            keys,
            normalizedItemCount: bdData?.byEventType?.length || 0,
            semester: bdData?.semester || semester,
          });
        }
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
        setResError(e?.message || '載入失敗');
        setReservationOverview(null);
        setCapacityBreakdown({ byEventType: [], byEvent: [] });
        setCapacityBreakdownError('');
      } finally {
        setResLoading(false);
      }
    })();

    const chartsP = (async () => {
      try {
        const [trendsJson, eventsJson, classesJson] = await Promise.all([
          fetchAnalyticsTrends(token, semester, kind),
          fetchAnalyticsEvents(token, semester),
          fetchAnalyticsClasses(token, semester),
        ]);

        setActivityTrend(trendsJson?.activityTrend || []);
        setAttendanceTrend(eventsJson?.attendanceTrend || []);
        setClassRankings(classesJson?.rankings || []);
      } catch (e) {
        setChartsError(e?.message || '圖表資料載入失敗');
        setActivityTrend([]);
        setAttendanceTrend([]);
        setClassRankings([]);
      } finally {
        setChartsLoading(false);
      }
    })();

    await Promise.all([coreP, resP, chartsP]);
  }, [token, semester]);

  useEffect(() => {
    load();
  }, [load]);

  const lj = adminOverview?.learningJourneyCoreKpi || null;

  const semesterRangeLabel = useMemo(() => {
    const r = SEMESTER_RANGES[semester];
    if (!r) return String(semester || '');
    return `${semester}（${r.start}～${r.end}）`;
  }, [semester]);

  const reservationKpis = useMemo(() => {
    if (!reservationOverview) {
      return {
        totalReservations: 0,
        bookingRate: 0,
        attendanceRate: 0,
        violationRate: 0,
        englishPassRate: 0,
      };
    }
    return {
      totalReservations: Number(reservationOverview.totalReservations || 0),
      bookingRate: Number(reservationOverview.bookingRate || 0),
      attendanceRate: Number(reservationOverview.attendanceRate || 0),
      violationRate: Number(reservationOverview.violationRate || 0),
      englishPassRate: Number(reservationOverview.englishPassRate || 0),
    };
  }, [reservationOverview]);

  const activityChartData = useMemo(() => {
    return (activityTrend || []).map((p) => ({
      date: formatDateLabel(p.date),
      reservationsCount: Number(p.reservationsCount || 0),
      rawDate: p.date,
    }));
  }, [activityTrend]);

  const attendanceChartData = useMemo(() => {
    return (attendanceTrend || []).map((p) => ({
      date: formatDateLabel(p.date),
      attendanceRate: Number(p.attendanceRate || 0),
      rawDate: p.date,
    }));
  }, [attendanceTrend]);

  const classChartData = useMemo(() => {
    return (classRankings || []).map((c) => ({
      classKey: c.className ? c.className : `Class ${c.classId}`,
      classId: c.classId,
      violationRate: Number(c.violationRate || 0),
      attendanceRate: Number(c.attendanceRate || 0),
      reservationsCount: Number(c.reservationsCount || 0),
    }));
  }, [classRankings]);

  const ljEmptyRoster =
    !coreLoading &&
    !coreError &&
    lj &&
    Number(lj.rosterActiveStudentCount || 0) === 0;

  const ljNoValidScores =
    !coreLoading &&
    !coreError &&
    lj &&
    Number(lj.rosterActiveStudentCount || 0) > 0 &&
    Number(lj.validBestScoreStudentCount || 0) === 0;

  const reservationAllZero =
    !resLoading &&
    !resError &&
    reservationOverview &&
    Number(reservationKpis.totalReservations || 0) === 0 &&
    Number(reservationKpis.bookingRate || 0) === 0 &&
    Number(reservationKpis.attendanceRate || 0) === 0 &&
    Number(reservationKpis.violationRate || 0) === 0 &&
    Number(reservationKpis.englishPassRate || 0) === 0;

  const chartsNoData =
    !chartsLoading &&
    !chartsError &&
    (activityChartData || []).every((p) => Number(p.reservationsCount || 0) === 0) &&
    (attendanceChartData || []).length === 0 &&
    (classChartData || []).length === 0;

  return (
    <div className="container-fluid px-2 px-md-3">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
        <h1 className="h5 mb-0 text-primary">行政總覽</h1>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <Form.Group className="mb-0">
            <Form.Label className="small text-muted me-2 mb-0">學期</Form.Label>
            <Form.Select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              style={{ width: 180, display: 'inline-block' }}
              disabled={refreshing}
            >
              {SEMESTER_OPTIONS.filter((o) => o.value).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Button variant="outline-primary" size="sm" onClick={() => load()} disabled={refreshing || !token}>
            {refreshing ? '更新中…' : '重新整理'}
          </Button>
        </div>
      </div>
      <p className="text-muted small mb-3">
        本頁彙整<strong>學習歷程核心指標</strong>（英語學習歷程名冊與 et 成績口徑）與<strong>活動預約營運概況</strong>（活動預約／名額利用率／簽到／違規）；兩者分開呈現，請勿混為同一種達標定義。
      </p>

      {/* 區塊一：學習歷程核心 KPI */}
      <Card className="mb-4 border-primary">
        <Card.Header className="fw-semibold bg-primary-subtle">學習歷程核心 KPI</Card.Header>
        <Card.Body>
          {coreLoading && (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" className="me-2" />
              載入中…
            </div>
          )}
          {coreError && !coreLoading && <Alert variant="danger">{coreError}</Alert>}
          {!coreLoading && !coreError && adminOverview && !lj && (
            <Alert variant="secondary" className="mb-0">
              後端未回傳 learningJourneyCoreKpi（可能為舊版快取）；請稍候重試或聯絡管理員更新服務。
            </Alert>
          )}
          {!coreLoading && !coreError && lj && (
            <>
              {ljEmptyRoster && (
                <Alert variant="warning" className="py-2 small mb-3">
                  <strong>尚未建立本學期追蹤名冊：</strong>目前英語學習歷程 active roster 人數為 0。若已匯入名冊，請確認學期代碼一致。
                </Alert>
              )}
              {ljNoValidScores && (
                <Alert variant="info" className="py-2 small mb-3">
                  <strong>已有追蹤名冊，但尚未匯入可判讀 CEFR 的成績：</strong>名冊內尚無有效 best skill（cefrRank≥1）資料。
                </Alert>
              )}
              <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                <span className="badge bg-secondary text-uppercase">{lj.dataStatus || '—'}</span>
                {lj.generatedAt && (
                  <span className="text-muted small">
                    指標計算時間（generatedAt）：{dayjs(lj.generatedAt).format('YYYY-MM-DD HH:mm')}
                  </span>
                )}
                <span className="text-muted small">
                  資料更新時間（updatedAt）：
                  {lj.updatedAt ? dayjs(lj.updatedAt).format('YYYY-MM-DD HH:mm') : '尚未接資料治理時間戳'}
                </span>
              </div>
              {lj.dataStatusNote && (
                <Alert
                  variant={lj.dataStatus === 'unavailable' ? 'danger' : lj.rosterActiveStudentCount > 0 ? 'info' : 'warning'}
                  className="py-2 small"
                >
                  {lj.dataStatusNote}
                </Alert>
              )}
              <div className="row g-3">
                <KpiCard
                  title="追蹤學生數"
                  value={lj.rosterActiveStudentCount != null ? lj.rosterActiveStudentCount : '—'}
                  hint="本學期英語學習歷程 active 名冊（EtEnrollmentSnapshot isActive=true）之 DISTINCT 學號人數。"
                />
                <KpiCard
                  title="有效成績學生數"
                  value={lj.validBestScoreStudentCount != null ? lj.validBestScoreStudentCount : '—'}
                  hint="名冊內至少一項歷史最佳技能可判讀（cefrRank ≥ 1，來自 et_exam_attempts 有效成績）之學生人數。"
                />
                <KpiCard
                  title="已達標學生數"
                  value={lj.attainedStudentCount != null ? lj.attainedStudentCount : '—'}
                  hint="名冊內至少一項歷史最佳技能達 B2+（cefrRank ≥ 4，與學習歷程 B2 報表口徑一致）之學生人數。"
                />
                <KpiCard
                  title="達標率（LJ canonical）"
                  value={lj.attainmentRate != null ? formatPct1(lj.attainmentRate) : '—'}
                  hint="已達標學生數 ÷ 追蹤學生數；僅學習歷程口徑。非活動預約、非 english_test_registrations.hasCEFRB2。"
                />
                <KpiCard
                  title="高風險學生數（名冊內）"
                  value={lj.highRiskStudentCount != null ? lj.highRiskStudentCount : '—'}
                  hint="僅計算本學期追蹤名冊內學生，沿用風險模組規則（與「高風險預警」頁之規則一致，但母體為名冊交集）。"
                />
              </div>
              {lj.highRiskNote && <p className="text-muted small mt-2 mb-0">{lj.highRiskNote}</p>}
              <Form.Text className="text-muted d-block mt-2">
                母體：本學期英語學習歷程 active roster。有效成績：至少一項可判讀 best skill（cefrRank≥1）。達標：至少一項最佳技能達
                B2+（cefrRank≥4）。<strong>指標計算時間（generatedAt）</strong>為本次後端計算時間，<strong>不等於</strong>資料匯入或 ETL
                完成時間。<strong>資料更新時間（updatedAt）</strong>若為「尚未接資料治理時間戳」，表示尚未寫入治理事件表。
              </Form.Text>
            </>
          )}
        </Card.Body>
      </Card>

      {/* 區塊二：活動預約營運概況 */}
      <Card className="mb-4">
        <Card.Header className="fw-semibold">活動預約營運概況</Card.Header>
        <Card.Body>
          <p className="text-muted small mb-3">
            本區統計<strong>活動預約、名額利用率、簽到與違規</strong>資料（與學習歷程達標無直接對應）。下方「Legacy 報名資料 B2 標記比例」來自
            <code>english_test_registrations.hasCEFRB2</code>，屬舊報名欄位營運指標，<strong>不得</strong>稱為達標率，亦<strong>非</strong>
            Learning Journey canonical 達標率。
          </p>
          {resLoading && (
            <div className="text-center py-3">
              <Spinner animation="border" size="sm" className="me-2" />
              載入中…
            </div>
          )}
          {resError && !resLoading && <Alert variant="danger">{resError}</Alert>}
          {!resLoading && !resError && reservationAllZero && (
            <Alert variant="secondary" className="py-2 small mb-3">
              本學期尚無活動預約紀錄（或所選區間內預約、預約率、簽到、違規與 Legacy B2 標記皆為 0）。
            </Alert>
          )}
          {!resLoading && !resError && (
            <div className="row g-3 mb-0">
              <KpiCard title="總預約數" value={reservationKpis.totalReservations} hint="本學期日期區間內之活動預約筆數。" />
              <KpiCard
                title="預約率"
                value={formatPct1(reservationKpis.bookingRate)}
                hint="總預約數 ÷ 本學期日期區間內各活動 maxCapacity 加總（可開放名額總數）；反映名額被預約之比例。"
              />
              <KpiCard
                title="簽到出席率（預約）"
                value={formatPct1(reservationKpis.attendanceRate)}
                hint="已簽到 ÷ 總預約（依活動日期篩選之學期區間）。"
              />
              <KpiCard
                title="違規率（預約）"
                value={formatPct1(reservationKpis.violationRate)}
                hint="已登記違規 ÷ 總預約。"
              />
              <KpiCard
                title="Legacy 報名資料 B2 標記比例"
                value={formatPct1(reservationKpis.englishPassRate)}
                hint="API 欄位仍為 englishPassRate：english_test_registrations 本學期 hasCEFRB2 為肯定值之比例。與上方 LJ canonical 達標率無關。"
              />
            </div>
          )}
          {!resLoading && !resError && (
            <>
              <hr className="my-4" />
              <h6 className="fw-semibold mb-2">名額利用率（分項）</h6>
              <p className="text-muted small mb-3">
                與上方整體「預約率」相同口徑：已預約筆數 ÷ 可開放名額（<code>events.maxCapacity</code>
                ）。下表依<strong>活動類型</strong>彙總，以及<strong>各場次</strong>逐筆列出；篩選條件為目前所選學期之日期區間：
                <strong>{semesterRangeLabel}</strong>（後端以活動日 <code>CAST(TRIM(events.date) AS DATE)</code> 比對）。
              </p>
              {capacityBreakdownError && (
                <Alert variant="warning" className="py-2 small mb-3">
                  名額利用率分項載入失敗：{capacityBreakdownError}
                </Alert>
              )}
              {capacityBreakdown.byEventType.length === 0 && capacityBreakdown.byEvent.length === 0 && !capacityBreakdownError && (
                <Alert variant="secondary" className="py-2 small mb-0">
                  於<strong>{semesterRangeLabel}</strong>
                  內查無活動資料，故無法分項統計。若實際已有活動，請確認活動日期是否落在此區間，或活動日欄位是否為可解析之日期（建議
                  YYYY-MM-DD）。
                </Alert>
              )}
              {capacityBreakdown.byEventType.length > 0 && (
                <div className="mb-4">
                  <div className="text-muted small mb-2">依活動類型</div>
                  <div className="table-responsive">
                    <Table striped bordered hover size="sm" className="mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>活動類型</th>
                          <th className="text-end">可開放名額</th>
                          <th className="text-end">已預約筆數</th>
                          <th className="text-end">名額利用率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {capacityBreakdown.byEventType.map((row) => (
                          <tr key={row.eventType}>
                            <td>{row.eventType}</td>
                            <td className="text-end">{row.totalEventCapacity}</td>
                            <td className="text-end">{row.totalReservations}</td>
                            <td className="text-end">{formatPct1(row.bookingRate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              )}
              {capacityBreakdown.byEvent.length > 0 && (
                <div>
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
                          <th className="text-end">預約率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {capacityBreakdown.byEvent.map((row) => (
                          <tr key={row.eventId}>
                            <td>{formatDateLabel(row.eventDate)}</td>
                            <td>{row.eventName}</td>
                            <td>{row.eventType}</td>
                            <td className="text-end">{row.maxCapacity}</td>
                            <td className="text-end">{row.totalReservations}</td>
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
        </Card.Body>
      </Card>

      {/* 圖表（預約營運） */}
      <Card className="mb-4">
        <Card.Header className="fw-semibold">活動趨勢與班級排行（預約營運）</Card.Header>
        <Card.Body>
          {chartsLoading && (
            <div className="text-center py-3">
              <Spinner animation="border" size="sm" />
            </div>
          )}
          {chartsError && !chartsLoading && <Alert variant="danger">{chartsError}</Alert>}
          {!chartsLoading && !chartsError && chartsNoData && (
            <Alert variant="secondary" className="mb-0 small">
              尚無足夠資料產生圖表（活動趨勢、出席趨勢或班級排行皆為空）。
            </Alert>
          )}
          {!chartsLoading && !chartsError && !chartsNoData && (
            <>
              <div className="row g-3 mb-3">
                <div className="col-12 col-lg-6">
                  <Card className="h-100">
                    <Card.Header className="small">活動趨勢（依活動日期）</Card.Header>
                    <Card.Body style={{ height: 320 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={activityChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" minTickGap={20} />
                          <YAxis />
                          <RechartsTooltip formatter={(v) => [`${v} 筆`, '預約數']} labelFormatter={() => ''} />
                          <Line type="monotone" dataKey="reservationsCount" stroke="#0d6efd" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </Card.Body>
                  </Card>
                </div>

                <div className="col-12 col-lg-6">
                  <Card className="h-100">
                    <Card.Header className="small">出席率（依活動日期）</Card.Header>
                    <Card.Body style={{ height: 320 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={attendanceChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" minTickGap={20} />
                          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                          <RechartsTooltip formatter={(v) => [`${formatPct1(v)}`, '出席率']} labelFormatter={() => ''} />
                          <Line type="monotone" dataKey="attendanceRate" stroke="#198754" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </Card.Body>
                  </Card>
                </div>
              </div>

              <div className="row g-3">
                <div className="col-12">
                  <Card className="h-100">
                    <Card.Header className="small">班級排行（Top 10，依違規率由高到低）</Card.Header>
                    <Card.Body style={{ height: 340 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={classChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="classKey" interval={0} tick={{ fontSize: 12 }} />
                          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                          <RechartsTooltip
                            formatter={(v, name) => {
                              const label = name === 'violationRate' ? '違規率' : name;
                              return [`${formatPct1(v)}`, label];
                            }}
                          />
                          <Bar dataKey="violationRate" fill="#dc3545" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card.Body>
                  </Card>
                </div>
              </div>
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
