// Deprecated legacy/MVP student profile compatibility layer.
// Official Learning Journey student profiles should use
// /api/admin/learning-journey-v3/* and LearningJourneyStudentProfilePage.
// Do not add new product features here; route future work to V3 or the
// Learning Journey Hub.
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import { Card, Table, Button, Spinner, Alert, Badge, Row, Col } from 'react-bootstrap';
import { handleAPIError } from '../utils/errorHandler';
import { fetchStudentProfile } from '../services/studentApi';

const RISK_LABEL = { low: '低', medium: '中', high: '高' };

export default function StudentLearningProfilePage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutletContext() || {};
  const token = outlet.token || localStorage.getItem('token');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token || !studentId) return;
    setLoading(true);
    setError('');
    try {
      const sp = new URLSearchParams(location.search);
      const query = new URLSearchParams();
      const fromSemester = sp.get('fromSemester');
      const toSemester = sp.get('toSemester');
      if (fromSemester) query.set('fromSemester', fromSemester);
      if (toSemester) query.set('toSemester', toSemester);
      const json = await fetchStudentProfile(token, studentId, query);
      setData(json);
    } catch (e) {
      const errMsg = handleAPIError(e);
      setError(errMsg?.display || errMsg?.zh || '載入失敗');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, studentId, location.search]);

  useEffect(() => {
    load();
  }, [load]);

  const skillLabelMap = {
    LISTENING: '聽力',
    READING: '閱讀',
    SPEAKING: '口說',
    WRITING: '寫作',
  };

  const englishBestBySkill = data?.englishTest?.bestBySkill || {};
  const overallByAttempt = data?.englishTest?.cefrGrowth?.overallByAttempt || [];
  const cefrGrowthBySkill = data?.englishTest?.cefrGrowth?.bySkill || {};

  return (
    <div className="container-fluid px-2 px-md-3">
      <nav aria-label="breadcrumb" className="mb-2 small">
        <ol className="breadcrumb mb-0">
          <li className="breadcrumb-item"><a href="/admin">管理後台</a></li>
          <li className="breadcrumb-item active" aria-current="page">學生學習歷程</li>
        </ol>
      </nav>

      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h2 className="h5 mb-0">學生學習歷程</h2>
        <Button variant="outline-secondary" size="sm" onClick={() => navigate(-1)}>
          返回
        </Button>
      </div>

      {loading && (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      )}
      {error && <Alert variant="danger">{error}</Alert>}

      {!loading && data && (
        <>
          <Row className="g-3 mb-4">
            <Col md={3}>
              <Card className="h-100 border-primary">
                <Card.Body>
                  <div className="text-muted small">學號</div>
                  <div className="fw-semibold">{data.studentId}</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-100">
                <Card.Body>
                  <div className="text-muted small">累計簽到次數</div>
                  <div className="fs-5">{data.summary?.totalParticipation ?? '—'}</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-100">
                <Card.Body>
                  <div className="text-muted small">BESTEP 平均分／最佳總分</div>
                  <div className="fs-6">
                    {data.summary?.avgScore ?? '—'} ／ {data.summary?.bestScore ?? '—'}
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-100">
                <Card.Body>
                  <div className="text-muted small">風險等級</div>
                  <Badge bg={data.summary?.riskLevel === 'high' ? 'danger' : data.summary?.riskLevel === 'medium' ? 'warning' : 'success'}>
                    {RISK_LABEL[data.summary?.riskLevel] || data.summary?.riskLevel || '—'}
                  </Badge>
                  <span className="text-muted small ms-2">(score: {data.summary?.riskScore})</span>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-100">
                <Card.Body>
                  <div className="text-muted small">英檢整體最佳 CEFR</div>
                  <div className="fs-5 fw-semibold">{data?.englishTest?.overallBestCefr || '—'}</div>
                  <div className="text-muted small mt-1">
                    （各次 overall 為各項最低 CEFR）
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Card className="mb-4">
            <Card.Header>依學期摘要</Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table striped hover size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th>學期</th>
                      <th>簽到次數</th>
                      <th>No-show 違規</th>
                      <th>活動違規(紀錄)</th>
                      <th>培力報名</th>
                      <th>抵免</th>
                      <th>成績總分</th>
                      <th>達標</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.semesters || []).map((row) => (
                      <tr key={row.semester}>
                        <td>{row.semester}</td>
                        <td>{row.participation?.attendedCountTotal ?? '—'}</td>
                        <td>{row.participation?.noShowCount ?? '—'}</td>
                        <td>{row.violations}</td>
                        <td>{row.bestep?.registrationStatus || '—'}</td>
                        <td>{row.bestep?.exemption?.displayLabel || '無'}</td>
                        <td>{row.bestep?.score?.totalScore ?? '—'}</td>
                        <td>{row.bestep?.score?.passed ? '是' : '否'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>

          <Card className="mb-4">
            <Card.Header>活動紀錄（Reservations / Violations）</Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table striped hover size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th>學期</th>
                      <th>預約數</th>
                      <th>簽到數</th>
                      <th>No-show</th>
                      <th>違規（EventViolation 記錄）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.semesters || []).map((row) => (
                      <tr key={`activity-${row.semester}`}>
                        <td>{row.semester}</td>
                        <td>{row.participation?.reservedCount ?? '—'}</td>
                        <td>{row.participation?.attendedCountTotal ?? '—'}</td>
                        <td>{row.participation?.noShowCount ?? '—'}</td>
                        <td>{row.violations ?? 0}</td>
                      </tr>
                    ))}
                    {(data.semesters || []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-muted">
                          沒有活動紀錄
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>

          <Card className="mb-4">
            <Card.Header>英檢紀錄（et_exam_attempts）</Card.Header>
            <Card.Body>
              {(data.etExamAttempts || []).length === 0 ? (
                <div className="text-muted">尚無英檢紀錄</div>
              ) : (
                <div className="table-responsive">
                  <Table striped hover size="sm" className="mb-0">
                    <thead>
                      <tr>
                        <th>測驗日期</th>
                        <th>測驗類型</th>
                        <th>overall CEFR</th>
                        <th>四項能力</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(data.etExamAttempts || [])]
                        .sort((a, b) => new Date(a.testDate || 0) - new Date(b.testDate || 0))
                        .map((a) => (
                          <tr key={`et-${a.id}`}>
                            <td>{a.testDate || '—'}</td>
                            <td>{a.testType || '—'}</td>
                            <td>{a.overallCefr || '—'}</td>
                            <td className="small">
                              {(a.scores || [])
                                .map((s) => `${skillLabelMap[s.skill] || s.skill}:${s.cefr || '—'}(${s.rawScore ?? '—'})`)
                                .join(' / ')}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>

          <Card className="mb-4">
            <Card.Header>CEFR 成長（overall / 各項）</Card.Header>
            <Card.Body>
              <div className="row g-3 mb-3">
                {Object.entries(englishBestBySkill).map(([skill, v]) => (
                  <div key={skill} className="col-12 col-md-3">
                    <div className="border rounded p-2 h-100">
                      <div className="text-muted small">{skillLabelMap[skill] || skill}</div>
                      <div className="fs-5 fw-semibold">{v?.bestCefr || '—'}</div>
                      <div className="text-muted small">最佳分數：{v?.bestRawScore ?? '—'}</div>
                    </div>
                  </div>
                ))}
                {Object.keys(englishBestBySkill).length === 0 && (
                  <div className="text-muted">尚無足夠資料計算 CEFR 成長</div>
                )}
              </div>

              <div className="table-responsive">
                <Table striped hover size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th>測驗日期</th>
                      <th>overall CEFR</th>
                      <th>聽力</th>
                      <th>閱讀</th>
                      <th>口說</th>
                      <th>寫作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overallByAttempt.map((row) => {
                      const td = row.testDate;
                      const pickSkillCefr = (skill) => {
                        const arr = cefrGrowthBySkill?.[skill] || [];
                        const hit = arr.find((x) => x.testDate === td);
                        return hit?.cefr || '—';
                      };
                      return (
                        <tr key={`growth-${td}`}>
                          <td>{td || '—'}</td>
                          <td>{row.overallCefr || '—'}</td>
                          <td>{pickSkillCefr('LISTENING')}</td>
                          <td>{pickSkillCefr('READING')}</td>
                          <td>{pickSkillCefr('SPEAKING')}</td>
                          <td>{pickSkillCefr('WRITING')}</td>
                        </tr>
                      );
                    })}
                    {overallByAttempt.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-muted">
                          尚無 CEFR 成長資料
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>

          {/* 英語學習歷程中心資訊已在「英檢紀錄」與「CEFR 成長」卡片中呈現 */}
        </>
      )}
    </div>
  );
}
