# 學生回報測試計畫

- 日期：2026-11-12
- 狀態：Phase 1 指定測試已在本機執行。Phase 2、Phase 3 的「應補」仍未做。Phase 0 當時沒有執行 Jest。

## 已有測試（檔案在，本次未重跑）

`reservation-backend/tests/studentFeedbackService.test.js`

- 建立時使用 session 學生並寄中心信
- 中心信失敗仍保存
- 過短內容與錯誤項目被拒
- 同一學生短時間超過次數被拒
- 後台可依 `kind` 列表
- 未驗證信箱被拒
- 不要求回覆的案件可直接結案
- 要求回覆時，沒有公開回覆不能結案
- 公開回覆信不含回覆正文
- 學生看不到內部備註；結案後補充會變成處理中
- 不可指派中心名單以外的人

`reservation-backend/tests/security/studentFeedbackAuth.test.js`

- 未登入 401、未驗證信箱 403
- body 裡的他人學號不會進 service
- 匿名與一般老師讀列表：401／403
- `office_staff` event_lead 可讀列表、可回覆
- 一般老師回覆 403

`reservation-backend/tests/teacherRoleAccess.test.js`

- `teacher` regular 沒有 view／manage
- `teacher` executive 兩者都有

## Phase 1 執行結果（2026-11-12）

後端：

```text
npx jest tests/studentFeedbackService.test.js tests/security/studentFeedbackAuth.test.js --runInBand --no-coverage
```

2 suites、29 tests 通過，0 失敗。其中 service 18 則、權限 11 則。通過項目含既有提交、寄信失敗仍保存、三態結案規則、公開回覆不含正文、學生看不到內部備註、結案後補充會回到處理中、不可指派非中心人員，以及本次 summary、排序白名單與 401／403。

前端：

```text
npx vitest run src/pages/admin/AdminStudentFeedbackPage.test.jsx
```

1 file、8 tests 通過，0 失敗。涵蓋 KPI 載入、成功、全 0、summary 失敗時列表仍在、列表失敗時 KPI 仍在、`#128`、`updatedAt` 的台北時間、排序參數、結案成功後再取一次 summary。

沒有執行：整個後端 Jest、`teacherRoleAccess.test.js`（本次沒改權限對照）、真實 MySQL 整合測試、正式庫查詢。未執行的項目不能當成通過。

本機瀏覽器（`http://localhost:3001/admin/student-feedback`，後端未啟動，頁面內以假的管理員 JWT 與攔截的 fetch 看版面）：後端連線失敗時同時出現「無法載入統計」與「無法載入學生回報」。攔截成功後看到 128／24／13／91 與未結案 37，列表有 `#128` 與 `2026/11/09 09:00`。改排序只重打列表，結案後列表與 summary 都再打一次。1440、768、375 寬度下整頁沒有水平溢出；表格在 `.table-responsive` 內捲動。這不是正式資料。

前端 production build：`npm run build`（reservation-frontend）在 Phase 1 成功。Phase 1.5 之後會再跑一次，結果寫在當次報告，不沿用這一行當作新結果。

### Phase 1.5 執行結果（2026-11-12）

同一組 Jest 檔再跑一次：2 suites、37 tests 通過，0 失敗。新增覆蓋包含 view 詳情不含內部備註、manage 含內部備註、列表搜尋不掃內部正文、狀態與指派事件、相同值不寫事件、更新失敗與事件失敗 rollback、備註正文不進事件、事件列表穩定排序、未登入 401、無權限 403、view-only 不能新增備註或 PATCH。

前端 Vitest：`AdminStudentFeedbackPage.test.jsx` 10 tests 通過，0 失敗。含 view 不渲染內部備註、manage 依原順序渲染。

沒有真實 MySQL 整合測試，也沒有並行更新的資料庫測試。`teacherRoleAccess.test.js` 與全庫 Jest 沒有重跑。Phase 1.5 的 `npm run build` 成功，exit 0，約 29 秒。

