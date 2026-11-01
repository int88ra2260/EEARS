# F-BESTEP-02 未知出席被顯示成缺席

代碼：`UNKNOWN_ATTENDANCE_DISPLAYED_AS_ABSENT`。

這是前端顯示證據。API Shadow 只看到 response，不能證明畫面畫了什麼，所以 runtime 診斷不含 F-BESTEP-02。

## 後端三態

`resolveComponentAttended` 在 `services/bestepClassService.js`。`attended` 是 boolean 時回傳該值。不是 boolean 時才看 LR 或 SW 的合成值。仍沒有 boolean 就回傳 `null`。缺少出席列也是 `null`，不是缺考。

匯出使用 `getAttendanceExportCell`。未報到的項目是空字串。`null` 也是空字串。`true` 是 `✓`。`false` 才是「缺席」。匯出沒有把未知畫成缺席。

## 現有畫面

格式化函式是 `reservation-frontend/src/utils/classBestepDisplayHelpers.js` 的 `formatAttendanceCell`。表格 `ClassBestepStudentsTable.jsx` 直接呼叫它。本階段沒有改這個函式。

Vitest 渲染真正的函式：

| 輸入 | 現有畫面 | 應有語意 |
|---|---|---|
| `{ L: { attended: true } }` | `L: 出席` | 已到考 |
| `{ L: { attended: false } }` | `L: 缺席` | 已確認缺考 |
| `{ L: { attended: null } }` | `L: 缺席` | 未知 |
| `{ L: {} }` | `L: 缺席` | 未知，不應自動確認缺考 |
| `undefined`、`null`、`{}` | `未匯入` | 無資料 |

`null` 被畫成缺席，是因為物件存在時使用 `l.attended ? '出席' : '缺席'`。`null` 與缺少 `attended` 都是 falsy。測試固定這個 legacy 行為。判定是 `confirmed_by_code_and_test`。

## 以後可以怎麼改

未知應與已確認缺考分開，例如顯示「未知」或「未判定」，並使用中性徽章。空的出席物件維持「未匯入」。那是下一個明確授權的 UI 階段，不是這次。
