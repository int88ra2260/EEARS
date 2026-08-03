---
name: eears-weekly-ai-workflow
description: >-
  EEARS 英語中心週報（Weekly Studio）AI 輔助工作流：依使用者靈感生成 blocks 草稿、
  建議版型、產出後台可貼上的 JSON；預設只建 draft、不自動發布。當使用者要「用 AI 寫週報」、
  「根據靈感生成週報」、「週報草稿」、或提供週報素材時使用。
license: MIT
---

# EEARS Weekly AI Workflow

協助編輯者把「本週靈感」轉成 **Weekly Studio `blocks` 草稿**。學生端維持免登入；週報內容不得與預約 2hr 截止、問卷 Gate 等業務規則衝突。

## When to Use

- 使用者提供本週主題、活動重點、公告、互動想法，要你「生成週報」
- 使用者問如何下指令、要範例、或要把靈感變成可發布內容
- 需要建議版型（標準週 / 活動週 / 互動週等）

## Default Workflow（必遵守）

1. **讀取使用者輸入**（見 `PROMPT-TEMPLATE.md`）
2. **缺資料時**：用合理預設補齊，並在回覆中標註「待確認」項目（活動 ID、公告 slug、圖片 URL）
3. **產出草稿**：metadata + `blocks` JSON（結構符合 `weeklyBlockService`）
4. **預設 `status: draft`**；除非使用者明確寫「請發布」，否則不呼叫 publish API、不 `git commit`
5. **交付清單**：後台貼上步驟、預覽檢查項、待人工補齊欄位

若使用者要求「直接寫入系統」：可說明需後台 token 或本機腳本；仍建議先給 JSON 讓人類預覽。

## 關鍵路徑

| 用途 | 路徑 |
|------|------|
| 區塊常數 / 版型 | `reservation-frontend/src/constants/weeklyBlocks.js` |
| 後端驗證 / sanitize | `reservation-backend/services/weeklyBlockService.js` |
| 後台編輯器 | `reservation-frontend/src/pages/admin/AdminWeeklyReportEditorPage.jsx` |
| 語彙主題 ID | `reservation-frontend/src/data/wordBridgeThemes.js` |
| 管理 API | `PUT /api/admin/weekly-reports/:id`（需 `CAN_MANAGE_ANNOUNCEMENTS`） |

## 支援的區塊類型

`hero`, `richText`, `image`, `gallery`, `audio`, `video`, `callout`, `quote`, `divider`, `eventsHighlight`, `announcementCard`, `columns`, `embed`, `poll`, `quiz`, `wordBridgeChallenge`, `cta`, `spacer`

### 版型範本 ID（`applyWeeklyLayoutTemplate`）

| ID | 適合情境 |
|----|----------|
| `standard` | 一般週：編輯台 + 學習提示 + 語彙挑戰 |
| `minimal` | 短週、放假、僅提醒 |
| `events-focus` | 活動名額、本週場次多 |
| `announcement-focus` | 重要公告為主 |
| `challenge-focus` | 以 Connections 語彙挑戰為主軸 |
| `magazine` | 圖文並茂、雙欄 |
| `interaction-focus` | 投票 + 小測驗 + 挑戰 |

## 內容撰寫規範

### 語氣與長度

- 繁體中文為主；英文活動名稱可保留（English Table / English Club）
- Hero `subtitle`：一句話，≤ 80 字，適合首頁彈窗
- `richText`：2–4 段，每段 2–4 句；可用 `<h3>`、`<ul>`，避免過長
- `callout`（variant `tip`）：一則可執行的學習小提示，≤ 120 字

### 語彙挑戰 `wordBridgeChallenge`

- `level`：`A1`–`C1` 之一
- `themeIds`：**恰好 4 個**，須為 `wordBridgeThemes.js` 內有效 ID（同 level）
- 預設 A2 範例：`a2-campus`, `a2-homework`, `a2-weekend`, `a2-shopping`

### 活動精選 `eventsHighlight`

- `eventIds`：最多 6 個；若使用者只給名稱，輸出 `eventIds: []` 並標註「請後台 EventPicker 勾選」
- 勿虛構活動時間、名額

### 公告 `announcementCard`

- 需 `announcementId` 或 `slug`；未知則留空並標註待選

### 投票 `poll`

- 問題清楚、選項 2–6 個、`showResults`: `afterVote`（預設）
- 選項 `id` 用 `opt-1`… 或語意化 slug

