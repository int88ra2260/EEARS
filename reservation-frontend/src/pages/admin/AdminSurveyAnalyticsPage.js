import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import useToast from '../../components/ui/useToast';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { P } from '../../constants/permissions';
import {
  downloadBlob,
  exportSurveyAnalyticsXlsx,
  fetchSurveyAnalyticsBundle,
  fetchSurveyCenterOptions,
  fetchSurveyEmotionAnalysis,
} from '../../services/surveyAdminApi';

const EMOTION_COLORS = {
  positive: '#28a745',
  negative: '#dc3545',
  neutral: '#6c757d',
  mixed: '#ffc107',
};

const EMOTION_LABELS = {
  positive: '正面',
  negative: '負面',
  neutral: '中性',
  mixed: '混合',
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
  const [dataQuality, setDataQuality] = useState(null);
  const [emotionAnalysis, setEmotionAnalysis] = useState(null);
  const [emotionLoading, setEmotionLoading] = useState(false);

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
      const { overview: oa, distribution: ob, trends: oc, comparison: od, openTextSummary: oe } =
        await fetchSurveyAnalyticsBundle(token, q);
      setOverview(oa);
      setDistribution(ob.questions || []);
      setTrends(oc.rows || []);
      setComparison(od.rows || []);
      setOpenText(oe || { total: 0, rows: [], topTokens: [] });
      setDataQuality(oa.dataQuality || ob.dataQuality || oc.dataQuality || od.dataQuality || oe.dataQuality || null);
    } catch (err) {
      setError(err.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [filters, token]);

  const loadEmotionAnalysis = useCallback(async () => {
    try {
      setEmotionLoading(true);
      const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null)));
      const result = await fetchSurveyEmotionAnalysis(token, q, { limit: 100 });
      setEmotionAnalysis(result.data || null);
    } catch (err) {
      toast.danger(err.message || '情緒分析載入失敗');
    } finally {
      setEmotionLoading(false);
    }
  }, [filters, token, toast]);

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
          <div className="text-muted small">MVP：KPI / 分布 / 趨勢 / 比較 / 開放題摘要</div>
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
                      <Line type="monotone" dataKey="count" stroke="#0d6efd" strokeWidth={2} />
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

          {/* 情緒分析區塊 */}
          <Card className="border-0 shadow-sm mt-3">
            <Card.Header className="bg-white fw-semibold d-flex justify-content-between align-items-center">
              <span>🎭 情緒分析</span>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={loadEmotionAnalysis}
                disabled={emotionLoading}
              >
                {emotionLoading ? <Spinner animation="border" size="sm" /> : '分析'}
              </Button>
            </Card.Header>
            <Card.Body>
              {!emotionAnalysis && !emotionLoading ? (
                <div className="text-center text-muted py-4">
                  <div className="mb-2">點擊「分析」按鈕來分析開放式回答的情緒傾向</div>
                  <small>分析將使用 AI 或本地詞典判斷回答的情緒（正面/負面/中性/混合）</small>
                </div>
              ) : null}

              {emotionLoading ? (
                <div className="text-center py-4">
                  <Spinner animation="border" />
                  <div className="mt-2 text-muted small">分析中，請稍候...</div>
                </div>
              ) : null}

              {emotionAnalysis && !emotionLoading ? (
                <>
                  <div className="row mb-3">
                    <div className="col-md-3">
                      <div className="small text-muted">分析模式</div>
                      <Badge bg={emotionAnalysis.analysisMode === 'ai' ? 'primary' : 'secondary'}>
                        {emotionAnalysis.analysisMode === 'ai' ? 'AI 分析' : '本地詞典'}
                      </Badge>
                    </div>
                    <div className="col-md-3">
                      <div className="small text-muted">分析數量</div>
                      <div className="fw-semibold">{emotionAnalysis.analyzed} / {emotionAnalysis.total}</div>
                    </div>
                    <div className="col-md-3">
                      <div className="small text-muted">平均信心度</div>
                      <div className="fw-semibold">{Math.round(emotionAnalysis.averageConfidence * 100)}%</div>
                    </div>
                  </div>

                  <div className="row g-3">
                    {/* 情緒分布圓餅圖 */}
                    <div className="col-lg-4">
                      <div className="small text-muted mb-2 fw-semibold">情緒分布</div>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={Object.entries(emotionAnalysis.distribution || {})
                              .filter(([, count]) => count > 0)
                              .map(([emotion, count]) => ({
                                name: EMOTION_LABELS[emotion] || emotion,
                                value: count,
                                emotion,
                              }))}
                            cx="50%"
                            cy="50%"
                            outerRadius={70}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                            labelLine={false}
                          >
                            {Object.entries(emotionAnalysis.distribution || {})
                              .filter(([, count]) => count > 0)
                              .map(([emotion]) => (
                                <Cell key={emotion} fill={EMOTION_COLORS[emotion] || '#999'} />
                              ))}
                          </Pie>
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* 關鍵詞 */}
                    <div className="col-lg-4">
                      <div className="small text-muted mb-2 fw-semibold">情緒關鍵詞</div>
                      <div className="d-flex flex-wrap gap-1">
                        {(emotionAnalysis.topKeywords || []).map((kw, idx) => (
                          <Badge
                            key={kw.keyword}
                            bg="light"
                            text="dark"
                            className="border"
                            style={{
                              fontSize: `${Math.max(0.7, 1 - idx * 0.05)}rem`,
                              fontWeight: idx < 3 ? 600 : 400,
                            }}
                          >
                            {kw.keyword} ({kw.count})
                          </Badge>
                        ))}
                        {(emotionAnalysis.topKeywords || []).length === 0 ? (
                          <span className="text-muted small">無關鍵詞</span>
                        ) : null}
                      </div>

                      {(emotionAnalysis.topTopics || []).length > 0 ? (
                        <>
                          <div className="small text-muted mb-2 mt-3 fw-semibold">討論主題</div>
                          <div className="d-flex flex-wrap gap-1">
                            {emotionAnalysis.topTopics.map((t) => (
                              <Badge key={t.topic} bg="info" className="fw-normal">
                                {t.topic} ({t.count})
                              </Badge>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </div>

                    {/* 情緒長條圖 */}
                    <div className="col-lg-4">
                      <div className="small text-muted mb-2 fw-semibold">情緒統計</div>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart
                          data={Object.entries(emotionAnalysis.distribution || {}).map(([emotion, count]) => ({
                            emotion: EMOTION_LABELS[emotion] || emotion,
                            count,
                            fill: EMOTION_COLORS[emotion] || '#999',
                          }))}
                          layout="vertical"
                        >
                          <XAxis type="number" />
                          <YAxis type="category" dataKey="emotion" width={50} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#8884d8">
                            {Object.entries(emotionAnalysis.distribution || {}).map(([emotion]) => (
                              <Cell key={emotion} fill={EMOTION_COLORS[emotion] || '#999'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* 代表性樣本 */}
                  {(emotionAnalysis.samples || []).length > 0 ? (
                    <div className="mt-3">
                      <div className="small text-muted mb-2 fw-semibold">代表性回答樣本</div>
                      <div style={{ maxHeight: 300, overflow: 'auto' }}>
                        {emotionAnalysis.samples.map((sample, idx) => (
                          <div key={`${sample.answerId}-${idx}`} className="border rounded p-2 mb-2">
                            <div className="d-flex justify-content-between align-items-start mb-1">
                              <Badge
                                bg="light"
                                style={{
                                  color: EMOTION_COLORS[sample.emotion],
                                  border: `1px solid ${EMOTION_COLORS[sample.emotion]}`,
                                }}
                              >
                                {EMOTION_LABELS[sample.emotion]} ({Math.round(sample.confidence * 100)}%)
                              </Badge>
                              <small className="text-muted">{sample.questionKey}</small>
                            </div>
                            <div className="small" style={{ whiteSpace: 'pre-wrap' }}>
                              {sample.text}
                            </div>
                            {sample.summary ? (
                              <div className="small text-info mt-1 fst-italic">
                                💡 {sample.summary}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </Card.Body>
          </Card>
        </>
      ) : null}
    </div>
  );
}
