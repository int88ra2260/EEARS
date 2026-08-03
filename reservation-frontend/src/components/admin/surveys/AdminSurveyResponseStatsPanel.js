import React, { useCallback, useEffect, useState } from 'react';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import { fetchSurveyResponsesStats } from '../../../services/surveyAdminApi';

const GRADE_ORDER = ['一年級', '二年級', '高年級(大三以上含碩博士)', '其他/未填寫'];

function GradeDistributionChart({ distribution, percentages, total }) {
  if (!total) {
    return <div className="text-muted small">尚無資料</div>;
  }
  return (
    <div className="d-flex flex-column gap-3">
      {GRADE_ORDER.map((label) => {
        const count = distribution?.[label] ?? 0;
        const pct = percentages?.[label] ?? 0;
        return (
          <div key={label}>
            <div className="d-flex justify-content-between small mb-1">
              <span>{label}</span>
              <span className="text-muted">
                {count} 人（{pct}%）
              </span>
            </div>
            <ProgressBar now={pct} label={`${pct}%`} variant={label === '其他/未填寫' ? 'secondary' : 'primary'} />
          </div>
        );
      })}
    </div>
  );
}

function StatsBlock({ block, showSurveyTitle }) {
  if (!block) return null;
  const { survey, totalResponses, gradeDistribution, gradeDistributionPercent, overallLikertAverage, questionStats, extras } = block;

  return (
    <div className="mb-4">
      {showSurveyTitle && survey?.title ? (
        <h5 className="text-primary mb-3">{survey.title}</h5>
      ) : null}
      <div className="row g-3 mb-3">
        <div className="col-md-3">
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="small text-muted">總回應數</div>
              <div className="display-6 fw-semibold text-primary">{totalResponses ?? 0}</div>
              {extras?.distinctStudents != null ? (
                <div className="small text-muted mt-1">不重複學號：{extras.distinctStudents}</div>
              ) : null}
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="small text-muted">李克特量表整體平均</div>
              <div className="display-6 fw-semibold">{overallLikertAverage ?? '—'}</div>
              <div className="small text-muted mt-1">尺度 1–5（各題平均再彙整）</div>
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="small text-muted">已填年級/年級欄位</div>
              <div className="h4 fw-semibold mb-0">{extras?.withGradeField ?? '—'}</div>
              <div className="small text-muted mt-1">佔回應數 {totalResponses ? Math.round(((extras?.withGradeField || 0) / totalResponses) * 100) : 0}%</div>
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="small text-muted">填答期間</div>
              {extras?.submittedAtRange ? (
                <div className="small">
                  <div>{new Date(extras.submittedAtRange.first).toLocaleDateString()}</div>
                  <div className="text-muted">至</div>
                  <div>{new Date(extras.submittedAtRange.last).toLocaleDateString()}</div>
                </div>
              ) : (
                <div className="text-muted">—</div>
              )}
            </Card.Body>
          </Card>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-lg-5">
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white fw-semibold">年級分布</Card.Header>
            <Card.Body>
              <GradeDistributionChart
                distribution={gradeDistribution}
                percentages={gradeDistributionPercent}
                total={totalResponses}
              />
              {extras?.yearDistribution && Object.keys(extras.yearDistribution).length > 0 ? (
                <div className="mt-3 pt-3 border-top">
                  <div className="small text-muted mb-2">English Club 原始年級選項分布</div>
                  <ul className="small mb-0 ps-3">
                    {Object.entries(extras.yearDistribution)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, v]) => (
                        <li key={k}>
                          {k}：{v}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </Card.Body>
          </Card>
        </div>
        <div className="col-lg-7">
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white fw-semibold">各題平均分數（李克特 1–5）</Card.Header>
            <Card.Body className="p-0">
              {!questionStats?.length ? (
                <div className="p-3 text-muted small">尚無量表題資料</div>
              ) : (
                <div className="table-responsive">
                  <Table size="sm" hover className="mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: 48 }}>#</th>
                        <th>題目</th>
                        <th style={{ width: 72 }} className="text-end">平均</th>
                        <th style={{ width: 72 }} className="text-end">填答數</th>
                        <th style={{ width: 88 }} className="text-end">分數區間</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questionStats.map((q, idx) => (
                        <tr key={q.questionId}>
                          <td className="text-muted">{idx + 1}</td>
                          <td className="small">{q.label}</td>
                          <td className="text-end fw-semibold">{q.average ?? '—'}</td>
                          <td className="text-end text-muted">{q.count}</td>
                          <td className="text-end text-muted small">
                            {q.min != null && q.max != null ? `${q.min}–${q.max}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </div>
      </div>

      {(extras?.topDepartments?.length > 0 || extras?.timesThisSemester) && (
        <div className="row g-3">
          {extras?.topDepartments?.length > 0 ? (
            <div className="col-md-6">
              <Card className="border-0 shadow-sm">
                <Card.Header className="bg-white fw-semibold">系所 Top 10</Card.Header>
                <Card.Body>
                  <Table size="sm" className="mb-0">
                    <tbody>
                      {extras.topDepartments.map((d, i) => (
                        <tr key={d.name}>
                          <td className="text-muted" style={{ width: 32 }}>{i + 1}</td>
                          <td>{d.name}</td>
                          <td className="text-end">{d.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </div>
          ) : null}
          {extras?.timesThisSemester ? (
            <div className="col-md-6">
              <Card className="border-0 shadow-sm">
                <Card.Header className="bg-white fw-semibold">本學期參與 ET 次數</Card.Header>
                <Card.Body>
                  {Object.entries(extras.timesThisSemester).map(([k, v]) => (
                    <div key={k} className="d-flex justify-content-between small mb-2">
                      <span>{k}</span>
                      <Badge bg="light" text="dark">{v}</Badge>
                    </div>
                  ))}
                </Card.Body>
              </Card>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function AdminSurveyResponseStatsPanel({ filters, token, reloadToken }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const q = new URLSearchParams(
        Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null))
      );
      const data = await fetchSurveyResponsesStats(token, q);
      setStats(data);
    } catch (e) {
      setError(e.message || '載入統計失敗');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [filters, token]);

  useEffect(() => {
    loadStats();
  }, [loadStats, reloadToken]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
        <div className="text-muted small mt-2">載入統計中…</div>
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  if (!stats?.totalResponses) {
    return (
      <Alert variant="info" className="mb-0">
        目前篩選條件下沒有填答資料。請調整學期或問卷後再查詢。
      </Alert>
    );
  }

  const showMultiple = stats.groups?.length > 1;

  return (
    <div>
      {showMultiple ? (
        <>
          <Card className="border-0 shadow-sm mb-4">
            <Card.Header className="bg-white fw-semibold">全部回應（合計）</Card.Header>
            <Card.Body>
              <div className="row g-3">
                <div className="col-md-4">
                  <div className="small text-muted">總回應數</div>
                  <div className="h3 fw-semibold text-primary mb-0">{stats.totalResponses}</div>
                </div>
                <div className="col-md-8">
                  <div className="small text-muted mb-2">年級分布（合計）</div>
                  <GradeDistributionChart
                    distribution={stats.gradeDistribution}
                    percentages={stats.gradeDistributionPercent}
                    total={stats.totalResponses}
                  />
                </div>
              </div>
            </Card.Body>
          </Card>
          {stats.groups.map((g) => (
            <StatsBlock key={g.survey?.id || g.survey?.surveyKey} block={g} showSurveyTitle />
          ))}
        </>
      ) : (
        <StatsBlock block={stats.primary || stats.groups?.[0]} showSurveyTitle={false} />
      )}
    </div>
  );
}
