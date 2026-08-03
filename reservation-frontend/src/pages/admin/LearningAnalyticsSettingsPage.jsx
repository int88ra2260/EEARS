import React, { useCallback, useEffect, useMemo, useState } from 'react';

import Alert from 'react-bootstrap/Alert';

import Spinner from 'react-bootstrap/Spinner';

import { Link } from 'react-router-dom';

import GseMappingReference from '../../components/learningAnalytics/GseMappingReference';

import FilterReferenceEditor from '../../components/learningAnalytics/FilterReferenceEditor';

import LearningAnalyticsSettingsSection from '../../components/learningAnalytics/LearningAnalyticsSettingsSection';

import LvaConfigEditor from '../../components/learningAnalytics/LvaConfigEditor';
import LvaMethodComparison from '../../components/learningAnalytics/LvaMethodComparison';

import ResourceSkillProfileEditor from '../../components/learningAnalytics/ResourceSkillProfileEditor';

import { LA_TERM_HELP } from '../../components/learningAnalytics/learningAnalyticsFilterConstants';

import { getLearningAnalyticsSettings } from '../../services/learningAnalyticsService';

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

        在此校準分析用對照與篩選選項。變更後，各分析頁面的圖表與建議會採用新設定。

        資料重建請至

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

            <ul className="small mb-0">

              <li>{data.policies?.estimateDisclaimer}</li>

              <li>{data.policies?.exposureWindowRule}</li>

              <li>{data.policies?.gseNote || LA_TERM_HELP.gse}</li>

              <li>{data.policies?.lvaNote}</li>

              <li>{data.policies?.filterReferenceNote}</li>

            </ul>

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

            title="估計方法新舊對照"

            lead="v2 為目前預設；legacy 欄位仍由 API 回傳供比對。所有方法 causalClaimAllowed 均為 false。"

          >

            <LvaMethodComparison />

          </LearningAnalyticsSettingsSection>



          <LearningAnalyticsSettingsSection

            title="LVA 學習成效估計演算法"

            lead="控制修正成長、背景相近比對與加權估計；展開後請先閱讀公式說明再調整參數。"

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

            title="CEFR → GSE 能力量尺對照"

            lead="Pearson GSE 對齊 CEFR；用於跨英檢比較與前後測分析。此區塊為唯讀參考。"

          >

            <GseMappingReference gseMapping={data.gseMapping} embedded />

          </LearningAnalyticsSettingsSection>



          <LearningAnalyticsSettingsSection

            title="資源技能向量"

            lead="各資源對聽說讀寫等面向的相對權重，用於曝光計算與建議。"

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

            <div className="la-panel-title">維運指令</div>

            <ul className="small mb-0">

              <li>重建分析快照：<code>{data.maintenance?.rebuildCommand}</code></li>

              <li>清理舊 snapshot（dry-run）：<code>{data.maintenance?.pruneSnapshotsDryRun}</code></li>

              <li>清理舊 snapshot（執行）：<code>{data.maintenance?.pruneSnapshotsApply}</code></li>

            </ul>

          </div>

        </>

      ) : null}

    </div>

  );

}


