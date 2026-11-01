# 尚待決定與資料驗證

D1–D11 全部仍是 pending。本階段沒有替任何一項做決定。

## 受影響的決策

- D11（培力成績表與英檢嘗試衝突時誰優先）：契約現在能同時說出「投影已確認」和「成績衝突」。它仍不選邊，也不合併。正式優先權要等這個決策。
- D10（是否另存原始 CEFR 加號）：匯入已把加號去掉。契約只保留輸入當下還看得到的加號，不從 `B2` 還原 `B2+`。
- D1（正式成果用哪一種達標定義）：指標登錄沒有改。來源衝突被分開之後，達標定義仍不能直接拿未決議的來源去算。

其餘決策沒有被這次比較模型改寫。

## 需要正式資料才能回答

- `exam_attempts` 投影鍵的存在比例，以及 `sourceRef` 與 payload id 不一致的筆數。
- `et_exam_attempts.testDate` 與 `examDate` 同時有值且不同的比例。
- `1970-01-01` 出現在哪張表、是否都帶已確認的培力 `sourceRef`。
- 已確認投影的列是否曾被改成這個日期，而不經過 `resolveBestepExamDate`。
- 培力列與英檢列同人同日的候選筆數。技能是否相同要再看兩張子表。
- `et_semesters` 的起迄是否等於 `shared/semesterConfig.js`。
- `events.date` 用字串 `BETWEEN` 與 `CAST AS DATE` 的筆數差。
- `testDate` 為 NULL 時，唯一索引實際允許多少列。
- 匯入技能表 `et_exam_attempt_scores` 與歷史最佳讀取的 `et_exam_attempt_skill_scores` 各有多少列。歷史最佳目前看不到只寫在前一張表的技能。

草案在 `06_L3_READONLY_VALIDATION_PLAN.md`。尚未執行。

## Phase 4D / 4E 之前

4D 若要做跨來源的正式讀模型，需要先有 L3 的計數，並且 D11 仍不可在契約裡私自決定。4E 若要碰到查詢或 API，也不能把本契約的 `possible_same_assessment` 當成可合併列。

本階段到此停止，沒有實作 4D。
