# 未決事項

- L3 的缺日期、四科空缺、`STUDENT_NOT_FOUND`、投影與重匯比例仍未知。
- `examDate` 仍寫入 null。推斷日期不能填回來源日期。
- `SOURCE_INFORMATION_LOSS` 不能升級成原檔損失，除非以後有未正規化的原檔證據。本階段沒有新增那份證據。
- `validatedRowCount` 沒有獨立計數器。不為了補這個數去重跑驗證或查資料庫。
- D1–D11 仍是 pending。B2 政策、來源優先權與 merge 都沒有改。
- 正式環境 flag 仍不開啟。沒有管理畫面。
