// 學習有伴團體名次：載入、計算、排行榜與匯出
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Collapse,
  Form,
  Row,
  Spinner,
  Table
} from 'react-bootstrap';
import { getCurrentSemester, SEMESTER_OPTIONS } from '../../utils/semesterUtils';
import { handleAPIError } from '../../utils/errorHandler';
import { calculateBestepTeamRanking, fetchBestepTeamRanking } from '../../services/bestepAdminApi';

const RANKING_SEMESTER_OPTIONS = SEMESTER_OPTIONS.filter((opt) => opt.value !== '');

const SCORE_REWARD_TIERS = [
  { ranks: '第 1 名', amount: '5,000 元 / 人' },
  { ranks: '第 2 名', amount: '4,000 元 / 人' },
  { ranks: '第 3 名', amount: '3,000 元 / 人' },
  { ranks: '第 4 名', amount: '2,500 元 / 人' },
  { ranks: '第 5 名', amount: '2,000 元 / 人' },
  { ranks: '第 6–10 名', amount: '1,500 元 / 人' },
  { ranks: '第 11–20 名', amount: '1,000 元 / 人' }
];

const ATTENDANCE_REWARD_TIERS = [
  { label: '個人四項皆出席', amount: '200 元 / 人' },
  { label: '團隊全員四項皆出席（加碼）', amount: '300 元 / 人' },
  { label: '出席獎勵上限', amount: '500 元 / 人' }
];

function getRankDisplay(rank) {
  if (rank === 1) return { emoji: '🥇', label: '第 1 名' };
  if (rank === 2) return { emoji: '🥈', label: '第 2 名' };
  if (rank === 3) return { emoji: '🥉', label: '第 3 名' };
  return { emoji: null, label: `第 ${rank} 名` };
}

function formatScore(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return Number(value).toFixed(2);
}

function formatMoney(value) {
  if (!value || Number(value) <= 0) return '—';
  return `NT$ ${Number(value).toLocaleString()}`;
}

/** Excel 開啟 CSV 時以文字顯示，保留 09 等前導 0 */
function formatCsvExcelText(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return `\t${text}`;
}

function buildCsvRows(teams, semester, individualAward) {
  const header = [
    '學期',
    '名次',
    '隊伍名稱',
    '隊伍ID',
    '隊伍平均分',
    '團隊全員出席',
    '學號',
    '姓名',
    '身份',
    '身分證字號',
    '手機',
    'Email',
    '個人總分',
    '四項皆出席',
    '出席獎勵(元)',
    '團隊出席加碼(元)',
    '積分獎勵(元)',
    '個人特別獎(元)',
    '合計獎勵(元)'
  ];
  const rows = [header];

  teams.forEach((team) => {
    const members = team.members?.length
      ? team.members
      : [{ studentId: '', name: '', isRepresentative: false, totalScore: null }];
    members.forEach((member, index) => {
      rows.push([
        semester,
        index === 0 ? team.rank : '',
        index === 0 ? team.teamName : '',
        index === 0 ? team.teamId : '',
        index === 0 ? formatScore(team.avgScore) : '',
        index === 0 ? (team.teamAllAttended ? '是' : '否') : '',
        member.studentId,
        member.name,
        member.isRepresentative ? '代表者' : '成員',
        member.idNumber || '',
        formatCsvExcelText(member.phone),
        member.email || '',
        member.totalScore != null ? formatScore(member.totalScore) : '',
        member.attendedAllFour ? '是' : '否',
        member.attendanceReward ?? 0,
        member.teamAttendanceBonus ?? 0,
        member.scoreReward ?? 0,
        member.individualSpecialReward ?? 0,
        member.totalReward ?? 0
      ]);
    });
  });

  if (individualAward?.winners?.length) {
    rows.push([]);
    rows.push([
      '個人特別獎',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    ]);
    individualAward.winners.forEach((winner) => {
      rows.push([
        semester,
        '',
        '個人特別獎',
        '',
        '',
        '',
        winner.studentId,
        winner.name,
        '個人特別獎',
        winner.idNumber || '',
        formatCsvExcelText(winner.phone),
        winner.email || '',
        formatScore(winner.totalScore),
        '',
        0,
        0,
        0,
        individualAward.rewardAmount,
        individualAward.rewardAmount
      ]);
    });
  }

  return rows;
}

