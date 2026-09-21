import React from 'react';

const SKILL_LABELS = {
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
};

function buildTodoItems(data) {
  const items = [];
  const weakSkills = data?.weakSkills || [];
  const recommendations = data?.recommendations || [];

  if (!data?.isB2plus) {
    items.push({
      key: 'not-b2',
      title: '確認 B2 缺口',
      reason: '學生目前尚未達 B2+，正式判定仍以 B2 KPI 報表與有效英檢資料為準。',
      action: '先確認是否缺有效英檢或缺重測，再決定通知補測或安排輔導。',
    });
  }

  if (weakSkills.length) {
    items.push({
      key: 'weak-skills',
      title: '安排弱項補強',
      reason: `目前較需要補強：${weakSkills.map((skill) => SKILL_LABELS[skill] || skill).join('、')}。`,
      action: '優先挑選能對應這些技能的課程、諮詢或活動。',
    });
  } else {
    items.push({
      key: 'missing-skill-data',
      title: '補齊分技能資料',
      reason: '目前沒有足夠的聽讀說寫分技能成績，無法判斷主要弱項。',
      action: '先確認英檢匯入與重測資料，再做資源安排。',
    });
  }

  if (recommendations.some((row) => !row.alreadyParticipated)) {
    items.push({
      key: 'new-resource',
      title: '提供尚未參與的資源',
      reason: '系統依弱項技能列出可參考資源，但不是成效保證。',
      action: '從下方資源清單挑 1–2 項，轉成可通知學生的具體安排。',
    });
  } else if (recommendations.length) {
    items.push({
      key: 'follow-up-resource',
      title: '追蹤既有資源是否需要延續',
      reason: '目前推薦資源多已參與，下一步不是一直加資源，而是確認是否需要重測或改安排。',
      action: '查看時間線與前後測紀錄，決定是否轉介諮詢或提醒重測。',
    });
  }

  return items;
}

export default function StudentRecommendationsPanel({ data }) {
  if (!data) return null;

  const { weakSkills = [], recommendations = [] } = data;
  const todoItems = buildTodoItems(data);

  return (
    <div className="la-panel mb-3">
      <div className="la-panel-title">學生待辦與資源安排</div>
      <p className="small text-muted la-panel-lead mb-3">
        這裡只整理可採取的行政下一步；不顯示通過機率，也不作為正式輔導排序。
      </p>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <span className="small text-muted">弱項技能</span>
        {weakSkills.length ? weakSkills.map((skill) => (
          <span key={skill} className={`la-tag la-tag-pastel-blue`}>
            {SKILL_LABELS[skill] || skill}
          </span>
        )) : (
          <span className="small text-muted">尚無足夠分技能成績</span>
        )}
      </div>

      <div className="table-responsive mb-3">
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th>待辦</th>
              <th>原因</th>
              <th>下一步</th>
            </tr>
          </thead>
          <tbody>
            {todoItems.map((item) => (
              <tr key={item.key}>
                <td className="fw-semibold">{item.title}</td>
                <td className="small text-muted">{item.reason}</td>
                <td className="small">{item.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {recommendations.length ? (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>可參考資源</th>
                <th>狀態</th>
                <th>為什麼列入</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((row) => (
                <tr key={row.resourceKey}>
                  <td className="fw-semibold">
                    {row.label}
                    {row.alreadyParticipated ? (
                      <span className="la-tag la-tag-pastel-muted ms-2">已參與</span>
                    ) : null}
                  </td>
                  <td>{row.alreadyParticipated ? '追蹤成效或重測' : '可安排'}</td>
                  <td className="small text-muted">{row.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="small text-muted mb-0">目前沒有可參考資源；請先檢查英檢、重測與活動紀錄是否完整。</p>
      )}
    </div>
  );
}
