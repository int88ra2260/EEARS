# 權限矩陣

判斷沿用 `canAccessAdminRoute` 與 `buildAccessProfile`。Hub 沒有新增跨領域權限。前端隱藏連結不是授權；正式環境的直接網址仍由既有 AdminLayout route guard 擋下。這次瀏覽器 harness 沒有掛 AdminLayout，所以「直接輸入網址被擋」沒有在 Playwright 裡重測。

| 身分 | Hub | 活動營運總覽 | 班級列表 | 資源覆蓋 |
|---|---|---|---|---|
| admin | 可進 | 可進 | 可進 | 可進 |
| executive teacher | 可進 | 可進 | 可進 | 可進 |
| 一般教師 | 可進 | 沒有權限 | 可進 | 沒有權限 |
| 只留班級（拿掉活動分析） | 可進 | 沒有權限 | 可進 | 沒有權限 |
| 只留學習分析 | 可進 | 沒有權限 | 沒有權限 | 可進 |
| 只留活動分析（拿掉班級） | 可進 | 沒有權限 | 沒有權限 | 沒有權限 |
| event_lead | 路由不開放 | 沒有權限 | 沒有權限 | 沒有權限 |
| 未登入 | 路由不開放 | 沒有權限 | 沒有權限 | 沒有權限 |

活動營運總覽的規則是 `allowAdminOrExecutive`，沒有把 `CAN_VIEW_ANALYTICS` 當成替代許可。所以一般教師即使看得到 Hub，也不能從 Hub 進入營運總覽。Playwright 對「只留活動分析」確認畫面上是「活動營運總覽：沒有權限」，而不是可點連結。

`bestep_lead` 若只有 `CAN_EXPORT_BESTEP`，既有班級 BESTEP 路由仍可進，但 Hub 的許可清單沒有這把權限，本階段沒有為了統一入口而補上。

Hub 與新的返回連結都不帶學生姓名、學號、個人成績或查詢字串。班級 BESTEP 頁本來就會顯示該班學生，那是既有管理頁，不是 Hub 新增的名單。