function downloadCsv(filename, rows) {
  const escape = (cell) => {
    const text = String(cell ?? '');
    // 前導 tab 的儲存格需加引號，Excel 才會當文字處理
    const needsQuote = /[",\n]/.test(text) || text.startsWith('\t');
    if (needsQuote) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  const content = `\uFEFF${rows.map((row) => row.map(escape).join(',')).join('\n')}`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

export default function LearningPartnerTeamRankingPanel({
  token: tokenProp,
  semester: controlledSemester,
  onSemesterChange,
  showWorkflowHint = true,
  importPageLink = '/admin/english-test/import'
}) {
  const token = tokenProp || localStorage.getItem('token');
  const [internalSemester, setInternalSemester] = useState(
    controlledSemester || getCurrentSemester() || '114-1'
  );
  const semester = controlledSemester ?? internalSemester;

  const setSemester = (value) => {
    if (onSemesterChange) {
      onSemesterChange(value);
    } else {
      setInternalSemester(value);
    }
  };

  const [teams, setTeams] = useState([]);
  const [individualAward, setIndividualAward] = useState(null);
  const [calculatedAt, setCalculatedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const applyRankingData = (data) => {
    setTeams(data.teams || []);
    setIndividualAward(data.individualAward || null);
    setCalculatedAt(data.calculatedAt || null);
  };

  const loadRankings = useCallback(async () => {
    if (!semester) {
      setError('請選擇學期');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const data = await fetchBestepTeamRanking(token, semester);
      applyRankingData(data);
    } catch (err) {
      setError(handleAPIError(err));
      setTeams([]);
      setIndividualAward(null);
      setCalculatedAt(null);
    } finally {
      setLoading(false);
    }
  }, [semester, token]);

  useEffect(() => {
    loadRankings();
  }, [loadRankings]);

  const handleCalculate = async () => {
    setCalculating(true);
    setError('');
    setSuccessMessage('');

    try {
      const data = await calculateBestepTeamRanking(token, semester);
      applyRankingData(data);
      setCalculatedAt(data.calculatedAt || new Date().toISOString());
      setSuccessMessage(
        `已依 ${semester} 學期成績重新計算 ${data.teams?.length || 0} 支隊伍名次，並更新出席獎勵與個人特別獎。`
      );
    } catch (err) {
      setError(handleAPIError(err));
    } finally {
      setCalculating(false);
    }
  };

  const filteredTeams = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((team) => {
      const haystack = [
        team.teamName,
        String(team.teamId),
        String(team.rank),
        ...(team.members || []).flatMap((m) => [m.name, m.studentId])
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [teams, searchTerm]);

  const stats = useMemo(() => {
    const allMembers = teams.flatMap((t) => t.members || []);
    const attendanceRewarded = allMembers.filter((m) => (m.attendanceTotal || 0) > 0).length;
    const fullAttendanceTeams = teams.filter((t) => t.teamAllAttended).length;

    if (!teams.length) {
      return {
        teamCount: 0,
        topAvg: null,
        rewardedCount: 0,
        attendanceRewarded: 0,
        fullAttendanceTeams: 0
      };
    }

    const topAvg = Math.max(...teams.map((t) => Number(t.avgScore) || 0));
    const rewardedCount = teams.filter((t) => Number(t.rewardAmount) > 0).length;

    return {
      teamCount: teams.length,
      topAvg: Number.isFinite(topAvg) ? topAvg : null,
      rewardedCount,
      attendanceRewarded,
      fullAttendanceTeams
    };
  }, [teams]);

  const handleExport = () => {
    if (!teams.length) return;
    downloadCsv(
      `learning-partner-ranking-${semester}-${new Date().toISOString().split('T')[0]}.csv`,
      buildCsvRows(teams, semester, individualAward)
    );
  };

  return (
    <div>
      {showWorkflowHint && (
        <Alert variant="light" className="border mb-4">
          <div className="fw-semibold mb-2">建議作業流程</div>
          <ol className="mb-2 ps-3">
            <li>至「培力英檢資料匯入」完成成績與出席資料匯入（聽讀說寫分數、出席狀態）</li>
            <li>確認團體報名狀態為「已完成」（全員同意）</li>
            <li>選擇學期後按「重新計算名次」，系統會計算積分排名、出席獎勵與個人特別獎</li>
          </ol>
          <div className="small text-muted">
            名次結果會同步顯示於班級 BESTEP 總覽的「團體報名」欄位。
            {importPageLink && (
              <>
                {' '}
                <a href={importPageLink}>前往資料匯入</a>
              </>
            )}
          </div>
        </Alert>
      )}

      <Row className="g-3 mb-4">
        <Col md={3}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body>
              <div className="text-muted small">已排名隊伍</div>
              <div className="fs-3 fw-bold text-primary">{stats.teamCount}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body>
              <div className="text-muted small">最高隊伍平均分</div>
              <div className="fs-3 fw-bold text-success">
                {stats.topAvg != null ? formatScore(stats.topAvg) : '—'}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body>
              <div className="text-muted small">積分獎勵隊伍（前 20 名）</div>
              <div className="fs-3 fw-bold text-warning">{stats.rewardedCount}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body>
              <div className="text-muted small">出席獎勵 / 全員出席隊伍</div>
              <div className="fs-3 fw-bold text-info">
                {stats.attendanceRewarded}
                <span className="fs-6 text-muted fw-normal"> 人 / </span>
                {stats.fullAttendanceTeams}
                <span className="fs-6 text-muted fw-normal"> 隊</span>
              </div>
              {calculatedAt && (
                <div className="small text-muted mt-1">
                  上次計算：{new Date(calculatedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {individualAward && (
        <Card className="mb-4 border-warning">
          <Card.Header className="bg-warning bg-opacity-10 fw-semibold d-flex justify-content-between align-items-center">
            <span>個人特別獎（規則 3）</span>
            {individualAward.winners?.length > 0 && (
              <Badge bg="warning" text="dark">NT$ 5,000</Badge>
            )}
          </Card.Header>
          <Card.Body>
            <p className="small text-muted mb-3">
              僅從本學期已完成團體報名、四項皆出席，且聽讀達 B1+、說寫達 B1 以上的學生中，取總分最高者。
              {individualAward.eligibleCount != null && (
                <>
                  {' '}
                  符合資格：
                  {individualAward.eligibleCount}
                  人。
                </>
              )}
            </p>
            {individualAward.winners?.length > 0 ? (
              <>
                {individualAward.isTied && (
                  <Alert variant="warning" className="py-2 mb-3">
                    多名學生總分並列最高，以下皆列為獲獎候選，請人工確認後發放。
                  </Alert>
                )}
                <Table size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th>學號</th>
                      <th>姓名</th>
                      <th className="text-end">個人總分</th>
                      <th className="text-end">獎勵金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {individualAward.winners.map((winner) => (
                      <tr key={winner.studentId}>
                        <td>{winner.studentId}</td>
                        <td className="fw-semibold">{winner.name}</td>
                        <td className="text-end">{formatScore(winner.totalScore)}</td>
                        <td className="text-end text-success fw-semibold">
                          {formatMoney(individualAward.rewardAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </>
            ) : (
              <Alert variant="light" className="mb-0 border">
                目前尚無符合團體賽資格且達 CEFR 門檻的學生，或尚未匯入完整成績／出席資料。
              </Alert>
            )}
          </Card.Body>
        </Card>
      )}

      <Card className="mb-4">
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col md={3}>
              <Form.Label>學期</Form.Label>
              <Form.Select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                disabled={loading || calculating}
              >
                {RANKING_SEMESTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={5}>
              <Form.Label>搜尋隊伍 / 學號 / 姓名</Form.Label>
              <Form.Control
                type="search"
                placeholder="輸入關鍵字篩選排行榜…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={!teams.length}
              />
            </Col>
            <Col md={4} className="d-flex flex-wrap gap-2">
              <Button
                variant="outline-secondary"
                onClick={loadRankings}
                disabled={loading || calculating}
              >
                {loading ? (
                  <>
                    <Spinner size="sm" className="me-2" />
                    載入中
                  </>
                ) : (
                  <>
                    <i className="fas fa-sync-alt me-2" aria-hidden="true" />
                    重新載入
                  </>
                )}
              </Button>
              <Button
                variant="primary"
                onClick={handleCalculate}
                disabled={calculating || loading}
              >
                {calculating ? (
                  <>
                    <Spinner size="sm" className="me-2" />
                    計算中
                  </>
                ) : (
                  <>
                    <i className="fas fa-calculator me-2" aria-hidden="true" />
                    重新計算名次
                  </>
                )}
              </Button>
              <Button
                variant="outline-success"
                onClick={handleExport}
                disabled={!teams.length}
              >
                <i className="fas fa-download me-2" aria-hidden="true" />
                匯出 CSV
              </Button>
            </Col>
          </Row>

          {error && (
            <Alert variant="danger" className="mt-3 mb-0">
              {error}
            </Alert>
          )}
          {successMessage && (
            <Alert variant="success" className="mt-3 mb-0">
              {successMessage}
            </Alert>
          )}
        </Card.Body>
      </Card>

      <Row className="g-4">
        <Col lg={8}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span className="fw-semibold">團體名次排行榜</span>
              {filteredTeams.length > 0 && (
                <Badge bg="secondary">{filteredTeams.length} 隊</Badge>
              )}
            </Card.Header>
            <Card.Body className="p-0">
              {loading && teams.length === 0 ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <p className="text-muted mt-3 mb-0">載入名次資料中…</p>
                </div>
              ) : filteredTeams.length === 0 ? (
                <div className="text-center py-5 px-3">
                  <div className="fs-1 mb-2" aria-hidden="true">📊</div>
                  <p className="fw-semibold mb-1">
                    {teams.length === 0 ? '尚無名次資料' : '沒有符合搜尋條件的隊伍'}
                  </p>
                  <p className="text-muted small mb-3">
                    {teams.length === 0
                      ? '請先匯入培力英檢成績與出席資料，再按「重新計算名次」。僅「已完成」且有成績的隊伍會列入。'
                      : '請調整搜尋關鍵字。'}
                  </p>
                  {teams.length === 0 && (
                    <Button variant="primary" onClick={handleCalculate} disabled={calculating}>
                      立即計算名次
                    </Button>
                  )}
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover className="mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: '88px' }}>名次</th>
                        <th>隊伍</th>
                        <th className="text-end">平均分</th>
                        <th className="text-end">積分獎勵</th>
                        <th className="text-end">出席</th>
                        <th style={{ width: '72px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTeams.map((team) => {
                        const rankInfo = getRankDisplay(team.rank);
                        const isExpanded = expandedTeamId === team.teamId;
                        const membersMissingScore = (team.members || []).filter(
                          (m) => m.totalScore == null
                        ).length;
                        const attendanceMembers = (team.members || []).filter(
                          (m) => m.attendedAllFour
                        ).length;

                        return (
                          <React.Fragment key={team.teamId}>
                            <tr
                              className={team.rank <= 3 ? 'table-warning' : undefined}
                              style={team.rank <= 3 ? { '--bs-table-bg': 'rgba(255, 193, 7, 0.08)' } : undefined}
                            >
                              <td>
                                <div className="fw-bold">
                                  {rankInfo.emoji && (
                                    <span className="me-1" aria-hidden="true">{rankInfo.emoji}</span>
                                  )}
                                  {rankInfo.label}
                                </div>
                              </td>
                              <td>
                                <div className="fw-semibold">{team.teamName}</div>
                                <div className="small text-muted">
                                  隊伍 ID {team.teamId}
                                  {' · '}
                                  {team.members?.length || 0} 人
                                  {membersMissingScore > 0 && (
                                    <Badge bg="warning" text="dark" className="ms-2">
                                      {membersMissingScore} 人尚無成績
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="text-end fw-semibold">{formatScore(team.avgScore)}</td>
                              <td className="text-end">
                                {team.rewardAmount > 0 ? (
                                  <span className="text-success fw-semibold">
                                    {formatMoney(team.rewardAmount)}
                                  </span>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                              <td className="text-end">
                                {team.teamAllAttended ? (
                                  <Badge bg="success">全員出席</Badge>
                                ) : (
                                  <span className="small text-muted">
                                    {attendanceMembers}/{team.members?.length || 0} 人
                                  </span>
                                )}
                              </td>
                              <td className="text-end">
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="text-decoration-none p-0"
                                  onClick={() => setExpandedTeamId(isExpanded ? null : team.teamId)}
                                  aria-expanded={isExpanded}
                                >
                                  {isExpanded ? '收合' : '成員'}
                                </Button>
                              </td>
                            </tr>
                            <tr className="p-0 border-0">
                              <td colSpan={6} className="p-0 border-0">
                                <Collapse in={isExpanded}>
                                  <div className="px-3 pb-3 bg-light">
                                    <Table size="sm" className="mb-0 bg-white">
                                      <thead>
                                        <tr>
                                          <th>身份</th>
                                          <th>姓名</th>
                                          <th>學號</th>
                                          <th className="text-end">個人總分</th>
                                          <th className="text-center">四項出席</th>
                                          <th className="text-end">出席獎勵</th>
                                          <th className="text-end">積分獎勵</th>
                                          <th className="text-end">特別獎</th>
                                          <th className="text-end">合計</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(team.members || []).map((member) => (
                                          <tr key={member.studentId}>
                                            <td>
                                              {member.isRepresentative ? (
                                                <Badge bg="warning" text="dark">代表者</Badge>
                                              ) : (
                                                '成員'
                                              )}
                                            </td>
                                            <td>{member.name}</td>
                                            <td>{member.studentId}</td>
                                            <td className="text-end">
                                              {formatScore(member.totalScore)}
                                            </td>
                                            <td className="text-center">
                                              {member.attendedAllFour ? (
                                                <Badge bg="success">✓</Badge>
                                              ) : (
                                                <span className="text-muted">—</span>
                                              )}
                                            </td>
                                            <td className="text-end">
                                              {(member.attendanceTotal || 0) > 0 ? (
                                                <span className="text-info">
                                                  {formatMoney(member.attendanceTotal)}
                                                  {member.teamAttendanceBonus > 0 && (
                                                    <div className="small text-muted">
                                                      含加碼 {formatMoney(member.teamAttendanceBonus)}
                                                    </div>
                                                  )}
                                                </span>
                                              ) : (
                                                <span className="text-muted">—</span>
                                              )}
                                            </td>
                                            <td className="text-end">
                                              {(member.scoreReward || 0) > 0
                                                ? formatMoney(member.scoreReward)
                                                : '—'}
                                            </td>
                                            <td className="text-end">
                                              {(member.individualSpecialReward || 0) > 0 ? (
                                                <span className="text-warning fw-semibold">
                                                  {formatMoney(member.individualSpecialReward)}
                                                </span>
                                              ) : (
                                                '—'
                                              )}
                                            </td>
                                            <td className="text-end fw-semibold">
                                              {(member.totalReward || 0) > 0
                                                ? formatMoney(member.totalReward)
                                                : '—'}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </Table>
                                  </div>
                                </Collapse>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <Card className="mb-3">
            <Card.Header className="fw-semibold">積分獎勵對照（規則 2）</Card.Header>
            <Card.Body className="p-0">
              <Table size="sm" className="mb-0">
                <thead className="table-light">
                  <tr>
                    <th>名次</th>
                    <th className="text-end">每人獎勵</th>
                  </tr>
                </thead>
                <tbody>
                  {SCORE_REWARD_TIERS.map((tier) => (
                    <tr key={tier.ranks}>
                      <td>{tier.ranks}</td>
                      <td className="text-end">{tier.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
            <Card.Footer className="small text-muted">
              並列時採「跳號」規則：例如 3 隊並列第 1 名，下一隊為第 4 名。
            </Card.Footer>
          </Card>

          <Card className="mb-3">
            <Card.Header className="fw-semibold">出席獎勵對照（規則 1）</Card.Header>
            <Card.Body className="p-0">
              <Table size="sm" className="mb-0">
                <thead className="table-light">
                  <tr>
                    <th>條件</th>
                    <th className="text-end">獎勵</th>
                  </tr>
                </thead>
                <tbody>
                  {ATTENDANCE_REWARD_TIERS.map((tier) => (
                    <tr key={tier.label}>
                      <td>{tier.label}</td>
                      <td className="text-end">{tier.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header className="fw-semibold">個人特別獎（規則 3）</Card.Header>
            <Card.Body className="small">
              <p className="mb-2">
                僅從本學期已完成團體報名、四項皆出席，且聽讀達 B1+、說寫達 B1 以上的學生中，取總分最高者，可獲得
                <strong> 新台幣 5,000 元 </strong>
                獎勵金。
              </p>
              <p className="text-muted mb-0">
                若多人並列最高分，系統會列出所有候選人供人工確認。
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
