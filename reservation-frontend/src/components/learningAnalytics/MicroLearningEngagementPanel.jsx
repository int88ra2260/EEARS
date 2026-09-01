import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Col from 'react-bootstrap/Col';
import Nav from 'react-bootstrap/Nav';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getMicroLearningEngagement } from '../../services/learningTraceApi';
import MetricCard from './MetricCard';
import LearningAnalyticsPanelHeader from './LearningAnalyticsPanelHeader';

const GAME_TABS = [
  { id: 'all', label: '總覽' },
  { id: 'word_bridge', label: '語彙連橋' },
  { id: 'listening_ladder', label: '聽力字彙階梯' },
  { id: 'vocabulary_depth', label: '詞彙深度測驗' },
  { id: 'vocabulary_size', label: '詞彙量測驗' },
];

const GAME_LABELS = Object.fromEntries(GAME_TABS.map((t) => [t.id, t.label]));

function formatDuration(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return '—';
  const totalSec = Math.round(value / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min <= 0) return `${sec} 秒`;
  return `${min} 分 ${sec} 秒`;
}

export default function MicroLearningEngagementPanel({ token, ready = true }) {
  const [activeGameId, setActiveGameId] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async (gameId) => {
    if (!ready || !token) return;
    setLoading(true);
    setError('');
    try {
      const payload = await getMicroLearningEngagement(token, { gameId, days: 30 });
      setData(payload);
    } catch (e) {
      setData(null);
      setError(e.message || '載入微學習軌跡失敗');
    } finally {
      setLoading(false);
    }
  }, [ready, token]);

  useEffect(() => {
    load(activeGameId);
  }, [load, activeGameId]);

  const dailyChart = useMemo(
    () => (data?.dailySessions || []).map((row) => ({
      date: row.date.slice(5),
      sessions: row.sessions,
    })),
    [data],
  );

  const subtitle = activeGameId === 'all'
    ? '四項微學習遊戲完成場次總覽（匿名 session；觀察性資料）'
    : `${GAME_LABELS[activeGameId] || activeGameId} 遊玩歷程`;

  return (
    <section className="la-panel mb-4">
      <LearningAnalyticsPanelHeader
        title="微學習參與軌跡"
        subtitle={subtitle}
      />

      <Nav variant="tabs" className="mb-3 flex-nowrap overflow-auto">
        {GAME_TABS.map((tab) => (
          <Nav.Item key={tab.id}>
            <Nav.Link
              active={activeGameId === tab.id}
              onClick={() => setActiveGameId(tab.id)}
              eventKey={tab.id}
            >
              {tab.label}
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>

      {loading ? (
        <div className="d-flex align-items-center gap-2 text-muted py-3">
          <Spinner animation="border" size="sm" />
          載入微學習軌跡…
        </div>
      ) : null}

      {error ? <Alert variant="warning">{error}</Alert> : null}

      {!loading && !error && data ? (
        <>
          <Row className="g-3 mb-3">
            <Col md={3} sm={6}>
              <MetricCard label="完成場次" value={data.totals?.completedSessions ?? 0} />
            </Col>
            <Col md={3} sm={6}>
              <MetricCard label="唯一 session" value={data.totals?.uniqueClientSessions ?? 0} />
            </Col>
            <Col md={3} sm={6}>
              <MetricCard label="平均遊玩時間" value={formatDuration(data.totals?.avgDurationMs)} />
            </Col>
            <Col md={3} sm={6}>
              <MetricCard label="自願填學號" value={data.totals?.identifiedStudents ?? 0} />
            </Col>
          </Row>

          {activeGameId === 'all' && data.perGame?.length ? (
            <div className="la-chart-card mb-3">
              <h3 className="h6 mb-3">各遊戲完成場次</h3>
              <ul className="list-unstyled mb-0 small">
                {data.perGame.map((row) => (
                  <li key={row.gameId} className="d-flex justify-content-between py-1 border-bottom">
                    <span>{GAME_LABELS[row.gameId] || row.gameId}</span>
                    <strong>{row.completedSessions}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Row className="g-3">
            <Col lg={7}>
              <div className="la-chart-card h-100">
                <h3 className="h6 mb-3">近 30 日完成場次</h3>
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer>
                    <BarChart data={dailyChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="sessions" fill="#4f7cac" name="完成場次" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Col>
            <Col lg={5}>
              {activeGameId !== 'all' ? (
                <div className="la-chart-card h-100">
                  <h3 className="h6 mb-3">CEFR 估計分布</h3>
                  <ul className="list-unstyled mb-0 small">
                    {(data.cefrDistribution || []).map((row) => (
                      <li key={row.level} className="d-flex justify-content-between py-1 border-bottom">
                        <span>{row.level}</span>
                        <strong>{row.count}</strong>
                      </li>
                    ))}
                  </ul>
                  <h3 className="h6 mt-4 mb-2">結束原因</h3>
                  <ul className="list-unstyled mb-0 small">
                    {(data.endReasonDistribution || []).map((row) => (
                      <li key={row.reason} className="d-flex justify-content-between py-1 border-bottom">
                        <span>{row.reason}</span>
                        <strong>{row.count}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="la-chart-card h-100">
                  <h3 className="h6 mb-3">使用說明</h3>
                  <p className="small text-muted mb-0">
                    切換上方分頁可查看單一遊戲的 CEFR 分布、結束原因與錯誤統計。
                    總覽數字為各遊戲加總，未跨遊戲去重 session。
                  </p>
                </div>
              )}
            </Col>
          </Row>

          {data.researchNote ? (
            <p className="text-muted small mt-3 mb-0">{data.researchNote}</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
