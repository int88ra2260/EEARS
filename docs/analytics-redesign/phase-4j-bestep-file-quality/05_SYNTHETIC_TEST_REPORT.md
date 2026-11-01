# 合成測試

檔案：`reservation-backend/tests/analytics-contracts/bestepFileQuality.test.js`。

識別值只用 `SYNTH-STUDENT-9`、`合成甲`、`person@example.com`。J32 確認這些字串不出現在報告 JSON。

| ID | 結果要點 |
|---|---|
| J01 | 四科 `skill_present`，無 finding，status `complete` |
| J02–J05 | 單科雙空為 `skill_missing`。J02 的有效技能數是 3 |
| J06 | `cefr_missing`，沒有 score missing |
| J07 | `score_missing`，沒有 CEFR missing |
| J08 | `HIGH` 為 `invalid_value` |
| J09 | 來源日期維持 null |
| J10 | stated 投影日存在，來源日仍 null |
| J11 | `inferred` 與已確認投影上的 `1970-01-01` 都是推斷 |
| J12 | 未標日期來源時不標成 inferred |
| J13 | `attended: true` 不是缺考 |
| J14 | `attended: false` 是 informational，本身不把 status 打成 partial |
| J15 | 省略出席集合時 value 是 null |
| J16 | `STUDENT_NOT_FOUND` 只進 skipped |
| J17 | 沒有報名母體則 `coverage.calculated` 為 false |
| J18 | `confirmed_projection` 且 `consistent` |
| J19 | 同一確認連結下 consistency 為 `conflicting`，status `conflicting` |
| J20 | `possible_same_assessment`，不合併 |
| J21 | 報告不含 `B2+`，`restoredCefrPlus` 為 false |
| J22 | 存量 1 列，accepted 為 null，歷史 `not_observed` |
| J23 | accepted 1 與 current 2 分開，沒有 combined |
| J24 | 缺 import run 是 warning，技能仍可讀 |
| J25 | 缺 source file 是 warning，不是缺學期 |
| J26 | `insufficient_evidence`，計數不是 0 |
| J27 | observation 4、accepted 1、exam sittings null |
| J28 | 凍結輸入前後 JSON 相同 |
| J29 | validator 原始碼與 module children 沒有 Sequelize、model、mysql、匯入或同步服務 |
| J30 | 兩個投影通道都不設權威來源。D11 仍 pending |
| J31 | `mergePerformed` 為 false |
| J32 | 報告不含合成個資 |
| J33 | 錯誤 pilot、出席字串、null 列、非法 targetTable 都丟出 `ContractRegistryError` |
| J34 | 分數 0 是存在。省略出席是 null，空陣列是 0 |
| J35 | 完整批次的歷史品質是 `not_claimed` |

同檔另有 registry 回歸：32 metrics、9 temporal contracts、7 domains、11 個 pending gates。

執行見 Phase 4J 回報。全部是合成輸入。
