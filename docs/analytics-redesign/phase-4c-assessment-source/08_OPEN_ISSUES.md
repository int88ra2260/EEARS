# 未決事項

## 程式已看過、資料還沒核對

- `et_exam_attempts.testDate` 與 `examDate` 同時存在而且不同時，沿用歷史最佳的讀法留下 testDate。哪一欄才是對外日期：UNKNOWN。
- et 唯一鍵在 testDate 為 null 時是否擋得住重複：UNKNOWN。
- et 的 `rawPayload` 在正式資料裡有沒有 `bestepExamScoreId`：程式沒有寫入這條連結。實際列：UNKNOWN。
- `et_semesters.startDate`／`endDate` 與 `shared/semesterConfig.js` 是否一致：UNKNOWN。合成測試不能代替。
- JavaScript 字串比較只說明它和半開區間不同。MySQL 的 DATE、DATETIME、字串 `BETWEEN`、CAST 的實際筆數差：待驗證。

## 政策

D11 仍 pending。相似坐席不會自動併成一筆，也不會讓 `et_exam_attempts`、`exam_attempts` 或 `bestep_exam_scores` 取得優先權。

已經寫進資料庫的 B2 無法知道當初是不是 B2+。本階段不回補。

## 同步日期

`resolveBestepExamDate` 會改看出席表、匯入時間，最後寫 `1970-01-01`。adapter 不重做這段。只有已寫入且帶培力連結的 `1970-01-01` 會被標成哨兵。若真有人把這天當考試日，會被誤標。這是已知限制。

## 下一階段之前不要做的事

不要把 possible_duplicate 寫回快照去重。不要改 prefer-et。不要為了 D11 先選一個來源。
