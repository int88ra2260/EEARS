# 微學習 LA 平台（方案 A + B + C）開發交接文件

> 整理自 2026-08-28 對話，供在其他電腦接續開發。  
> 對應 GitHub：`int88ra2260/EEARS`（`main` 分支）

---

## 1. 專案背景與目標

本輪實作 EEARS **微學習 Learning Analytics 平台**，對齊劉明機副教授研究主軸（教學策略驅動 LA、調節焦點回饋、遊戲化 SRL、推薦漏斗），分三個方案一次交付：

| 方案 | 名稱 | 核心交付 |
|------|------|----------|
| **A** | 微學習 LA | Trace 收集、LJ 投影、關聯分析、Word Bridge 追蹤 |
| **B** | 調節焦點回饋 | promotion / prevention 模板回饋（非真 LLM） |
| **C** | 完整平台 | 推薦 funnel 儀表板、徽章/SRL、學生歷程頁 |

**業務底線（不可破壞）**

- 學生端不登入；身分以學號 + 姓名 + email 驗證（比對既有預約紀錄）
- 預約/取消截止仍為活動開始前 **2 小時**
- 問卷 Gate 僅 ET/EC；後端 fail-close 維持
- 黑名單邏輯不變
- 對外分析一律標記 `causalClaimAllowed: false`，不作因果宣稱

---

## 2. 架構總覽

```
學生端（無登入）
  Word Bridge / 活動推薦 CTA
       │ POST /api/learning-traces
       ▼
  learning_trace_events（MySQL）
       │ session_complete + studentId
       ▼
  lj_student_events（micro_learning_event 投影）

學生查詢 /student/progress
       │ GET /api/student-learning-journey/dashboard
       ▼
  回饋 + 徽章 + 微學習 + ET 建議

管理端 LVA 總覽
       │ GET /api/admin/learning-traces/*
       ▼
  微學習參與 + 漏斗 + LJ 關聯
```

---

## 3. 新增／修改檔案清單

### 3.1 後端（`reservation-backend/`）

| 路徑 | 說明 |
|------|------|
| `migrations/20260828120000-create-learning-trace-events.js` | 建立 `learning_trace_events` 表 |
| `migrations/20260828130000-expand-learning-trace-events.js` | 擴充 event_type、funnel；unique 改為 `(trace_id, event_type)` |
| `migrations/20260828140000-add-micro-learning-lj-event-type.js` | LJ `lj_student_events.event_type` 新增 `micro_learning_event` |
| `models/LearningTraceEvent.js` | Trace ORM |
| `models/LjStudentEvent.js` | enum 新增 `micro_learning_event` |
| `models/index.js` | 註冊 LearningTraceEvent |
| `services/learningTraceService.js` | 驗證、寫入、去重、engagement/funnel 彙總 |
| `services/learningTrace/learningTraceProjectionService.js` | trace → LJ 投影 |
| `services/learningTrace/learningTraceCorrelationService.js` | 微學習 × 預約 × B2+ 關聯 |
| `services/learningTrace/learningFeedbackService.js` | 調節焦點回饋（模板） |
| `services/learningTrace/learningGamificationService.js` | 徽章 / SRL 聚合 |
| `services/learningTrace/studentLearningJourneyService.js` | 學生 dashboard 組裝 |
| `routes/learningTraceRouter.js` | 公開 + 管理端路由 |
| `server.js` | `app.use('/api', learningTraceRouter)` |
| `tests/learningTraceService.test.js` | 11 項單元測試 |

### 3.2 前端（`reservation-frontend/src/`）

| 路徑 | 說明 |
|------|------|
| `utils/learningTraceSession.js` | `clientSessionId`（localStorage） |
| `utils/learningStudentLink.js` | 自願學號 sessionStorage |
| `utils/learningEventPayload.js` | `session_start` / `session_complete` payload |
| `utils/learningFunnelPayload.js` | funnel 事件 payload |
| `services/learningTraceApi.js` | API 薄層 |
| `hooks/useWordBridgeGame.js` | `activeTraceId`、`startLevelRef` |
| `components/activities/WordBridgeGame.jsx` | trace + funnel 上報 |
| `components/student/StudentLearningJourneyPanel.jsx` | 回饋、徽章、微學習、建議 |
| `components/learningAnalytics/MicroLearningEngagementPanel.jsx` | 管理端微學習參與 |
| `components/learningAnalytics/LearningTraceInsightsPanel.jsx` | 管理端漏斗 + 關聯 |
| `pages/student/StudentProgressPage.jsx` | 整合 journey dashboard |
| `pages/student/StudentProgressPage.css` | journey 面板樣式 |
| `pages/admin/LearningAnalyticsOverviewPage.jsx` | 掛載上述兩個 LA 面板 |

---

## 4. API 一覽

### 4.1 公開（學生端）

#### `POST /api/learning-traces`

上報微學習或 funnel 事件。去重鍵：`(traceId, eventType)`。

**允許的 `gameId`**

- `word_bridge`
- `activity_recommendation`
- `et_recommendation`

**允許的 `eventType`**

- `session_start`
- `session_complete`
- `funnel_impression`
- `funnel_click`
- `funnel_book_attempt`

**範例（Word Bridge 結算）**

```json
{
  "traceId": "wb_abc123...",
  "gameId": "word_bridge",
  "eventType": "session_complete",
  "clientSessionId": "ls_xxxx",
  "studentId": "12345678",
  "durationMs": 120000,
  "cefrLevel": "B1",
  "skillTags": ["vocabulary"],
  "payload": {
    "endReason": "mistakes",
    "totalMistakes": 3,
    "passedLevels": ["A1", "A2"]
  }
}
```

`studentId` 可選；有值且 `eventType === session_complete` 時會投影至 LJ。

