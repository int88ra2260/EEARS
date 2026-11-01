# 邊界、時區與精度

## 格式

- 日期：`YYYY-MM-DD`。`114-2`、`2026/3/1`、`2026-02-30` 都是 `INVALID_DATE_FORMAT`。
- 時間：`YYYY-MM-DDTHH:mm:ss` 後面必須是 `Z` 或 `±hh:mm`。沒有時區的 `2026-06-01T08:00:00` 被拒絕。
- 毫秒會在改寫成 `+08:00` 時去掉。比較精度到秒。
- 解析用年月日數字與 `Date.UTC`，不用 `new Date('YYYY-MM-DD')`，也不用執行環境的本地時區。

## 半開區間

活動學期用 `[startInclusive, endExclusive)`。

`shared/semesterConfig.js` 與前端產生檔的 `end` 都是含尾日。114-2 是 `2026-02-01` 到 `2026-07-31`。上下文把它寫成：

```text
startInclusive: 2026-02-01T00:00:00+08:00
endExclusive:   2026-08-01T00:00:00+08:00
```

因此 `2026-07-31T23:59:59+08:00` 在窗內，`2026-08-01T00:00:00+08:00` 與 `2026-07-31T16:00:00Z` 不在窗內。114-1 的含尾日 `2026-01-31` 同樣在隔日零時排除。設定檔沒有被改。

自訂期間必須自己宣告 `boundKind: 'half_open'`。開始不早於結束時是 `INVALID_TIME_RANGE`。

## 精度

| 情況 | precision.assessment |
|---|---|
| 呼叫端給了測驗日 | `date` 或 `timestamp` |
| 只有檔案學期或名冊學期 | `semester` |
| 只有工具與快照版本、沒有考試日 | `unknown` |
| 活動場次這類不談測驗日的契約 | `not_applicable` |

只有學期時，安全邊界的 `startInclusive` 是 null。不會把學期第一天補成考試日。

baseline 必須早於 follow-up。同一天的日期起點不算早於。

## 與舊查詢的差異

這份半開區間還沒有接到舊 SQL。舊查詢仍是含尾日，而且兩條路徑本來就不一樣：

- `analyticsService.sqlEventDateInSemesterRange` 用 `CAST(... AS DATE) BETWEEN`。
- `kpiService` 的名單參與查詢把 `range.start` 與 `range.end` 當字串綁進 `e.date BETWEEN`。同函式裡組過 `00:00:00` / `23:59:59`，但那兩個變數沒有被查詢使用。

`et_semesters.startDate` / `endDate` 這次沒有讀。若資料庫列與 `shared/semesterConfig.js` 不同，這裡不會自動對齊。
