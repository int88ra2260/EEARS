import React from 'react';

const SKILL_ORDER = ['listening', 'reading', 'speaking', 'writing'];

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatPeople(value) {
  const count = finiteNumber(value);
  if (count == null) return '未提供';
  return count.toLocaleString('zh-Hant');
}

function formatRate(cell) {
  const mean = finiteNumber(cell?.meanRate);
  const count = finiteNumber(cell?.count);
  if (mean == null || count == null || count === 0) return '沒有細項';
  const weak = cell.weakest ? '，較弱' : '';
  return `${mean.toFixed(1)}%（${formatPeople(count)} 人${weak}）`;
}

function partsForSkill(parts, skill) {
  return (parts || []).filter((part) => part.skill === skill);
}

function SkillHeading({ label }) {
  return <h4 className="et-analytics-part-skill">{label}</h4>;
}

function historyHasRates(history) {
  return (history?.parts || []).some((part) => (
    Object.values(part.bySemester || {}).some((cell) => finiteNumber(cell?.count) > 0)
  ));
}

function HistoryTable({ history }) {
  const semesters = history?.semesters || [];
  if (semesters.length === 0) {
    return <p className="et-analytics-status" role="status">還沒有可比較的培力成績。</p>;
  }
  if (!historyHasRates(history)) {
    return (
      <p className="et-analytics-status" role="status">
        這些考試還沒有三部分分數。請用含部分分數與達成率的官方成績檔重新匯入，這裡才看得到各部分的變化。
      </p>
    );
  }
  return SKILL_ORDER.map((skill) => {
    const rows = partsForSkill(history.parts, skill);
    if (rows.length === 0) return null;
    return (
      <div key={skill}>
        <SkillHeading label={rows[0].skillLabel} />
        <div className="et-analytics-table-wrap">
          <table className="table table-sm et-analytics-table">
            <caption className="et-analytics-caption">
              {rows[0].skillLabel}各部分的平均達成率。每一格是該次考試、有該部分分數的人數。
            </caption>
            <thead>
              <tr>
                <th scope="col">部分</th>
                <th scope="col">滿分</th>
                {semesters.map((semester) => (
                  <th key={semester} scope="col">{semester}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.skill}-${row.part}`}>
                  <th scope="row">{row.label}</th>
                  <td>{row.fullMark}</td>
                  {semesters.map((semester) => {
                    const cell = row.bySemester?.[semester];
                    return (
                      <td key={semester} className={cell?.weakest ? 'et-analytics-weak' : undefined}>
                        {formatRate(cell)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  });
}

function PartMeanTable({ parts, caption }) {
  const rows = parts || [];
  if (rows.length === 0) {
    return <p className="et-analytics-status" role="status">這個範圍沒有可比較的部分分數。</p>;
  }
  return SKILL_ORDER.map((skill) => {
    const skillRows = partsForSkill(rows, skill);
    if (skillRows.length === 0) return null;
    return (
      <div key={skill}>
        <SkillHeading label={skillRows[0].skillLabel} />
        <div className="et-analytics-table-wrap">
          <table className="table table-sm et-analytics-table">
            <caption className="et-analytics-caption">{caption}</caption>
            <thead>
              <tr>
                <th scope="col">部分</th>
                <th scope="col">滿分</th>
                <th scope="col">平均達成率</th>
              </tr>
            </thead>
            <tbody>
              {skillRows.map((row) => (
                <tr key={`${row.skill}-${row.part}`}>
                  <th scope="row">{row.label}</th>
                  <td>{row.fullMark}</td>
                  <td className={row.weakest ? 'et-analytics-weak' : undefined}>{formatRate(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  });
}

function ApproachingTables({ approaching }) {
  if (approaching?.status === 'needs_single_semester') {
    return <p className="et-analytics-status" role="status">B1 與 B1+ 要看單一次考試。請改選單一學期。</p>;
  }
  if (approaching?.status === 'no_part_scores') {
    return (
      <p className="et-analytics-status" role="status">
        這個學期的成績還沒有三部分分數。請用含部分分數與達成率的成績檔重新匯入。
      </p>
    );
  }
  return (approaching?.skills || []).map((skill) => (
    <div key={skill.skill}>
      <SkillHeading label={skill.label} />
      {(skill.groups || []).map((group) => (
        <div key={group.level} className="et-analytics-part-group">
          <h5>{group.level === 'B1與B1+' ? 'B1 與 B1+ 合併' : group.level}</h5>
          <p>{formatPeople(group.count)} 人有這一級別，而且有部分分數。</p>
          {group.count > 0 ? (
            <div className="et-analytics-table-wrap">
              <table className="table table-sm et-analytics-table">
                <caption className="et-analytics-caption">
                  {skill.label} {group.level === 'B1與B1+' ? 'B1 與 B1+' : group.level} 的三部分平均達成率。
                </caption>
                <thead>
                  <tr>
                    <th scope="col">部分</th>
                    <th scope="col">滿分</th>
                    <th scope="col">平均達成率</th>
                  </tr>
                </thead>
                <tbody>
                  {(group.parts || []).map((part) => (
                    <tr key={part.part}>
                      <th scope="row">{part.label}</th>
                      <td>{part.fullMark}</td>
                      <td className={part.weakest ? 'et-analytics-weak' : undefined}>{formatRate(part)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="et-analytics-status" role="status">這個級別沒有帶部分分數的成績。</p>
          )}
        </div>
      ))}
    </div>
  ));
}

export default function BestepPartDiagnostics({ partDiagnostics, semester }) {
  if (!partDiagnostics) {
    return <p className="et-analytics-status" role="status">部分細項尚未由這次查詢提供。</p>;
  }
  const preExam = partDiagnostics.preExam;
  const singleSemester = semester && semester !== 'all';

  return (
    <div className="et-analytics-workbench" role="tabpanel">
      <p className="et-analytics-caveat">{partDiagnostics.comparisonNote}</p>

      <section className="et-analytics-panel" aria-labelledby="bestep-part-history-title">
        <div className="et-analytics-panel-head">
          <div>
            <h3 id="bestep-part-history-title">各次考試的部分達成率</h3>
            <p>{partDiagnostics.history?.note}</p>
          </div>
        </div>
        <HistoryTable history={partDiagnostics.history} />
      </section>

      <section className="et-analytics-panel" aria-labelledby="bestep-part-preexam-title">
        <div className="et-analytics-panel-head">
          <div>
            <h3 id="bestep-part-preexam-title">考前：這批報名學生先前較弱的部分</h3>
            <p>{preExam?.note}</p>
          </div>
        </div>
        {preExam?.status === 'needs_single_semester' || !singleSemester ? (
          <p className="et-analytics-status" role="status">考前加強要看單一次報名。請改選單一學期。</p>
        ) : (
          <>
            <dl className="et-analytics-facts">
              <div>
                <dt>報名應考</dt>
                <dd>{formatPeople(preExam?.registeredStudentCount)}</dd>
                <p>報名成功且有應考項目</p>
              </div>
              <div>
                <dt>有先前細項</dt>
                <dd>{formatPeople(preExam?.withPriorParts)}</dd>
                <p>找得到更早一次的部分分數</p>
              </div>
              <div>
                <dt>沒有先前細項</dt>
                <dd>{formatPeople(preExam?.withoutPriorParts)}</dd>
                <p>沒有更早的部分分數可對照</p>
              </div>
            </dl>
            <PartMeanTable
              parts={preExam?.parts}
              caption="平均達成率來自這批學生最近一次更早的培力成績。較弱是該科三部分裡平均較低的部分。"
            />
          </>
        )}
      </section>

      <section className="et-analytics-panel" aria-labelledby="bestep-part-b1-title">
        <div className="et-analytics-panel-head">
          <div>
            <h3 id="bestep-part-b1-title">B1 與 B1+ 較弱的部分</h3>
            <p>{partDiagnostics.approachingB2?.note}</p>
          </div>
        </div>
        <ApproachingTables approaching={partDiagnostics.approachingB2} />
      </section>
    </div>
  );
}
