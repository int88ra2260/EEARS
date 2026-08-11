import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import {
  createLearningAnalyticsModelRun,
  getLearningAnalyticsModelRun,
  listLearningAnalyticsModelRuns,
} from '../../services/learningAnalyticsService';
import LearningAnalyticsDataHealth from '../../components/learningAnalytics/LearningAnalyticsDataHealth';
import LearningAnalyticsFilters, { LearningAnalyticsActiveFilters } from '../../components/learningAnalytics/LearningAnalyticsFilters';
import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { P } from '../../constants/permissions';

const SKILL_LABELS = {
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
};

function formatConfidenceIntervalLowHigh(low, high) {
  const l = Number(low);
  const h = Number(high);
  if (!Number.isFinite(l) || !Number.isFinite(h)) return '—';
  return `${l.toFixed(2)}~${h.toFixed(2)}`;
}

function formatMaybeNumber(value, digits = 3) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(digits);
}

function formatBalanceDiagnosticsSummary(balanceDiagnostics) {
  if (!balanceDiagnostics) return '—';

  const b = balanceDiagnostics.balanceQuality;
  const baselineSmd = formatMaybeNumber(balanceDiagnostics.baselineGse?.standardizedMeanDifference, 3);
  const hoursSmd = formatMaybeNumber(balanceDiagnostics.resourceHoursBeforeExam?.standardizedMeanDifference, 3);

  const ceFromExact = formatMaybeNumber(balanceDiagnostics.initialCefrBand?.exactMatchRate, 3);
  const deptExact = formatMaybeNumber(balanceDiagnostics.department?.exactMatchRate, 3);
  const evExact = formatMaybeNumber(balanceDiagnostics.evidenceQuality?.exactMatchRate, 3);
  const skillExact = formatMaybeNumber(balanceDiagnostics.skill?.exactMatchRate, 3);

  const parts = [];
  parts.push(`品質:${b || '—'}`);
  if (baselineSmd != null) parts.push(`基礎SMD:${baselineSmd}`);
  if (hoursSmd != null) parts.push(`時數SMD:${hoursSmd}`);
  if (ceFromExact != null) parts.push(`初始CEFR精確:${ceFromExact}`);
  if (deptExact != null) parts.push(`部門精確:${deptExact}`);
  if (evExact != null) parts.push(`證據精確:${evExact}`);
  if (skillExact != null) parts.push(`技能精確:${skillExact}`);

  return parts.join('；');
}

