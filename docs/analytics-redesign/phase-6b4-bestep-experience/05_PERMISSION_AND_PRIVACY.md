# 權限與個資

沿用 `canAccessAdminRoute`。班級列表要 `CAN_VIEW_CLASSES` 或 `CAN_MANAGE_CLASSES`。班級 BESTEP 另外接受 `CAN_EXPORT_BESTEP`。沒有放寬規則，也沒有第二套角色。

| 身分 | 班級列表 | 班級 BESTEP | Hub |
|---|---|---|---|
| admin | 可 | 可 | 可 |
| executive | 可 | 可 | 可 |
| et_manager | 可 | 可 | 可，因為有班級檢視 |
| 一般教師 | 可 | 可 | 可 |
| 只留班級檢視、拿掉分析 | 可 | 可 | 可 |
| curriculum_lead | 可 | 可 | 可 |
| bestep_lead | 不可 | 知道 classId 時可 | 不可 |
| event_lead | 不可 | 不可 | 不可 |
| 只留分析、拿掉班級 | 不可 | 不可 | 可 |
| 未登入 | 不可 | 不可 | 不可 |

Hub 不放個人成績，也不組班級 BESTEP 網址。測試只用 `SYN-` 合成學生。沒有把姓名或學號寫進新的 console，也沒有新的跨班 API。

前端隱藏不是授權。正式站仍由既有 route guard 擋未授權者。Harness 沒有掛 `AdminLayout`。
