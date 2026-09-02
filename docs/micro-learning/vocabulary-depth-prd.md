# 詞彙深度測驗（Vocabulary Depth）— PRD 與題型規格

**版本**：MVP 1.0  
**日期**：2026-09-01  
**路由**：`/practice/vocabulary-depth`  
**gameId**：`vocabulary_depth`

---

## 1. 產品定位

### 1.1 問題陳述

EEARS 現有微學習：

| 遊戲 | 測量維度 | 缺口 |
|------|----------|------|
| 語彙連橋 | 主題分組、語意推理 | 不測同義、搭配、慣用語 |
| 聽力字彙階梯 | 聽音辨義、反應速度 | 不測詞彙深度與語意辨析 |

學生需要第三種 **5–8 分鐘自我評估**，補足「認識單字」與「能在語境中運用」之間的落差。

### 1.2 目標

- 提供 **CEFR A1–C1** 詞彙深度參考（非正式認證）
- 與活動推薦、Learning Trace、LJ 投影整合
- 模組化架構：`data/`（純邏輯）↔ `services/`（儲存介面）↔ `hooks/`（狀態）↔ `components/`（UI）

### 1.3 非目標（MVP 不做）

- C2 評級（與 Lenguia、多數自評工具一致，上限 C1）
- 帳號登入、題庫後端 API（預留 `sessionRepository` 介面）
- 聽力／拼寫／造句題型
- 正式 CEFR 認證或 BESTEP 對照

---

## 2. 與 Lenguia 的差異化

| 維度 | Lenguia Vocabulary Level Test | EEARS 詞彙深度測驗 |
|------|------------------------------|-------------------|
| 平台 | 獨立語言學習 SaaS | 活動預約生態的 **伴侶練習** |
| 題量 | 50 題（每級 10 題） | MVP **30 題**（每級 6 題），可擴至 50 |
| CEFR 上限 | C1 | C1（語彙連橋保留 C2 進階） |
| 計分 | 每級 2/3 通過門檻、連續通過 | **相同模型**（沿用 Lenguia 可解釋性） |
| 題型 | 定義／語境／同義／搭配／慣用語 | 相同分級邏輯，**題目對齊 EEARS 活動場景** |
| 結果 | 導向 Lenguia 學習計畫 | 導向 **ET/EC/IF/JT 活動推薦** + 其他微學習 |
| 詞彙來源 | 自有 10K 語料 | 與 `wordBridge` / `listeningLadder` **共用 canonical 詞表**（CEFR 稽核腳本維護） |
| 資料 | 可選帳號 | 匿名 + **自願學號**（Learning Trace） |

**EEARS 獨有價值**：練完 → 知道適合哪種中心活動 → 一鍵去預約／Phrasebook，而非離開去外部平台。

---

## 3. 使用者流程

```
Intro（規則 + 免責）
  → Start
Level A1（6 題 MCQ）
  → 通過（≥4/6）→ A2 … → 通過 C1 → 結果 C1
  → 未通過 → 結果 = 上一個通過級（A1 未過 → A1）
Results（估計層級 + 活動建議 + 交叉導向其他遊戲）
```

- 無限時（MVP）；未來可加每題 20s
- 每題答完即顯示正確答案（學習導向，非競賽）

---

## 4. 題型規格（依 CEFR 帶）

| 級別 | 題型 `type` | 測量能力 | 範例 |
|------|-------------|----------|------|
| A1 | `definition` | 高頻詞基本義 | What does "breakfast" mean? |
| A2 | `context` | 日常語境選詞 | In a café: "I'd like to make a ______." |
| B1 | `synonym` | 同義／近義辨析 | "participate" ≈ ? |
| B2 | `collocation` | 搭配／片語 | "raise an issue" means… |
| C1 | `nuance` | 慣用語、多義、細微差異 | "give up" in "Don't give up" |

### 4.1 題目資料結構

```js
{
  id: 'vd_b1_03',
  level: 'B1',
  type: 'synonym',
  prompt: 'Which word is closest in meaning to "clarify"?',
  promptZh: '哪個詞與 clarify 意思最接近？',
  options: [
    { id: 'a', text: 'make clear', textZh: '釐清說明' },
    { id: 'b', text: 'classify', textZh: '分類' },
    // ...
  ],
  correctOptionId: 'a',
  word: 'clarify',
  explanationEn: 'Clarify means to make something easier to understand.',
  explanationZh: 'Clarify 意為使某事更容易理解。',
  tags: ['english_table', 'discussion'],
}
```

