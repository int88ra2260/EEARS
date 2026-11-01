# 09 遷移與相容

原則：沒有對照到新契約的舊頁，保持原樣。Unverified 的資產不刪。新舊並行期間，舊 API 仍是操作介面，新 metadata 是附加。

策略代號：Retain 沿用計算；Reorganize 改掛工作流但不改公式；Reimplement 日後換讀取層；Deprecate Candidate 僅標可能退役，不刪；Requires Business Decision；Unverified。

## 指標對照

完整列在 `migration_matrix.csv`。摘要：

| Phase 2 ID | 領域 | 策略 | 風險 |
|---|---|---|---|
| 營運五個列指標 | OPS | Retain，之後加 metadata | 低。取消狀態未濾，並行時不要「修正」 |
| 名單參與三個 | PART | Retain | 與列指標並排會被誤減。文案風險 |
| `ops.participation.streak` | PART | Proposed，無頁可遷 | 不要為了補洞先做一版定義 |
| 培力分數、等級、四項、單科 | ATTAIN | Retain | 改顯示名會讓舊簡報對不上，要在發布說明寫加號已摺疊 |
| 行政通過率、LR／SW 出席 | ATTAIN／PART | Retain | 與班級率不同分母 |
| legacy hasCEFRB2 | ATTAIN | Deprecate Candidate | 註解已說前端不顯示。確認無消費者後才停，本階段不停 |
| 聽讀／說寫成對 | ATTAIN | Retain | 終身窗。標籤可以先加，公式不能先改 |
| `both_pairs` | ATTAIN | Proposed | 無 |
| 歷史最佳兩個 | STATE | Reorganize | 移出成果語意，不刪 API |
| 快照格子、接近 B2、GSE 差、暴露、成長段、資源效果、品質帶 | STATE／LONG／EXPLORE／GOV | Retain | 快照延遲與同日覆蓋仍在 |
| 微學習、分組 GSE | PART／STATE | Retain | 不進快照的事實要寫在頁上 |
| 有伴差距 | EXPLORE | Retain | 不得刪 caveat |

## Phase 1 盤點卡

| 卡片 | 策略 | 新工作流 |
|---|---|---|
| LA-01 總覽快照 | Reorganize | 不再當主任成果。覆蓋與 CEFR 分布留在探索或狀態。學期 B2 旁路維持不送學期 |
| LA-02 KPI | Retain | `page.draft.roster`。Official 等 D1 |
| LA-03 接近 B2 | Retain | 教師與狀態頁 |
| LA-04 探索、LA-05 追蹤、LA-06 個人 | Retain | 個人與名單。追蹤重算語意仍 PARTIALLY_VERIFIED，不改 |
| LA-07 系所 | Retain | 探索。不是學期 KPI |
| LA-08 技能 | Retain | Workflow E |
| LA-09 課師、LA-10 資源 | Retain | 探索。保留非因果句 |
| LA-11 原始匯出 | Retain | 追溯，不是成果 |
| LA-12 設定 | Retain | 政策表仍是 AssessmentPolicy |
| LA-13 洞察／模型改導 | Retain 改導 | 不把模型頁送回主任首頁 |
| LJ-01 B2 報告 | Reorganize | DOM-STATE。禁止再叫認證率 |
| LJ-02 至 LJ-06 | Retain | 重建與品質仍是快照管線，不是 Report Run |
| BT-01 班級 BESTEP | Retain | Workflow D |
| BT-02 報名分析 | Unverified 公式／Retain 頁 | 不併進達標 |
| BT-03 漏斗 | Retain | DOM-PART。公式仍 PARTIALLY_VERIFIED |
| BT-04 有伴結果 | Retain | EXPLORE |
| BT-05 名次 | Retain | 行政，不是達標契約。未另發 Metric ID，避免把獎金規則收成 B2 |
| BT-06、BT-07 未掛載路由 | Deprecate Candidate | 不掛回。底層 `rebuildSemesterBestSkills` 仍被 v3 使用，退役路由前要再確認沒有腳本 require |
| OP-01 至 OP-03 | Retain | Workflow A 只用 OPS 子集；風險頁仍可能呼叫歷史最佳，標 Unverified 程度 PARTIALLY_VERIFIED，不在第一期改風險公式 |
| OP-04 改導 | Retain | |
| OP-05 問卷、OP-06 週報、OP-07 分組報表 | Unverified | 留在原模組。不納入新達標，也不刪 |
| OP-08 流量 | Retain | 不是學習成效 |

