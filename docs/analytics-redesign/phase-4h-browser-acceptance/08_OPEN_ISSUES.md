# 未完成事項

- L3 資料驗證尚未授權，也尚未執行。F-OPS-01 到 F-OPS-09 的母體與來源差異仍待正式唯讀核對。
- Staging 與 Production 都還沒有用真實管理階段與真實資料走過這一頁。
- 沒有跑螢幕閱讀器。鍵盤與 ARIA 只代表程式化檢查。
- Harness 不載入正式站的網頁字型。字距與正式站可能有細微差別；結構、Bootstrap 與專案 CSS 是實際載入的。
- React StrictMode 會讓開發 harness 的初次請求出現兩次。這不改變畫面數值，正式 production build 不會套用這個開發雙重呼叫。
- 圖表軸文字對比 4.70:1，高於 4.5:1，但是接近門檻。本次沒有改共用圖表色票。
- Playwright 與 browser binary 需要在每台機器另行安裝。Binary 不進 git。CI 尚未加入 `npm run test:analytics-browser`。
- `.mysql-data/`、SQL dump、`presentation-build/` 仍是未追蹤敏感或既有檔案，沒有加入本次變更。
