# Assessment Observation

一筆觀測是一個來源列上的一個技能，不是「這個學生的聽力」。

| 區塊 | 內容 |
|---|---|
| observationId | `obs:{table}:{id}:{skill}`。沒有主鍵時 id 位置是 `none` |
| sourceIdentity | 來源系統、表、主鍵、批次、上游連結、originClass |
| studentReference | 學號與 matchKey。不含姓名 |
| assessment | 工具、sessionId、考試日、精度、日期出處、檔案學期 |
| result.skill | listening、reading、speaking、writing，或缺技能時 null |
| result.rawScore | 原分。沒有就是 null |
| result.normalizedScore | 永遠 null。沒有已驗證的跨工具換算 |
| result.cefrLevel | 去掉加號後的 A1–C2。認不出來是 null |
| result.originalCefrLevel | 只有輸入本身帶加號時才保留，例如 `B2+`。單純的 B2 不會被填回這裡 |
| qualityFlags | 排序後的標記，沒有總分 |
| provenance | 欄位對應與列內日期衝突 |

`bestep_exam_scores` 一列會變成四筆觀測，因為四科共用同一個來源主鍵。

考試日精度：

- `date`：欄位裡有 `YYYY-MM-DD`
- `semester`：沒有考試日，但有檔案學期。`assessmentDate` 仍是 null
- `inferred`：呼叫端明確標 `dateProvenance: 'inferred'`
- `unknown`：沒有日期，或同步哨兵 `1970-01-01` 被拿掉

哨兵只用於帶有培力同步痕跡的 `exam_attempts`。這個判斷來自 `resolveBestepExamDate` 的最後退路，adapter 不會自己去出席表找日期。
