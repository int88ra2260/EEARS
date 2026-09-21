import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import { Link } from 'react-router-dom';
import { getLearningAnalyticsResources } from '../../services/learningAnalyticsService';
import LearningAnalyticsFilters, { LearningAnalyticsActiveFilters } from '../../components/learningAnalytics/LearningAnalyticsFilters';
import LearningAnalyticsDataHealth from '../../components/learningAnalytics/LearningAnalyticsDataHealth';
import EvidenceQualityBadge from '../../components/learningAnalytics/EvidenceQualityBadge';
import LearningAnalyticsPanelHeader from '../../components/learningAnalytics/LearningAnalyticsPanelHeader';
import LaFold from '../../components/learningAnalytics/LaFold';
import { RESOURCE_TYPE_LABELS, SKILL_LABELS } from '../../components/learningAnalytics/learningAnalyticsCopy';
import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';
import { LA_FILTER_INTRO_COHORT } from '../../components/learningAnalytics/learningAnalyticsFilterConstants';

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
    token,
  } = useLearningAnalyticsBootstrap();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError('');
    try {
      setData(await getLearningAnalyticsResources(token, apiParams()));
    } catch (e) {
      setData(null);
      setError(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token, apiParams, ready]);

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

      <LearningAnalyticsPanelHeader
        title="資源覆蓋與可觀察性"
        lead="依資源類型（English Table、EAP、通識英文等）先看參與規模、可算成長樣本與資料完整度。這頁用來判斷資料能不能用，不做資源成效排名。"
      />

      <LaFold label="如何閱讀本頁" className="mb-3">
        <ol className="small mb-2 ps-3">
          <li className="mb-1">
            預設只看<strong>描述表</strong>：誰參加多、有多少人能算成長、資料是否足夠解讀。
          </li>
          <li className="mb-1">
            「有前後測」太少時不要解讀平均；跨英檢工具的原始分<strong>不宜直接互比</strong>。
          </li>
          <li className="mb-1">
            要盯某一門課／老師／活動，請到
            {' '}
            <Link to="/admin/learning-analytics/offerings">課／師／活動</Link>
            ；正式達標請到
            {' '}
            <Link to="/admin/learning-analytics/kpi-report">B2 KPI 報表</Link>
            。
          </li>
        </ol>
      </LaFold>

      <Alert variant="secondary" className="small py-2">
        這裡只回答「哪些資源有人用、哪些資源有足夠前後測可觀察」。是否調整課程或活動，請回到具體課程／活動明細與學生名單。
      </Alert>

      <LearningAnalyticsFilters
        filters={filters}
        onChange={setFilters}
        onSubmit={applyFilters}
        onReset={resetFilters}
        loading={loading || !ready}
        filterOptions={meta?.filterOptions}
        matchingCaliperDefault={meta?.matchingCaliperDefault}
        snapshotOptions={meta?.snapshots}
        filterTitle="篩選條件"
        submitLabel="套用篩選"
        intro={LA_FILTER_INTRO_COHORT}
      />
      <LearningAnalyticsActiveFilters filters={appliedFilters} />

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
              預設主指標：參與人數、有前後測、資料完整度。平均原始分只作內部參考；列依「有前後測」人數排序。
            </p>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0 la-resources-table">
                <thead>
                  <tr>
                    <th>資源類型</th>
                    <th className="text-end" title="曾參與該類資源的學生數">參與人數</th>
                    <th className="text-end" title="有可配對前後測、能算進步的人數">有前後測</th>
                    <th
                      className="text-end"
                      title="同測原始分進步平均；跨工具不宜直接互比"
                    >
                      平均原始分進步
                    </th>
                    <th className="d-none d-md-table-cell">主要技能</th>
                    <th>資料完整度</th>
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
    </div>
  );
}
