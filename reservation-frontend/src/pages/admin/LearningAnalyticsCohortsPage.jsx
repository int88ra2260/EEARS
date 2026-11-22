import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import { getLearningAnalyticsCohorts } from '../../services/learningAnalyticsService';
import LearningAnalyticsFilters, { LearningAnalyticsActiveFilters } from '../../components/learningAnalytics/LearningAnalyticsFilters';
import LearningAnalyticsDataHealth from '../../components/learningAnalytics/LearningAnalyticsDataHealth';
import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';
import LearningAnalyticsPageFrame from '../../components/learningAnalytics/LearningAnalyticsPageFrame';
import ComparisonModeSwitch from '../../components/learningAnalytics/ComparisonModeSwitch';
import { COHORT_COMPARISON_FILTER_KEYS, LA_FILTER_INTRO_COHORTS } from '../../components/learningAnalytics/learningAnalyticsFilterConstants';
import { buildAccessProfile } from '../../utils/accessControl';
import AnalyticsHubReturn from './AnalyticsHubReturn';
import ColumnHead, { HEAD } from '../../components/learningAnalytics/ColumnHead';
import { formatObservedDelta, shouldApplyAnalyticsResult } from './learningParticipationReading';

const GROUP_OPTIONS = [
  { value: 'department', label: '系所' },
  { value: 'college', label: '學院' },
  { value: 'cohort', label: '入學年度' },
  { value: 'exposure_level', label: '資源參與量' },
  { value: 'baseline_level', label: '起始能力' },
];

const SKILL_LABELS = {
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
};

function formatPct(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function formatCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('zh-TW');
}

function countShare(count, total) {
  const n = Number(count);
  const d = Number(total);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return '—';
  return `${formatCount(n)} 人 · ${((n / d) * 100).toFixed(1)}%`;
}

function useNarrowScreen() {
  const query = '(max-width: 767.98px)';
  const [narrow, setNarrow] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  ));

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(query);
    const onChange = () => setNarrow(media.matches);
    onChange();
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  return narrow;
}

function DetailFacts({ row }) {
  return (
    <dl className="la-offering-metrics">
      <div>
        <dt>快照 B2</dt>
        <dd>{formatPct(row.b2plusRate)}</dd>
      </div>
      <div>
        <dt>重測比例</dt>
        <dd>{formatPct(row.retestRate)}</dd>
      </div>
      <div>
        <dt>平均資源時數</dt>
        <dd>{formatCount(row.avgResourceHours)}</dd>
      </div>
      <div>
        <dt>校正後變化</dt>
        <dd>{formatObservedDelta(row.avgAdjustedGseGrowth, row.growthEpisodeCount)}</dd>
      </div>
    </dl>
  );
}