## Parallel Run

每次只比一個 Metric ID。舊 API 的數字為基準，新讀取層或新 metadata 路徑的數字應相同，直到有核准的公式變更。

| 比對 | 通過條件 | 失敗時 |
|---|---|---|
| 營運五 ID | 同一學期、差異 0（快取除外，要繞過快取） | 不切換主任頁 |
| 四項 `passed` 人數 | 與班級統計一致 | 不改班級頁 |
| 成對人數 | 與現有 KPI 在同一政策鍵下一致 | 不改政策引擎 |
| 歷史最佳率 | 與 `b2-report` 一致 | 不改文案以外的計算 |
| 快照學生數 | 同一 version 一致 | 不改投影 |

公式變更（例如 D2 從終身改成學期窗）不算並行失敗，算**另一次**核准後的差異報告，必須先給主任看 V-01。

## Golden Dataset

合成資料，不使用正式學號。最少情境：

1. 正常：同人、同日、四科齊、等級含字串 `B2+`（斷言儲存後為 B2）。
2. 缺一科等級：培力 `passed` 為 false，人仍在註冊分母。
3. 分日：聽讀一日、說寫另一日。same_date 成對不應把四科拼成一場；cross_date 政策才可以在同工具下拼。
4. 雙來源：只有 `bestep_exam_scores`、只有 et、兩者候選鍵相同但分數不同。斷言檔案指標只看培力表，成對只看 et，且沒有刪列。
5. 重複匯入：同學期兩列，斷言現況後寫覆蓋的行為在 Retain 期間不變。
6. 跨學期嘗試：名冊 114-2，嘗試日在 114-1 與 115-1。終身政策仍可選為候選；學期窗政策（若尚未實作）不在這批資料裡假裝已上線。
7. 歷史最佳：較晚較高的 rank 改變率。凍結 as-of 未做時，測試期望是「會變」，不是「不變」。
8. 跨工具：TOEIC 聽、BESTEP 讀。成對不通過跨工具拼。歷史最佳可以各科取高。
9. 學測：不進分析考試列，不能當前測。
10. 全形與半形學號：快照合併行為維持現況，讀取層不新增合併。

## Contract Testing

- 每個 ID 的 temporalContract 與 registry 一致。
- 比較 API 拒絕不同 ID 的並排。
- `official: true` 在達標 ID 上，於 D1 仍為 Pending 時失敗。
- 探索回應含限制句。
- `roster.pair_pass.both_pairs` 與 streak 沒有計算函式可呼叫。
- 黃金資料第 4 點：兩軌數字可以不同，測試名稱就叫 `dual_source_not_equal`。

## Rollback

| 層 | 退回 |
|---|---|
| 只加 metadata 的 API | 忽略新欄位，舊欄位仍在 |
| 新讀取層 | 功能旗標關閉，呼叫舊服務 |
| 發布表 | 停止寫入。已 published 的列保留只讀，不回寫業務表 |
| 投影 prefer et | 本路線不改它，所以沒有這一步的回滾 |
| 文案 | 還原字串。數字不應已變 |

回滾不包含刪除正式庫的培力列或嘗試列。

## 相容風險

最高的風險是並行期間有人把「新舊數字不同」當成 bug 去改公式，把 D2 或 D6 偷偷做掉。驗收規定：未核准的差異只能出報告，不能改 SQL。

第二是快照同日覆蓋讓並行比對對錯 version。比對必須釘死 `snapshot_version`。
