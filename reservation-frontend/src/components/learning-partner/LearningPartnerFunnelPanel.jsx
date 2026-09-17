import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Card, Col, Form, ProgressBar, Row, Spinner, Table } from 'react-bootstrap';
import { getDefaultLearningPartnerOpsSemester, SEMESTER_OPTIONS } from '../../utils/semesterUtils';
import { TEAM_STATUS_MAP } from '../../utils/learningPartnerDisplayHelpers';
import {
  fetchLearningPartnerFunnel,
  fetchLearningPartnerOutcome,
} from '../../services/learningPartnerAdminApi';

const FUNNEL_SEMESTER_OPTIONS = SEMESTER_OPTIONS.filter((opt) => opt.value !== '');

const MEMBER_STATUS_MAP = {
  pending: { text: '待同意', color: 'warning' },
  approved: { text: '已同意', color: 'success' },
  expired: { text: '已失效', color: 'danger' },
};

const SKILL_LABELS = {
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
};

function formatPct(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(1)}%`;
}

function formatHours(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(1)} 小時`;
}

function formatScore(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(2);
}

function formatSigned(value, { suffix = '', digits = 2 } = {}) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}${suffix}`;
}

function MetricTile({ label, value, hint }) {
  return (
    <Card className="h-100 border-0 bg-light">
      <Card.Body className="py-3">
        <div className="text-muted small mb-1">{label}</div>
        <div className="fs-4 fw-semibold mb-0">{value}</div>
        {hint ? <div className="small text-muted mt-1">{hint}</div> : null}
      </Card.Body>
    </Card>
  );
}

function StatusBars({ title, counts, labels }) {
  const total = Object.values(counts || {}).reduce((sum, n) => sum + Number(n || 0), 0);
  const entries = Object.keys(labels);

  return (
    <Card className="h-100">
      <Card.Body>
        <div className="fw-semibold mb-3">{title}</div>
        {total === 0 ? (
          <div className="text-muted small">尚無資料</div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {entries.map((key) => {
              const count = Number(counts?.[key] || 0);
              const pct = total ? (count / total) * 100 : 0;
              const meta = labels[key];
              return (
                <div key={key}>
                  <div className="d-flex justify-content-between small mb-1">
                    <span>
                      <Badge bg={meta.color} className="me-2">{meta.text}</Badge>
                      {count} 筆
                    </span>
                    <span className="text-muted">{pct.toFixed(1)}%</span>
                  </div>
                  <ProgressBar now={pct} variant={meta.color} style={{ height: 8 }} />
                </div>
              );
            })}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

function OutcomeComparisonSection({ outcome }) {
  if (!outcome) return null;

  const partner = outcome.partner || {};
  const nonPartner = outcome.nonPartner || {};
  const delta = outcome.delta || {};
  const coverage = outcome.coverage || {};

  return (
    <div className="mt-4 pt-4 border-top">
      <h5 className="mb-1">該次考試表現對照</h5>
      <p className="text-muted small mb-3">
        比較有參加學習有伴與未參加者在同學期 BESTEP 成績的差距。
      </p>

      <Alert variant="light" className="border small mb-3">
        <div><strong>有參加：</strong>{outcome.definition?.partner}</div>
        <div><strong>沒參加：</strong>{outcome.definition?.nonPartner}</div>
        <div className="mt-1 text-muted">{outcome.definition?.caveat}</div>
      </Alert>

      <Row className="g-3 mb-3">
        <Col md={3} sm={6}>
          <MetricTile
            label="有伴成員"
            value={coverage.partnerMemberCount ?? 0}
            hint={`有成績 ${coverage.partnerWithScoreCount ?? 0}｜缺成績 ${coverage.partnerWithoutScoreCount ?? 0}`}
          />
        </Col>
        <Col md={3} sm={6}>
          <MetricTile
            label="無伴（有成績）"
            value={coverage.nonPartnerWithScoreCount ?? 0}
            hint={`成績總筆數 ${coverage.examScoreTotal ?? 0}`}
          />
        </Col>
        <Col md={3} sm={6}>
          <MetricTile
            label="平均總分差距"
            value={formatSigned(delta.avgTotalScore)}
            hint="有伴 − 無伴"
          />
        </Col>
        <Col md={3} sm={6}>
          <MetricTile
            label="達標率差距"
            value={formatSigned(delta.passRatePctPoints, { suffix: ' pt', digits: 1 })}
            hint="各項皆達 B2 以上"
          />
        </Col>
      </Row>

      <Card>
        <Card.Body>
          <div className="fw-semibold mb-3">總分與達標率</div>
          <div className="table-responsive">
            <Table size="sm" bordered hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>指標</th>
                  <th>有參加</th>
                  <th>沒參加</th>
                  <th>差距（有伴 − 無伴）</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>有成績人數</td>
                  <td>{partner.withTotalScoreCount ?? partner.studentCount ?? 0}</td>
                  <td>{nonPartner.withTotalScoreCount ?? nonPartner.studentCount ?? 0}</td>
                  <td>—</td>
                </tr>
                <tr>
                  <td>平均總分</td>
                  <td>{formatScore(partner.avgTotalScore)}</td>
                  <td>{formatScore(nonPartner.avgTotalScore)}</td>
                  <td>{formatSigned(delta.avgTotalScore)}</td>
                </tr>
                <tr>
                  <td>中位數總分</td>
                  <td>{formatScore(partner.medianTotalScore)}</td>
                  <td>{formatScore(nonPartner.medianTotalScore)}</td>
                  <td>{formatSigned(delta.medianTotalScore)}</td>
                </tr>
                <tr>
                  <td>達標率</td>
                  <td>{formatPct(partner.passRatePct)}</td>
                  <td>{formatPct(nonPartner.passRatePct)}</td>
                  <td>{formatSigned(delta.passRatePctPoints, { suffix: ' pt', digits: 1 })}</td>
                </tr>
              </tbody>
            </Table>
          </div>

          <div className="fw-semibold mt-4 mb-3">分項平均分</div>
          <div className="table-responsive">
            <Table size="sm" bordered hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>分項</th>
                  <th>有參加平均</th>
                  <th>沒參加平均</th>
                  <th>差距</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(SKILL_LABELS).map((key) => (
                  <tr key={key}>
                    <td>{SKILL_LABELS[key]}</td>
                    <td>{formatScore(partner.skills?.[key]?.avg)}</td>
                    <td>{formatScore(nonPartner.skills?.[key]?.avg)}</td>
                    <td>{formatSigned(delta.skills?.[key]?.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}

export default function LearningPartnerFunnelPanel({
  token,
  semester,
  onSemesterChange,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [outcomeError, setOutcomeError] = useState('');

  const activeSemester = semester || getDefaultLearningPartnerOpsSemester() || '';

  const load = useCallback(async () => {
    if (!token || !activeSemester) {
      setData(null);
      setOutcome(null);
      setLoading(false);
      setError(activeSemester ? '' : '請選擇學期以查看該次考試營運成效');
      setOutcomeError('');
      return;
    }

    setLoading(true);
    setError('');
    setOutcomeError('');
    try {
      const [funnelPayload, outcomePayload] = await Promise.all([
        fetchLearningPartnerFunnel(token, activeSemester),
        fetchLearningPartnerOutcome(token, activeSemester).catch((e) => {
          const raw = e.message || e.data?.error || '';
          if (raw === 'API_NOT_FOUND' || e.status === 404) {
            setOutcomeError('成績對照 API 尚未載入，請確認後端已重啟後再重新整理。');
          } else {
            setOutcomeError(raw || '載入成績對照失敗');
          }
          return null;
        }),
      ]);
      setData(funnelPayload);
      setOutcome(outcomePayload);
    } catch (e) {
      setData(null);
      setOutcome(null);
      setError(e.message || '載入營運成效失敗');
    } finally {
      setLoading(false);
    }
  }, [token, activeSemester]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-3">
        <div>
          <h5 className="mb-1">團體報名營運成效</h5>
          <p className="text-muted small mb-0">
            選定學期（該次考試）的組隊漏斗，以及有伴／無伴的 BESTEP 成績對照。
          </p>
        </div>
        <Form.Select
          value={activeSemester}
          onChange={(e) => onSemesterChange?.(e.target.value)}
          style={{ minWidth: 160, maxWidth: 200 }}
          aria-label="選擇學期"
        >
          {FUNNEL_SEMESTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Form.Select>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {loading ? (
        <div className="text-center py-5 text-muted">
          <Spinner animation="border" size="sm" className="me-2" />
          載入營運成效中...
        </div>
      ) : null}

      {!loading && data ? (
        <>
          <Alert variant="light" className="border small mb-3">
            {data.scope?.note}
          </Alert>

          <Row className="g-3 mb-3">
            <Col md={3} sm={6}>
              <MetricTile label="組隊數" value={data.teams?.total ?? 0} hint={`成員 ${data.members?.total ?? 0} 人`} />
            </Col>
            <Col md={3} sm={6}>
              <MetricTile label="完成率" value={formatPct(data.teams?.approvalRatePct)} hint="狀態＝已完成" />
            </Col>
            <Col md={3} sm={6}>
              <MetricTile label="流失率" value={formatPct(data.teams?.dropOffRatePct)} hint="已失效＋已取消" />
            </Col>
            <Col md={3} sm={6}>
              <MetricTile
                label="平均完成時長"
                value={formatHours(data.timing?.avgHoursToFullApproval)}
                hint={`中位數 ${formatHours(data.timing?.medianHoursToFullApproval)}`}
              />
            </Col>
          </Row>

          <Row className="g-3 mb-3">
            <Col md={3} sm={6}>
              <MetricTile
                label="成員同意率"
                value={formatPct(data.members?.approvalRatePct)}
                hint="全體成員"
              />
            </Col>
            <Col md={3} sm={6}>
              <MetricTile
                label="受邀者同意率"
                value={formatPct(data.members?.inviteeApprovalRatePct)}
                hint="不含代表者"
              />
            </Col>
            <Col md={3} sm={6}>
              <MetricTile
                label="3 人隊／4 人隊"
                value={`${data.teams?.byTeamSize?.[3] ?? 0} / ${data.teams?.byTeamSize?.[4] ?? 0}`}
              />
            </Col>
            <Col md={3} sm={6}>
              <MetricTile
                label="名額佔用"
                value={`${data.quota?.occupiedActiveSeats ?? 0} / ${data.quota?.limit ?? 0}`}
                hint={`剩餘 ${data.quota?.remainingSeats ?? 0}（全站）`}
              />
            </Col>
          </Row>

          <Row className="g-3">
            <Col lg={6}>
              <StatusBars title="團體狀態分布" counts={data.teams?.byStatus} labels={TEAM_STATUS_MAP} />
            </Col>
            <Col lg={6}>
              <StatusBars title="成員同意狀態分布" counts={data.members?.byApprovalStatus} labels={MEMBER_STATUS_MAP} />
            </Col>
          </Row>

          {outcomeError ? <Alert variant="warning" className="mt-4">{outcomeError}</Alert> : null}
          <OutcomeComparisonSection outcome={outcome} />
        </>
      ) : null}
    </div>
  );
}
