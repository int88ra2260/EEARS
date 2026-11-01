# Phase 4G 實作摘要

本階段只改活動營運總覽的前端呈現。統計 SQL、API response、權限與路由都沒有改。

## 完成內容

- 既有 `AdminAnalyticsPage` 改成六個閱讀區塊：資源供給、預約需求、簽到與使用、行政例外、活動類型與場次、報名資料補充資訊。
- 五個營運數字沿用 API 原值，只改名稱與可展開說明。
- `englishPassRate` 移出核心 KPI，放在可展開的報名補充區，並註明它不是活動成效。
- 學期活動日期由既有 `SEMESTER_RANGES` 格式化，沒有在頁面再寫一份學期對照表。
- 缺值顯示「—」，數值 0 顯示 0 或 0.0%。載入下一個學期時先清掉上一筆數字。
- 類型表、場次表、兩條趨勢圖、班級排行、學期篩選與重新整理都還在。
- 這頁原本沒有匯出按鈕，本階段沒有新增。

## 主要檔案

- `reservation-frontend/src/pages/admin/AdminAnalyticsPage.jsx`
- `reservation-frontend/src/pages/admin/activityOpsPresentation.js`
- `reservation-frontend/src/pages/admin/AdminAnalyticsPage.test.jsx`

## 明確沒做

- 沒有新增場次數、不重複學生數或取消率。
- 沒有在前端重算預約名額比、簽到率或違規狀態比。
- 沒有把 `items` 與 `byEventType` 加總。
- 沒有改其他分析頁、全站導覽、下載內容或後端。
- Phase 4G 沒有 commit。
