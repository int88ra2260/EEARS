import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import useToast from '../../components/ui/useToast';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { P } from '../../constants/permissions';
import {
  downloadBlob,
  exportSurveyAnalyticsXlsx,
  fetchSurveyAnalyticsBundle,
  fetchSurveyCenterOptions,
} from '../../services/surveyAdminApi';

const SENTIMENT_COLORS = {
  positive: '#198754',
  neutral: '#6c757d',
  negative: '#dc3545',
};

const SENTIMENT_LABELS = {
  positive: '正向',
  neutral: '中性',
  negative: '負向',
};

function sentimentBadge(label) {
  const bg = label === 'positive' ? 'success' : label === 'negative' ? 'danger' : 'secondary';
  return <Badge bg={bg}>{SENTIMENT_LABELS[label] || label}</Badge>;
}

const EMPTY_SENTIMENT = {
  total: 0,
  distribution: { positive: 0, neutral: 0, negative: 0 },
  percentages: { positive: 0, neutral: 0, negative: 0 },
  averageScore: 0,
  byQuestion: [],
  topPositiveTerms: [],
  topNegativeTerms: [],
  samples: [],
  method: '',
};

export default function AdminSurveyAnalyticsPage() {
  const { surveyId } = useParams();
  const { token, userRole, accessProfile: ctxProfile } = useOutletContext();
  const toast = useToast();
  const accessProfile = ctxProfile || buildAccessProfile(token || '', userRole || '');
  const canView = hasPermission(accessProfile, P.CAN_VIEW_SURVEY_ANALYTICS);
  const canExport = hasPermission(accessProfile, P.CAN_EXPORT_SURVEY_RESPONSES);
  const [options, setOptions] = useState({ semesters: [], surveys: [], versions: [], events: [] });
  const [filters, setFilters] = useState({ semesterId: '', surveyId: surveyId || '', versionId: '', activityType: '', eventId: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);
  const [distribution, setDistribution] = useState([]);
  const [trends, setTrends] = useState([]);
  const [comparison, setComparison] = useState([]);
  const [openText, setOpenText] = useState({ total: 0, rows: [], topTokens: [] });
  const [sentiment, setSentiment] = useState(EMPTY_SENTIMENT);
  const [dataQuality, setDataQuality] = useState(null);

  useEffect(() => {
    setFilters((f) => ({ ...f, surveyId: surveyId || '' }));
  }, [surveyId]);

  const sentimentPieData = useMemo(() => ([
    { name: '正向', key: 'positive', value: sentiment.distribution?.positive || 0 },
    { name: '中性', key: 'neutral', value: sentiment.distribution?.neutral || 0 },
    { name: '負向', key: 'negative', value: sentiment.distribution?.negative || 0 },
  ]), [sentiment.distribution]);

  const loadOptions = useCallback(async () => {
    const data = await fetchSurveyCenterOptions(token);
    setOptions({
      semesters: data.semesters || [],
      surveys: data.surveys || [],
      versions: data.versions || [],
      events: data.events || [],
    });
  }, [token]);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null)));
      const {
        overview: oa,
        distribution: ob,
        trends: oc,
        comparison: od,
        openTextSummary: oe,
        sentimentSummary: os,
      } = await fetchSurveyAnalyticsBundle(token, q);
      setOverview(oa);
      setDistribution(ob.questions || []);
      setTrends(oc.rows || []);
      setComparison(od.rows || []);
      setOpenText(oe || { total: 0, rows: [], topTokens: [] });
      setSentiment(os || EMPTY_SENTIMENT);
      setDataQuality(
        oa.dataQuality || ob.dataQuality || oc.dataQuality || od.dataQuality || oe.dataQuality || os.dataQuality || null,
      );
    } catch (err) {
      setError(err.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [filters, token]);

  const exportXlsx = useCallback(async () => {
    try {
      const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null)));
      const blob = await exportSurveyAnalyticsXlsx(token, q);
      downloadBlob(blob, `survey-analytics-${Date.now()}.xlsx`);
      toast.success('已下載 Excel');
    } catch (e) {
      toast.danger(e.message || '匯出失敗');
    }
  }, [filters, token, toast]);

  useEffect(() => {
    if (!token || !canView) return;
    loadOptions().catch((e) => toast.danger(e.message || '載入選項失敗'));
  }, [canView, loadOptions, toast, token]);

  useEffect(() => {
    if (!token || !canView) return;
    loadAll();
  }, [canView, loadAll, token]);

  if (!canView) {
    return (
      <div className="container py-4">
        <Alert variant="warning">無權限檢視問卷分析。</Alert>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h2 className="h4 text-primary mb-1">問卷分析</h2>
          <div className="text-muted small">KPI / 分布 / 趨勢 / 比較 / 開放題摘要 / 情緒分析</div>
        </div>
        <div className="d-flex gap-2">
          {canExport ? (
            <Button variant="outline-secondary" onClick={exportXlsx}>匯出 Excel</Button>
          ) : null}
          <Button variant="outline-primary" onClick={loadAll}>重新整理</Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body className="row g-2">
          <div className="col-md-2"><Form.Select value={filters.semesterId} onChange={(e) => setFilters((f) => ({ ...f, semesterId: e.target.value }))}><option value="">學期</option>{options.semesters.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</Form.Select></div>
          <div className="col-md-2"><Form.Select value={filters.surveyId} onChange={(e) => setFilters((f) => ({ ...f, surveyId: e.target.value }))}><option value="">問卷</option>{options.surveys.map((s) => <option key={s.id} value={s.id}>{s.title || s.name || s.surveyKey}</option>)}</Form.Select></div>
          <div className="col-md-2"><Form.Select value={filters.versionId} onChange={(e) => setFilters((f) => ({ ...f, versionId: e.target.value }))}><option value="">版本</option>{options.versions.filter((v) => !filters.surveyId || String(v.surveyId) === String(filters.surveyId)).map((v) => <option key={v.id} value={v.id}>v{v.versionNumber}</option>)}</Form.Select></div>
          <div className="col-md-2"><Form.Select value={filters.activityType} onChange={(e) => setFilters((f) => ({ ...f, activityType: e.target.value }))}><option value="">活動類型</option>{['ET', 'EC', 'IF', 'JT', 'GENERAL'].map((x) => <option key={x}>{x}</option>)}</Form.Select></div>
          <div className="col-md-2"><Form.Select value={filters.eventId} onChange={(e) => setFilters((f) => ({ ...f, eventId: e.target.value }))}><option value="">活動</option>{options.events.map((ev) => <option key={ev.id} value={ev.id}>{ev.id}-{ev.name}</option>)}</Form.Select></div>
          <div className="col-md-2"><Button variant="outline-secondary" onClick={() => setFilters({ semesterId: '', surveyId: '', versionId: '', activityType: '', eventId: '' })}>重設</Button></div>
        </Card.Body>
      </Card>

      {loading ? <div className="text-center py-4"><Spinner animation="border" /></div> : null}
      {!loading && error ? <Alert variant="danger">{error}</Alert> : null}

      {!loading && !error && overview ? (
        <>
          {dataQuality && (dataQuality.missingSemesterCount > 0 || dataQuality.missingVersionCount > 0 || dataQuality.unmatchedAnswersCount > 0 || dataQuality.fallbackNormalizedCount > 0) ? (
            <Alert variant="warning">
              資料品質提示：missingSemester={dataQuality.missingSemesterCount}，missingVersion={dataQuality.missingVersionCount}，
              unmatchedAnswers={dataQuality.unmatchedAnswersCount}，fallbackNormalized={dataQuality.fallbackNormalizedCount}。
            </Alert>
          ) : null}
          <div className="row g-2 mb-3">
            <div className="col-md-2"><Card className="border-0 shadow-sm"><Card.Body className="py-2"><div className="small text-muted">回覆總數</div><div className="h5 mb-0">{overview.totalResponses}</div></Card.Body></Card></div>
            <div className="col-md-2"><Card className="border-0 shadow-sm"><Card.Body className="py-2"><div className="small text-muted">完成率</div><div className="h5 mb-0">{overview.completionRate}%</div></Card.Body></Card></div>
            <div className="col-md-2"><Card className="border-0 shadow-sm"><Card.Body className="py-2"><div className="small text-muted">平均滿意度</div><div className="h5 mb-0">{overview.averageSatisfaction}</div></Card.Body></Card></div>
            <div className="col-md-2"><Card className="border-0 shadow-sm"><Card.Body className="py-2"><div className="small text-muted">活動覆蓋</div><div className="h5 mb-0">{overview.activityCoverage}</div></Card.Body></Card></div>
            <div className="col-md-2"><Card className="border-0 shadow-sm"><Card.Body className="py-2"><div className="small text-muted">問卷覆蓋</div><div className="h5 mb-0">{overview.surveyCoverage}</div></Card.Body></Card></div>
            <div className="col-md-2"><Card className="border-0 shadow-sm"><Card.Body className="py-2"><div className="small text-muted">開放題情緒</div><div className="h5 mb-0">{sentiment.total ? `${sentiment.percentages.positive}% 正向` : '—'}</div></Card.Body></Card></div>
          </div>

          <div className="row g-3">
            <div className="col-lg-6">
              <Card className="border-0 shadow-sm h-100">
                <Card.Header className="bg-white fw-semibold">Trends</Card.Header>
                <Card.Body style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends}>
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#2a5d9f" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </div>
            <div className="col-lg-6">
              <Card className="border-0 shadow-sm h-100">
                <Card.Header className="bg-white fw-semibold">Comparison</Card.Header>
                <Card.Body style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparison}>
                      <XAxis dataKey="key" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#0dcaf0" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </div>
          </div>

          <Card className="border-0 shadow-sm mt-3">
            <Card.Header className="bg-white fw-semibold d-flex justify-content-between align-items-center flex-wrap gap-2">
              <span>開放題情緒分析</span>
              <span className="small text-muted">詞典規則法（中英）· {sentiment.method || '—'}</span>
            </Card.Header>
            <Card.Body>
              {sentiment.total === 0 ? (
                <div className="text-muted small">目前篩選範圍沒有可分析的開放題文字（常見於僅有量表題的 ET 問卷）。</div>
              ) : (
                <>
                  <div className="row g-3 mb-3">
                    <div className="col-md-4">
                      <div className="small text-muted">分析筆數</div>
                      <div className="h5 mb-0">{sentiment.total}</div>
                    </div>
                    <div className="col-md-4">
                      <div className="small text-muted">平均情緒分數</div>
                      <div className="h5 mb-0">{sentiment.averageScore}</div>
                      <div className="text-muted small">正值偏正向、負值偏負向</div>
                    </div>
                    <div className="col-md-4">
                      <div className="small text-muted mb-1">分布</div>
                      <div className="d-flex flex-wrap gap-2">
                        <Badge bg="success">正向 {sentiment.distribution.positive}（{sentiment.percentages.positive}%）</Badge>
                        <Badge bg="secondary">中性 {sentiment.distribution.neutral}（{sentiment.percentages.neutral}%）</Badge>
                        <Badge bg="danger">負向 {sentiment.distribution.negative}（{sentiment.percentages.negative}%）</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="row g-3">
                    <div className="col-lg-5">
                      <div style={{ height: 240 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={sentimentPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                              {sentimentPieData.map((entry) => (
                                <Cell key={entry.key} fill={SENTIMENT_COLORS[entry.key]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="col-lg-7">
                      <div className="small fw-semibold mb-1">正向關鍵詞</div>
                      <div className="small text-muted mb-2">
                        {(sentiment.topPositiveTerms || []).slice(0, 10).map((t) => `${t.term}(${t.count})`).join('、') || '—'}
                      </div>
                      <div className="small fw-semibold mb-1">負向關鍵詞</div>
                      <div className="small text-muted mb-3">
                        {(sentiment.topNegativeTerms || []).slice(0, 10).map((t) => `${t.term}(${t.count})`).join('、') || '—'}
                      </div>
                      {(sentiment.byQuestion || []).length > 0 ? (
                        <div>
                          <div className="small fw-semibold mb-1">依題目</div>
                          {(sentiment.byQuestion || []).slice(0, 6).map((q) => (
                            <div key={q.questionKey} className="small border-bottom py-1">
                              <span className="font-monospace">{q.questionKey}</span>
                              {' · '}
                              正 {q.positive}／中 {q.neutral}／負 {q.negative}
                              {' · '}
                              avg {q.averageScore}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="fw-semibold small mb-2">樣本標註（最多 30）</div>
                    <div style={{ maxHeight: 280, overflow: 'auto' }}>
                      {(sentiment.samples || []).map((s, idx) => (
                        <div key={`${s.responseId}-${s.questionKey}-${idx}`} className="small border-bottom py-2">
                          <div className="d-flex flex-wrap gap-2 align-items-center mb-1">
                            {sentimentBadge(s.label)}
                            <span className="text-muted">score {s.score}</span>
                            <span className="text-muted">{s.questionKey} / #{s.responseId}</span>
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{s.answerText}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </Card.Body>
          </Card>

          <Card className="border-0 shadow-sm mt-3">
            <Card.Header className="bg-white fw-semibold">Distribution（單選/多選/量表）</Card.Header>
            <Card.Body>
              {distribution.length === 0 ? <div className="text-muted small">無可用分布資料</div> : distribution.map((q) => (
                <div key={q.questionKey} className="mb-3 pb-3 border-bottom">
                  <div className="fw-semibold">{q.questionKey} <span className="text-muted small">({q.questionType})</span> {q.averageScore != null ? <span className="badge bg-light text-dark">avg: {q.averageScore}</span> : null}</div>
                  <div className="small text-muted">{Object.entries(q.distribution || {}).map(([k, c]) => `${k}: ${c}`).join(' | ') || '-'}</div>
                </div>
              ))}
            </Card.Body>
          </Card>

          <Card className="border-0 shadow-sm mt-3">
            <Card.Header className="bg-white fw-semibold">Open Text 摘要</Card.Header>
            <Card.Body>
              <div className="small text-muted mb-2">回答數：{openText.total}</div>
              <div className="small mb-2">高頻詞：{(openText.topTokens || []).slice(0, 10).map((t) => `${t.token}(${t.count})`).join('、') || '-'}</div>
              <div style={{ maxHeight: 220, overflow: 'auto' }}>
                {(openText.rows || []).slice(0, 20).map((r, idx) => (
                  <div key={`${r.responseId}-${idx}`} className="small border-bottom py-2">
                    <div className="text-muted">{r.questionKey} / response #{r.responseId}</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{r.answerText}</div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </>
      ) : null}
    </div>
  );
}
