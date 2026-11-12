# 學生回報安全待辦

- 日期：2026-11-12
- 範圍：Phase 0 看到的四項。Phase 1.5 已在工作區處理第 1 項與第 4 項的狀態／指派事件。第 2、3 項未改。

Phase 1 的 `GET /api/admin/student-feedback/summary` 只回傳筆數，不含學號、姓名、信箱或內文。這不處理下列既有暴露。

## 1. 查看權限可以讀內部備註

- 現有行為（Phase 1.5 之後）：`GET /api/admin/student-feedback/:id` 只有 `can_manage_student_feedback` 會查詢並回傳 `visibility=internal`。只有 view 的詳情與列表關鍵字搜尋都排除內部備註。學生端維持只看公開留言。事件查詢對 view 只回 `visibility=staff`，而且不帶回留言正文。
- 受影響的 API 或元件：`studentFeedbackService.js` 的 `getStudentFeedback`、`presentStaff`；`adminStudentFeedbackRouter.js` 的 `GET /:id`。前端 `AdminStudentFeedbackPage.jsx` 有處理權限才顯示備註表單，但詳情資料仍會在查看權限下被 API 回傳。
- 可能的資料暴露範圍：任何具 `can_view_student_feedback` 的帳號，可讀取全部案件的內部備註。備註可能含承辦判斷，不是學生公開內容。
- 建議修正方式：另開安全修補。詳情 API 在只有 view、沒有 `can_manage_student_feedback` 時省略 `visibility=internal` 的正文。不要只藏按鈕。
- 對既有使用者的相容性影響：目前能看後台的行政與主管若只靠 view 讀備註，修補後會看不到。有 manage 的人維持可見。這會改變現況，所以沒有放進 Phase 1。
- 建議優先級：高。工作區已依 manage 過濾。正式環境尚未部署，也還沒驗證 migration。
- 驗證測試：view 詳情與搜尋不含內部正文；manage 看得到；學生詳情仍不含內部正文；view 不能新增備註。Jest 已覆蓋。

## 2. 查看權限可以讀所有學生的個資與內文

- 現有行為：具 `can_view_student_feedback` 的人可列表與讀詳情，不限承辦人。回應含學號、姓名、信箱、回報內文與公開留言。Phase 1.6 沒有縮小這個範圍。
- 預設角色：`accessProfile.js` 裡 admin、teacher executive、office_staff 各職務是 view 與 manage 一起給。regular teacher、worker、leader 兩者都沒有。程式裡沒有「只有 view」的預設角色。只有 view 會出現在 `role_permissions` 把 manage 設成 false，或測試用的權限覆寫。
- 受影響的 API 或元件：`GET /api/admin/student-feedback`、`GET /:id`、列表關鍵字（可搜學號、姓名、公開內文）。`AdminStudentFeedbackPage.jsx` 列表與詳情直接顯示這些欄位。路由 `/admin/student-feedback` 只要求 view。
- 資料存取矩陣（本次維持現況，姓名／學號／信箱／內文標成待決策）：

  | 資料 | View-only | Manage |
  |---|---|---|
  | 案件 ID | 可查看 | 可查看 |
  | 問題類別 | 可查看 | 可查看 |
  | 狀態 | 可查看 | 可查看 |
  | 姓名 | 待決策，目前可查看 | 可查看 |
  | 學號 | 待決策，目前可查看 | 可查看 |
  | Email | 待決策，目前可查看 | 可查看 |
  | 完整問題內容 | 待決策，目前可查看 | 可查看 |
  | 內部備註 | 不可查看 | 可查看 |

- 建議修正方式（尚未實作）：列表與詳情對只有 view 的回應改由後端投影，拿掉或遮罩學號、姓名、信箱與完整內文；搜尋也不得用這些欄位或內部備註繞過。manage 維持全欄。summary 仍是筆數，不帶個資。
- 對既有使用者的相容性影響：預設角色同時有 manage，遮罩 view 不會改變他們。被資料庫覆寫成只有 view 的帳號會看不到身分與內文。所以本次不改。
- 建議優先級：中。這是既有授權，不是新的未授權漏洞。正式發布前仍要中心確認是否接受。
- 驗證測試：若日後實作遮罩，view 的列表、詳情與搜尋都不得含被遮罩欄位；manage 仍看得到。本次沒有這組測試，因為行為沒改。

## 3. 新案通知信包含完整內容與個資

- 現有行為（Phase 1.6 之後）：新案信只含案件編號與 `/admin/student-feedback`。沒有學號、姓名、學生信箱、問題內文，也沒有 replyTo。寄信失敗仍保存案件。學生收到的回覆通知 `studentFeedbackReply` 仍含學生自己的姓名與學號，因為那封信是寄給學生本人。
- 受影響的 API 或元件：`submitStudentFeedback`、`config/email.js` 的 `studentFeedbackNotice`。
- 可能的資料暴露範圍：中心信箱只看到案件編號與後台網址。詳細內容要登入後台。郵件日誌的 subject 也只有案件編號。
- 相容性：中心不能再從信裡直接回學生，必須登入後台。連結不含 token，打開後仍要登入與 view 權限。
- 建議優先級：已在工作區實作。尚未在正式環境寄出驗證。
- 驗證測試：模板測試確認個資不會被帶進主旨或本文；提交時傳給寄信函式的參數只有中心信箱、案件編號與後台連結。這是 mock，沒有真的寄出。

## 4. 狀態與指派沒有完整稽核

- 現有行為（Phase 1.5 之後）：狀態與承辦變更寫入 `student_feedback_events`，與工單更新同一筆 transaction。沒有改動的重送不寫事件。公開回覆、內部備註、學生補充若同時改狀態，也寫 `STATUS_CHANGED`。事件不存留言正文。`audit_logs` 仍不承擔這筆交易。
- 受影響的 API 或元件：`PATCH /api/admin/student-feedback/:id`、`updateStudentFeedbackCase`。
- 可能的資料暴露範圍：這項不是外洩。風險是事後無法回答誰在何時把案件改成結案或換承辦人。
- 建議修正方式：Phase 2 再加事件表或既有稽核。狀態與指派寫入要和事件同一筆 transaction。不要在 Phase 1 補半套欄位。
- 對既有使用者的相容性影響：只新增事件時，舊畫面與舊案件可維持。補上線前的歷史無法回填操作者。
- 建議優先級：中。狀態與指派已有事件。留言本身仍只在 `student_feedback_messages`，沒有另寫一筆「新增備註」事件。
- 驗證測試：狀態與指派事件含原值、新值與操作者；更新或事件寫入失敗會 rollback；相同值不寫事件；結案被 409 拒絕時不更新工單。這些是 mock，不是真實 MySQL 並行測試。

## 發布前判斷

- 內部備註的讀取已改成只有 manage。新案信已拿掉個資。view 仍可看學號、姓名、信箱與內文，這次故意不改。
- 正式庫的兩支 migration 仍是 Unknown。因此仍不是 Production Ready。
