# UX 分支相容性

只讀比較。沒有 merge、rebase 或 cherry-pick。

## 祖先

| 分支 | 尖端 | 相對 main | 相對 Analytics 候選 |
|---|---|---|---|
| `consolidation/phase-2a-ux-fixes` | `a0b45e1` | 祖先 | 祖先 |
| `consolidation/phase-2b-empty-state` | `3d9f205` | 祖先 | 祖先 |
| `consolidation/phase-2c-empty-state-adoption` | `e2ab111` | 祖先 | 祖先 |

`main` 比 2c 超前 24 個提交、落後 0。`git diff base..UX尖端` 是空的，因為 merge-base 就是該尖端。這三條沒有待合併的新提交。

2a 到 2c 的歷史檔案是 14 個：週曆、EmptyState、儀表板、學習歷程表、問卷管理與對應測試。Analytics 自 `main` 起改了 284 個路徑。兩者檔名交集是空的。

## 矩陣

| 項目 | Analytics（相對 main） | UX 尖端 | 風險 |
|---|---|---|---|
| Frontend Routes | 沒有改 `App.js` 或 `adminRouteAccess.js` | 無未合併提交 | 無待解衝突 |
| Shared Components | 改了活動總覽與班級 BESTEP 表 | EmptyState 等已在 main 裡 | 檔名不重疊；空狀態行為已在候選基底中 |
| Admin Navigation | 這段 diff 沒有 `adminNavigation.js` | 無 | 無 |
| CSS / Bootstrap | 分析頁用既有 Bootstrap；UX 有 `EmptyState.css` 且已在 main | 已包含 | 不需再合併才看得到空狀態樣式 |
| Backend APIs | Shadow hook 與既有回應並存，公式未改 | 無 | 無 UX 分支上的 API 衝突 |
| Dependencies | `package.json` 新增 `@playwright/test` 1.64.1 與 `@testing-library/user-event` | 無未合併依賴 | 合併 Analytics 才會把這兩個 devDependency 帶進 main |
| Test Config | 新增 `test:analytics-browser` 與 Playwright 設定 | 無 | 不影響 UX 分支的 Jest/Vitest |
| Shadow flags | 三個旗標只在 Analytics | UX 檔案沒有這些旗標 | 無旗標衝突 |

沒有相同檔案，也不代表以後若有人在那些工作樹寫新提交就仍然安全。目前尖端是乾淨的已追蹤狀態。若要驗證「把未來 UX 提交和 Analytics 合在一起」的畫面，需要另一次授權的整合測試，這次沒有做。

## 合併預覽

因為 UX 尖端已是候選的祖先，把 UX 合併進候選不會產生新的樹。不需要在 main 或 UX 工作樹上試合併。
