# 資訊架構

不新建平行權限，也不把四個視角做成四套新 API。

建議在現有 `/admin` 下加一個首頁路由 `/admin/analytics`（目前沒有 index route，不會蓋掉 `analytics/overview`）。它只做導覽與限制說明。

四個區塊連到既有頁：

1. **中心營運**：`/admin/analytics/overview`、`/admin/analytics/risk`、`/admin/reports`。給 `hasAdminRights` 或對應匯出權。
2. **英語測驗**：班級 BESTEP、培力匯入 `/admin/english-test/import`、學習歷程裡已掛載的成績頁。通過率旁固定短句：尚未核定官方達標率。
3. **學習參與**：`/admin/learning-analytics/resources`、`offerings`、`students`、`skills`。標題避免「造成進步」。
4. **資料限制**：不是新的 Shadow 儀表板。首頁列出已知限制：未知出席、總分 0 與缺失不同、報名 B2 標記不是活動成效、三個成績來源未合併、D1–D11 未決。

學期控制可以長得一樣，但每個區塊要寫自己的時間定義。活動日、報名學期、檔案學期、推斷考試日不能合成一個日期。

`/admin/analytics/students` 維持隱藏並導向學習歷程。
