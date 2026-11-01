# 測試與尚未驗證的資料

## 已有契約測試

檔案：`reservation-backend/tests/analytics-contracts/assessmentContractHardening.test.js`。

| 假設 | 測試 |
|---|---|
| 一列成績變四個 skill observation，namespace 同為 `bestep_exam_scores` | H08 |
| 不同表的相同數字 id 不是同一來源 | H07 |
| 分數或 CEFR 不同仍保留來源身分 | H02、H03 |
| 確認投影在內容衝突時仍保留 | H04、H05 |
| 確認投影上的 1970-01-01 是哨兵；沒有確認連結時不是 | H12、H13 |
| 缺考試日維持 null 並標 `MISSING_ASSESSMENT_DATE` | A09 |
| 學期字串不展開成考試日 | A10；`temporalContextBuilder` 另有學期不被改寫成第一天的案例 |
| 輸入仍帶加號時，正規化 B2 與 original 分開 | A12 |
| 已存的 B2 不重建成 B2+ | A13、H17 |

## 本階段新增

`reservation-backend/tests/bestepClassExport.test.js`：

`missing attendance stays unknown and is not a no-show`

`resolveComponentAttended({}, 'L')` 是 `null`。已標缺席的列是 `false`。Jest 單檔 8 passed。沒有連正式資料庫，沒有改 `bestepClassService`。

## 未再新增的項目

報名列與不重複學生的差異已由唯一索引與 `pickLatestRegistrationPerStudent` 說明。抽出 router 函式只為測試，會碰到現役審核流程，本階段不做。

出席舊模板把非出席字寫成 false，已有 `bestepAttendanceImport.test.js`。該檔含合成學號，文件不引用那些值。

## 尚未用真實資料驗證

- 各學期成績列的 `examDate` 是否都是 null。
- 重匯覆蓋了多少列。
- success 報名裡沒有成績列的人數。
- `exam_attempts` 裡有多少 1970 或出席推斷日。
- `et_exam_attempts` 是否已由 `lj:promote-bestep` 補寫。
- 歷史報名是否仍有同一學號加學期的多列。
- 團體報名成員是否各自有報名列。

這些是 L3。本階段沒有執行。
