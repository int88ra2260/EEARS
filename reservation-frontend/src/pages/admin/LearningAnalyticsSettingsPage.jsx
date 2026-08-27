import React, { useCallback, useEffect, useMemo, useState } from 'react';

import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';

import Spinner from 'react-bootstrap/Spinner';
import Form from 'react-bootstrap/Form';

import { Link } from 'react-router-dom';

import GseMappingReference from '../../components/learningAnalytics/GseMappingReference';

import FilterReferenceEditor from '../../components/learningAnalytics/FilterReferenceEditor';

import LearningAnalyticsSettingsSection from '../../components/learningAnalytics/LearningAnalyticsSettingsSection';

import LvaConfigEditor from '../../components/learningAnalytics/LvaConfigEditor';
import LvaMethodComparison from '../../components/learningAnalytics/LvaMethodComparison';

import ResourceSkillProfileEditor from '../../components/learningAnalytics/ResourceSkillProfileEditor';

import { LA_TERM_HELP } from '../../components/learningAnalytics/learningAnalyticsFilterConstants';
import LaFold from '../../components/learningAnalytics/LaFold';

import { getLearningAnalyticsSettings, postPruneAnalyticsSnapshots } from '../../services/learningAnalyticsService';

import { buildAccessProfile, hasPermission } from '../../utils/accessControl';

import { P } from '../../constants/permissions';



const FILTER_HINTS = {

  semester: '補充學期代碼（例：116-1）；會與系統學期與分析資料合併出現在下拉選單。',

  cohort: '補充入學年度（例：116）；分析資料中已出現的年度會自動列入。',

  college: '補充學院名稱；分析資料中已出現的學院會自動列入。',

  department: '補充系所名稱；分析資料中已出現的系所會自動列入。',

};



