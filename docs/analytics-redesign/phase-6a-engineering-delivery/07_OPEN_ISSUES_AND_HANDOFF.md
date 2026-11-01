# 未決與交接

- 發布負責人尚未核准把 `main` 快轉到 `174beeb`。
- Staging 沒有授權，也沒有在這次使用任何遠端環境。
- Release 分支沒有獨立工作樹。測試用的是 `D:/EEARS-phase5b`。
- 舊候選分支仍停在 `15974e0`。不要為了改名而去 force update。
- Jest `[JEST-01]` 與過期的 Browserslist 仍在，不影響本次通過。
- F-BESTEP-01、D1–D11、L3、正式部署都還沒有。
- Phase 6B 的產品設計寫在另一個目錄，沒有改這個候選的程式。

下一步若要工程上線：先核准 SHA，再快轉，再 Node 20 回歸，再另案申請 Staging。產品 Hub 不要堆在這次發布裡。
