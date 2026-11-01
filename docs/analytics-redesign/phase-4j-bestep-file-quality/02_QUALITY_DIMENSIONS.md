# 品質面向

程式：`bestepFileQualityValidator.js`。

## Q1 來源完整

檢查檔案學期、`bestep_score_import`、source file、import run。缺 file 或 run 是追溯警告。缺學期是 error，批次無法定位，但不把已提供的技能內容改成 0。

## Q2 技能完整

每一筆 accepted 或 current 列展開 listening、reading、speaking、writing。

| 狀態 | 條件 |
|---|---|
| `skill_present` | 分數與可辨識 CEFR 都在。0 分仍算存在 |
| `skill_missing` | 分數與 CEFR 都空 |
| `score_missing` | 只有分數空 |
| `cefr_missing` | 只有 CEFR 空 |
| `invalid_value` | 非空但 `interpretScore` / `interpretCefr` 不接受 |

空值不補 0。四個 observation 的計數在 `counts.skillObservations`。`counts.examSittings.value` 維持 null。

## Q3 日期證據

來源日期只讀該列的 `examDate`。null 產生 `SOURCE_EXAM_DATE_MISSING`，不用出席日或投影日填回。

投影日期：

- `dateProvenance: 'stated'` 且欄位有日期：`projection_date_present`
- `inferred`，或既有 adapter 對已確認投影上的 `1970-01-01` 哨兵：`projection_date_inferred`
- 有日期但呼叫端沒說明來源：`date_provenance_unknown`
- 來源日期與 stated 投影日期不同：`date_conflict`
- `et_exam_attempts` 的 `testDate` 與 `examDate` 不一致時，沿用 adapter 的欄位衝突，不取其中一欄

## Q4 報名與出席

- `STUDENT_NOT_FOUND` 計入 skipped，並標 `IMPORT_ROW_SKIPPED_UNMATCHED`。不進入 accepted 人數。
- `attended: true` 是到考證據。
- `attended: false` 是已標缺考，嚴重程度 informational。
- 集合未提供，或列上的 `attended` 是 null，或 accepted 列對不到出席列：`ATTENDANCE_UNKNOWN`。
- 覆蓋率只在 `registrationPopulation.availability === 'provided'` 時計算。分母文字寫明是本次提供的 success 人數，不是全校學生。

## Q5 投影與一致性

已確認投影使用既有 identity。內容衝突使用既有 consistency。兩者同時保留：衝突不取消確認連結。

沒有明確 source ref 時，相同學號、日期、技能、分數最多得到 `possible_same_assessment`，finding 為 `POSSIBLE_DUPLICATE_UNMERGED`。不合併、不指定權威來源。D11 不在這裡決定。

未提供 `projectionRecords` 時標 `PROJECTION_UNVERIFIED`，不把它解釋成沒有投影。

## Q6 資訊損失與重匯

只有 raw 列仍帶加號、accepted 列已經沒有加號時，才標 `SOURCE_INFORMATION_LOSS`。報告欄位 `restoredCefrPlus` 固定 false，正文不回寫 `B2+`。

`importHistory` 未提供時標 `REIMPORT_HISTORY_UNKNOWN`。目前存量列數與本次 accepted 列數分開，不相加。
