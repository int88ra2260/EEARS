import React, { useCallback, useEffect, useState } from 'react';
import { Card, Spinner, Alert, Badge, ProgressBar, ListGroup, Accordion } from 'react-bootstrap';
import { fetchLearningRiskPrediction } from '../../../services/reportsAdminApi';
import './LearningRiskPredictionPanel.css';

const RISK_LEVEL_CONFIG = {
  high: { variant: 'danger', label: '高風險', icon: '⚠️' },
  medium: { variant: 'warning', label: '中風險', icon: '⚡' },
  low: { variant: 'success', label: '低風險', icon: '✓' },
};

const CONFIDENCE_CONFIG = {
  high: { variant: 'success', label: '高' },
  medium: { variant: 'warning', label: '中' },
  low: { variant: 'secondary', label: '低' },
};

const TREND_CONFIG = {
  improving: { icon: '📈', label: '提升中', variant: 'success' },
  stable: { icon: '➡️', label: '穩定', variant: 'secondary' },
  declining: { icon: '📉', label: '下降中', variant: 'warning' },
  unknown: { icon: '❓', label: '資料不足', variant: 'light' },
};

function RiskLevelBadge({ level }) {
  const config = RISK_LEVEL_CONFIG[level] || RISK_LEVEL_CONFIG.low;
  return (
    <Badge bg={config.variant} className="risk-level-badge">
      <span className="risk-level-icon">{config.icon}</span>
      <span>{config.label}</span>
    </Badge>
  );
}

function ConfidenceBadge({ level, value }) {
  const config = CONFIDENCE_CONFIG[level] || CONFIDENCE_CONFIG.low;
  const percentage = value != null ? Math.round(value * 100) : 0;
  return (
    <span className="confidence-badge">
      <Badge bg={config.variant} className="me-1">{config.label}信心度</Badge>
      <small className="text-muted">{percentage}%</small>
    </span>
  );
}

function TrendIndicator({ trend }) {
  const config = TREND_CONFIG[trend] || TREND_CONFIG.unknown;
  return (
    <Badge bg={config.variant} className="trend-badge">
      <span className="trend-icon">{config.icon}</span>
      <span>{config.label}</span>
    </Badge>
  );
}

function RiskFactorsList({ factors }) {
  if (!factors || factors.length === 0) {
    return <p className="text-muted small mb-0">目前無顯著風險因子</p>;
  }

  return (
    <ListGroup variant="flush" className="risk-factors-list">
      {factors.map((factor, idx) => (
        <ListGroup.Item key={`${factor.key}-${idx}`} className="risk-factor-item">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <strong>{factor.label}</strong>
              <p className="small text-muted mb-0">{factor.description}</p>
            </div>
            <Badge bg="secondary" className="contribution-badge">
              +{factor.contribution.toFixed(1)}
            </Badge>
          </div>
        </ListGroup.Item>
      ))}
    </ListGroup>
  );
}

