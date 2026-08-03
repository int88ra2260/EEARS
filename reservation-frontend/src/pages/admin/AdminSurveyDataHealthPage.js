import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import Nav from 'react-bootstrap/Nav';
import Tab from 'react-bootstrap/Tab';
import StatusBadge from '../../components/ui/StatusBadge';
import {
  genericResultStatusToVariant,
  surveyRepairModeToVariant,
} from '../../utils/statusBadgeUtils';
import useToast from '../../components/ui/useToast';
import SurveyWorkflowGuide from '../../components/admin/survey/SurveyWorkflowGuide';
import SurveyHealthOverviewCards from '../../components/admin/survey/SurveyHealthOverviewCards';
import SurveyOpsQuickLinks from '../../components/admin/survey/SurveyOpsQuickLinks';
import {
  fetchSurveyHealthBundle,
  fetchSurveyRepairRun,
  runSurveyRepair,
} from '../../services/surveyAdminApi';
import {
  HEALTH_METRIC_KEYS,
  READINESS_GATE_LABELS,
  SURVEY_REPAIR_TYPE_LABELS,
  surveyLabelById,
} from '../../constants/surveyAdminUx';

const REPAIR_ACTIONS = [
  {
    type: 'recommended',
    title: '建議修復（一次執行）',
    desc: '依序：補齊活動／作答學期、重新對應版本、建立標準答案對照（如 interviewEmail→interview_email）。建議先預覽。',
    highlight: true,
  },
  {
    type: 'semester',
    title: '補齊學期欄位',
    desc: '將缺少 semesterId 的作答與活動，依學期代碼或活動日期嘗試補齊關聯。',
  },
  {
    type: 'version',
    title: '重新對應版本',
    desc: '將缺少 surveyVersionId 的作答，對應至該問卷目前已發布的版本。',
  },
  {
    type: 'answers',
    title: '檢查答案格式',
    desc: '掃描答案鍵是否可對照題目結構（唯讀）；若異常多請至「答案對照」。',
  },
];

function EmptyTableRow({ colSpan, message }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center text-muted py-4">
        {message}
      </td>
    </tr>
  );
}

function formatDt(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('zh-TW');
  } catch {
    return String(value);
  }
}

