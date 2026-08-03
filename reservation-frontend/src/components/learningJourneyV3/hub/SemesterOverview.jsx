import React from 'react';
import { Link } from 'react-router-dom';
import {
  EMPTY,
  formatDate,
  fmtRate,
  SKILL_KEYS,
  SKILL_LABELS,
} from '../../../utils/learningJourneyHubFormatters';
import { EmptyState, KpiCard } from './HubUi';

export default function SemesterOverview({ overview, quality, riskData, historyRecords }) {
  const summaryData = overview || {};
  const skills = summaryData.skills || {};
  const gradeRows = Array.isArray(summaryData.byGrade) ? summaryData.byGrade : [];
  const departmentRows = Array.isArray(summaryData.byDepartment) ? summaryData.byDepartment : [];
  const riskItems = Array.isArray(riskData?.items) ? riskData.items : Array.isArray(riskData?.topStudents) ? riskData.topStudents : [];

  if (!overview && !riskData) {
    return <EmptyState>此區塊尚未取得資料，請點擊「查看學期總覽」。</EmptyState>;
  }

  return (
    <div className="row g-3">
      <KpiCard label="名冊人數" value={summaryData.denominator ?? 0} />
      {SKILL_KEYS.map((skill) => (
        <KpiCard
          key={skill}
          label={`${SKILL_LABELS[skill]} B2+`}
          value={`${skills?.[skill]?.b2PlusCount ?? 0} 人`}
          hint={fmtRate(skills?.[skill]?.rate)}
        />
      ))}

      <div className="col-lg-7">
        <div className="card h-100">
          <div className="card-header py-2 fw-semibold">四技能 B2+ 達成比例</div>
          <div className="card-body">
            {Object.keys(SKILL_LABELS).map((skill) => {
              const rate = Number(skills?.[skill]?.rate ?? 0);
              return (
                <div className="mb-3" key={skill}>
                  <div className="d-flex justify-content-between small mb-1">
                    <span>{SKILL_LABELS[skill]}</span>
                    <span>{skills?.[skill]?.b2PlusCount ?? 0} / {summaryData.denominator ?? 0}（{fmtRate(rate)}）</span>
                  </div>
                  <div className="progress" style={{ height: 10 }}>
                    <div className="progress-bar" style={{ width: `${Math.max(0, Math.min(rate * 100, 100))}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="col-lg-5">
        <div className="card h-100">
          <div className="card-header py-2 fw-semibold">風險學生</div>
          <div className="card-body small">
            {riskItems.length === 0 ? <div className="text-muted">目前無高風險學生清單。</div> : (
              <div className="table-responsive">
                <table className="table table-sm mb-0 align-middle">
                  <thead><tr><th>學號</th><th>分數</th><th>原因</th><th>操作</th></tr></thead>
                  <tbody>
                    {riskItems.map((row) => (
                      <tr key={row.studentId}>
                        <td className="font-monospace">{row.studentId}</td>
                        <td>{row.riskScore ?? EMPTY}</td>
                        <td>{(row.reasons || []).map((r) => r.message || r).join('；') || EMPTY}</td>
                        <td>
                          <Link className="btn btn-sm btn-outline-primary" to={`/admin/learning-journey/students/${encodeURIComponent(row.studentId)}?semesterId=${encodeURIComponent(summaryData.semesterId || '')}`}>
                            查看
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="col-12">
        <div className="card">
          <div className="card-header py-2 fw-semibold">年級統計</div>
          <div className="card-body p-0">
            {gradeRows.length === 0 ? (
              <div className="p-3 text-muted small">尚無年級統計資料。</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-striped mb-0 align-middle">
                  <thead className="table-light">
                    <tr><th>年級</th><th>名冊人數</th><th>聽力 B2+</th><th>閱讀 B2+</th><th>口說 B2+</th><th>寫作 B2+</th></tr>
                  </thead>
                  <tbody>
                    {gradeRows.map((row) => (
                      <tr key={row.grade || 'unknown'}>
                        <td>{row.grade || EMPTY}</td>
                        <td>{row.denominator ?? 0}</td>
                        {SKILL_KEYS.map((skill) => (
                          <td key={skill}>{row.skills?.[skill]?.b2PlusCount ?? 0}（{fmtRate(row.skills?.[skill]?.rate)}）</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="col-12">
        <div className="card">
          <div className="card-header py-2 fw-semibold">各系所統計</div>
          <div className="card-body p-0">
            {departmentRows.length === 0 ? (
              <div className="p-3 text-muted small">尚無系所統計資料。</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-striped mb-0 align-middle">
                  <thead className="table-light">
                    <tr><th>系所</th><th>名冊人數</th><th>聽力 B2+</th><th>閱讀 B2+</th><th>口說 B2+</th><th>寫作 B2+</th></tr>
                  </thead>
                  <tbody>
                    {departmentRows.map((row) => (
                      <tr key={row.department || 'unknown'}>
                        <td>{row.department || EMPTY}</td>
                        <td>{row.denominator ?? 0}</td>
                        {SKILL_KEYS.map((skill) => (
                          <td key={skill}>{row.skills?.[skill]?.b2PlusCount ?? 0}（{fmtRate(row.skills?.[skill]?.rate)}）</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="col-lg-6">
        <div className="card h-100">
          <div className="card-header py-2 fw-semibold">資料品質摘要</div>
          <div className="card-body">
            {!quality ? (
              <div className="text-muted small">尚無資料品質摘要。</div>
            ) : (
              <div className="row g-2">
                <div className="col-6"><div className="text-muted small">名冊人數</div><div className="h5">{quality.kpis?.rosterStudentCount ?? 0}</div></div>
                <div className="col-6"><div className="text-muted small">無成績學生</div><div className="h5">{quality.kpis?.noScoreStudentCount ?? 0}</div></div>
                <div className="col-6"><div className="text-muted small">成績覆蓋率</div><div className="h5">{fmtRate(quality.rates?.scoreCoverageRate)}</div></div>
                <div className="col-6"><div className="text-muted small">名冊完整率</div><div className="h5">{fmtRate(quality.rates?.rosterCompletenessRate)}</div></div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="col-lg-6">
        <div className="card h-100">
          <div className="card-header py-2 fw-semibold">歷史快照摘要</div>
          <div className="card-body small">
            {!Array.isArray(historyRecords) || historyRecords.length === 0 ? (
              <div className="text-muted">尚無歷史快照。載入學期總覽後會保留最近指標快照於本機瀏覽器。</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm mb-0 align-middle">
                  <thead className="table-light"><tr><th>時間</th><th>學期</th><th>名冊</th><th>聽力 B2+</th><th>閱讀 B2+</th></tr></thead>
                  <tbody>
                    {historyRecords.slice(0, 5).map((record) => (
                      <tr key={record.id}>
                        <td>{formatDate(record.createdAt)}</td>
                        <td>{record.semesterId}</td>
                        <td>{record.summary?.denominator ?? 0}</td>
                        <td>{fmtRate(record.summary?.skills?.listening?.rate)}</td>
                        <td>{fmtRate(record.summary?.skills?.reading?.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
