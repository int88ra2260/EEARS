# 合成測試報告

指令於 `reservation-backend/`：

```bash
npx eslint analytics-contracts tests/analytics-contracts
npm test -- --runInBand tests/analytics-contracts
```

結果：ESLint 通過。Jest 12 suites、97 tests、0 failed。時間約 6.9 秒。全部使用合成學號 `s001` 這類值。

Phase 4C 結束時是 11 suites、77 tests。本階段新增 1 suite、20 tests，既有 A01–A20 仍通過。

## H01–H20

| ID | 結果 |
|---|---|
| H01 | 同源同技能且成績一致：身分 `same_source_record`，內容 `consistent` |
| H02 | 同源同分不同：身分保留，內容 `conflicting`，舊介面仍是 `conflicting` |
| H03 | 同源同技能、CEFR 不同：身分保留，差異欄為 `cefrLevel` |
| H04 | 已確認投影且成績一致：舊介面 `confirmed_projection`，不需覆核 |
| H05 | 已確認投影且成績衝突：身分仍是 `confirmed_projection` |
| H06 | 內容全同但來源主鍵不同：`possible_same_assessment`，信心 `candidate` |
| H07 | 不同表的相同數字主鍵：namespace 不同，並帶 `table_namespace_differs` |
| H08 | 一列培力成績拆成四個觀測；不同技能為 `distinct` / `not_comparable` |
| H09 | 投影已確認但缺分數：內容 `insufficient_data`，不當成衝突 |
| H10 | 分數更新後 observationId 與 namespace 不變，版本保持 `unknown` |
| H11 | `testDate` 與 `examDate` 不同時不選正式日期，比較因日期不足而 `undetermined` |
| H12 | 已確認同步投影上的 `1970-01-01` 不是可觀測考試日，投影本身仍在 |
| H13 | 手動列，以及沒有來源鍵的 BESTEP 列，`1970-01-01` 保持字面日期 |
| H14 | 缺主鍵：`UNKNOWN_SOURCE_IDENTITY`，比較 `undetermined` |
| H15 | 交換左右後，詳細結果 deep equal |
| H16 | 舊欄位仍回報衝突，同時看得到保留的身分 |
| H17 | 儲存值 `B2` 的 `originalCefrLevel` 為 null，輸出不含 `B2+` |
| H18 | 32 / 9 / 7 / D1–D11 pending / 兩個未實作指標 / 兩個官方旗標皆 false |
| H19 | 三個 adapter 不改輸入物件 |
| H20 | 載入契約模組的子模組不含 `models/`、`db.js`、`sequelize`、`server.js`；`server.js` 內文也沒有契約路徑 |

## 尚未用測試證明的事

- MySQL 對 DATE、DATETIME、字串條件的筆數。
- 正式資料裡哨兵日期、兩欄日期不一致、投影鍵覆蓋率。
- `et_semesters` 與 `shared/semesterConfig.js` 的實際差異。
- 匯入寫入的 `et_exam_attempt_scores` 與歷史最佳讀取的 `skillScores` 在正式資料中各有多少列。
