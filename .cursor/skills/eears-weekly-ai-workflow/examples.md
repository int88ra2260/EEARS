# 週報 AI 工作流範例

以下三則示範：**使用者輸入 → AI 應產出的摘要與 blocks 片段**。完整 JSON 可精簡；實務上 hero + richText + 1–2 互動區塊即可運作。

---

## 範例 A：活動週（events-focus）

### 使用者輸入

```markdown
- 期數：2026-W26
- 週期：2026-06-23 ~ 2026-06-29
- 版型：events-focus
- 主軸：本週 ET 場次多，鼓勵預約
- 重點：提醒活動開始前 2 小時截止預約/取消（僅文案提醒，不改系統規則）
- 活動：English Table 週三晚、English Club 週五午（ID 待後台勾選）
- 語彙挑戰：A2，校園+作業相關
- 語氣：親切簡短
- 不要發布
```

### AI 摘要（應先給使用者）

- 版型：`events-focus`
- 待確認：`eventsHighlight.eventIds` 需後台 EventPicker 勾選
- 語彙主題建議：`a2-campus`, `a2-homework`, `a2-schedule`, `a2-weekend`

### blocks 片段（示意）

```json
{
  "issueKey": "2026-W26",
  "slug": "2026-w26",
  "weekStart": "2026-06-23",
  "weekEnd": "2026-06-29",
  "status": "draft",
  "blocks": [
    {
      "id": "hero-w26",
      "type": "hero",
      "props": {
        "kicker": "EEARS Weekly",
        "title": "EEARS Weekly",
        "subtitle": "本週 English Table 與 English Club 場次開放預約，把握最後機會練口說！",
        "imageUrl": "",
        "imageAlt": ""
      }
    },
    {
      "id": "rt-w26",
      "type": "richText",
      "props": {
        "html": "<p>期末週大家辛苦了！英語中心本週仍有多場 English Table 與 English Club，歡迎預約參加。</p><p><strong>小提醒：</strong>每場活動開始前 <strong>2 小時</strong> 為預約與取消截止，請提早安排。</p>"
      }
    },
    {
      "id": "ev-w26",
      "type": "eventsHighlight",
      "props": {
        "title": "本週活動精選",
        "eventIds": []
      }
    },
    {
      "id": "tip-w26",
      "type": "callout",
      "props": {
        "variant": "tip",
        "title": "學習一點",
        "body": "參加 ET 前，先用 30 秒預想一個你想討論的話題，當天會更敢開口。"
      }
    },
    {
      "id": "wb-w26",
      "type": "wordBridgeChallenge",
      "props": {
        "level": "A2",
        "themeIds": ["a2-campus", "a2-homework", "a2-schedule", "a2-weekend"]
      }
    },
    {
      "id": "cta-w26",
      "type": "cta",
      "props": {
        "label": "立即預約活動",
        "href": "/events",
        "variant": "primary"
      }
    }
  ]
}
```

---

## 範例 B：互動週（interaction-focus）

### 使用者輸入

```markdown
- 版型：interaction-focus
- 主軸：讓學生投票 + 做一題小測驗 + 玩語彙挑戰
- 投票：你最想加開哪類活動？ET / EC / Job Talk / 其他
- 小測驗：1 題選擇題，library 詞彙
- 不要發布
```

### 投票與測驗區塊片段

```json
{
  "id": "poll-w26",
  "type": "poll",
  "props": {
    "question": "你最希望中心多開哪類活動？",
    "options": [
      { "id": "opt-et", "label": "English Table" },
      { "id": "opt-ec", "label": "English Club" },
      { "id": "opt-jt", "label": "Job Talk" },
      { "id": "opt-other", "label": "其他（留言告訴我們）" }
    ],
    "allowMultiple": false,
    "showResults": "afterVote"
  }
},
{
  "id": "quiz-w26",
  "type": "quiz",
  "props": {
    "title": "本週一題",
    "questions": [
      {
        "id": "q1",
        "type": "choice",
        "prompt": "Where do you borrow books on campus?",
        "options": ["Cafeteria", "Library", "Gym", "Parking lot"],
        "correctAnswer": "Library",
        "audioUrl": "",
        "explanation": "Library = 圖書館"
      }
    ]
  }
}
```

---

## 範例 C：公告週（announcement-focus）— 精簡

### 使用者輸入

```markdown
- 版型：announcement-focus
- 主軸：暑假服務時間調整公告為主
- 公告 slug：summer-hours-2026（假設）
- 補充一段 richText 說明仍可在線上預約
- minimal CTA
```

### AI 應標註

- `announcementCard.slug`: `summer-hours-2026`（若公告不存在，後台需重選）
- 區塊順序：hero → announcementCard → richText → cta

---

## 黃金範例特徵（供日後對齊語氣）

寫得好的週報通常：

1. Hero 副標一句話說清「本週為什麼要打開週報」
2. 正文 2 段內，第三段用 callout 給一個可執行 tip
3. 只有一個主要 CTA（預約活動）
4. 互動不超過 2 種（例：投票 + 挑戰，或測驗 + 挑戰）
5. 不堆砌英文，專有名詞保留即可

你可把實際滿意的一期匯出 blocks，貼在本檔最下方作為 **Gold Standard**。

---

## 範例 D：創意互動週（interaction-focus + 加分項）— 2026-W27

### 使用者輸入

```markdown
- 期數：2026-W27
- 週期：2026-06-29 ~ 2026-07-05
- 版型：interaction-focus + magazine 雙欄
- 主軸：Summer Signal 暑假信號，Connections 儀式感 + 期末週
- 加分：embed TED 短片、雙欄右欄留圖、poll + quiz + 語彙挑戰
- 不要發布
```

### AI 摘要

- 完整 JSON：`drafts/2026-W27-summer-signal.json`
- 15 區塊；embed 使用公開 TED embed（口說技巧，呼應「敢開口」）
- 匯入：`npm run weekly:import-draft -- --fill-events`

### 加分項對照

| 加分項 | 實作 |
|--------|------|
| `embed` 區塊 | `embed-summer-talk`（TED embed） |
| `columns` 雜誌版 | 左 richText、右 image（URL 待媒體庫） |
| 活動自動帶入 | 匯入腳本 `--fill-events` |
| 寫入後台 | `weeklyDraftImportService` + `import-weekly-draft.js` |