### 4.2 MVP 題庫規模

- **每級 6 題 × 5 級 = 30 題**（seed 在 `questionBank.js`）
- 正式版目標：每級 10 題 × 5 級 = 50 題（對齊 Lenguia）

---

## 5. 計分與 CEFR 推估

### 5.1 通過門檻（Lenguia 模型）

```text
passThreshold(level) = ceil(questionsPerLevel × 2/3)
MVP: questionsPerLevel = 6 → 需答對 ≥ 4 題
```

### 5.2 推估規則

1. 從 A1 依序進行；某級 **未達門檻** → 結束，`estimatedLevel` = 上一個通過級（無則 A1）
2. 五級皆通過 → `estimatedLevel` = C1
3. **不評 C2**

### 5.3 輸出欄位

```js
{
  estimatedLevel: 'B1',
  passedLevels: ['A1', 'A2'],
  failLevel: 'B1',
  endReason: 'level_failed' | 'cleared_c1',
  accuracy: 0.73,
  levelStats: [{ level: 'A1', correct: 5, total: 6, passed: true }, ...],
  confidence: 'medium', // 依 borderline 答對數
}
```

---

## 6. Learning Trace 契約

| eventType | 時機 | 主要欄位 |
|-----------|------|----------|
| `session_start` | 開始第一題前 | `traceId`, `gameId: vocabulary_depth` |
| `session_complete` | 進入結果頁 | `cefrLevel`, `durationMs`, `accuracy`, `payload.levelStats` |

`skillTags`: `['vocabulary', 'vocabulary_depth', 'reading_comprehension']`

---

## 7. UI / UX

- 重用 `GameHero`、`GameHowToPlay`、`GameCefrDisclaimer`
- 元件目錄：`components/vocabularyDepth/`（Intro / Question / Result 分離）
- 結果頁 Next Action：活動推薦、語彙連橋、聽力階梯、Phrasebook
- 入口：`MINI_GAMES_CATALOG`、首頁 `HomePracticeNow`、學習資源頁

---

## 8. 技術架構（模組化）

```
src/
  data/learningContent/vocabularyDepth/
    constants.js      # 級別、門檻、題型常數
    questionBank.js   # 純資料 + getQuestionsForLevel
    scoring.js        # computeVocabularyDepthResult（無 React）
  services/vocabularyDepth/
    sessionRepository.js  # async API；MVP = localStorage
  hooks/
    useVocabularyDepthGame.js  # 狀態機 only
  components/vocabularyDepth/
    VocabularyDepthGame.jsx    # orchestrator + trace 副作用
    VocabularyDepthIntro.jsx
    VocabularyDepthQuestion.jsx
    VocabularyDepthResult.jsx
  pages/VocabularyDepthPage.jsx
```

**未來 API 替換**：僅改 `sessionRepository.js` 實作；hook / UI 不變。

---

## 9. 成功指標（上線後）

- 完成率 ≥ 60%
- 結果頁 → 活動頁 CTR ≥ 15%
- Learning Trace `session_complete` 與 Word Bridge 量級可比（3 個月）
- CEFR 稽核腳本 CI 零新增 cross-bank 衝突

---

## 10. 里程碑

| 階段 | 內容 |
|------|------|
| **MVP（本 PRD）** | 30 題、A1–C1、localStorage、Trace、目錄上架 |
| v1.1 | 擴題至 50、CEFR 稽核 golden list |
| v1.2 | 後端題庫 API、`sessionRepository` 切換 |
| v2 | 依活動類型動態抽題（ET/EC 場景權重） |

---

## 11. 字彙庫維護

題庫與 canonical 詞彙的**更新、重建、驗證**流程見 [vocabulary-bank-maintenance.md](./vocabulary-bank-maintenance.md)。

- 日常：`npm run vocab:build`（改來源後重建）
- PR / CI：`npm run vocab:check`（驗證已提交產物與規則一致）
