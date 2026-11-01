# 尚未關閉的項目

## 需要 L3，本階段沒有執行

| 項目 | 草案 | 影響的句子 |
|---|---|---|
| 日期欄型別、索引、外鍵刪除規則 | V-OPS-01 | 強制刪除是否一併移除預約 |
| `CAST` 含尾日、半開區間、字串比較，以及 `semesters` / `et_semesters` 的 114-2 | V-OPS-02 | 這頁與學習歷程是不是同一批活動 |
| 隱藏場次名額 | V-OPS-03 | 供給是否大於學生看得到的名額 |
| 預約筆數與不重複學生、重複列 | V-OPS-04 | 標題必須維持「筆數」 |
| 預約狀態與 `event_violations` | V-OPS-05 | 不能把違規狀態比叫成事件率 |
| 頂層與分項的三個加總 | V-OPS-06 | 總計與類型表是否對得上 |
| 報名標記列數；可選的重疊計數 | V-OPS-07 | 只影響補充區，不影響活動成效結論 |

## 需要中心決定，程式已先用一種算法

- 名額比的分母要不要繼續包含零預約場次與隱藏場次。
- 違規狀態比要不要在對帳完成後，另立正式指標 `ops.reservation.violation_row_rate`。在那之前它保持提案。
- 報名 B2 標記要不要在別的頁面繼續給人看。不論決定為何，都不把它放進活動營運 KPI。

## 不需要再決定的事

`englishPassRate` 不是活動造成的英語能力提升。這已由第二段 SQL 與時間契約確定。

## 契約治理

32 個 Metric ID、9 個時間契約、7 個領域維持不變。D1–D11 仍是 pending。`officialUseAllowed` 與 `causalClaimAllowed` 仍全是 false。未實作的仍是 `ops.participation.streak` 與 `roster.pair_pass.both_pairs`。

Phase 4F 沒有 commit，也沒有進入下一階段的畫面實作。
