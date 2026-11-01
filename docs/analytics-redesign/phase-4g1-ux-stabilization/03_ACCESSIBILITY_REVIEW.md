# 無障礙檢查

檢查方式是 jsdom 加上 `@testing-library/user-event`。不是螢幕報讀，也不是真實瀏覽器。

## 鍵盤

| 操作 | 結果 |
|---|---|
| Tab 從學期選單到重新整理，再到「活動總名額說明」 | PASSED_AUTOMATED |
| Enter 展開說明 | PASSED_AUTOMATED |
| Space 收合說明，焦點留在原按鈕 | PASSED_AUTOMATED |
| 再 Tab 到「預約筆數說明」並用 Enter 展開 | PASSED_AUTOMATED |
| 報名補充按鈕可展開與收合 | PASSED_AUTOMATED |

沒有發現鍵盤陷阱：收合後可以 Tab 到下一個說明按鈕。這只代表 jsdom 的焦點順序。

## ARIA

- 說明按鈕的 accessible name 是「活動總名額說明」這類完整名稱，可見文字仍是「說明」。
- `aria-expanded` 與開關同步。
- `aria-controls` 指向的說明節點一直存在；收合時該節點有 `hidden`。
- 報名補充區不再使用 `<details>`。jsdom 不會在點擊 summary 時切換 `open`，所以改成與指標說明相同的按鈕。真實瀏覽器裡的原生 details 行為因此沒有被保留，也沒有在瀏覽器重測。

## 文字與狀態

- 指標名稱與數字分層：名稱是小字，數字是 `fs-4`。
- 錯誤使用 Bootstrap danger alert 的文字，不是只靠顏色。
- 全 0 與缺值分別是 `0` / `0.0%` 與「—」。
- 圖表卡片有標題與描述文字。測試把 Recharts 換成空元件，所以沒有驗證 SVG 本身能否被報讀。
- 表格標頭在測試中可依名稱找到「活動類型」與「活動名稱」。

## 尚未確認

- 對比度。
- 真實 Enter / Space 與螢幕報讀。
- 窄螢幕是否截斷單位。
