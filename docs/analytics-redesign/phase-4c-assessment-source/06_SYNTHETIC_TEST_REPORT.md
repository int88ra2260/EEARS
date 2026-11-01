# 合成測試報告

```text
npx eslint analytics-contracts tests/analytics-contracts
npm test -- --runInBand tests/analytics-contracts
```

ESLint 通過。Jest 11 個 suite、77 個測試通過，0 失敗。其中 Phase 4A／4B 的原有測試仍在同一指令裡。沒有真實學生，沒有資料庫連線，沒有讀取目前時間。

## 新增情境

| ID | 結果 |
|---|---|
| A01 | same_source_record |
| A02 | possible_duplicate，沒有套用來源優先 |
| A03 | 不同實測日為 distinct |
| A04 | 有 sourceRef 與 payload id 時為 confirmed_projection |
| A05 | 只有 BESTEP 類型、沒有 id 時不是 confirmed，而是 possible_duplicate 加 UNVERIFIED_PROJECTION |
| A06 | 同一主鍵、分數不同為 conflicting |
| A07 | 不同工具、相同 CEFR 為 distinct，且不可比較 |
| A08 | 不同來源、分數不同為 conflicting，兩邊的值都保留 |
| A09 | 缺日期則 assessmentDate 為 null |
| A10 | 只有 114-2 時精度是 semester，日期仍是 null |
| A11 | 標成推估的日期不能拿來判同一場，結果 undetermined |
| A12 | B2+ 留在 original，cefrLevel 為 B2 |
| A13 | 只有 B2 時 original 是 null，不還原加號 |
| A14 | 缺原分 |
| A15 | 缺 CEFR |
| A16 | 缺主鍵則 undetermined |
| A17 | 聽與讀是 distinct |
| A18 | 不同學號是 distinct |
| A19 | 輸入凍結物件不會被 adapter 改寫 |
| A20 | 左右對調後的判斷相同 |

另有三項 adapter 測試：sourceRef 與 payload id 衝突、et 的 testDate／examDate 不一致、1970-01-01 哨兵。另有一項：投影連結加上分數不同仍是 conflicting。

Legacy 時間差異有四項靜態測試：半開尾日、JavaScript 字串比較與半開瞬間不一致、`kpiService` 仍綁日期字串、adapter 不讀 `et_semesters`。這沒有證明 MySQL 上的正式查詢筆數相同。

## 未測

沒有把 adapter 接到真實列。沒有驗證 et 唯一鍵在 testDate 為 null 時的資料庫行為。沒有驗證 `et_semesters` 的實際起迄。
