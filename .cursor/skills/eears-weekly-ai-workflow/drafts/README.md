# 週報草稿庫

AI 工作流產出的完整 JSON 放此目錄，供匯入腳本或後台手動貼上。

## 匯入為後台 draft

```bash
cd reservation-backend
npm run weekly:import-draft -- --file ../.cursor/skills/eears-weekly-ai-workflow/drafts/2026-W27-summer-signal.json --fill-events
```

| 旗標 | 說明 |
|------|------|
| `--dry-run` | 只預覽，不寫入 DB |
| `--fill-events` | 依週期自動填入 `eventsHighlight.eventIds` |
| `--update` | 同期數已存在時覆寫（否則 exit 2） |

## 2026-W27 Summer Signal

- **版型建議**：`interaction-focus` + `magazine`（雙欄）
- **區塊數**：15（含 embed 加分項）
- **待人工補齊**：
  - [x] Hero `imageUrl` → `assets/2026-w27-hero-summer-signal.png`
  - [x] 雙欄右欄 `image` → `assets/2026-w27-column-flatlay.png`
  - [ ] `eventsHighlight`：執行 `--fill-events` 或後台 EventPicker 勾選
  - [ ] 預覽桌面／手機／首頁彈窗
  - [ ] 確認後「儲存草稿」或「排程發布」（勿跳過人工預覽）

## 發布前檢查清單（通用）

- [ ] Hero 標題與副標正確
- [ ] 活動精選為本週可預約場次
- [ ] 語彙挑戰 4 主題有效
- [ ] 投票／測驗無錯字、答案正確
- [ ] embed 網址可正常嵌入
- [ ] 手機版可讀
