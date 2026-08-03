import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { P } from '../../constants/permissions';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import LearningJourneyV3ImportSection from '../../components/learningJourneyV3/LearningJourneyV3ImportSection';
import LearningJourneyImportHistoryPanel from '../../components/learningJourneyV3/LearningJourneyImportHistoryPanel';
import useScrollReveal from '../../hooks/useScrollReveal';
import { getCurrentSemester } from '../../utils/semesterUtils';
import '../../styles/learning-journey-import.css';

/**
 * 學習歷程 V3 名冊／考試匯入（/admin/learning-journey/import）。
 * 由資料匯入中心導向，與總覽 Dashboard 分離。
 */
export default function LearningJourneyImportHubPage() {
  const token = localStorage.getItem('token') || '';
  const [searchParams] = useSearchParams();
  const defaultSemester = (searchParams.get('semester') || getCurrentSemester() || '114-2').trim();
  const [historySemesterId, setHistorySemesterId] = useState(defaultSemester);
  const accessProfile = useMemo(() => buildAccessProfile(token), [token]);
  const canManageLj = hasPermission(accessProfile, P.CAN_MANAGE_ENGLISH_TEST_TRACKING);

  useScrollReveal('.lj-import-reveal');

  if (!canManageLj) {
    return (
      <main className="lj-import-page">
        <div className="alert alert-warning mb-0">您沒有管理英語學習歷程匯入的權限。</div>
      </main>
    );
  }

  return (
    <main className="lj-import-page">
      <header className="lj-import-page__header lj-import-reveal">
        <p className="lj-import-page__kicker">英語學習歷程 · 資料匯入</p>
        <h1 className="lj-import-page__title">學習歷程資料匯入</h1>
        <p className="lj-import-page__lede">
          上傳名冊、英檢成績、教務處修課名單與學測 baseline Excel。寫入後會觸發學習歷程統計重算。
        </p>
        <nav className="lj-import-page__nav" aria-label="相關頁面">
          <Link to="/admin/learning-journey">英語學習歷程中心</Link>
          <Link to="/admin/learning-journey/ewl-sync">EWL 同步</Link>
          <Link to="/admin/import-center">資料匯入中心</Link>
          <Link to="/admin/import-center/runs">匯入紀錄中心</Link>
        </nav>
      </header>

      <div className="lj-import-guide lj-import-reveal" style={{ '--reveal-delay': '60ms' }}>
        <div className="lj-import-guide__item">
          <span className="lj-import-guide__step">步驟 1</span>
          <p className="lj-import-guide__text">選擇學期（修課與名冊／考試匯入需指定學期）</p>
        </div>
        <div className="lj-import-guide__item">
          <span className="lj-import-guide__step">步驟 2</span>
          <p className="lj-import-guide__text">上傳 Excel；修課名單請先預覽，確認後再寫入</p>
        </div>
        <div className="lj-import-guide__item">
          <span className="lj-import-guide__step">步驟 3</span>
          <p className="lj-import-guide__text">檢視匯入結果與下方批次紀錄，必要時可回滾</p>
        </div>
      </div>

      <section
        className="lj-import-reveal"
        style={{ '--reveal-delay': '120ms' }}
        aria-label="資料匯入表單"
      >
        <LearningJourneyV3ImportSection
          token={token}
          defaultSemester={defaultSemester}
          onImportSuccess={(sem) => setHistorySemesterId(sem)}
        />
      </section>

      <LearningJourneyImportHistoryPanel
        token={token}
        semesterId={historySemesterId}
        onSemesterChange={setHistorySemesterId}
        canManage={canManageLj}
      />
    </main>
  );
}