export default function AdminSurveyDataHealthPage() {
  const { token } = useOutletContext();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [options, setOptions] = useState({ surveys: [] });
  const [overview, setOverview] = useState(null);
  const [problems, setProblems] = useState(null);
  const [rules, setRules] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [runs, setRuns] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [runDetail, setRunDetail] = useState({ show: false, loading: false, data: null });
  const [confirm, setConfirm] = useState({ show: false, type: '' });
  const [executeMode, setExecuteMode] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchSurveyHealthBundle(token);
      setOptions(data.options);
      setOverview(data.overview);
      setProblems(data.problems);
      setRules(data.rules);
      setReadiness(data.readiness);
      setRuns(data.runs);
      setLastLoadedAt(new Date());
    } catch (e) {
      toast.danger(e.message || '資料品質載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const issueCount = useMemo(() => {
    if (!overview) return 0;
    return (
      Number(overview.missingSemesterCount || 0) +
      Number(overview.missingVersionCount || 0) +
      Number(overview.responsesWithUnmatched || 0) +
      Number(overview.eventsMissingSemester || 0)
    );
  }, [overview]);

  const quickLinks = useMemo(() => {
    const links = [
      {
        to: '/admin/survey-center',
        label: '問卷中心',
        description: '日常檢視作答、匯出與統計',
      },
      {
        to: '/admin/survey-rules',
        label: '啟用規則',
        description: '確認學期與活動問卷開關',
      },
    ];
    if (Number(overview?.unmatchedAnswersCount || 0) > 0) {
      links.unshift({
        to: '/admin/survey-answer-mappings',
        label: '答案對照',
        description: '處理無法對照的題目代碼',
        variant: 'primary',
      });
    }
    if (Number(overview?.missingSemesterCount || 0) > 0) {
      links.push({
        to: '/admin/survey-responses',
        label: '填答紀錄',
        description: '檢視缺學期關聯的作答',
      });
    }
    return links;
  }, [overview]);

  const runRecheck = async (type) => {
    try {
      const data = await runSurveyRepair(token, { type, executeMode, confirmPhrase });
      const modeLabel = executeMode ? '實際執行' : '預覽';
      const typeLabel = SURVEY_REPAIR_TYPE_LABELS[type] || type;
      toast.success(`${modeLabel}完成：${typeLabel}（紀錄 #${data.id || '—'}）`);
      setActiveTab('runs');
      load();
    } catch (e) {
      toast.danger(e.message || '修復執行失敗');
    } finally {
      setConfirm({ show: false, type: '' });
    }
  };

  const loadRunDetail = async (id) => {
    try {
      setRunDetail({ show: true, loading: true, data: null });
      const data = await fetchSurveyRepairRun(token, id);
      setRunDetail({ show: true, loading: false, data });
    } catch (e) {
      toast.danger(e.message || '紀錄詳情載入失敗');
      setRunDetail({ show: false, loading: false, data: null });
    }
  };

  const sampleNote = useMemo(() => {
    if (!overview?.sampleSizeForNormalization) return null;
    const scanned = overview.sampleSizeForNormalization;
    const total = overview.responsesTotal || 0;
    const complete = overview.normalizationScanComplete;
    const suffix = complete
      ? '已掃描全部作答。'
      : `已掃描最近 ${scanned} 筆（共 ${total} 筆）。`;
    return `「答案無法對照」僅計算題目欄位（不含學號、姓名等），${suffix} 學號／姓名等系統欄位不列入。`;
  }, [overview]);

  const readinessVariant =
    readiness?.gate === 'Not ready'
      ? 'danger'
      : readiness?.gate === 'Ready with warnings'
        ? 'warning'
        : 'success';

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
        <div>
          <h2 className="h4 text-primary mb-1">問卷資料品質</h2>
          <div className="text-muted small">
            檢查作答是否缺學期、缺版本或答案無法對照；日常匯出與統計請用
            <Link to="/admin/survey-center" className="ms-1">
              問卷中心
            </Link>
            。
          </div>
          {lastLoadedAt ? (
            <div className="text-muted small mt-1">
              最後更新：{formatDt(lastLoadedAt)}
              {issueCount > 0 ? (
                <StatusBadge variant="warning" size="sm" className="ms-2">
                  約 {issueCount} 項異常指標
                </StatusBadge>
              ) : (
                <StatusBadge variant="success" size="sm" className="ms-2">
                  主要指標正常
                </StatusBadge>
              )}
            </div>
          ) : null}
        </div>
        <div className="d-flex gap-2 flex-wrap">
          {issueCount > 0 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setActiveTab('repairs');
                setConfirm({ show: true, type: 'recommended' });
              }}
            >
              處理待辦（建議修復）
            </Button>
          ) : null}
          <Button variant="outline-primary" onClick={load} disabled={loading}>
          {loading ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              載入中…
            </>
          ) : (
            '重新整理'
          )}
          </Button>
        </div>
      </div>

      <SurveyWorkflowGuide variant="health" defaultOpen={false} />

      {loading && !overview ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
          <div className="text-muted small mt-2">正在彙整資料品質指標…</div>
        </div>
      ) : null}

      {!loading && overview ? (
        <>
          <SurveyOpsQuickLinks links={quickLinks} />
          <Tab.Container activeKey={activeTab} onSelect={(k) => k && setActiveTab(k)}>
            <Nav variant="tabs" className="mb-3">
              <Nav.Item>
                <Nav.Link eventKey="overview">總覽</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="problems">
                  問題清單
                  {(problems?.responsesMissingSemester?.length ||
                    problems?.responsesMissingVersion?.length ||
                    problems?.responsesWithUnmatchedAnswers?.length) > 0 ? (
                    <StatusBadge variant="danger" size="sm" className="ms-1">
                      !
                    </StatusBadge>
                  ) : null}
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="repairs">修復工具</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="runs">修復紀錄</Nav.Link>
              </Nav.Item>
            </Nav>

            <Tab.Content>
              <Tab.Pane eventKey="overview">
                <SurveyHealthOverviewCards
                  overview={overview}
                  metricKeys={HEALTH_METRIC_KEYS}
                  sampleNote={sampleNote}
                />
                {readiness ? (
                  <Card className="border-0 shadow-sm mb-3">
                    <Card.Header className="bg-white fw-semibold">上線就緒狀態</Card.Header>
                    <Card.Body>
                      <Alert variant={readinessVariant} className="mb-2 py-2">
                        {READINESS_GATE_LABELS[readiness.gate] || readiness.gate}
                      </Alert>
                      {(readiness.recommendedActions || []).length > 0 ? (
                        <ul className="mb-0 small">
                          {readiness.recommendedActions.map((a, idx) => (
                            <li key={idx}>{a}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-muted small">目前無建議動作</div>
                      )}
                    </Card.Body>
                  </Card>
                ) : null}
                <Card className="border-0 shadow-sm">
                  <Card.Header className="bg-white fw-semibold d-flex justify-content-between">
                    <span>啟用規則衝突</span>
                    <StatusBadge
                      variant={(rules?.conflictCount || 0) > 0 ? 'warning' : 'success'}
                      size="sm"
                    >
                      {(rules?.conflictCount || 0) > 0 ? `${rules.conflictCount} 筆` : '無衝突'}
                    </StatusBadge>
                  </Card.Header>
                  <Card.Body>
                    {(rules?.conflicts || []).length === 0 ? (
                      <div className="text-muted small">目前未檢測到規則衝突。</div>
                    ) : (
                      <ul className="mb-0 small">
                        {(rules?.conflicts || []).slice(0, 20).map((c, idx) => (
                          <li key={`${c.type}-${idx}`} className="mb-2">
                            <strong>{c.type}</strong>
                            <div className="text-muted">
                              相關規則：{(c.relatedRules || []).join('、') || '—'}
                            </div>
                            <div>建議：{c.suggestion}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card.Body>
                </Card>
              </Tab.Pane>

              <Tab.Pane eventKey="problems">
                <div className="row g-3">
                  <div className="col-lg-6">
                    <Card className="border-0 shadow-sm h-100">
                      <Card.Header className="bg-white fw-semibold">
                        缺少學期的作答
                        <StatusBadge variant="neutral" size="sm" className="ms-2">
                          顯示前 30 筆
                        </StatusBadge>
                      </Card.Header>
                      <Card.Body className="p-0">
                        <Table size="sm" hover responsive className="mb-0">
                          <thead>
                            <tr>
                              <th>編號</th>
                              <th>問卷</th>
                              <th>學號</th>
                              <th>送出時間</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(problems?.responsesMissingSemester || []).slice(0, 30).length === 0 ? (
                              <EmptyTableRow colSpan={4} message="沒有缺少學期的作答" />
                            ) : (
                              (problems?.responsesMissingSemester || []).slice(0, 30).map((r) => (
                                <tr key={r.id}>
                                  <td>
                                    <Link to={`/admin/survey-responses/${r.surveyId}`}>
                                      #{r.id}
                                    </Link>
                                  </td>
                                  <td>{surveyLabelById(options.surveys, r.surveyId)}</td>
                                  <td>{r.studentId || '—'}</td>
                                  <td>{formatDt(r.submittedAt)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </Table>
                      </Card.Body>
                    </Card>
                  </div>
                  <div className="col-lg-6">
                    <Card className="border-0 shadow-sm h-100">
                      <Card.Header className="bg-white fw-semibold">
                        缺少版本的作答
                        <StatusBadge variant="neutral" size="sm" className="ms-2">
                          顯示前 30 筆
                        </StatusBadge>
                      </Card.Header>
                      <Card.Body className="p-0">
                        <Table size="sm" hover responsive className="mb-0">
                          <thead>
                            <tr>
                              <th>編號</th>
                              <th>問卷</th>
                              <th>學號</th>
                              <th>送出時間</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(problems?.responsesMissingVersion || []).slice(0, 30).length === 0 ? (
                              <EmptyTableRow colSpan={4} message="沒有缺少版本的作答" />
                            ) : (
                              (problems?.responsesMissingVersion || []).slice(0, 30).map((r) => (
                                <tr key={r.id}>
                                  <td>
                                    <Link to={`/admin/survey-responses/${r.surveyId}`}>
                                      #{r.id}
                                    </Link>
                                  </td>
                                  <td>{surveyLabelById(options.surveys, r.surveyId)}</td>
                                  <td>{r.studentId || '—'}</td>
                                  <td>{formatDt(r.submittedAt)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </Table>
                      </Card.Body>
                    </Card>
                  </div>
                  <div className="col-lg-6">
                    <Card className="border-0 shadow-sm h-100">
                      <Card.Header className="bg-white fw-semibold">
                        答案無法對照的作答
                        <StatusBadge variant="neutral" size="sm" className="ms-2">
                          顯示前 30 筆
                        </StatusBadge>
                      </Card.Header>
                      <Card.Body className="p-0">
                        <Table size="sm" hover responsive className="mb-0">
                          <thead>
                            <tr>
                              <th>作答編號</th>
                              <th>無法對照題數</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {(problems?.responsesWithUnmatchedAnswers || []).slice(0, 30).length ===
                            0 ? (
                              <EmptyTableRow colSpan={3} message="沒有答案無法對照的作答" />
                            ) : (
                              (problems?.responsesWithUnmatchedAnswers || [])
                                .slice(0, 30)
                                .map((r) => (
                                  <tr key={r.responseId}>
                                    <td>#{r.responseId}</td>
                                    <td>
                                      <StatusBadge variant="warning" size="sm">
                                        {r.unmatchedAnswerCount}
                                      </StatusBadge>
                                    </td>
                                    <td>
                                      <Button
                                        as={Link}
                                        to="/admin/survey-answer-mappings"
                                        size="sm"
                                        variant="outline-primary"
                                      >
                                        前往對照
                                      </Button>
                                    </td>
                                  </tr>
                                ))
                            )}
                          </tbody>
                        </Table>
                      </Card.Body>
                    </Card>
                  </div>
                </div>
              </Tab.Pane>

              <Tab.Pane eventKey="repairs">
                <Card className="border-0 shadow-sm">
                  <Card.Header className="bg-white fw-semibold">修復工具</Card.Header>
                  <Card.Body>
                    <Alert variant={executeMode ? 'danger' : 'info'} className="small py-2">
                      {executeMode
                        ? '已啟用實際寫入：執行前請先備份資料庫，並在下方輸入確認字串。'
                        : '預設為「預覽」模式，不會修改資料庫；確認結果後再開啟實際寫入。'}
                    </Alert>
                    <div className="d-flex flex-wrap gap-3 align-items-center mb-3">
                      <Form.Check
                        type="switch"
                        checked={executeMode}
                        onChange={(e) => setExecuteMode(e.target.checked)}
                        label="啟用實際寫入模式（高風險）"
                      />
                      {executeMode ? (
                        <Form.Control
                          style={{ maxWidth: 320 }}
                          value={confirmPhrase}
                          onChange={(e) => setConfirmPhrase(e.target.value)}
                          placeholder="輸入 EXECUTE_SURVEY_REPAIR"
                          aria-label="修復確認字串"
                        />
                      ) : null}
                    </div>
                    <div className="row g-2">
                      {REPAIR_ACTIONS.map((action) => (
                        <div
                          key={action.type}
                          className={action.highlight ? 'col-12' : 'col-md-4'}
                        >
                          <Card className={`h-100 border ${action.highlight ? 'border-primary' : ''}`}>
                            <Card.Body className="d-flex flex-column">
                              <div className="fw-semibold mb-1">{action.title}</div>
                              <p className="small text-muted flex-grow-1 mb-2">{action.desc}</p>
                              <Button
                                variant={
                                  action.highlight
                                    ? executeMode
                                      ? 'danger'
                                      : 'primary'
                                    : executeMode
                                      ? 'danger'
                                      : 'outline-secondary'
                                }
                                size="sm"
                                onClick={() => setConfirm({ show: true, type: action.type })}
                              >
                                {executeMode ? '執行' : '預覽'}
                                {SURVEY_REPAIR_TYPE_LABELS[action.type]
                                  ? `：${SURVEY_REPAIR_TYPE_LABELS[action.type]}`
                                  : ''}
                              </Button>
                            </Card.Body>
                          </Card>
                        </div>
                      ))}
                    </div>
                  </Card.Body>
                </Card>
              </Tab.Pane>

              <Tab.Pane eventKey="runs">
                <Card className="border-0 shadow-sm">
                  <Card.Header className="bg-white fw-semibold">最近修復紀錄</Card.Header>
                  <Card.Body className="p-0">
                    <Table size="sm" hover responsive className="mb-0">
                      <thead>
                        <tr>
                          <th>編號</th>
                          <th>類型</th>
                          <th>模式</th>
                          <th>狀態</th>
                          <th>執行者</th>
                          <th>時間</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(runs || []).length === 0 ? (
                          <EmptyTableRow colSpan={7} message="尚無修復紀錄" />
                        ) : (
                          runs.map((r) => (
                            <tr key={r.id}>
                              <td>{r.id}</td>
                              <td>{SURVEY_REPAIR_TYPE_LABELS[r.repairType] || r.repairType}</td>
                              <td>
                                {r.mode === 'execute' ? (
                                  <StatusBadge variant="danger" size="sm">實際執行</StatusBadge>
                                ) : (
                                  <StatusBadge variant="neutral" size="sm">預覽</StatusBadge>
                                )}
                              </td>
                              <td>{r.status}</td>
                              <td>{r.requestedBy || '—'}</td>
                              <td>{formatDt(r.createdAt)}</td>
                              <td>
                                <Button
                                  size="sm"
                                  variant="outline-primary"
                                  onClick={() => loadRunDetail(r.id)}
                                >
                                  詳情
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              </Tab.Pane>
            </Tab.Content>
          </Tab.Container>
        </>
      ) : null}

      <Modal show={confirm.show} onHide={() => setConfirm({ show: false, type: '' })} centered>
        <Modal.Header closeButton>
          <Modal.Title>確認{executeMode ? '執行' : '預覽'}修復</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            即將{executeMode ? '實際寫入' : '預覽'}：
            <strong>{SURVEY_REPAIR_TYPE_LABELS[confirm.type] || confirm.type}</strong>
          </p>
          {executeMode ? (
            <div className="small text-danger">
              請確認已備份，並在上方輸入 <code>EXECUTE_SURVEY_REPAIR</code>。
            </div>
          ) : (
            <div className="small text-muted">預覽不會修改資料，完成後可至「修復紀錄」查看結果。</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setConfirm({ show: false, type: '' })}>
            取消
          </Button>
          <Button
            variant={executeMode ? 'danger' : 'primary'}
            onClick={() => runRecheck(confirm.type)}
            disabled={executeMode && confirmPhrase !== 'EXECUTE_SURVEY_REPAIR'}
          >
            確認{executeMode ? '執行' : '預覽'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={runDetail.show}
        onHide={() => setRunDetail({ show: false, loading: false, data: null })}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>修復紀錄詳情</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {runDetail.loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" />
            </div>
          ) : null}
          {!runDetail.loading && runDetail.data ? (
            <>
              <div className="d-flex flex-wrap gap-2 mb-3">
                <StatusBadge variant="neutral" size="sm">
                  #{runDetail.data.run?.id}
                </StatusBadge>
                <StatusBadge variant="neutral" size="sm">
                  {SURVEY_REPAIR_TYPE_LABELS[runDetail.data.run?.repairType] ||
                    runDetail.data.run?.repairType}
                </StatusBadge>
                <StatusBadge variant={surveyRepairModeToVariant(runDetail.data.run?.mode)} size="sm">
                  {runDetail.data.run?.mode === 'execute' ? '實際執行' : '預覽'}
                </StatusBadge>
                <StatusBadge variant="info" size="sm">{runDetail.data.run?.status}</StatusBadge>
              </div>
              {runDetail.data.run?.summaryJson &&
              Object.keys(runDetail.data.run.summaryJson).length > 0 ? (
                <Card className="mb-3 border-0 bg-light">
                  <Card.Body className="py-2 small">
                    {Object.entries(runDetail.data.run.summaryJson).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-muted">{k}：</span>
                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </div>
                    ))}
                  </Card.Body>
                </Card>
              ) : null}
              <div className="table-responsive" style={{ maxHeight: 360 }}>
                <Table size="sm" bordered hover className="mb-0">
                  <thead>
                    <tr>
                      <th>資料類型</th>
                      <th>編號</th>
                      <th>動作</th>
                      <th>結果</th>
                      <th>訊息</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(runDetail.data.items || []).slice(0, 200).map((it) => (
                      <tr key={it.id}>
                        <td>{it.entityType}</td>
                        <td>{it.entityId}</td>
                        <td>{it.actionType}</td>
                        <td>
                          <StatusBadge
                            variant={genericResultStatusToVariant(it.resultStatus)}
                            size="sm"
                          >
                            {it.resultStatus}
                          </StatusBadge>
                        </td>
                        <td className="small">{it.message || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          ) : null}
        </Modal.Body>
      </Modal>
    </div>
  );
}