export default function LearningAnalyticsModelRunsPage() {
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [runs, setRuns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const accessProfile = useMemo(() => buildAccessProfile(token), [token]);
  const canRun = hasPermission(accessProfile, P.CAN_RUN_LEARNING_ANALYTICS_MODEL);

  const loadRuns = useCallback(async () => {
    if (!token || !ready) return;
    setLoading(true);
    setError('');
    try {
      const data = await listLearningAnalyticsModelRuns(token, { limit: 20 });
      setRuns(data?.items || []);
    } catch (e) {
      setRuns([]);
      setError(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token, ready]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const handlePersist = async () => {
    if (!canRun || saving) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const data = await createLearningAnalyticsModelRun(token, { filters: apiParams() });
      setMessage(`已固化 Model Run #${data?.modelRun?.id || '—'}`);
      await loadRuns();
    } catch (e) {
      setError(e.message || '固化失敗');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (id) => {
    setDetailLoading(true);
    try {
      const data = await getLearningAnalyticsModelRun(token, id);
      setSelected(data);
    } catch (e) {
      setSelected(null);
      setError(e.message || '讀取詳情失敗');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div>
      <LearningAnalyticsDataHealth meta={meta} error={metaError} />
      <p className="small text-muted">
        將目前篩選下的分析估計寫入資料庫，供稽核與跨批次比對。需「執行學習成效分析模型」權限。
      </p>

      <LearningAnalyticsFilters
        filters={filters}
        onChange={setFilters}
        onSubmit={applyFilters}
        onReset={resetFilters}
        loading={loading || saving || !ready}
        filterOptions={meta?.filterOptions}
        matchingCaliperDefault={meta?.matchingCaliperDefault}
        filterTitle="固化時套用的篩選"
        submitLabel="套用篩選"
        showAdvanced
      />
      <LearningAnalyticsActiveFilters filters={appliedFilters} />

      <div className="la-panel mt-3 mb-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="la-panel-title mb-0">執行新 Model Run</div>
          <Button
            size="sm"
            variant="dark"
            onClick={handlePersist}
            disabled={!canRun || saving || !ready}
          >
            {saving ? '固化中…' : '固化目前篩選結果'}
          </Button>
        </div>
        {!canRun ? (
          <Alert variant="light" className="small border mt-2 mb-0 py-2">
            您沒有模型執行權限；可檢視歷史紀錄。
          </Alert>
        ) : null}
      </div>

      {message ? <Alert variant="success">{message}</Alert> : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {loading ? (
        <div className="text-center py-4"><Spinner animation="border" /></div>
      ) : (
        <div className="la-panel">
          <div className="la-panel-title">歷史紀錄</div>
          <Table responsive size="sm" className="mb-0 align-middle">
            <thead>
              <tr>
                <th>ID</th>
                <th>快照版本</th>
                <th>學期</th>
                <th className="text-end">納入學生</th>
                <th>建立時間</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>#{run.id}</td>
                  <td className="small">{run.snapshotVersion || '—'}</td>
                  <td>{run.semester || '—'}</td>
                  <td className="text-end">{run.includedStudentsCount ?? '—'}</td>
                  <td className="small">
                    {run.created_at ? new Date(run.created_at).toLocaleString('zh-TW') : '—'}
                  </td>
                  <td className="text-end">
                    <Button size="sm" variant="outline-secondary" onClick={() => openDetail(run.id)}>
                      詳情
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {!runs.length ? <p className="small text-muted mb-0 mt-2">尚無固化紀錄。</p> : null}
        </div>
      )}

      {detailLoading ? (
        <div className="text-center py-3"><Spinner size="sm" animation="border" /></div>
      ) : null}

      {selected ? (
        <>
          <div className="la-panel mt-3">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
              <div>
                <div className="la-panel-title mb-1">Run #{selected.modelRun?.id} 摘要</div>
                <div className="small text-muted">
                  {selected.modelRun?.modelName || '學習成效估計'}
                  {' · '}
                  v{selected.modelRun?.modelVersion || '—'}
                  {selected.modelRun?.createdBy ? ` · ${selected.modelRun.createdBy}` : ''}
                </div>
              </div>
              <Button size="sm" variant="outline-secondary" onClick={() => setSelected(null)}>
                關閉
              </Button>
            </div>
            <Row className="g-3 mt-2 la-bento-reveal">
              <Col md={4}>
                <div className="la-outlook-card h-100">
                  <div className="small text-muted">納入／排除</div>
                  <div className="fw-semibold mt-1">
                    {selected.modelRun?.includedStudentsCount ?? '—'}
                    {' / '}
                    {selected.modelRun?.excludedStudentsCount ?? '—'}
                  </div>
                </div>
              </Col>
              <Col md={4}>
                <div className="la-outlook-card h-100">
                  <div className="small text-muted">資源效應列</div>
                  <div className="fw-semibold mt-1">{selected.resourceEffects?.length || 0} 筆</div>
                </div>
              </Col>
              <Col md={4}>
                <div className="la-outlook-card h-100">
                  <div className="small text-muted">成長區間列</div>
                  <div className="fw-semibold mt-1">{selected.growthEpisodes?.length || 0} 筆</div>
                </div>
              </Col>
            </Row>
          </div>

          {selected.resourceEffects?.length ? (
            <div className="la-panel mt-3">
              <div className="la-panel-title">資源效應預覽（前 12 筆）</div>
              <Table responsive size="sm" className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>資源</th>
                    <th>技能</th>
                    <th className="text-end">估計效應</th>
                    <th className="text-end">95% 信賴區間</th>
                    <th>平衡診斷（matching）</th>
                    <th className="text-end">樣本</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.resourceEffects.slice(0, 12).map((row) => (
                    <tr key={row.id}>
                      <td>{row.resourceType}</td>
                      <td>{SKILL_LABELS[row.skill] || row.skill || '—'}</td>
                      <td className="text-end">{row.causalEffect ?? row.adjustedEffect ?? row.rawEffect ?? '—'}</td>
                      <td className="text-end">
                        {formatConfidenceIntervalLowHigh(row.confidenceIntervalLow, row.confidenceIntervalHigh)}
                      </td>
                      <td>
                        {formatBalanceDiagnosticsSummary(row.payload?.balanceDiagnostics)}
                      </td>
                      <td className="text-end">{row.sampleSize ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <p className="small text-muted mb-0 mt-2">
                效應為觀察估計；causalClaimAllowed 為 false 時不得解讀為因果。
              </p>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
