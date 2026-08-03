import React, { useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Collapse from 'react-bootstrap/Collapse';
import { Link } from 'react-router-dom';

const STEPS = [
  {
    title: '1. 確認資料已建立',
    body: '若下方顯示「尚無分析資料」，請至「英語學習歷程 → 學習歷程維運」執行「背景重建（全部）」。重建會把名冊、英檢、修課與活動整理成可分析的摘要。',
    link: { to: '/admin/learning-journey/operations', label: '前往學習歷程維運' },
  },
  {
    title: '2. 設定想看的學生群體',
    body: '在「篩選條件」選擇入學年級、系所、起始英語能力等，按「套用篩選」後，本頁所有數字與圖表才會更新（調整選項時不會自動重算）。',
  },
  {
    title: '3. 閱讀指標卡與圖表',
    body: '上方四張卡片是整體摘要；下方圖表分別呈現英語等級分布、各技能成長、資源參與與效益排名。滑鼠移到指標旁的 ⓘ 可查看定義。',
  },
  {
    title: '4. 需要細部比較時',
    body: '若要依系所／年級分組比較，請至「群體分析」；進階散點圖、認證趨勢與個別建議請至「決策支援」。',
    links: [
      { to: '/admin/learning-analytics/cohorts', label: '群體分析' },
      { to: '/admin/learning-analytics/insights', label: '決策支援' },
      { to: '/admin/learning-analytics/raw-data', label: '原始資料匯出' },
    ],
  },
];

export default function LearningAnalyticsOverviewGuide() {
  const [open, setOpen] = useState(false);

  return (
    <Alert variant="light" className="la-overview-guide border mb-3">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
        <div>
          <div className="fw-semibold">本頁可以回答什麼？</div>
          <p className="small text-muted mb-0 mt-1">
            在目前的學生群體中，英語程度分布如何、有多少人達 B2+、參與哪些英語資源，
            以及重測後能力是否有變化。這些都是<strong>觀察統計</strong>，用來輔助決策，不能單獨解讀為「某課程保證讓學生進步」。
          </p>
        </div>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? '收合使用說明' : '如何使用本頁'}
        </Button>
      </div>
      <Collapse in={open}>
        <ol className="small mb-0 mt-3 ps-3 la-overview-steps">
          {STEPS.map((step) => (
            <li key={step.title} className="mb-2">
              <strong>{step.title}</strong>
              <div className="text-muted">{step.body}</div>
              {step.link ? (
                <Link to={step.link.to} className="small">{step.link.label} →</Link>
              ) : null}
              {step.links ? (
                <div className="d-flex flex-wrap gap-2 mt-1">
                  {step.links.map((l) => (
                    <Link key={l.to} to={l.to} className="small">{l.label} →</Link>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </Collapse>
    </Alert>
  );
}
