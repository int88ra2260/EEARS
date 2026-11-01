# Phase 4M 實作摘要

本階段把 Phase 4L 的班級 BESTEP 欄位契約接到現役概況 API 的成功路徑上，只做讀取驗證。統計公式、查詢、權限、匯出與前端正式元件都沒有改。

Phase 4L 已另成一個本機 commit：`499be067863d6c9323a04f414f671f57c6c8e17f`。本階段變更尚未提交。

## 接入結果

`GET /api/admin/classes/:classId/bestep-overview` 在 `getClassBestepOverview` 成功、`res.json` 之前呼叫 `observeBestepClassAnalytics`。呼叫包在獨立的 try/catch。匯出函式 `exportClassBestepOverview` 沒有這個呼叫。

旗標 `BESTEP_CLASS_ANALYTICS_SHADOW_ENABLED` 預設關閉。只有去掉前後空白後剛好是 `true`，而且 `NODE_ENV` 是 `test`、`development` 或 `staging` 才會執行。`production` 不執行。

## 語意證據

- F-BESTEP-01 是公式定義差異。`passedCount` 計算全部班級名冊裡 `score.passed` 為真的列。`passRate` 的分母是 `registeredCount`，也就是本國生且最新報名成功的人數。合成案例可以看到通過率 150，以及分母為 0 時分子仍大於 0、但公布的通過率被寫成 0。這不是「所有班級通過率都錯」。
- F-BESTEP-02 是前端顯示。`formatAttendanceCell` 在出席物件存在時，把 `null` 和缺少 `attended` 都畫成「缺席」。API Shadow 沒有把這個前端問題寫進每次診斷。

## 沒有做的事

沒有改報考率、到考率、四科通過率。沒有改前端正式元件。沒有新增 SQL。沒有合併成績來源。沒有跑 L3。沒有部署，沒有 push。
