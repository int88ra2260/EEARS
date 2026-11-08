import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import { getLearningAnalyticsResources } from '../../services/learningAnalyticsService';
import LearningAnalyticsFilters, { LearningAnalyticsActiveFilters } from '../../components/learningAnalytics/LearningAnalyticsFilters';
import LearningAnalyticsDataHealth from '../../components/learningAnalytics/LearningAnalyticsDataHealth';
import EvidenceQualityBadge from '../../components/learningAnalytics/EvidenceQualityBadge';
import LearningAnalyticsPanelHeader from '../../components/learningAnalytics/LearningAnalyticsPanelHeader';
import LearningAnalyticsPageFrame from '../../components/learningAnalytics/LearningAnalyticsPageFrame';
import { RESOURCE_TYPE_LABELS, SKILL_LABELS } from '../../components/learningAnalytics/learningAnalyticsCopy';
import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';
import { RESOURCE_COVERAGE_FILTER_KEYS } from '../../components/learningAnalytics/learningAnalyticsFilterConstants';
import LearningResourceReading, { LearningDetailLinks } from '../../components/learningAnalytics/LearningResourceReading';
import ResourcesModeSwitch from '../../components/learningAnalytics/ResourcesModeSwitch';
import {
  describeResourceCoverage,
  formatObservedCount,
  formatObservedDelta,
  resourceEventCount,
  shouldApplyAnalyticsResult,
} from './learningParticipationReading';
import AnalyticsHubReturn from './AnalyticsHubReturn';
import { buildAccessProfile } from '../../utils/accessControl';

function resourceLabel(type) {
  return RESOURCE_TYPE_LABELS[type] || type;
}

function skillList(skills) {
  if (!Array.isArray(skills) || !skills.length) return '—';
  return skills.map((s) => SKILL_LABELS[s] || s).join('、');
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
    workingSetScope,
    token,
  } = useLearningAnalyticsBootstrap({ scopeKeys: RESOURCE_COVERAGE_FILTER_KEYS });
  const outlet = useOutletContext() || {};
  const accessProfile = buildAccessProfile(outlet.token || token);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const runSeq = useRef(0);

  useEffect(() => {
    if (!ready) return undefined;
    const seq = runSeq.current + 1;
    runSeq.current = seq;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    getLearningAnalyticsResources(token, withWorkingSet(apiParams()), { signal: controller.signal })
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
  }, [token, apiParams, withWorkingSet, ready]);

  const rows = useMemo(() => {
    const list = [...(data?.resourceEffectiveness || [])];
    list.sort((a, b) => {
      const participants = (Number(b.participantCount) || 0) - (Number(a.participantCount) || 0);
      if (participants !== 0) return participants;
      return (Number(b.growthSampleSize) || 0) - (Number(a.growthSampleSize) || 0);
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
        title="資源與開課分析"
        actions={<AnalyticsHubReturn accessProfile={accessProfile} />}
        showWorkingSet
        workingSetHere="resources"
        workingSetScope={workingSetScope}
        question="查看英語學習資源的參與情況，以及相關學生可觀察的學習紀錄。"
        howToRead={(
          <>
            <LearningResourceReading rows={data?.resourceEffectiveness} />
            <ul className="small mb-2 ps-3">
              <li>沒有人參與：參與人數是 0。</li>
              <li>有人參與但沒有可比較前後測：參與人數大於 0，可比較樣本是 0。這不是「資源沒有效果」。</li>
              <li>這份 API 沒有單獨的「有測驗紀錄但無法比較成長」人數。</li>
              <li>事件次數與不重複學生數分開計算。可比較樣本是 0 時，平均變化顯示「無可比較樣本」，不會顯示成 0.0。</li>
            </ul>
            <LearningDetailLinks />
          </>
        )}
      >
      <ResourcesModeSwitch />
      <p className="la-scope-note" data-testid="la-scope-note">
        資料範圍：分析快照
        {data?.snapshotVersion ? ` ${data.snapshotVersion}` : ''}
        。學院、系所、入學年度篩的是這份快照。此頁不依學期切分。
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
        visibleKeys={RESOURCE_COVERAGE_FILTER_KEYS}
        showAdvanced={false}
        groupSnapshots
        filterTitle="篩選條件"
        submitLabel="套用篩選"
        intro={null}
      />
      <LearningAnalyticsActiveFilters filters={appliedFilters} visibleKeys={RESOURCE_COVERAGE_FILTER_KEYS} />

      <p className="small mt-3 mb-0" data-testid="learning-reading">
        參加過的人數是不重複學生數，不是事件次數，也不代表資源造成能力提升。
      </p>

      {error ? <Alert variant="danger" className="mt-3">{error}</Alert> : null}
      {loading ? (
        <div className="text-center py-5" role="status">
          <Spinner animation="border" />
          <span className="visually-hidden">載入中</span>
        </div>
      ) : null}

      {!loading && data ? (
        <>
          <div className="la-panel mt-3">
            <LearningAnalyticsPanelHeader
              title="資源類型覆蓋"
              lead="參與人數、事件次數與可比較樣本。平均變化不是資源造成的效果。"
            />
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0 la-table la-resources-table">
                <thead>
                  <tr>
                    <th>資源類型</th>
                    <th className="text-end">參與人數</th>
                    <th className="text-end">參與事件次數</th>
                    <th className="text-end">可比較樣本</th>
                    <th>可觀察性</th>
                    <th className="text-end">平均變化</th>
                    <th className="d-none d-md-table-cell">主要技能</th>
                    <th>資料狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? rows.map((row) => (
                    <tr key={row.resourceType}>
                      <td className="fw-semibold">{resourceLabel(row.resourceType)}</td>
                      <td className="text-end">{formatObservedCount(row.participantCount)}</td>
                      <td className="text-end">{formatObservedCount(resourceEventCount(data?.skillExposure?.byResource, row.resourceType))}</td>
                      <td className="text-end">{formatObservedCount(row.growthSampleSize)}</td>
                      <td className="small">{describeResourceCoverage(row)}</td>
                      <td className="text-end fw-semibold">{formatObservedDelta(row.rawGrowthAverage, row.growthSampleSize)}</td>
                      <td className="small d-none d-md-table-cell">{skillList(row.mainSkills)}</td>
                      <td><EvidenceQualityBadge level={row.evidenceLevel} /></td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={8} className="text-muted text-center py-4">尚無可用紀錄。不能推論沒有學習。</td>
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