function GradeBreakdown({ row, gradeSemester }) {
  return (
    <div className="py-2">
      <p className="small text-muted mb-2">
        {`年級依 ${gradeSemester || '目前學期'} 在學名冊。各列百分比的分母是該年級人數。缺年級是這份快照有、名冊上沒有年級的人。`}
      </p>
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th>年級</th>
              <th className="text-end"><ColumnHead {...HEAD.cohortStudents} /></th>
              <th className="text-end"><ColumnHead {...HEAD.noValidExam} /></th>
              <th className="text-end"><ColumnHead {...HEAD.anyValidExam} /></th>
              <th className="text-end"><ColumnHead {...HEAD.snapshotB2Count} /></th>
            </tr>
          </thead>
          <tbody>
            {(row.grades || []).map((grade) => (
              <tr key={grade.grade}>
                <td>{grade.grade}</td>
                <td className="text-end">{formatCount(grade.students)}</td>
                <td className="text-end">{countShare(grade.withoutExamCount, grade.students)}</td>
                <td className="text-end">{countShare(grade.withExamCount, grade.students)}</td>
                <td className="text-end">{countShare(grade.b2plusCount, grade.students)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowDetail({ row, gradeSemester }) {
  if (Array.isArray(row.grades)) return <GradeBreakdown row={row} gradeSemester={gradeSemester} />;
  return <DetailFacts row={row} />;
}

export default function LearningAnalyticsCohortsPage() {
  const {
    meta,
    metaError,
    filters,
    setFilters,
    appliedFilters,
    applyFilters,
    resetFilters,
    ready,
    apiParams,
    withWorkingSet,
    workingSetScope,
    token,
  } = useLearningAnalyticsBootstrap({ scopeKeys: COHORT_COMPARISON_FILTER_KEYS });
  const outlet = useOutletContext() || {};
  const accessProfile = buildAccessProfile(outlet.token || token);
  const narrow = useNarrowScreen();
  const [groupBy, setGroupBy] = useState('department');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [openKey, setOpenKey] = useState('');
  const runSeq = useRef(0);
  const groupLabel = GROUP_OPTIONS.find((opt) => opt.value === groupBy)?.label || '系所';

  useEffect(() => {
    if (!ready) return undefined;
    const seq = runSeq.current + 1;
    runSeq.current = seq;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getLearningAnalyticsCohorts(
      token,
      withWorkingSet({ ...apiParams(), group_by: groupBy }),
      { signal: controller.signal },
    )
      .then((payload) => {
        if (!shouldApplyAnalyticsResult(seq, runSeq.current)) return;
        setData(payload);
      })
      .catch((e) => {
        if (!shouldApplyAnalyticsResult(seq, runSeq.current) || e?.name === 'AbortError') return;
        setData(null);
        setError(e.message || '載入失敗');
      })
      .finally(() => {
        if (shouldApplyAnalyticsResult(seq, runSeq.current)) setLoading(false);
      });
    return () => controller.abort();
  }, [token, apiParams, withWorkingSet, groupBy, ready]);

  const rows = data?.rows || [];
  const snapshotLabel = data?.snapshotVersion || appliedFilters.snapshot_version || '尚未載入';
  const summary = useMemo(() => {
    const students = Number(data?.totalStudents);
    const b2 = rows.reduce((sum, row) => sum + (Number(row.b2plusCount) || 0), 0);
    return {
      groups: rows.length,
      students: data?.totalStudents,
      b2: Number.isFinite(students) && students > 0 ? countShare(b2, students) : formatCount(b2),
    };
  }, [rows, data?.totalStudents]);

  return (
    <div>
      <LearningAnalyticsDataHealth
        meta={meta}
        error={metaError}
        snapshotVersion={appliedFilters.snapshot_version}
      />

      <LearningAnalyticsPageFrame
        title="群體與技能比較"
        actions={<AnalyticsHubReturn accessProfile={accessProfile} />}
        showWorkingSet
        workingSetHere="cohorts"
        workingSetScope={workingSetScope}
        question="比較不同學生群體有沒有有效英檢成績，以及快照裡的 B2 達標。"
        howToRead={(
          <ul className="small mb-0 ps-3">
            <li className="mb-1">先選快照、學院、系所或入學年度，再選現在要比較的維度。</li>
            <li>沒有英檢成績與至少一次英檢成績，是這個群體裡有沒有有效英檢。兩欄人數加起來等於學生數。</li>
            <li>B2 達標是分析快照的標記，分母是該群體全部學生，不是只有有英檢的人，也不是學期名冊的 B2 KPI。</li>
            <li>系所或學院展開後，依目前學期在學名冊的年級拆開。各年級人數加上缺年級，回到該列的學生數。</li>
            <li>下方參與量對照與各技能前後測仍看 GSE 變化。可比較筆數是 0 時顯示「無可比較樣本」，不顯示成 0.0。</li>
          </ul>
        )}
      >
        <ComparisonModeSwitch />
        <p className="la-scope-note" data-testid="la-scope-note">
          {`資料範圍：分析快照 ${snapshotLabel}。目前比較維度是${groupLabel}。這是快照裡的學生，不是學期名冊的系所人數。`}
        </p>

        <LearningAnalyticsFilters
          filters={filters}
          onChange={setFilters}
          onSubmit={applyFilters}
          onReset={resetFilters}
          loading={!ready}
          filterOptions={meta?.filterOptions}
          matchingCaliperDefault={meta?.matchingCaliperDefault}
          snapshotOptions={meta?.snapshots}
          visibleKeys={COHORT_COMPARISON_FILTER_KEYS}
          showAdvanced={false}
          groupSnapshots
          intro={LA_FILTER_INTRO_COHORTS}
        />

        <LearningAnalyticsActiveFilters filters={appliedFilters} visibleKeys={COHORT_COMPARISON_FILTER_KEYS} />

        <div className="la-dimension mt-3" role="group" aria-label="比較維度">
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="btn btn-sm btn-outline-secondary"
              aria-pressed={groupBy === opt.value}
              onClick={() => setGroupBy(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <details className="la-metric-defs mt-3">
          <summary>指標定義</summary>
          <dl>
            <dt>學生數</dt>
            <dd>這個分組在目前篩選後的快照學生人數。沒有英檢、至少一次英檢、B2 達標的百分比都用它當分母。</dd>
            <dt>沒有英檢成績</dt>
            <dd>沒有有效英檢成績的人數，以及占該群體學生數的百分比。</dd>
            <dt>至少一次英檢成績</dt>
            <dd>至少有一筆有效英檢成績的人數，以及占該群體學生數的百分比。與沒有英檢成績的人數加總等於學生數。</dd>
            <dt>B2 達標</dt>
            <dd>分析快照已標成達 B2 的人數，以及占該群體全部學生的百分比。不是學期名冊的 B2 KPI。</dd>
            <dt>年級</dt>
            <dd>系所或學院展開後使用。年級來自目前學期在學名冊，不是入學年度。名冊上沒有年級的人列在缺年級。</dd>
            <dt>可比較筆數</dt>
            <dd>下方參與量對照與各技能表使用。前後測區間筆數，同一人可以有多筆。筆數是 0 代表沒有可比較的前後測。</dd>
            <dt>平均 GSE 變化</dt>
            <dd>下方比較表使用。可比較筆數大於 0 時，這些區間的平均 GSE 變化。0.0 是觀察到的零。筆數是 0 時不顯示成 0.0。</dd>
            <dt>校正後變化</dt>
            <dd>既有校正後 GSE 平均。這是描述，不能說成學院或系所因為中心資源而提升。</dd>
          </dl>
        </details>

        {error ? <Alert variant="danger" className="mt-3">{error}</Alert> : null}
        {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : null}

        {!loading && data && rows.length === 0 ? (
          <Alert variant="secondary" className="mt-3">這個分組沒有學生。不能因此說該群體沒有學習。</Alert>
        ) : null}

        {!loading && data && rows.length > 0 ? (
          <>
            <div className="la-compare-summary" data-testid="cohort-summary">
              <div>
                <span>分組數</span>
                <strong>{formatCount(summary.groups)}</strong>
              </div>
              <div>
                <span>學生數</span>
                <strong>{formatCount(summary.students)}</strong>
              </div>
              <div>
                <span>B2 達標</span>
                <strong>{summary.b2}</strong>
              </div>
            </div>

            {narrow ? (
              <div data-testid="cohort-cards">
                {rows.map((row) => (
                  <article key={row.groupKey} className="la-offering-card la-compare-card">
                    <h3>{row.groupKey}</h3>
                    <dl className="la-offering-metrics">
                      <div>
                        <dt>學生數</dt>
                        <dd>{formatCount(row.students)}</dd>
                      </div>
                      <div>
                        <dt>沒有英檢成績</dt>
                        <dd>{countShare(row.withoutExamCount, row.students)}</dd>
                      </div>
                      <div>
                        <dt>至少一次英檢成績</dt>
                        <dd>{countShare(row.withExamCount, row.students)}</dd>
                      </div>
                      <div>
                        <dt>B2 達標</dt>
                        <dd>{countShare(row.b2plusCount, row.students)}</dd>
                      </div>
                    </dl>
                    <details>
                      <summary>{`查看 ${row.groupKey} 詳細資訊`}</summary>
                      <RowDetail row={row} gradeSemester={data?.gradeSemester} />
                    </details>
                  </article>
                ))}
              </div>
            ) : (
              <div className="la-panel" data-testid="cohort-table">
                <div className="la-panel-title">{`依${groupLabel}比較`}</div>
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>群體</th>
                        <th className="text-end"><ColumnHead {...HEAD.cohortStudents} /></th>
                        <th className="text-end"><ColumnHead {...HEAD.noValidExam} /></th>
                        <th className="text-end"><ColumnHead {...HEAD.anyValidExam} /></th>
                        <th className="text-end"><ColumnHead {...HEAD.snapshotB2Count} /></th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const open = openKey === row.groupKey;
                        return (
                          <React.Fragment key={row.groupKey}>
                            <tr>
                              <td className="la-offerings-name fw-semibold">{row.groupKey}</td>
                              <td className="text-end">{formatCount(row.students)}</td>
                              <td className="text-end">{countShare(row.withoutExamCount, row.students)}</td>
                              <td className="text-end">{countShare(row.withExamCount, row.students)}</td>
                              <td className="text-end">{countShare(row.b2plusCount, row.students)}</td>
                              <td className="text-end">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary"
                                  aria-expanded={open}
                                  onClick={() => setOpenKey(open ? '' : row.groupKey)}
                                >
                                  {`查看 ${row.groupKey} 詳細資訊`}
                                </button>
                              </td>
                            </tr>
                            {open ? (
                              <tr>
                                <td colSpan={6}>
                                  <RowDetail row={row} gradeSemester={data?.gradeSemester} />
                                </td>
                              </tr>
                            ) : null}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(data.participationComparison || []).length > 0 ? (
              <div className="la-panel mt-3">
                <div className="la-panel-title">參與量對照</div>
                <p className="small text-muted">
                  考前時數至少 10 小時與較少參與者的前後測樣本。只用來找值得追查的群體，不能說參與造成進步。
                </p>
                <div className="la-detail-scroll">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>參與分組</th>
                        <th className="text-end">學生數</th>
                        <th className="text-end">可比較筆數</th>
                        <th className="text-end">平均 GSE 變化</th>
                        <th className="text-end">校正後變化</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.participationComparison.map((row) => (
                        <tr key={row.key}>
                          <td>{row.label}</td>
                          <td className="text-end">{formatCount(row.students)}</td>
                          <td className="text-end">{formatCount(row.growthEpisodeCount)}</td>
                          <td className="text-end">{formatObservedDelta(row.avgActualGseGrowth, row.growthEpisodeCount)}</td>
                          <td className="text-end">{formatObservedDelta(row.avgAdjustedGseGrowth, row.growthEpisodeCount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {(data.skillGrowthSummary || []).length > 0 ? (
              <div className="la-panel mt-3">
                <div className="la-panel-title">各技能前後測樣本</div>
                <p className="small text-muted">
                  這張表只列出回應裡有可比較筆數的技能。沒有出現的技能，是這份回應沒有帶回，不能解讀成沒有進步。
                </p>
                <div className="la-detail-scroll">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>技能</th>
                        <th className="text-end">可比較筆數</th>
                        <th className="text-end">平均 GSE 變化</th>
                        <th className="text-end">校正後變化</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.skillGrowthSummary.map((row) => (
                        <tr key={row.skill}>
                          <td>{SKILL_LABELS[row.skill] || row.skill}</td>
                          <td className="text-end">{formatCount(row.sampleSize)}</td>
                          <td className="text-end">{formatObservedDelta(row.avgActualGseGrowth, row.sampleSize)}</td>
                          <td className="text-end">{formatObservedDelta(row.avgAdjustedGseGrowth, row.sampleSize)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </LearningAnalyticsPageFrame>
    </div>
  );
}
