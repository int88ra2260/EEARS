# Staging 驗收計畫

狀態：`STAGING_PENDING_EXTERNAL_APPROVAL`。

這次沒有找到可安全使用、且已授權的 Staging。沒有部署。Playwright 的合成頁不能代替 Staging。

若之後同時有授權、與正式環境分開的 Staging、以及可回退的版本：

1. 部署 SHA 必須是當時核准的 Candidate，現在的候選是 `174beeb`。
2. 確認三個 Shadow 變數不存在。
3. 職員登入後打開 `/admin/analytics/overview`，確認報名 B2 比例在補充區，核心 KPI 仍是活動數字。
4. 打開一個有權限的班級 BESTEP 頁，確認總分 0 顯示 0，未知出席不是缺席。
5. 既有選單（學習歷程、培力匯入、報表）仍可進入。
6. 總覽 API 與班級 API 的狀態碼與主要欄位跟部署前相同。
7. 瀏覽器主控台沒有新的未處理錯誤。
8. 保留部署前的前端 build 與後端 SHA，以便退回。

沒有這份授權之前，不要把本機 build 拷到任何主機。
