# W27 Summer Signal 配圖

AI 產生的週報配圖，可下載後上傳媒體庫，或部署時複製至後端 `uploads/weekly/`。

| 檔案 | 用途 | 建議 URL |
|------|------|----------|
| `2026-w27-hero-summer-signal.png` | Hero 封面（橫幅） | `/uploads/weekly/2026-w27-hero-summer-signal.png` |
| `2026-w27-column-flatlay.png` | 雙欄右欄配圖 | `/uploads/weekly/2026-w27-column-flatlay.png` |

## 本機已就緒

若已複製至 `reservation-backend/uploads/weekly/`，重啟後端後可直接在週報預覽看到圖片。

## 正式站

1. 將兩張 PNG 複製到伺服器 `reservation-backend/uploads/weekly/`
2. 或後台 **媒體庫** 上傳後，在編輯器 Hero／雙欄區塊選取
3. 執行 `npm run weekly:import-draft -- --update --fill-events` 同步 JSON 中的 URL（若用腳本匯入）

## 重新產生

請 Cursor 依 `eears-weekly-ai-workflow` 與 `minimalist-ui` 風格重新生成即可。
