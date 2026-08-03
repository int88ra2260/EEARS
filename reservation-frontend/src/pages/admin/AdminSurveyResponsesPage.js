import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Pagination from 'react-bootstrap/Pagination';
import Nav from 'react-bootstrap/Nav';
import StatusBadge from '../../components/ui/StatusBadge';
import { surveySubmissionStatusToVariant } from '../../utils/statusBadgeUtils';
import useToast from '../../components/ui/useToast';
import { displayStudentEmail } from '../../utils/piiMask';
import AdminSurveyGateGapsPanel, {
  buildSurveyGateGapsQueryParams,
  canQuerySurveyGateGaps,
} from '../../components/admin/surveys/AdminSurveyGateGapsPanel';
import AdminSurveyResponseStatsPanel from '../../components/admin/surveys/AdminSurveyResponseStatsPanel';
import {
  downloadBlob,
  exportSurveyGateGapsXlsx,
  fetchSurveyCenterOptions,
  fetchSurveyResponseById,
  fetchSurveyResponses,
  fetchSurveyResponsesExport,
} from '../../services/surveyAdminApi';

function renderAnswerValue(a) {
  if (a.answerText) return a.answerText;
  if (Array.isArray(a.answerJson)) return a.answerJson.join('、');
  if (a.answerJson && typeof a.answerJson === 'object') return JSON.stringify(a.answerJson);
  if (a.scoreValue != null) return String(a.scoreValue);
  return '-';
}

