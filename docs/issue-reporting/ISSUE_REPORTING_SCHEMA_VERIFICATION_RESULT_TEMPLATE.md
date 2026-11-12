# 學生回報正式 Schema 查詢回填範本

把這份檔複製到正式機的管理目錄再填。不要 commit 填過的複本，不要貼上 PR。

**Production Verification Required — UNKNOWN**

在工程人員用三邊清單比對之前，下面所有判定都維持 UNKNOWN。操作人員不要把 UNKNOWN 改成 PASS。

## 執行身分

| 項目 | 填寫 |
|------|------|
| 執行日期（Asia/Taipei） | |
| 執行人 | |
| 電腦名稱 | |
| 是否為 `LAPTOP-IVA4HK36` | 是 / 否 |
| 若是開發筆電 | 停止。這份結果作廢 |
| 正式庫授權 | 有 / 沒有 |
| `@@port` | |
| `DATABASE()` 是否為正式庫 | 是 / 否。不必在這份檔重寫密碼 |
| MySQL 版本 | |
| 正式機 `git rev-parse HEAD` | |
| 執行當下有沒有 Deploy 或 `deploy.ps1` | |
| SQL 檔 | `docs/issue-reporting/sql/production_student_feedback_readonly_check.sql` |
| 結果有沒有出現學生、老師或留言內容 | 有就停止，刪除結果，不送出 |

電腦名稱是 `LAPTOP-IVA4HK36` 時，後續各表不必填。

## 資料表

| 物件 | 結果（PRESENT / ABSENT / 未執行） | 判定 |
|------|-----------------------------------|------|
| SequelizeMeta | | UNKNOWN |
| teachers | | UNKNOWN |
| student_feedback | | UNKNOWN |
| student_feedback_messages | | UNKNOWN |
| student_feedback_events | | UNKNOWN |

`SequelizeMeta` 是 ABSENT 時，不要建立它，也不要填下面的帳本表。

## SequelizeMeta 與目錄

| 清單 | 檔案位置或筆數 | 判定 |
|------|----------------|------|
| C. `SequelizeMeta` 全部 `name` | | UNKNOWN |
| B. 正式機 `migrations\*.js` 檔名筆數 | | UNKNOWN |
| A. 手冊第 10 節的 177 個 PR Head 檔名 | 本機清單，不在正式機現查 | UNKNOWN |
| B 有而 C 沒有的檔名 | | UNKNOWN |
| C 有而 A 沒有的檔名 | | UNKNOWN |
| A 有而 B 沒有的檔名 | | UNKNOWN |

學生回報窗口只記帳本有沒有檔名。ABSENT 不是執行許可。

| 檔名 | RECORDED / ABSENT_FROM_SEQUELIZE_META / 未執行 | 判定 |
|------|--------------------------------------------------|------|
| `20261108150000-create-student-feedback.js` | | UNKNOWN |
| `20261108150100-grant-student-feedback-permission.js` | | UNKNOWN |
| `20261110123000-create-leader-public-profiles.js` | | UNKNOWN |
| `20261110131500-repair-campus-private-use-qi.js` | | UNKNOWN |
| `20261110143000-repair-more-campus-private-use-names.js` | | UNKNOWN |
| `20261110160000-drop-cancellation-code-from-email-overrides.js` | | UNKNOWN |
| `20261110160000-student-feedback-cases.js` | | UNKNOWN |
| `20261110160100-grant-student-feedback-manage-permission.js` | | UNKNOWN |
| `20261112161000-student-feedback-events.js` | | UNKNOWN |
| `20261112173000-student-feedback-priority.js` | | UNKNOWN |
| 檔名排在最後的 `add-*.js`、`fix-*.js`、`remove_q19_q20_from_english_table_survey.js` | 全部 RECORDED / 有缺 | UNKNOWN |

## 欄位、索引、外鍵

從 SQL 第 5 與第 6 段抄結構。不要抄資料列。預設值先照 MySQL 原文填，比對留到本機。

| 物件 | actual_column_type | actual_is_nullable | actual_column_default | actual_column_key / extra | 結果 | 判定 |
|------|--------------------|--------------------|------------------------|---------------------------|------|------|
| student_feedback.id | | | | | | UNKNOWN |
| student_feedback.status | | | | | | UNKNOWN |
| student_feedback.replyRequested | | | | | | UNKNOWN |
| student_feedback.priority | | | | | | UNKNOWN |
| student_feedback.assignedTeacherId | | | | | | UNKNOWN |
| student_feedback.closedAt | | | | | | UNKNOWN |
| student_feedback_messages.feedbackId | | | | | | UNKNOWN |
| student_feedback_events.feedbackId | | | | | | UNKNOWN |
| student_feedback_events.visibility | | | | | | UNKNOWN |
| student_feedback_events.beforeValue | | | | | | UNKNOWN |
| student_feedback_events.afterValue | | | | | | UNKNOWN |
| student_feedback_events.updatedAt | 不應存在 | | | | | UNKNOWN |
| teachers.id | | | | | | UNKNOWN |

| 索引或外鍵 | PRESENT / ABSENT | 刪除規則（外鍵才填） | 判定 |
|------------|------------------|----------------------|------|
| idx_student_feedback_status_created | | | UNKNOWN |
| idx_student_feedback_priority | | | UNKNOWN |
| idx_student_feedback_events_timeline | | | UNKNOWN |
| fk_student_feedback_assignee | | | UNKNOWN |
| fk_student_feedback_messages_case | | | UNKNOWN |
| fk_student_feedback_messages_teacher | | | UNKNOWN |
| fk_student_feedback_events_case | | | UNKNOWN |
| fk_student_feedback_events_teacher | | | UNKNOWN |

非預期欄位：有 / 沒有。名稱：

`SHOW CREATE TABLE` 是否只含欄位定義：是 / 否 / 未執行。未執行的原因：

## 決策

對照手冊第 9 節，只選一列，判定仍寫 UNKNOWN。

| 選到的矩陣列 | 看到的事實 | 是否已停止 | 判定 |
|--------------|------------|------------|------|
| | | 是 | UNKNOWN |

## 明確沒有做的事

| 動作 | 本次 |
|------|------|
| 連到正式庫以外的檢查 | |
| `db:migrate` | 沒有執行 |
| 修改 `SequelizeMeta` | 沒有執行 |
| `down` 或 `sequelize.sync()` | 沒有執行 |
| 讀取或回傳 `.env`、密碼、學生內容 | 沒有 |

## 交回內容

- [ ] SQL 輸出，已確認沒有資料列內容
- [ ] 正式機 migration 檔名清單
- [ ] 這份範本
- [ ] 沒有 `.env` 與密碼

交回之後，Database Ready 仍然是 UNKNOWN，直到另一次工程比對寫明結果。
