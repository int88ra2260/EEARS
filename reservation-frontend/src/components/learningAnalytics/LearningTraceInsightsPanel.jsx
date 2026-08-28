import React, { useCallback, useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import {
  getRecommendationFunnelSummary,
  getTraceLjCorrelation,
} from '../../services/learningTraceApi';
import MetricCard from './MetricCard';
import LearningAnalyticsPanelHeader from './LearningAnalyticsPanelHeader';

function formatPct(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

export default function LearningTraceInsightsPanel({ token, ready = true }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [funnel, setFunnel] = useState(null);
  const [correlation, setCorrelation] = useState(null);

  const load = useCallback(async () => {
    if (!ready || !token) return;
    setLoading(true);
    setError('');
    try {
      const [funnelData, correlationData] = await Promise.all([
        getRecommendationFunnelSummary(token, { days: 30 }),
        getTraceLjCorrelation(token, { days: 90 }),
      ]);
      setFunnel(funnelData);
      setCorrelation(correlationData);
    } catch (e) {
      setFunnel(null);
      setCorrelation(null);
      setError(e.message || '載入軌跡洞察失敗');
    } finally {
      setLoading(false);
    }
  }, [ready, token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="la-panel mb-4">
      <LearningAnalyticsPanelHeader
        title="學習軌跡洞察"
        subtitle="推薦漏斗 × LJ 關聯分析（觀察性資料）"
      />

      {loading ? (
        <div className="d-flex align-items-center gap-2 text-muted py-3">
          <Spinner animation="border" size="sm" />
          載入洞察…
        </div>
      ) : null}

      {error ? <Alert variant="warning">{error}</Alert> : null}

      {!loading && !error && funnel ? (
        <>
          <Row className="g-3 mb-3">
            <Col md={3} sm={6}>
              <MetricCard label="推薦曝光" value={funnel.funnel?.impressions ?? 0} />
            </Col>
            <Col md={3} sm={6}>
              <MetricCard label="點擊" value={funnel.funnel?.clicks ?? 0} />
            </Col>
            <Col md={3} sm={6}>
              <MetricCard label="點擊率" value={formatPct(funnel.funnel?.clickThroughRate)} />
            </Col>
            <Col md={3} sm={6}>
              <MetricCard label="預約 CTA" value={funnel.funnel?.bookAttempts ?? 0} />
            </Col>
          </Row>

          {correlation?.sampleSize > 0 ? (
            <Row className="g-3">
              <Col md={4}>
                <MetricCard label="有學號微學習樣本" value={correlation.sampleSize} />
              </Col>
              <Col md={4}>
                <MetricCard
                  label="練習→活動預約率"
                  value={formatPct(correlation.rates?.practiceToReservation)}
                />
              </Col>
              <Col md={4}>
                <MetricCard
                  label="練習者 B2+ 比例"
                  value={formatPct(correlation.rates?.b2plusAmongPracticed)}
                />
              </Col>
            </Row>
          ) : (
            <Alert variant="light" className="border small mb-0">
              {correlation?.researchNote || '尚無足夠自願學號資料進行 LJ 關聯分析。'}
            </Alert>
          )}

          {(funnel.byActivity || []).length ? (
            <div className="mt-3 small">
              <div className="fw-semibold mb-2">各活動推薦漏斗</div>
              <ul className="list-unstyled mb-0">
                {funnel.byActivity.slice(0, 6).map((row) => (
                  <li key={row.activityKey} className="d-flex justify-content-between border-bottom py-1">
                    <span>{row.activityKey}</span>
                    <span>
                      曝光 {row.impressions} · 點擊 {row.clicks} · CTA {row.bookAttempts}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
