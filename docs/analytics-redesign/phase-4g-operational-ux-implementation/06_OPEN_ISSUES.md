# 尚未關閉的問題

本階段沒有把下列項目改成已驗證，也沒有改統計來避開它們。

## 仍待 L3 或業務決定

- 預約名額比的分母含零預約場次。隱藏場次佔比尚未用資料庫核對。
- 預約列違規狀態與 `event_violations` 是否同數，尚未核對。
- `CAST ... BETWEEN` 與半開區間在 MySQL 是否等價，尚未實測。
- `semesters`、`et_semesters` 與 `SEMESTER_RANGES` 是否同一窗，這支總覽 API 仍只讀共用設定。
- 取消會刪列已由程式確認；資料庫是否仍有應刪未刪的列，尚未查。
- 類型表與總覽的預約筆數是否每次都相同，尚未用資料庫核對。畫面沒有把兩種形狀加總。
- 報名 B2 標記的字串是否整齊，尚未查。畫面只把它放在補充區。

這些項目的只讀查詢稿在 `docs/analytics-redesign/phase-4f-operational-validation-ux/03_L3_READONLY_QUERY_PLAN.md`。本階段沒有執行。

## 產品與介面缺口

- 沒有可靠的活動場次數字，所以沒有場次 KPI。
- 沒有可靠的取消紀錄統計，所以沒有取消率。
- 這頁沒有匯出。若要把營運總覽接到既有報表下載，需另開範圍。
- Desktop、tablet、mobile 尚未在瀏覽器看過。見 `05_VISUAL_ACCESSIBILITY_REVIEW.md`。
- D1–D11、正式指標登錄與 Shadow Validator 治理狀態都沒有在本階段變更。