## Phase 1 仍未覆蓋

上面的執行結果沒有包含下列舊計畫項目。它們不是這次失敗，是沒有跑：

後端：

- summary 的 `open`／`in_progress`／`closed` 等於全表計數，與 `page` 無關
- 關鍵字、狀態、項目、承辦、`none`、日期區間會進 `where`
- `pageSize` 51 與 `page` 0 回 400
- 排序欄位不在白名單時回 400，且不會把該字串拼進 SQL
- 無 token、無 view、有 view 無 manage：列表、詳情、PATCH、回覆的狀態碼
- 學生讀他人 `id` 為 404，回應不含對方內容
- 結案仍遵守現有 409

前端（有測試框架時才加；沒有頁面測試就不宣稱已測）：

- KPI 使用 summary，不用 `items.length`
- 篩選改變會重打列表
- 載入中、無資料、API 失敗三種狀態
- 無 manage 時不出現回覆、備註、結案

回歸：跑既有預約截止與問卷 Gate 測試中與這次 diff 無關、但 CI 會跑的那一組，確認沒有改到那些檔案。

## Phase 2A 執行結果（2026-11-12）

前端 `AdminStudentFeedbackPage.test.jsx`：18 tests 通過。涵蓋狀態變更、承辦變更、空歷程、歷程錯誤不擋案件、切換案件忽略舊回應、結案與指派後重讀、載入更多與去重排序。不顯示內部事件正文與 request id。

後端 `studentFeedbackService.test.js` 與 `studentFeedbackAuth.test.js`：2 suites、37 tests 通過。本階段沒有改這兩個檔。沒有重跑真實 MySQL 整合測試，也不能把它記成這次通過。

## Phase 2B 執行結果（2026-11-12）

後端 Jest `studentFeedbackService.test.js` 與 `studentFeedbackAuth.test.js`：2 suites、40 tests 通過。涵蓋優先級寫入、未變更不寫事件、非法值、事件失敗 rollback、分類與優先級篩選、優先級排序、舊列未設定、學生不能帶入優先級、view-only 的 PATCH 403。

隔離 MySQL `studentFeedbackMysql.integration.test.js`：1 suite、5 tests 通過。含可空且無預設的 `priority`、未設定仍可查、重複設定不新增事件、兩筆優先級更新被鎖成依序提交。資料庫用完即刪。這不是正式庫。

前端 Vitest：22 tests 通過。涵蓋分類與未設定、優先級更新與時間軸、失敗時恢復選單、篩選與排序。

## Phase 2 應補

- 公開回覆 `visibility=public`，內部備註 `internal`
- 學生詳情 JSON 沒有 `internal` 的 `body`
- 若政策改為 view 不能讀內部備註：只有 view 的 GET 不含備註；manage 含備註
- 不合法狀態（例如 PATCH `open`、或尚未定義的狀態）被拒，且 `status` 不變
- 指派歷史有舊承辦與新承辦
- `duplicateOfId` 指向不存在的 id 被拒；不刪除被標重複的列
- 附件：錯誤 mime、超過大小、未登入下載、學生下載他人檔案
- 兩個 PATCH 交錯時不會寫出一半事件（transaction）

## Phase 3 應補

- 每週新增用 `createdAt`、結案用 `closedAt` 的固定樣本
- 重開率在沒有事件表時不回傳假 0 冒充已定義指標；要么沒有這個欄，要么測試寫明定義
- 匯出列數等於同一篩選的 `total`
- 匯出儲存格以 `=` 開頭的內容被中和
- 匯出不含內部備註正文（在無權限時）
- 寄信拋錯時，案件與留言仍在

## 明確不在本功能測試裡改斷言

預約 `cutoffHours`、問卷 409 `redirectUrl`、黑名單解封、BESTEP 分數、Learning Journey canonical、成效分析 CEFR／GSE。這些只做「本 diff 沒改那些檔」的回歸，不改其預期。
