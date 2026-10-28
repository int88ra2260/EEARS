---
name: eears-learning-analytics
description: >-
  EEARS 學習成效分析（Learning Analytics）：CEFR 與 GSE 用法、B2 達標／接近 B2、
  跨頁 working set、分析頁 UI 契約。在改成效分析頁、KPI、技能成長、接近 B2、
  系所比較、資源覆蓋、課師活動、學生探索，或討論 CEFR／GSE／B1+ 時使用。
license: MIT
---

# eears-learning-analytics（學習成效分析）

## When to Use This Skill

- 改 `/admin/learning-analytics/*` 任一頁或對應 API／service
- 討論或實作 CEFR、GSE、B2 達標、接近 B2（舊稱 B1+ 追蹤）
- 改成效分析篩選、表頭、working set 交接、資料版本／快照

## 產品量尺（必須遵守）

CEFR 只用在最後呈現或是看有沒有達標使用，GSE 是用作資料比較使用，因為教務處和教育部要看的是 CEFR 的成果，但是因為每個測驗雖然 CEFR 一樣但由於級距關係看不出差異所以才使用 GSE 作為比較時使用。

因此：

| 用途 | 用什麼 | 說明 |
|------|--------|------|
| 上呈、達標、對外成果 | **CEFR** | 例如是否達 B2；報表標題與結論用語 |
| 資料比較、成長、接近程度 | **GSE** | 同一 CEFR 級距內仍可看出差異；跨英檢放同一尺 |

### 不要做

- 不要用 GSE 取代對外／教務處／教育部的 CEFR 達標語言
- 不要只靠分析快照裡的 CEFR 字串 `B1+` 找「接近 B2」（學習歷程 `normalizeCefr` 會拿掉加號，快照常只剩 A1–C2）
- 不要把「全部 CEFR=B1」當成「接近 B2」（含剛進 B1 前段）
- 同測比較主看**原始分**；GSE 鈍化時標警示，不解讀成沒進步

### 接近 B2（路由仍為 `b1-plus`）

- 條件：尚未達 B2，且目前最佳能力 **GSE 51–58**（Pearson B1+ 帶）
- 有原始分 → 換成 GSE；頁面名稱／選單用「接近 B2」
- 實作：`reservation-backend/services/learningAnalytics/b1PlusWatch.js`
- 對照表：`reservation-backend/services/learningAnalytics/gseMappingDefaults.js`（VERSION `2026-v1`）

### B2 達標（KPI）

- 仍以 CEFR／政策引擎判定是否達 B2
- 路徑：`/admin/learning-analytics/kpi-report`
- GSE 不取代 KPI 分母與達標定義

### 接近 B2 的「有修課」

- **有修課**＝`course_enrollments` 有非退選紀錄（不靠成績、不靠快照 `totalCourseHours`）
- **修課中**＝選課列的 `semesterId` 等於當下時間所屬學期（`getCurrentSemester()`）
- 原因：目前常只能匯入該學期選課、尚無學期成績；時數會長期為 0

## 模組地圖

### 前端

- Layout／子頁：`reservation-frontend/src/pages/admin/LearningAnalytics*.jsx`
- 共用殼：`reservation-frontend/src/components/learningAnalytics/`
- 學生探索路由：**`/admin/learning-analytics/explore`**（不是 `student-explorer`；API 仍可能是 `/api/.../student-explorer`）
- 導覽：`adminNavigation.js`、`adminRouteAccess.js`、`LearningAnalyticsLayout.jsx`

### 後端

- 路由：`reservation-backend/routes/learningAnalyticsRouter.js`
- GSE：`gseScoreMappingService.js`、`gseMappingDefaults.js`
- CEFR 正規化（LJ，去加號）：`learningJourney/utils/cefr.js`
- 稽核說明：`docs/learning-analytics-gse-anchor-audit.md`

## Working set（跨頁名單）

- 前端：`sessionStorage` key `eears.la.workingSet.v1`，上限 2000 人
- 有 `studentIds` 時用 **POST** 同路徑帶 body；勿把長名單寫進 URL
- `useLearningAnalyticsWorkingSet` 回傳物件每 render 是新的：effect 依賴解構後的 `withWorkingSet`，不要依賴整個 hook 物件
- 截斷提示只在 `truncated && total > ids.length` 時顯示

## UI 契約（成效分析）

- 左側選單已列齊各頁：頁內勿再鋪一整組帶說明的目錄占首屏
- 表頭要讓使用者知道「這欄在量什麼」；同一概念跨頁用同一組用語（見 `ColumnHead.jsx`）
- 篩選選項（學院／系所／入學年）應來自分析快照／設定，不要只從「目前命中列」組下拉（命中為 0 時會空）

## Hard Checklist

- [ ] 這次改動是「呈現／達標」還是「比較」？前者偏 CEFR，後者偏 GSE
- [ ] 若改接近 B2：是否仍用 GSE 51–58，而非 CEFR 字串 B1+？
- [ ] 若改 handoff 連結：學生探索是否指向 `/explore`？
- [ ] 若改 GSE↔CEFR 分帶：縫隙分數（如 50.5）不可誤標成 C2（`gseBandForScore`）
- [ ] 培力／學習有伴獎勵若仍認字串 `B1+`，不要與成效分析「接近 B2」混成同一套條件

## Suggested Workflow Prompt

> 請先判斷這次是 CEFR 呈現／達標，還是 GSE 資料比較；列出會動到的 learning-analytics 路徑與是否觸及接近 B2（GSE 51–58）或 KPI B2。確認後再改，並補相關測試。