#### `GET /api/student-learning-journey/dashboard`

查詢參數：`studentId`、`studentName`、`studentEmail`（皆必填）。

- 驗證：三欄位須與 `reservations` 表任一筆完全吻合
- Rate limit：預設 120 次 / 10 分鐘（`STUDENT_JOURNEY_RATE_LIMIT_*`）
- 回傳：`gamification`、`feedback`、`microLearning`、`recommendations`

#### `POST /api/student-learning-journey/feedback`

同上身分驗證；可傳 `regulatoryFocus=promotion|prevention|auto`。

### 4.2 管理端（需 `CAN_VIEW_LEARNING_ANALYTICS`）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/admin/learning-traces/engagement` | 微學習參與摘要（`?days=30`） |
| GET | `/api/admin/learning-traces/funnel` | 推薦漏斗（曝光/點擊/CTA） |
| GET | `/api/admin/learning-traces/correlation` | 微學習 × LJ 關聯（觀察性） |

---

## 5. 調節焦點回饋邏輯（方案 B）

檔案：`services/learningTrace/learningFeedbackService.js`

| 焦點 | 觸發條件 |
|------|----------|
| **prevention** | `noShowCount >= 2`，或明確傳入 `upcomingReservations === 0` |
| **promotion** | 其餘情況（含空 context 預設） |

學生 dashboard 會從預約紀錄計算：

- `upcomingReservations`：`未簽到` 且活動開始時間在未來
- `noShowCount`：`已登記違規` 筆數

**簽到狀態請用中文 enum**：`未簽到` / `已簽到` / `已登記違規`（勿用英文 `checked_in`）。

**LLM**：目前僅模板；`LEARNING_FEEDBACK_LLM_ENABLED` 尚未接 OpenAI。

---

## 6. 遊戲化徽章（方案 C）

檔案：`services/learningTrace/learningGamificationService.js`

| ID | 條件 |
|----|------|
| `first_word_bridge` | ≥1 場微學習 |
| `practice_streak_3` | 連續 3 週每週 ≥1 場 |
| `activity_starter` | ≥1 次活動簽到 |
| `et_regular_5` | ET 簽到 ≥5 |
| `passport_halfway` | 護照 ≥50 點 |
| `passport_certified` | 護照 ≥100 點 |

---

## 7. 新環境接續開發

### 7.1 Clone 與依賴

```bash
git clone https://github.com/int88ra2260/EEARS.git
cd EEARS

cd reservation-backend
cp .env.example .env   # 首次：填 DB、JWT_SECRET 等
npm install

cd ../reservation-frontend
npm install
```

### 7.2 資料庫 Migration（必做）

```bash
cd reservation-backend
npx sequelize-cli db:migrate
```

會執行三個 migration（見 §3.1）。若 DB 已部分 migrate，用 `npx sequelize-cli db:migrate:status` 確認。

### 7.3 本機啟動

```bash
# 終端 1：後端 port 3000
cd reservation-backend && npm run dev

# 終端 2：前端 port 3001（proxy → 3000）
cd reservation-frontend && npm start
```

### 7.4 驗證指令

```bash
# 後端
cd reservation-backend
npm test -- --runInBand tests/learningTraceService.test.js
npm run lint

# 前端
cd reservation-frontend
npm run lint
npm run build
```

### 7.5 手動驗收路徑

1. **Word Bridge**：`/practice/word-bridge` 玩一場 → Network 應見 `POST /api/learning-traces`
2. **管理端**：`/admin/learning-analytics` →「微學習參與」「學習軌跡洞察」
3. **學生歷程**：`/student/progress` 輸入有預約紀錄的學號+姓名+email → 回饋、徽章、微學習列表
4. **Funnel**：Word Bridge 結果頁點活動推薦 → 後台漏斗數字增加

---

## 8. 前端追蹤要點

- `learningTraceSession.js`：產生並持久化 `clientSessionId`
- `learningStudentLink.js`：學生在 progress 頁查詢後，學號寫入 sessionStorage，Word Bridge 上報時帶入
- `WordBridgeGame.jsx`：
  - 開局：`session_start`
  - 結算：`session_complete`
  - 結果頁推薦：`funnel_impression` / `funnel_click` / `funnel_book_attempt`

---

## 9. 已知限制與後續可做

| 項目 | 狀態 |
|------|------|
| 真 LLM 回饋 | 未接；僅模板 + disclaimer |
| Listening Ladder / 其他 mini-game trace | 僅 Word Bridge 已接 |
| ET 推薦 funnel 全站 | 主要在 Word Bridge 結果頁 |
| 實驗設計 A/B | 未實作 |
| research export 納入 trace | 未實作 |
| `.tmp-ux-audit/` | 本地 UX 稽核產物，**勿提交** |

---

## 10. 研究／面談參考（劉明機副教授）

**可強調的 EEARS 亮點**

- LJ v3 事件層 + LVA 三法估計
- 問卷 gate（ET/EC）與修復管線
- 本輪新增：微學習 trace、funnel、調節焦點回饋雛形、SRL 徽章

**建議專題定位**

> 教學策略驅動的微學習軌跡 + 適應性回饋 + LJ 關聯驗證（準實驗／觀察性研究設計）

---

## 11. 相關規則檔

- `.cursor/rules/eears-business-rules.mdc` — 2hr、黑名單、問卷 gate
- `.cursor/rules/project-overview.mdc` — monorepo 結構
- `AGENTS.md` — Agent 工作指南

---

## 12. 變更紀錄

| 日期 | 說明 |
|------|------|
| 2026-08-28 | 初版：方案 A+B+C 實作完成；後端 11 tests pass；前端 build pass |

---

*文件維護：接續開發時請同步更新本檔 §9 與 §12。*