export default function LearningAnalyticsSettingsPage({ token }) {

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  const [data, setData] = useState(null);



  const [pruning, setPruning] = useState(false);
  const [pruneKeepGlobalCount, setPruneKeepGlobalCount] = useState(1);
  const [pruneResultMessage, setPruneResultMessage] = useState('');
  const [pruneError, setPruneError] = useState('');

  const accessProfile = useMemo(() => buildAccessProfile(token), [token]);

  const canManage = hasPermission(accessProfile, P.CAN_MANAGE_LEARNING_ANALYTICS_SETTINGS);



  const load = useCallback(async () => {

    if (!token || !canManage) return;

    setLoading(true);

    setError('');

    try {

      const payload = await getLearningAnalyticsSettings(token);

      setData(payload);

    } catch (e) {

      setData(null);

      setError(e.message || '載入失敗');

    } finally {

      setLoading(false);

    }

  }, [token, canManage]);



  useEffect(() => {

    load();

  }, [load]);



  const handleSettingsPatch = (patch) => {

    setData((prev) => (prev ? { ...prev, ...patch } : prev));

  };



  const runPrune = useCallback(async ({ dryRun }) => {
    if (!token || !canManage || pruning) return;
    setPruning(true);
    setPruneError('');
    setPruneResultMessage('');
    try {
      const resp = await postPruneAnalyticsSnapshots(token, {
        dryRun,
        keepGlobalCount: pruneKeepGlobalCount,
      });
      const msg = resp?.result?.message || '完成';
      setPruneResultMessage(msg);
    } catch (e) {
      setPruneError(e.message || '執行失敗');
    } finally {
      setPruning(false);
    }
  }, [canManage, pruneKeepGlobalCount, pruning, token]);

  const lvaCustomBadge = data?.lvaConfig?.hasCustomOverrides ? '已校準' : null;

  const skillCustomBadge = data?.resourceSkillProfiles?.some((row) => row.isCustom) ? '已校準' : null;



  if (!canManage) {

    return (

      <Alert variant="warning" className="mt-3">

        您沒有「學習成效分析設定」權限。如需調整模組設定，請聯絡系統管理員。

      </Alert>

    );

  }



  return (

    <div>

      <p className="small text-muted">

        調整下拉選項、估計參數與資源技能權重。重建資料請到

        {' '}

        <Link to="/admin/learning-journey/operations">學習歷程維運</Link>

        。

      </p>



      {error ? <Alert variant="danger">{error}</Alert> : null}

      {loading ? (

        <div className="text-center py-5"><Spinner animation="border" /></div>

      ) : null}



      {!loading && data ? (

        <>

          <div className="la-panel mb-3">
            <div className="la-panel-title">閱讀提醒</div>
            <p className="small text-muted mb-2">數字用來比較趨勢，不是「參加就一定進步」。</p>
            <LaFold label="完整原則">
              <ul className="small mb-0">
                <li>{data.policies?.estimateDisclaimer}</li>
                <li>{data.policies?.exposureWindowRule}</li>
                <li>{data.policies?.gseNote || LA_TERM_HELP.gse}</li>
                <li>{data.policies?.lvaNote}</li>
                <li>{data.policies?.filterReferenceNote}</li>
              </ul>
            </LaFold>
          </div>



          <LearningAnalyticsSettingsSection

            title="篩選選項維護"

            lead="下拉選單會合併「分析資料中出現過的值」與手動清單；可先新增未來系所或學院。"

          >

            {(data.filterReferenceTypes || []).map(({ refType, label }) => (

              <FilterReferenceEditor

                key={refType}

                token={token}

                refType={refType}

                label={label}

                hint={FILTER_HINTS[refType]}

                items={data.filterReferences?.[refType] || []}

                onSaved={(filterReferences) => handleSettingsPatch({ filterReferences })}

              />

            ))}

          </LearningAnalyticsSettingsSection>



          <LearningAnalyticsSettingsSection

            title="目前用哪種算法"

            lead="右側是目前預設。數字用來比較趨勢，不是保證參加就進步。"

          >

            <LvaMethodComparison />

          </LearningAnalyticsSettingsSection>



          <LearningAnalyticsSettingsSection

            title="估計參數"

            lead="調整校正後進步、背景相近比較與加權比較的門檻。展開後再改參數。"

            badge={lvaCustomBadge}

          >

            <LvaConfigEditor

              token={token}

              lvaConfig={data.lvaConfig}

              embedded

              onSaved={(lvaConfig) => handleSettingsPatch({ lvaConfig })}

            />

          </LearningAnalyticsSettingsSection>



          <LearningAnalyticsSettingsSection

            title="英檢換算表"

            lead="把不同英檢換成同一把能力尺，才能比進步。此表唯讀。"

          >

            <GseMappingReference gseMapping={data.gseMapping} embedded />

          </LearningAnalyticsSettingsSection>



          <LearningAnalyticsSettingsSection

            title="各資源主要練什麼"

            lead="各課程／活動對聽說讀寫的相對權重，用在曝光與建議。"

            badge={skillCustomBadge}

          >

            <ResourceSkillProfileEditor

              token={token}

              profiles={data.resourceSkillProfiles || []}

              embedded

              onSaved={(profiles) => handleSettingsPatch({ resourceSkillProfiles: profiles })}

            />

          </LearningAnalyticsSettingsSection>



          <div className="la-panel mb-3">
            <div className="la-panel-title">清理舊資料版本</div>
            <p className="small text-muted mb-2">
              先「預覽」看會刪哪些版本，確認後再「執行刪除」。
            </p>

            <Form.Group className="mb-3" style={{ maxWidth: 360 }}>
              <Form.Label className="small text-muted mb-1">要保留幾個最新版本</Form.Label>
              <Form.Control
                type="number"
                min={1}
                value={pruneKeepGlobalCount}
                onChange={(e) => setPruneKeepGlobalCount(Math.max(1, Number(e.target.value || 1)))}
                disabled={pruning}
              />
            </Form.Group>

            <div className="d-flex flex-wrap gap-2">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => runPrune({ dryRun: true })}
                disabled={pruning}
              >
                {pruning ? '執行中…' : '預覽'}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  const ok = window.confirm('確定刪除舊資料版本？此動作無法還原。');
                  if (!ok) return;
                  runPrune({ dryRun: false });
                }}
                disabled={pruning}
              >
                {pruning ? '執行中…' : '執行刪除'}
              </Button>
            </div>

            {pruneError ? (
              <Alert variant="danger" className="small mt-3 mb-0 py-2">
                {pruneError}
              </Alert>
            ) : null}
            {pruneResultMessage ? (
              <Alert variant="info" className="small mt-3 mb-0 py-2">
                {pruneResultMessage}
              </Alert>
            ) : null}

            <LaFold label="伺服器指令" className="mt-3">
              <ul className="small mb-0">
                <li>重建：<code>{data.maintenance?.rebuildCommand}</code></li>
                <li>預覽清理：<code>{data.maintenance?.pruneSnapshotsDryRun}</code></li>
                <li>執行清理：<code>{data.maintenance?.pruneSnapshotsApply}</code></li>
              </ul>
            </LaFold>
          </div>

        </>

      ) : null}

    </div>

  );

}


