# 試點測試報告

指令於 `reservation-backend/`：

```bash
npx eslint analytics-contracts tests/analytics-contracts
npm test -- --runInBand tests/analytics-contracts
```

結果：ESLint 通過。Jest 13 suites、112 tests、0 failed。其中 Phase 4A–4C.1 的 97 個測試仍在這 112 個裡面通過。新增檔案是 `tests/analytics-contracts/activityOpsOverviewPilot.test.js`，15 個測試對應 P01–P15。

| ID | 結果 |
|---|---|
| P01 | 114-2 契約起點 `2026-02-01T00:00:00+08:00`，終點 `2026-08-01T00:00:00+08:00` |
| P02 | 舊邊界等於 `shared/semesterConfig.js` 的 `2026-02-01` 與 `2026-07-31` |
| P03 | 四個已映射欄位各自使用登錄中的 Metric ID；報名標記使用檔案學期契約 |
| P04 | 出席率單位是預約列，不是不重複學生 |
| P05 | `reservations.createdAt` 被拒絕 |
| P06 | 沒有學期時為 `MISSING_REQUIRED_BOUNDARY` |
| P07 | 未知指標、錯配契約、未實作的 streak 都被拒絕 |
| P08 | `distinctStudents`、`violationRate`、`totalEventCapacity`、`capacityBreakdown` 維持 unmapped |
| P09 | 傳入 `class_working_set` 時，母體說明仍是全中心 |
| P10 | 凍結的 legacy 物件在呼叫後 JSON 不變 |
| P11 | metadata 不帶入 `totalReservations` 的數值，且 `countsRecomputed` 為 false |
| P12 | 試點檔沒有 `require` Sequelize 或 analyticsService，也沒有 `sequelize.query` |
| P13 | 含尾日與半開終點同時保留，MySQL 等價標記為 false |
| P14 | 32 個指標、9 個時間契約、7 個領域、11 個 pending gate、兩個未實作指標、兩個官方旗標皆 false |
| P15 | `getOverview` 仍 `res.json(data)`，控制器與 `server.js` 都沒有載入契約模組 |

沒有跳過的測試。實際資料庫筆數仍是 L3，這組測試沒有宣稱已驗證。
