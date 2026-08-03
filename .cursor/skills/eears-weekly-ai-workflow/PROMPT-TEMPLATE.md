# 週報 AI 指令範本（複製貼上）

每週要 AI 協助寫週報時，複製下面區塊，填好後貼給 Cursor。  
可加一句：**「請依 eears-weekly-ai-workflow skill 產出 draft，不要自動發布。」**

---

```markdown
## 週報請求

### 基本資訊
- 期數 issueKey：（例 2026-W26；留空則請 AI 建議）
- 週期 weekStart ~ weekEnd：（例 2026-06-23 ~ 2026-06-29）
- slug：（例 2026-w26；留空則請 AI 建議）
- 建議版型：（standard / events-focus / announcement-focus / challenge-focus / interaction-focus / magazine / minimal）

### 本週主軸（1～2 句）
（例：期末將至，鼓勵同學把握最後幾場 English Table）

### 必寫重點（條列 2～5 點）
1.
2.
3.

### 活動精選（選填）
- 要 featured 的活動名稱或 ID：
- 強調訊息：（例：名額有限、新開場次）

### 公告引用（選填）
- 公告標題或 slug：

### 互動（選填）
- 投票：問題 + 選項想法
- 小測驗：主題、題數、難度
- 語彙挑戰：等級 A1–C1、偏好主題（校園/考試/週末…）

### 語氣與風格
- （例：親切、簡短、略帶鼓勵；中英混用可接受）

### 媒體（選填）
- 封面圖／配圖說明：（檔案稍後自行上傳媒體庫亦可）

### 輸出要求
- [ ] 只要 blocks JSON + metadata（預設）
- [ ] 另附後台操作步驟
- [ ] 寫入系統建立 draft（需我提供後台環境／明確授權）
- [ ] 用匯入腳本：`cd reservation-backend && npm run weekly:import-draft -- --fill-events`

### 禁止
- 不要自動發布
- 不要虛構活動時間或名額
```

---

## 精簡版（靈感很少時）

```markdown
本週週報靈感：
- 主題：
- 重點：
- 版型偏好：
請產 draft blocks JSON，不要發布。
```

---

## 修訂版（已有草稿要改）

```markdown
## 週報修訂

- 期數 / slug：
- 要改什麼：（例：hero 副標更口語、加一題投票、拿掉某活動）
- 保留不變：（例：語彙挑戰主題不動）
- 請輸出「完整 blocks JSON」或「僅變更的區塊」：（擇一）
```

---

## 附：一鍵觸發句

```
請用 eears-weekly-ai-workflow，依我下面的週報請求產出 draft。
```