function MicroLearningInsights({ data }) {
  if (!data) return null;

  const { totalSessions, recentSessions, avgAccuracy, trend, lastSessionDaysAgo, gameBreakdown } = data;

  return (
    <div className="micro-learning-insights">
      <h6 className="insights-title">微學習洞察</h6>
      <div className="insights-grid">
        <div className="insight-item">
          <span className="insight-value">{totalSessions}</span>
          <span className="insight-label">總練習次數</span>
        </div>
        <div className="insight-item">
          <span className="insight-value">{recentSessions}</span>
          <span className="insight-label">近 30 天練習</span>
        </div>
        <div className="insight-item">
          <span className="insight-value">
            {avgAccuracy != null ? `${Math.round(avgAccuracy * 100)}%` : '—'}
          </span>
          <span className="insight-label">平均正確率</span>
        </div>
        <div className="insight-item">
          <span className="insight-value">
            {lastSessionDaysAgo != null ? `${lastSessionDaysAgo} 天` : '—'}
          </span>
          <span className="insight-label">距上次練習</span>
        </div>
      </div>
      <div className="d-flex align-items-center gap-2 mt-2">
        <span className="small text-muted">表現趨勢：</span>
        <TrendIndicator trend={trend} />
      </div>
      {gameBreakdown && Object.keys(gameBreakdown).length > 0 && (
        <div className="game-breakdown mt-3">
          <small className="text-muted d-block mb-2">各遊戲練習次數：</small>
          <div className="game-breakdown-grid">
            {Object.entries(gameBreakdown).map(([gameId, stats]) => (
              <div key={gameId} className="game-stat">
                <Badge bg="light" text="dark" className="game-badge">
                  {gameId.replace('_', ' ')}
                </Badge>
                <span className="game-count">{stats.count} 次</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ParticipationInsights({ data }) {
  if (!data) return null;

  const { totalReservations, attendanceRate, noShowRate, violationCount } = data;

  return (
    <div className="participation-insights">
      <h6 className="insights-title">活動參與洞察</h6>
      <div className="insights-grid">
        <div className="insight-item">
          <span className="insight-value">{totalReservations}</span>
          <span className="insight-label">預約次數</span>
        </div>
        <div className="insight-item">
          <span className="insight-value">
            {attendanceRate != null ? `${attendanceRate}%` : '—'}
          </span>
          <span className="insight-label">出席率</span>
        </div>
        <div className="insight-item">
          <span className="insight-value text-warning">
            {noShowRate != null ? `${noShowRate}%` : '—'}
          </span>
          <span className="insight-label">缺席率</span>
        </div>
        <div className="insight-item">
          <span className={`insight-value ${violationCount > 0 ? 'text-danger' : ''}`}>
            {violationCount}
          </span>
          <span className="insight-label">違規次數</span>
        </div>
      </div>
    </div>
  );
}

function SuggestionsList({ suggestions }) {
  if (!suggestions || suggestions.length === 0) return null;

  const priorityConfig = {
    high: { bg: 'danger', label: '重要' },
    medium: { bg: 'warning', label: '建議' },
    low: { bg: 'info', label: '參考' },
  };

  return (
    <div className="suggestions-section mt-3">
      <h6 className="suggestions-title">建議行動</h6>
      <ListGroup variant="flush">
        {suggestions.map((suggestion, idx) => {
          const config = priorityConfig[suggestion.priority] || priorityConfig.medium;
          return (
            <ListGroup.Item key={idx} className="suggestion-item">
              <Badge bg={config.bg} className="me-2">{config.label}</Badge>
              <strong>{suggestion.action}</strong>
              <p className="small text-muted mb-0 mt-1">{suggestion.detail}</p>
            </ListGroup.Item>
          );
        })}
      </ListGroup>
    </div>
  );
}

export default function LearningRiskPredictionPanel({ studentId, semester, token }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [prediction, setPrediction] = useState(null);

  const load = useCallback(async () => {
    if (!token || !studentId || !semester) return;
    setLoading(true);
    setError('');
    try {
      const result = await fetchLearningRiskPrediction(token, studentId, semester);
      setPrediction(result.data || null);
    } catch (err) {
      setError(err.message || '載入失敗');
      setPrediction(null);
    } finally {
      setLoading(false);
    }
  }, [token, studentId, semester]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Card className="learning-risk-panel">
        <Card.Body className="text-center py-4">
          <Spinner animation="border" size="sm" className="me-2" />
          <span className="text-muted">分析學習風險中…</span>
        </Card.Body>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="learning-risk-panel">
        <Card.Body>
          <Alert variant="warning" className="mb-0 small">
            {error}
          </Alert>
        </Card.Body>
      </Card>
    );
  }

  if (!prediction) {
    return (
      <Card className="learning-risk-panel">
        <Card.Body>
          <p className="text-muted mb-0">無法取得風險預測資料</p>
        </Card.Body>
      </Card>
    );
  }

  const { currentRisk, prediction: pred, insights, suggestions } = prediction;

  return (
    <Card className="learning-risk-panel">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span className="fw-semibold">學習風險預測</span>
        <small className="text-muted">學期：{semester}</small>
      </Card.Header>
      <Card.Body>
        <div className="risk-summary-row">
          <div className="risk-summary-item">
            <span className="risk-summary-label">預測風險等級</span>
            <RiskLevelBadge level={pred?.riskLevel || 'low'} />
          </div>
          <div className="risk-summary-item">
            <span className="risk-summary-label">風險分數</span>
            <span className="risk-score">{pred?.riskScore?.toFixed(1) || '0.0'}</span>
          </div>
          <div className="risk-summary-item">
            <span className="risk-summary-label">預測信心</span>
            <ConfidenceBadge
              level={pred?.confidenceLevel || 'low'}
              value={pred?.confidence}
            />
          </div>
        </div>

        {currentRisk && (
          <div className="current-risk-note mt-3 p-2 bg-light rounded">
            <small className="text-muted">
              目前規則式風險等級：
              <Badge
                bg={RISK_LEVEL_CONFIG[currentRisk.level]?.variant || 'secondary'}
                className="ms-1"
              >
                {RISK_LEVEL_CONFIG[currentRisk.level]?.label || currentRisk.level}
              </Badge>
              <span className="ms-2">分數：{currentRisk.score}</span>
            </small>
          </div>
        )}

        <Accordion className="mt-3" defaultActiveKey="0">
          <Accordion.Item eventKey="0">
            <Accordion.Header>風險因子分析</Accordion.Header>
            <Accordion.Body>
              <RiskFactorsList factors={pred?.factors} />
            </Accordion.Body>
          </Accordion.Item>
          
          <Accordion.Item eventKey="1">
            <Accordion.Header>微學習數據</Accordion.Header>
            <Accordion.Body>
              <MicroLearningInsights data={insights?.microLearning} />
            </Accordion.Body>
          </Accordion.Item>
          
          <Accordion.Item eventKey="2">
            <Accordion.Header>活動參與</Accordion.Header>
            <Accordion.Body>
              <ParticipationInsights data={insights?.participation} />
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>

        <SuggestionsList suggestions={suggestions} />

        <div className="text-end mt-3">
          <small className="text-muted">
            更新時間：{prediction.generatedAt ? new Date(prediction.generatedAt).toLocaleString('zh-TW') : '—'}
          </small>
        </div>
      </Card.Body>
    </Card>
  );
}
