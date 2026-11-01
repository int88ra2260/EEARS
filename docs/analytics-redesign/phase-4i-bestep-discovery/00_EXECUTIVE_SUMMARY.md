# Phase 4I 摘要

本階段只盤點與規劃。沒有改 BESTEP 報名、匯入、成績表、分析 API、學習歷程、KPI 或 Shadow runtime。

## 結論

EEARS 裡的「培力」不是一條單線：

1. **報名營運**在 `english_test_registrations`。學生個人報名與管理端審核是現役入口。管理端刪除會刪列。狀態字串沒有獨立的「取消」流程。
2. **到考**在 `bestep_attendance`。它跟報名以學號加檔案學期對上，且只接受 `status=success`。到考粒度是 L/R/S/W 或 LR/SW，不是一場考試一列。
3. **成績檔**在 `bestep_exam_scores`。一列是一位學生乘一個檔案學期，內含四科。匯入把 `examDate` 寫成 null，並把 `B2+` 折成 `B2`。
4. **投影**有兩條。成績匯入後會排程 `bestep_exam_scores` → `exam_attempts`。補寫 `et_exam_attempts` 要另外跑 `npm run lj:promote-bestep`。學習成效 KPI 讀的是 `et_exam_attempts`，不是成績檔本表。
5. `bestep_exam_sessions` 有資料表，但匯入程式不寫它。它不是報名或成績的外鍵。

因此不能把報名筆數、到考、B2 標記和能力提升合成一個成效指標。

## 建議的下一刀

Phase 4J 建議做 **Candidate C：單一檔案學期的 BESTEP 成績匯入品質**，pilot id `bestep-file-quality`。

原因是班級頁與成效分析已經在顯示通過率或歷史結果，但成績檔本身沒有考試日，加號已消失，而且和 `exam_attempts` / `et_exam_attempts` 是不同來源。先用既有 Assessment Observation 契約做 shadow，檢查這一檔能不能被當成一次測驗，再決定要不要做技能分布。

Candidate A 的班級到考率已經有現役計算，但分母是班級本國生與報考項目，不是中心場次名額。`bestep_exam_sessions` 沒有名額欄。Candidate B 會直接碰到 D1 與加號折疊，不適合作為第一個 BESTEP shadow。

## 不能在本階段決定的事

D1–D11 維持 Pending。`officialUseAllowed` 與 `causalClaimAllowed` 維持 false。沒有執行 L3，也沒有連正式資料庫。
