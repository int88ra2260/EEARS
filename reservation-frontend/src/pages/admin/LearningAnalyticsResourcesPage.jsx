import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import { getLearningAnalyticsResources } from '../../services/learningAnalyticsService';
import LearningAnalyticsFilters, { LearningAnalyticsActiveFilters } from '../../components/learningAnalytics/LearningAnalyticsFilters';
import LearningAnalyticsDataHealth from '../../components/learningAnalytics/LearningAnalyticsDataHealth';
import EvidenceQualityBadge from '../../components/learningAnalytics/EvidenceQualityBadge';
import LearningAnalyticsPanelHeader from '../../components/learningAnalytics/LearningAnalyticsPanelHeader';
import LearningAnalyticsPageFrame from '../../components/learningAnalytics/LearningAnalyticsPageFrame';
import ColumnHead, { HEAD } from '../../components/learningAnalytics/ColumnHead';
import { RESOURCE_TYPE_LABELS, SKILL_LABELS } from '../../components/learningAnalytics/learningAnalyticsCopy';
import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';
import { LA_FILTER_INTRO_RESOURCES, RESOURCE_COVERAGE_FILTER_KEYS } from '../../components/learningAnalytics/learningAnalyticsFilterConstants';

function resourceLabel(type) {
  return RESOURCE_TYPE_LABELS[type] || type;
}

function skillList(skills) {
  if (!Array.isArray(skills) || !skills.length) return '—';
  return skills.map((s) => SKILL_LABELS[s] || s).join('、');
}

function formatDelta(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1);
}

export default function LearningAnalyticsResourcesPage() {
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
    token,
  } = useLearningAnalyticsBootstrap({ scopeKeys: RESOURCE_COVERAGE_FILTER_KEYS });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError('');
    try {
      setData(await getLearningAnalyticsResources(token, withWorkingSet(apiParams())));
    } catch (e) {
      setData(null);
      setError(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token, apiParams, withWorkingSet, ready]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const list = [...(data?.resourceEffectiveness || [])];
    list.sort((a, b) => {
      const g = (Number(b.growthSampleSize) || 0) - (Number(a.growthSampleSize) || 0);
      if (g !== 0) return g;
      return (Number(b.participantCount) || 0) - (Number(a.participantCount) || 0);
    });
    return list;
  }, [data?.resourceEffectiveness]);

  return (
    <div>
      <LearningAnalyticsDataHealth
        meta={meta}
        error={metaError}
        snapshotVersion={appliedFilters.snapshot_version}
      />

      <LearningAnalyticsPageFrame
        title="資源覆蓋"
        showWorkingSet
        workingSetHere="resources"
        question="哪些資源有人參加、哪些資源有足夠前後測可以觀察。"
        scope="分析快照裡的學生，依資源類型彙總。這頁不做資源成效排名。"
        howToRead={(
          <ol className="small mb-0 ps-3">
            <li className="mb-1">先看描述表：誰參加多、有多少人能算成長、資料是否足夠解讀。</li>
            <li className="mb-1">有前後測太少時不要解讀平均。跨英檢工具的原始分不宜直接互比。</li>
            <li>
              要盯某一門課、老師或活動，到課／師／活動。正式達標到 B2 KPI 報表。
            </li>
          </ol>
        )}
      >

      <LearningAnalyticsFilters
        filters={filters}
        onChange={setFilters}
        onSubmit={applyFilters}
        onReset={resetFilters}
        loading={loading || !ready}
        filterOptions={meta?.filterOptions}
        matchingCaliperDefault={meta?.matchingCaliperDefault}
        snapshotOptions={meta?.snapshots}
        visibleKeys={RESOURCE_COVERAGE_FILTER_KEYS}
        showAdvanced={false}
        groupSnapshots
        filterTitle="篩選條件"
        submitLabel="套用篩選"
        intro={LA_FILTER_INTRO_RESOURCES}
      />
      <LearningAnalyticsActiveFilters filters={appliedFilters} visibleKeys={RESOURCE_COVERAGE_FILTER_KEYS} />

      {error ? <Alert variant="danger" className="mt-3">{error}</Alert> : null}
      {loading ? <div className="text-center py-5"><Spinner animation="border" /></div> : null}

      {!loading && data ? (
        <>
          <div className="la-panel mt-3">
            <LearningAnalyticsPanelHeader
              title="資源類型覆蓋"
              lead="先看參與人數與可算前後測樣本；原始分進步只作內部參考，跨英檢不宜直接互比。"
              tooltip="有參加該資源、且有前後測的學生，其工具原始分進步平均。沒有扣掉背景差異；跨英檢工具不宜直接互比。"
            />
            <p className="small text-muted mb-3">
              預設先看參加過的人數、能算進步的人數、資料夠不夠。這份測驗多幾分只作參考，不同英檢不能互比；列依能算進步的人數排序。
            </p>
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0 la-table la-resources-table">
                <thead>
                  <tr>
                    <th>資源類型</th>
                    <th className="text-end"><ColumnHead {...HEAD.participants} /></th>
                    <th className="text-end"><ColumnHead {...HEAD.growthStudents} /></th>
                    <th className="text-end"><ColumnHead {...HEAD.rawGain} /></th>
                    <th className="d-none d-md-table-cell"><ColumnHead {...HEAD.mainSkills} /></th>
                    <th><ColumnHead {...HEAD.evidence} /></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? rows.map((row) => (
                    <tr key={row.resourceType}>
                      <td className="fw-semibold">{resourceLabel(row.resourceType)}</td>
                      <td className="text-end">{row.participantCount ?? '—'}</td>
                      <td className="text-end">{row.growthSampleSize ?? '—'}</td>
                      <td className="text-end fw-semibold">{formatDelta(row.rawGrowthAverage)}</td>
                      <td className="small d-none d-md-table-cell">{skillList(row.mainSkills)}</td>
                      <td><EvidenceQualityBadge level={row.evidenceLevel} /></td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="text-muted text-center py-4">尚無資源資料</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
      </LearningAnalyticsPageFrame>
    </div>
  );
}
