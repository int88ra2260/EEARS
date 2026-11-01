# L3 尚未驗證

本階段沒有連線資料庫，也沒有執行唯讀聚合。下列數字都還沒有真實結果：

- `bestep_exam_scores.examDate` 為 null 的比例
- 四科分數或 CEFR 空缺比例
- `STUDENT_NOT_FOUND` 與其他跳過碼的比例
- `exam_attempts` 中來源連結、推斷日與 `1970-01-01` 的比例
- `et_exam_attempts` 是否已由 `lj:promote-bestep` 補寫
- 加號在匯入前檔案與匯入後欄位之間實際消失的比例
- 同一學號加學期被重匯覆蓋的次數
- success 報名中沒有成績列的人數

未來若獲授權，只做唯讀聚合：按 `semester` 與 `importBatchId` 計列數、null 日期數、四科 null 數，以及 `sourceRef` 以 `bestep_exam_scores:` 開頭的投影列數。輸出不得包含學號或姓名。未授權前不執行。

合成測試的計數只描述測試輸入。