### 小測驗 `quiz`

- 1–5 題為宜；`correctAnswer` 必須與選項完全一致
- 聽力題可留 `audioUrl: ""`，標註「請上傳音檔至媒體庫」

### 媒體

- **勿捏造** `/uploads/weekly/...` URL
- 圖片/音檔留空，交付清單提醒後台媒體庫上傳

### CTA

- 預約：`href: "/events"`
- 活動總覽：`href: "/activities"`
- 按鈕文案具體（「立即預約 ET」優於「了解更多」）

## 輸出格式（給使用者）

每次生成至少包含：

### 1. 摘要

- 建議版型、本期主軸、區塊數量

### 2. Metadata 建議

```json
{
  "issueKey": "2026-W26",
  "slug": "2026-w26",
  "title": "EEARS Weekly",
  "weekStart": "2026-06-23",
  "weekEnd": "2026-06-29",
  "status": "draft"
}
```

### 3. `blocks` JSON

- 每個 block 含 `id`, `type`, `props`
- `id` 格式：`{type}-{random}`（可參考 `createBlockId` 語意）
- `richText.html` 僅用安全標籤：`p`, `h3`, `ul`, `ol`, `li`, `strong`, `em`, `a`, `blockquote`

### 4. 後台操作步驟

1. 後台 → 英語中心週報 → 新增（或開啟草稿）
2. 套用版型 / 貼上 blocks（或逐區塊對照修改）
3. 補活動、公告、媒體
4. 預覽：桌面 / 手機 / 首頁彈窗
5. 確認後「儲存草稿」或「發布／排程」

### 5. 發布前檢查清單

- [ ] Hero 標題與副標正確
- [ ] 活動精選仍為本週可預約場次
- [ ] 公告連結有效
- [ ] 語彙挑戰 4 主題已選
- [ ] 圖片有 alt
- [ ] 手機版可讀
- [ ] 互動題無錯字、測驗答案正確

## 禁止事項

- 不自動 `published`（除非使用者明確授權且已確認內容）
- 不承諾問卷/黑名單/預約規則變更（週報僅內容展示）
- 不收集學號；互動區塊維持匿名設計
- 不編造活動、公告、媒體 URL

## 進階：寫入後端草稿

### 方式 A：後台手動（預設）

1. 後台 → 英語中心週報 → 新增（或開啟草稿）
2. 貼上 `blocks` JSON 或逐區塊對照
3. 補活動、媒體 → 預覽 → 儲存草稿

### 方式 B：匯入腳本（本機／維運）

僅在使用者明確要求且具備 DB 環境時：

```bash
cd reservation-backend

# 預覽（不寫入）
npm run weekly:import-draft -- --file ../.cursor/skills/eears-weekly-ai-workflow/drafts/2026-W27-summer-signal.json --dry-run

# 建立 draft（預設檔為 W27 範例）
npm run weekly:import-draft -- --fill-events

# 已存在同期數時覆寫
npm run weekly:import-draft -- --file path/to/draft.json --update --fill-events
```

- `--fill-events`：依 `weekStart`～`weekEnd` 自動填入 `eventsHighlight.eventIds`（最多 6 筆，僅填空陣列）
- 預設 **不發布**；`status` 非 `published` 一律存為 draft
- 建立後導向 `/admin/weekly-reports/:id/edit` 繼續編輯（補 Hero 封面、雙欄配圖）

### 方式 C：Admin API

```http
POST /api/admin/weekly-reports
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "issueKey", "slug", "title", "weekStart", "weekEnd", "status": "draft", "blocks", "blocksVersion": 1 }
```

## 草稿範例庫

| 檔案 | 說明 |
|------|------|
| `drafts/2026-W27-summer-signal.json` | 互動週完整範例（poll + quiz + columns + embed + 語彙挑戰） |
| `drafts/README.md` | 匯入與發布前檢查清單 |

## 參考檔案

- 使用者複製用指令範本：[`PROMPT-TEMPLATE.md`](./PROMPT-TEMPLATE.md)
- 填好的輸入／輸出範例：[`examples.md`](./examples.md)

## Suggested Follow-up Prompt（給使用者）

> 請依 `PROMPT-TEMPLATE.md` 幫我生成本週週報草稿（status: draft），版型建議用活動週，並附上 blocks JSON 與發布前檢查清單。
