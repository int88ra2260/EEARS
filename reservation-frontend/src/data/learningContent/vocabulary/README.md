# Canonical Vocabulary Bank

**請勿手改** `canonicalVocabulary.js`。

## 快速指令

```bash
cd reservation-frontend
npm run vocab:build    # 重建 canonical + 微學習衍生檔
npm run vocab:verify   # 稽核 + 測試
```

## 編輯哪裡？

| 目的 | 檔案 |
|------|------|
| 加詞 / 改 CEFR 來源 | `wordBridgeThemes.js`、`listeningLadderWords.js` |
| CEFR 衝突覆寫 | `cefrOverrides.js` |
| 型別 | `types.js` |
| 查詢 API | `index.js` |

完整流程見 [`docs/micro-learning/vocabulary-bank-maintenance.md`](../../../../docs/micro-learning/vocabulary-bank-maintenance.md)。
