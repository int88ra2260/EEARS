# 學習成效分析：課程／教師／活動細項（Offerings）PRD

> 狀態：構思 + Phase 1 MVP 實作中  
> 對齊模組：LVA（`learning-analytics`）  
> 語氣底線：觀察關聯，非因果證明（`causalClaimAllowed = false`）

---

## 1. 背景與問題

現有 LVA 以**學生**與**資源類型**（English Table、EAP、通識英文…）為分析單位，無法回答：

- 某門課（含學期、授課教師）修過幾人？其中幾人有可計算的前後測進步？
- 某位教師該學期教過幾人？平均原始分進步多少？
- 某一場 English Table／Job Talk 活動，出席者有幾人進步？

底層資料（`courses`、`course_enrollments`、`lj_student_events`、`lj_analytic_exams`）已具備關聯基礎，缺的是**細項彙總維度**與**呈現頁面**。

---

## 2. 目標與非目標

### 目標（Phase 1）

| 維度 | 說明 | 彙總鍵 |
|------|------|--------|
| **課程** | 學期內具體開課（課名 + 教師） | `semesterId::courseId` |
| **教師** | 學期內授課教師 | `semesterId::instructorName` |
| **活動** | 單一活動場次（預約或參與紀錄） | `eventId` 或 `eventDate::title` |
| **資源類別** | 通識英文、EAP、ET…（既有粗分類的細項列表） | `resourceType` |

每列至少呈現：

- 參與／修課人數
- 可計算成長人數（有前後測、`retestFlag`）
- 有進步人數（任一前後測 `improvedFlag` 或 `deltaRawScore > 0`）
- **平均原始分進步**（`deltaRawScore`，與現有「資源效益」頁口徑一致：先算學生平均，再算群體平均）
- 進步率 = 有進步人數 ÷ 可計算成長人數

### 非目標（Phase 1 不做）

- 不作「此課程／教師**造成**進步」的因果宣稱
- 不作教師績效排名對外公布（樣本過小需遮蔽）
- 不取代既有「分析與報表 → 教師影響（proxy）」實驗頁（該頁為全校綜合 proxy，語意不同）
- Phase 1 不做預先物化表；資料量成長後再評估

---

## 3. 歸因邏輯（描述性）

採用與現有 `summarizeResourceEffectiveness` 相同的**成員歸因**：

1. 學生 S 曾參與 offering O（修課、出席活動、或事件對應資源類別）
2. 若 S 在分析快照中有前後測（`LjAnalyticExam.retestFlag`），則 S 的成長納入 O 的統計
3. 同一學生可同時出現在多門課／多場活動 → **人數與進步率會重複計入**（需在 UI 明示）

成長指標優先序：

| 優先 | 指標 | 來源 |
|------|------|------|
| 1 | 原始分進步 | `deltaRawScore` |
| 2（Phase 2） | GSE 實際成長 | `actualGseGrowth` |
| 3（Phase 2） | 修正成長 | `adjustedGseGrowth` |

---

## 4. 隱私與樣本門檻

- 可計算成長人數 **< 10**：遮蔽平均進步與進步率，顯示「樣本不足」
- 教師維度：預留 Phase 2 讓 `teacher` 角色僅能看自己的列（沿用 `learningJourneyAccessService` scope）
- 所有列標記 `causalClaimAllowed: false`

---

## 5. API 設計

```
GET /api/admin/learning-analytics/offerings
```

Query：

| 參數 | 說明 |
|------|------|
| `dimension` | `course` \| `instructor` \| `activity` \| `resource_category` |
| `semester` | 學期（建議必填；活動／課程預設依學期篩選） |
| 其餘 | 沿用 LVA 群體篩選（系所、學院、起始能力…） |

```
GET /api/admin/learning-analytics/offerings/export
```

需 `CAN_EXPORT_LEARNING_ANALYTICS` 權限。XLSX 含四個工作表：匯出說明、細項彙總、技能明細、學生明細（上限 20,000 列）。

```json
{
  "dimension": "course",
  "semester": "114-1",
  "rows": [
    {
      "offeringKey": "114-1::42",
      "label": "學術英文（王小明）",
      "semesterId": "114-1",
      "courseCode": "ENG201",
      "instructorName": "王小明",
      "participantCount": 28,
      "growthSampleSize": 12,
      "improvedStudentCount": 8,
      "improvedRate": 0.6667,
      "avgRawDelta": 35.5,
      "privacySuppressed": false,
      "causalClaimAllowed": false
    }
  ],
  "cautions": ["…"]
}
```

---

## 6. UI 設計

新增 LVA 子頁：**「細項分析」**（`/admin/learning-analytics/offerings`）

- 頂部：維度切換（課程／教師／活動／資源類別）
- 沿用既有 `LearningAnalyticsFilters`（學期、系所…）
- 表格可排序：人數、可計算成長、進步率、平均原始進步
- 固定警示：描述性統計、非因果；同一學生可能重複計入多個細項

Phase 2：點列展開技能 breakdown、連到學習軌跡篩選名單。

---

## 7. 實作分期

| 階段 | 內容 |
|------|------|
| **Phase 1（MVP）** | API + 細項分析頁 + 單元測試 + 文件 |
| **Phase 1.1（已完成）** | 樣本門檻 10 人；三種進步定義；GSE 成長；技能 breakdown；學生下鑽；教師跨學期／依學期；教師 self-scope |
| Phase 2 | 匯出、物化彙總、與 model run 連動 |

---

## 8. 與現有頁面關係

| 現有頁面 | 關係 |
|----------|------|
| 資源效益 | 資源**類別**層；本功能補**具體課／師／場次** |
| 學生群體分析 | 學生屬性分組；本功能為參與**標的**分組 |
| 學習軌跡 | 個人明細；本功能為群體彙總後可下鑽 |
| 教師影響（proxy） | 不同指標、不同 API；勿混淆 |
