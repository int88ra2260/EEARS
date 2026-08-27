import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { P } from '../../constants/permissions';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import EwlSyncPanel from '../../components/learningJourneyV3/EwlSyncPanel';
import useScrollReveal from '../../hooks/useScrollReveal';
import '../../styles/learning-journey-import.css';

/**
 * 英文寫作工坊（EWL）資料同步
 * /admin/learning-journey/ewl-sync
 */
export default function AdminEwlSyncPage() {
  const token = localStorage.getItem('token') || '';
  const accessProfile = useMemo(() => buildAccessProfile(token), [token]);
  const canManageLj = hasPermission(accessProfile, P.CAN_MANAGE_ENGLISH_TEST_TRACKING);

  useScrollReveal('.lj-import-reveal');

  if (!canManageLj) {
    return (
      <main className="lj-import-page">
        <div className="alert alert-warning mb-0">您沒有管理英語學習歷程／EWL 同步的權限。</div>
      </main>
    );
  }

  return (
    <main className="lj-import-page">
      <header className="lj-import-page__header lj-import-reveal">
        <p className="lj-import-page__kicker">英語學習歷程 · 外部資料</p>
        <p className="lj-import-page__lede">
          從 EWL 系統讀取預約與簽到，寫入學習歷程活動參與，讓個人歷程、分析報表與行政總覽涵蓋寫作工坊資料。
        </p>
        <nav className="lj-import-page__nav" aria-label="相關頁面">
          <Link to="/admin/learning-journey">英語學習歷程中心</Link>
          <Link to="/admin/learning-journey/import">學習歷程資料匯入</Link>
          <Link to="/admin/learning-journey/operations">資料維運紀錄</Link>
          <Link to="/admin/import-center">資料匯入中心</Link>
        </nav>
      </header>

      <div className="lj-import-guide lj-import-reveal" style={{ '--reveal-delay': '60ms' }}>
        <div className="lj-import-guide__item">
          <span className="lj-import-guide__step">步驟 1</span>
          <p className="lj-import-guide__text">設定日期區間（或留空使用預設窗）與選填學號</p>
        </div>
        <div className="lj-import-guide__item">
          <span className="lj-import-guide__step">步驟 2</span>
          <p className="lj-import-guide__text">先「預覽同步」確認筆數，再「確認寫入」</p>
        </div>
        <div className="lj-import-guide__item">
          <span className="lj-import-guide__step">步驟 3</span>
          <p className="lj-import-guide__text">至學習歷程個人頁或報表核對 EWL 活動是否出現</p>
        </div>
      </div>

      <div
        className="lj-import-guide lj-import-reveal mb-4"
        style={{ '--reveal-delay': '90ms' }}
        role="note"
      >
        <div className="lj-import-guide__item" style={{ gridColumn: '1 / -1' }}>
          <span className="lj-import-guide__step">說明</span>
          <p className="lj-import-guide__text mb-0">
            日期篩選依 EWL「活動／預約日期」，不是報名時間。日常同步建議涵蓋未來數週，避免漏掉已報名但尚未舉辦的時段。
            同一筆以 ConsultationTimeID 去重，重複執行會更新既有紀錄。
          </p>
        </div>
      </div>

      <section
        className="lj-import-reveal"
        style={{ '--reveal-delay': '120ms' }}
        aria-label="EWL 同步表單與紀錄"
      >
        <EwlSyncPanel token={token} />
      </section>
    </main>
  );
}