export default function AdminSurveyResponsesPage() {
  const toast = useToast();
  const { token } = useOutletContext();
  const params = useParams();

  const [options, setOptions] = useState({ semesters: [], surveys: [], versions: [], events: [] });
  const [filters, setFilters] = useState({
    semesterId: '',
    surveyId: params.surveyId || '',
    versionId: '',
    activityType: '',
    eventId: '',
    studentId: '',
    studentName: '',
    studentEmail: '',
    submissionStatus: '',
    startDate: '',
    endDate: '',
  });
  const [sort, setSort] = useState({ sortBy: 'submittedAt', sortOrder: 'DESC' });
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState({ show: false, loading: false, data: null });
  const [activeTab, setActiveTab] = useState('responses');
  const [gapReloadToken, setGapReloadToken] = useState(0);
  const [statsReloadToken, setStatsReloadToken] = useState(0);
  const [gapExporting, setGapExporting] = useState(false);
  const [responseExporting, setResponseExporting] = useState(false);

  const loadOptions = useCallback(async () => {
    const data = await fetchSurveyCenterOptions(token);
    setOptions({
      semesters: data.semesters || [],
      surveys: data.surveys || [],
      versions: data.versions || [],
      events: data.events || [],
    });
  }, [token]);

  const loadList = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError('');
      const q = new URLSearchParams({
        page: String(page),
        pageSize: String(pagination.pageSize),
        ...sort,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null)),
      });
      const data = await fetchSurveyResponses(token, q);
      setRows(data.rows || []);
      setSummary(data.summary || null);
      setPagination((p) => ({ ...p, ...(data.pagination || {}), page }));
    } catch (e) {
      setError(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.pageSize, sort, token]);

  useEffect(() => {
    loadOptions().catch((e) => toast.danger(e.message || '載入選項失敗'));
  }, [loadOptions, toast]);

  useEffect(() => {
    if (activeTab !== 'responses') return;
    loadList(1);
  }, [activeTab, loadList]);

  const openDetail = async (id) => {
    setDetail({ show: true, loading: true, data: null });
    try {
      const data = await fetchSurveyResponseById(token, id);
      setDetail({ show: true, loading: false, data });
    } catch (e) {
      setDetail({ show: true, loading: false, data: null });
      toast.danger(e.message || '載入詳情失敗');
    }
  };

  const handleSearch = () => {
    if (activeTab === 'responses') {
      loadList(1);
      return;
    }
    if (activeTab === 'stats') {
      setStatsReloadToken((n) => n + 1);
      return;
    }
    if (!canQuerySurveyGateGaps(filters)) {
      toast.info('請先選擇學期與活動類型 ET 或 EC');
      return;
    }
    setGapReloadToken((n) => n + 1);
  };

  const buildExportFilename = () => {
    const survey = options.surveys.find((s) => String(s.id) === String(filters.surveyId));
    const semester = options.semesters.find((s) => String(s.id) === String(filters.semesterId));
    let name = 'survey-responses';
    if (semester?.code) name += `_${semester.code}`;
    if (survey?.surveyKey) name += `_${survey.surveyKey}`;
    else if (survey?.title) name += `_${String(survey.title).replace(/\s+/g, '_').slice(0, 24)}`;
    return `${name}.xlsx`;
  };

  const exportXlsx = async () => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null)));
    setResponseExporting(true);
    try {
      const blob = await fetchSurveyResponsesExport(token, q);
      if (!blob.size) {
        toast.info('目前篩選條件下沒有可匯出的資料');
        return;
      }
      downloadBlob(blob, buildExportFilename());
      toast.success('填答紀錄已匯出');
    } catch (e) {
      if (e.status === 403) {
        toast.danger('您沒有匯出問卷填答紀錄的權限');
        return;
      }
      toast.danger(e.message || '匯出失敗');
    } finally {
      setResponseExporting(false);
    }
  };

  const exportGapXlsx = async () => {
    if (!canQuerySurveyGateGaps(filters)) {
      toast.info('請先選擇學期與活動類型 ET 或 EC');
      return;
    }
    const q = buildSurveyGateGapsQueryParams(filters);
    if (!q) return;

    setGapExporting(true);
    try {
      const blob = await exportSurveyGateGapsXlsx(token, q);
      const semesterCode = options.semesters.find(
        (s) => String(s.id) === String(filters.semesterId)
      )?.code;
      let filename = `survey-gate-gaps_${filters.activityType}`;
      if (semesterCode) filename += `_${semesterCode}`;
      filename += '.xlsx';

      downloadBlob(blob, filename);
      toast.success('預約缺口已匯出');
    } catch (e) {
      if (e.status === 403) {
        toast.danger('您沒有匯出預約缺口資料的權限');
        return;
      }
      toast.danger(e.message || '匯出預約缺口失敗');
    } finally {
      setGapExporting(false);
    }
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h2 className="h4 text-primary mb-1">填答紀錄</h2>
          <div className="text-muted small">查詢、檢視與匯出各學期活動問卷回覆</div>
        </div>
        {activeTab === 'gaps' ? (
          <Button
            variant="primary"
            onClick={exportGapXlsx}
            disabled={gapExporting || !canQuerySurveyGateGaps(filters)}
          >
            {gapExporting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                匯出中…
              </>
            ) : (
              '匯出 Excel'
            )}
          </Button>
        ) : (
          <Button variant="primary" onClick={exportXlsx} disabled={responseExporting}>
            {responseExporting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                匯出中…
              </>
            ) : (
              '匯出 Excel'
            )}
          </Button>
        )}
      </div>

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body className="row g-2">
          <div className="col-md-2"><Form.Select value={filters.semesterId} onChange={(e) => setFilters((f) => ({ ...f, semesterId: e.target.value }))}><option value="">學期</option>{options.semesters.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</Form.Select></div>
          <div className="col-md-2"><Form.Select value={filters.surveyId} onChange={(e) => setFilters((f) => ({ ...f, surveyId: e.target.value }))}><option value="">問卷</option>{options.surveys.map((s) => <option key={s.id} value={s.id}>{s.title || s.name || s.surveyKey}</option>)}</Form.Select></div>
          <div className="col-md-2"><Form.Select value={filters.versionId} onChange={(e) => setFilters((f) => ({ ...f, versionId: e.target.value }))}><option value="">版本</option>{options.versions.filter((v) => !filters.surveyId || String(v.surveyId) === String(filters.surveyId)).map((v) => <option key={v.id} value={v.id}>v{v.versionNumber}</option>)}</Form.Select></div>
          <div className="col-md-2"><Form.Select value={filters.activityType} onChange={(e) => setFilters((f) => ({ ...f, activityType: e.target.value }))}><option value="">活動類型</option>{['ET', 'EC', 'IF', 'JT', 'GENERAL'].map((x) => <option key={x}>{x}</option>)}</Form.Select></div>
          <div className="col-md-2"><Form.Select value={filters.eventId} onChange={(e) => setFilters((f) => ({ ...f, eventId: e.target.value }))}><option value="">活動</option>{options.events.map((ev) => <option key={ev.id} value={ev.id}>{ev.id}-{ev.name}</option>)}</Form.Select></div>
          <div className="col-md-2"><Form.Select value={filters.submissionStatus} onChange={(e) => setFilters((f) => ({ ...f, submissionStatus: e.target.value }))}><option value="">狀態</option><option value="submitted">submitted</option><option value="draft">draft</option></Form.Select></div>
          <div className="col-md-2"><Form.Control placeholder="學號" value={filters.studentId} onChange={(e) => setFilters((f) => ({ ...f, studentId: e.target.value }))} /></div>
          <div className="col-md-2"><Form.Control placeholder="姓名" value={filters.studentName} onChange={(e) => setFilters((f) => ({ ...f, studentName: e.target.value }))} /></div>
          <div className="col-md-2"><Form.Control placeholder="Email" value={filters.studentEmail} onChange={(e) => setFilters((f) => ({ ...f, studentEmail: e.target.value }))} /></div>
          <div className="col-md-2"><Form.Control type="date" value={filters.startDate} onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))} /></div>
          <div className="col-md-2"><Form.Control type="date" value={filters.endDate} onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))} /></div>
          <div className="col-md-4 d-flex gap-2">
            <Button variant="outline-primary" onClick={handleSearch}>查詢</Button>
            <Button variant="outline-secondary" onClick={() => {
              setFilters({ semesterId: '', surveyId: '', versionId: '', activityType: '', eventId: '', studentId: '', studentName: '', studentEmail: '', submissionStatus: '', startDate: '', endDate: '' });
              setSort({ sortBy: 'submittedAt', sortOrder: 'DESC' });
            }}>重設</Button>
          </div>
        </Card.Body>
      </Card>

      <Nav variant="tabs" className="mb-3">
        <Nav.Item>
          <Nav.Link active={activeTab === 'responses'} onClick={() => setActiveTab('responses')}>
            填答紀錄
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={activeTab === 'stats'} onClick={() => setActiveTab('stats')}>
            基本統計
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={activeTab === 'gaps'} onClick={() => setActiveTab('gaps')}>
            預約缺口
          </Nav.Link>
        </Nav.Item>
      </Nav>

      {activeTab === 'responses' ? (
      <>
      <div className="row g-2 mb-3">
        <div className="col-md-2"><Card className="border-0 shadow-sm"><Card.Body className="py-2"><div className="small text-muted">總回覆</div><div className="h5 mb-0">{summary?.totalResponses ?? '-'}</div></Card.Body></Card></div>
        <div className="col-md-2"><Card className="border-0 shadow-sm"><Card.Body className="py-2"><div className="small text-muted">完成數</div><div className="h5 mb-0">{summary?.completedResponses ?? '-'}</div></Card.Body></Card></div>
        <div className="col-md-2"><Card className="border-0 shadow-sm"><Card.Body className="py-2"><div className="small text-muted">未完成/部分</div><div className="h5 mb-0">{summary?.partialResponses ?? '-'}</div></Card.Body></Card></div>
        <div className="col-md-2"><Card className="border-0 shadow-sm"><Card.Body className="py-2"><div className="small text-muted">涵蓋問卷</div><div className="h5 mb-0">{summary?.distinctSurveyCount ?? '-'}</div></Card.Body></Card></div>
        <div className="col-md-2"><Card className="border-0 shadow-sm"><Card.Body className="py-2"><div className="small text-muted">涵蓋活動</div><div className="h5 mb-0">{summary?.distinctEventCount ?? '-'}</div></Card.Body></Card></div>
        <div className="col-md-2"><Card className="border-0 shadow-sm"><Card.Body className="py-2"><div className="small text-muted">涵蓋學期</div><div className="h5 mb-0">{summary?.distinctSemesterCount ?? '-'}</div></Card.Body></Card></div>
      </div>

      <Card className="border-0 shadow-sm">
        <Card.Body>
          {loading ? <div className="text-center py-4"><Spinner animation="border" /></div> : null}
          {!loading && error ? <Alert variant="danger">{error}</Alert> : null}
          {!loading && !error ? (
            <div className="table-responsive">
              <Table hover size="sm" className="align-middle">
                <thead className="table-light">
                  <tr>
                    <th>id</th>
                    <th>semester</th>
                    <th>survey</th>
                    <th>version</th>
                    <th>activity</th>
                    <th>event</th>
                    <th onClick={() => setSort((s) => ({ sortBy: 'studentId', sortOrder: s.sortOrder === 'ASC' ? 'DESC' : 'ASC' }))}>studentId</th>
                    <th onClick={() => setSort((s) => ({ sortBy: 'studentName', sortOrder: s.sortOrder === 'ASC' ? 'DESC' : 'ASC' }))}>studentName</th>
                    <th>studentEmail</th>
                    <th onClick={() => setSort((s) => ({ sortBy: 'submissionStatus', sortOrder: s.sortOrder === 'ASC' ? 'DESC' : 'ASC' }))}>status</th>
                    <th onClick={() => setSort((s) => ({ sortBy: 'submittedAt', sortOrder: s.sortOrder === 'ASC' ? 'DESC' : 'ASC' }))}>submittedAt</th>
                    <th>source</th>
                    <th>answers</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>{r.Semester?.code || '-'}</td>
                      <td>{r.Survey?.title || r.Survey?.name || '-'}</td>
                      <td>{r.SurveyVersion?.versionNumber || '-'}</td>
                      <td>{r.activityType || '-'}</td>
                      <td>{r.eventId || '-'}</td>
                      <td>{r.studentId || '-'}</td>
                      <td>{r.studentName || '-'}</td>
                      <td className="small text-break">{displayStudentEmail(r)}</td>
                      <td>
                        <StatusBadge variant={surveySubmissionStatusToVariant(r.submissionStatus)} size="sm">
                          {r.submissionStatus || '-'}
                        </StatusBadge>
                      </td>
                      <td className="small text-nowrap">{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '-'}</td>
                      <td>{r.source || '-'}</td>
                      <td>{r.answersCount || 0}</td>
                      <td><Button size="sm" variant="outline-primary" onClick={() => openDetail(r.id)}>查看詳情</Button></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : null}
          <Pagination className="mb-0">
            <Pagination.Prev disabled={pagination.page <= 1} onClick={() => loadList(pagination.page - 1)} />
            <Pagination.Item active>{pagination.page}</Pagination.Item>
            <Pagination.Next disabled={pagination.page >= (pagination.totalPages || 1)} onClick={() => loadList(pagination.page + 1)} />
          </Pagination>
        </Card.Body>
      </Card>
      </>
      ) : activeTab === 'stats' ? (
        <Card className="border-0 shadow-sm">
          <Card.Body>
            <p className="text-muted small mb-3">
              統計依上方篩選條件計算（建議選擇學期與問卷）。年級分布已將 English Club 年級選項歸併為一年級／二年級／高年級三類。
            </p>
            <AdminSurveyResponseStatsPanel
              filters={filters}
              token={token}
              reloadToken={statsReloadToken}
            />
          </Card.Body>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <Card.Body>
            <AdminSurveyGateGapsPanel
              filters={filters}
              token={token}
              reloadToken={gapReloadToken}
              pageSize={pagination.pageSize}
            />
          </Card.Body>
        </Card>
      )}

      <Modal show={detail.show} onHide={() => setDetail({ show: false, loading: false, data: null })} centered size="lg">
        <Modal.Header closeButton><Modal.Title>填答詳情</Modal.Title></Modal.Header>
        <Modal.Body>
          {detail.loading ? <div className="text-center py-3"><Spinner animation="border" /></div> : null}
          {!detail.loading && detail.data ? (
            <>
              <div className="small text-muted mb-2">
                response #{detail.data.response?.id} / surveyVersion {detail.data.response?.surveyVersionId || '-'} / source {detail.data.response?.source || '-'}
              </div>
              <div className="small mb-3">
                <span className="me-3">學號：{detail.data.response?.studentId || '-'}</span>
                <span className="me-3">姓名：{detail.data.response?.studentName || '-'}</span>
                <span>Email：{displayStudentEmail(detail.data.response)}</span>
              </div>
              <Card className="mb-2 border-0 shadow-sm">
                <Card.Body className="small">
                  <div className="fw-semibold mb-1">Data Integrity</div>
                  <div>hasSemester: {String(detail.data.dataIntegrity?.hasSemester)}</div>
                  <div>hasVersion: {String(detail.data.dataIntegrity?.hasVersion)}</div>
                  <div>schemaMatchedCount: {detail.data.dataIntegrity?.schemaMatchedCount ?? '-'}</div>
                  <div>unmatchedAnswerCount: {detail.data.dataIntegrity?.unmatchedAnswerCount ?? '-'}</div>
                  <div>normalizedWithFallback: {String(detail.data.dataIntegrity?.normalizedWithFallback)}</div>
                  <div>semesterInference: {detail.data.dataIntegrity?.sourceOfSemesterInference || '-'}</div>
                  <div>versionInference: {detail.data.dataIntegrity?.sourceOfVersionInference || '-'}</div>
                </Card.Body>
              </Card>
              {(detail.data.warnings || []).length > 0 ? (
                <Alert variant="warning">
                  <div className="fw-semibold">Warnings</div>
                  <ul className="mb-0">
                    {detail.data.warnings.map((w, idx) => <li key={`${w.code}-${idx}`}>{w.message}</li>)}
                  </ul>
                </Alert>
              ) : null}
              <Card className="mb-3 border-0 bg-light"><Card.Body className="small mb-0">schema: {detail.data.schemaJson ? 'loaded' : 'fallback mode'}</Card.Body></Card>
              <Table size="sm" bordered>
                <thead><tr><th>questionKey</th><th>type</th><th>answer</th></tr></thead>
                <tbody>
                  {(detail.data.answers || []).map((a) => (
                    <tr key={a.id}>
                      <td>{a.questionKey}</td>
                      <td>{a.questionType || '-'}</td>
                      <td style={{ whiteSpace: 'pre-wrap' }}>
                        {a.displayAnswer || renderAnswerValue(a)}
                        {!a.hasSchemaMatch ? (
                          <StatusBadge variant="warning" size="sm" className="ms-2">schema mismatch</StatusBadge>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          ) : null}
        </Modal.Body>
      </Modal>
    </div>
  );
}
