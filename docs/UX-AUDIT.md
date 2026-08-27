# EEARS 學生端 UX Audit

- **測試日期**：2026-08-17
- **測試環境**：正式站 `https://emieears-siwan.nsysu.edu.tw/`（真實學生會打開的系統）
- **測試方式**：以第一次接觸系統的學生身份，用瀏覽器實際操作；桌機 1440×900，手機 375 / 390 / 430px。不先看程式碼，完成任務後才對照實作。
- **本輪範圍**：只做使用者測試、問題排序與改進方案。**未修改任何 UI 程式碼。**
- **季節背景**：測試當日為 2026 年 8 月中（暑假）。「可預約 0 場」可能符合營運現況，但介面沒有把這個事實講清楚，仍視為 UX 問題。

核心判斷：

> EEARS 現在比較像「把很多功能擺上網站」，還不夠像「幫學生完成目標」。

---

## 測試方法與限制

### 做了什麼

- Persona A：第一次進站，從網址落地，不預設知道任何按鈕。
- Persona B：假裝已經參加過活動，嘗試快速找回預約、學習紀錄、認證、小遊戲。
- Persona C：375 / 390 / 430px 實際走首頁、選單、活動日曆、活動介紹、預約查詢、學習資源、修課說明、護照。
- Task 1–6 皆實際點擊，並以 think-aloud 記錄猶豫、誤判、死路。
- 鍵盤 Tab、焦點、標籤、觸控目標一併觀察。

### 刻意沒做的事

- **沒有在正式站送出真實預約**（避免污染正式資料）。預約流程走到「找得到場次並打開詳情」就停。當日找不到任何可點的場次。
- 沒有用真實學號進入護照後台內容（身分驗證後才看得到個人點數）。護照測試停在「進入我的護照」表單與空送出。
- 這份報告只覆蓋**學生端公開介面**。管理後台不在本輪範圍。

---

## Think-Aloud 摘要（操作當下）

### Task 1｜理解 EEARS

「朋友傳網址給我，我打開了。」

- 桌機：我先看到一個很大、很空的畫面，標題是「預約中心活動，從這裡開始」。上面有「活動 / 修課 / 學習 / 其他」四個膠囊。右上角有一個「× 關閉」。我猶豫：這是首頁，還是廣告？關閉之後會去哪？
- 我還看到「立即預約」，但不知道預約什麼。旁邊還有「寫作工坊」「活動介紹」「查詢預約紀錄」，選項一下子變多。
- 手機：先進來的不是首頁，是「EEARS WEEKLY · Summer Adventure」。我以為這就是網站。要不要看完整週報？「稍後再看」才看到真正首頁。
- 導覽列寫「最新公告、活動介紹、學習資源、法規表單、關於我們」。我是學生，我想預約，但列上沒有「預約」或「我的活動」。
- 「培力英檢報名」很顯眼。我以為這是主要功能，但其實我只是想找活動。
- 結論：大概知道這是中山 EMI 中心的英語活動網站，但「我現在該點哪裡」不夠單一。

完成理解的步驟：約 20–40 秒能猜到「這是活動預約網站」；要搞懂自己能做哪些事，桌機還得關掉 overlay 或往下捲，手機還得先關掉週報。大約 **4–8 次點擊 / 捲動** 才拼出完整能力地圖。

### Task 2｜找這週能練英文的活動

「我這週想找一個可以練英文的活動。」

- 我點「立即預約活動」，進到日曆。標題不是「預約」，日曆上寫 August 2026，格子是空的。
- 上面寫「可預約 0 場 / 共 6 場」。6 場在哪？我往未來翻到 2027 年 2 月，往回翻到 2026 年 4 月，日曆還是空的。
- 換成「清單」，看到英文 **No events to display**。沒有下一步。
- 我以為 filter 上的「English Table」是活動名稱，不知道跟中文「英語桌」是同一件事。
- 我改去「活動介紹」。這裡寫得很清楚：ET / EC / Forum / Job Talk 差在哪。我按「立即預約」，又被送回空日曆。
- 任務失敗：無法看到時間、地點、名額，也無法預約。

### Task 3｜確認星期三有沒有預約 English Table

- 導覽列沒有「我的預約」。我猜會在「活動介紹」裡，沒有。
- 回首頁才在「學生常用任務」看到「查詢／取消我的預約」。桌機若停在沉浸式 overlay，這張卡片根本被擋住。
- 要填學號、姓名、Email 三個欄位。我只想問「星期三有沒有」，系統卻要我證明我是誰。
- 空白就按搜尋：出現兩次一模一樣的錯誤（表單內 + 下方大框），還中英混寫。感覺像系統壞了，不是我少填。
- 填假資料後，空狀態其實不錯：「查無相應的預約紀錄」有核對提示。但還是無法快速回答 Persona B 的問題。

步驟：首頁 → 找到卡片（或不找得到）→ 填 3 欄 → 搜尋。最少 **3–5 步**，而且每次都要重填。

### Task 4｜理解這學期的學習狀況

- 我找「學習歷程 / 學習紀錄 / Dashboard / 個人」，導覽列都沒有。
- 「英語實踐歷程護照」聽起來像，但進去是申請護照、等審核、上傳任務、集滿 100 點。這是認證作業，不是「我這學期參加過哪些活動」。
- 「修課說明」是畢業規定長文，不是我的成績或 CEFR。
- 活動介紹說「準時參與並累積學習紀錄」，但沒有地方給我看紀錄。
- 結論：介面在**展示資料與規定**，沒有在**幫我理解自己的學習狀況**。

### Task 5｜我符不符合英語能力認證？

- 我聽說畢業要過英語認證。導覽上最顯眼的是「培力英檢報名」。點進去是 BESTEP 個資同意書，不是「我過了沒」。
- 「法規表單」依入學學年度堆 PDF。我必須先知道自己是哪一學年入學。
- 「修課說明」有公式：修課 6 學分 +（英檢 **或** 集滿 100 點）。有幫助，但仍是行政文件，不是我的狀態。
- 沒有任何畫面告訴我：你現在差什麼、下一步做哪一件。
- 使用者必須自備行政規章知識，才能讀懂這個介面。

### Task 6｜今天有 5–10 分鐘想練英文

- 導覽有「學習資源」，這次算找得到。
- 外部網站卡片全部寫「外部學習平台」，Live ABC / EasyTest / Cool English 看起來都一樣，我不知道點下去會發生什麼。
- 「語彙連橋」「聽力字彙階梯」名字漂亮，但我第一次不會對應 Word Bridge / Listening。進遊戲後說明偏長，不過「開始挑戰 / 準備開始」算清楚。
- 這些遊戲不在首頁第一眼，也不在導覽第一層。回訪意願：遊戲本身有吸引力；入口不夠讓我想再來。

---

## A. Executive Summary

### 現在最大的 5 個 UX 問題

1. **學生目標不在主導覽。** 導覽是「中心官網資訊架構」（公告、介紹、資源、法規、關於我們），不是學生任務（預約、我的場次、學習進度、認證狀態）。常用功能要靠首頁卡片或 overlay，而且桌機/手機還不一樣。
2. **活動發現是斷的。** 「立即預約」帶去空日曆；摘要寫「共 6 場」但畫面沒有任何場次；不可預約時也不提供「跳到最近一場」；空狀態是英文、沒有下一步。暑假沒活動這件事，系統沒有用人話講。
3. **兩套首頁，第一印象被蓋住。** 桌機是沉浸式 overlay（還可以關掉），手機是週報 modal。學生常用任務、FAQ、真正 CTA 不在第一眼。同一個網站，兩種心智模型。
4. **沒有「我現在怎樣」的學生畫面。** 沒有 dashboard。預約要每次三欄查詢；學習是護照申請流程；認證是長篇規定。學生問「我做過什麼、我在哪、下一步」三個問題，系統都答不好。
5. **名稱互相撞車。** 活動介紹 / 活動總覽 / 立即預約 / 查看活動 / 查看場次；English Table 沒有中文對照；培力英檢 vs 英語能力認證 vs 實踐歷程護照。學生無法靠導覽理解整個 EEARS。

### 哪些最影響學生

- **找不到或約不到活動**（問題 2）直接讓核心任務失敗。
- **找不到自己的預約**（問題 1 + 4）讓回訪學生焦慮，也增加違規風險（FAQ 自己也說沒取消會記違規）。
- **認證與學習被拆成規定頁**，學生無法判斷畢業進度，會轉去猜「培力英檢報名」或放棄。

### 哪些最值得優先處理

1. 空日曆 / 活動發現（含暑假 empty state 與「去看那 6 場」）。
2. 主導覽改成學生任務（至少：預約場次、我的預約、學習資源）。
3. 桌機 overlay 不要擋住第一次使用；手機週報不要當唯一第一畫面。
4. 預約查詢的錯誤回饋與欄位驗證（低成本、立刻減摩擦）。
5. 認證入口改成「你差什麼」而不是「請讀 PDF」。

---

## B. UX Friction List

依嚴重程度排序。

### Critical

#### UX-001

- **頁面**：`/events` 活動日曆
- **使用者目標**：找這週能參加的英語活動並預約
- **原本預期**：看到近期場次、時間、地點、名額，能點進去預約
- **實際發生**：月曆全空；清單顯示 `No events to display`；摘要卻寫「可預約 0 場 / 共 6 場」。前後翻月份仍空。無法完成預約。
- **問題**：日曆視窗與「全部場次」脫節；不可預約的場次也不引導過去；空狀態沒有原因與下一步。
- **類型**：Discoverability、Feedback、Empty state、Cognitive Load
- **嚴重程度**：Critical
- **影響**：核心任務（預約）在正式站失敗。學生會以為系統沒活動或壞掉。
- **改善建議**：
  - 當目前視圖沒有場次、但系統有場次時，自動跳到最近一場，或放主按鈕「查看這 6 場」。
  - `hasNextBookable === false` 時仍提供「查看最近場次」（含已截止/未開放）。
  - 暑假／無可預約：人話 empty state：「現在是暑假，目前沒有可預約場次。你可以先看活動介紹、玩 5 分鐘小練習，或查自己的預約。」
  - 清單空狀態改中文，並給 CTA。
- **建議修改範圍**：Component、Copy、Interaction、Backend support（若 API 沒回傳日期範圍）

#### UX-002

- **頁面**：全站 Navigation
- **使用者目標**：靠選單完成「預約 / 查我的場次 / 看進度」
- **原本預期**：導覽就是我能做的事
- **實際發生**：一級選單是公告、活動介紹、學習資源、法規表單、關於我們。預約日曆、我的預約、護照、修課說明都不在 header。`/events` 主要靠 CTA。Footer「活動總覽」連到 `/activities` 不是 `/events`。
- **問題**：資訊架構依中心網站分類，不符合學生心智模型。
- **類型**：Information Architecture、Navigation、Discoverability
- **嚴重程度**：Critical
- **影響**：回訪學生多繞路；第一次使用者不知道「活動介紹」不是日曆。
- **改善建議**：主導覽改為任務：`預約場次` `/events`、`我的預約` `/my-reservations`、`活動介紹` `/activities`、`學習`（資源+遊戲）、次要再放公告/關於。法規與修課收到「畢業／認證」底下。
- **建議修改範圍**：Navigation、Information Architecture、Copy

### High

#### UX-003

- **頁面**：`/` 首頁
- **使用者目標**：第一次搞懂這是什麼、下一步點哪
- **原本預期**：一個清楚的第一畫面
- **實際發生**：
  - 桌機 ≥861px：`ScrollWorld` overlay 蓋住真正首頁（FAQ、學生常用任務）。首頁本體 `aria-hidden`。
  - 手機：週報 modal 先蓋住。
  - Overlay 有「× 關閉」，aria-label 卻是「沉浸式首頁」。
- **問題**：第一印象被行銷/實驗層蓋住；兩種裝置兩套 IA。
- **類型**：Visual Hierarchy、Mobile UX、Cognitive Load
- **嚴重程度**：High
- **影響**：學生常用任務在桌機第一眼不可見；手機把週報誤認成網站主體。
- **改善建議**：第一次進站先看任務型首頁。沉浸式改為可選「探索」；週報改 banner/小卡，不要 modal 擋路。
- **建議修改範圍**：Layout、Information Architecture、Interaction

#### UX-004

- **頁面**：`/my-reservations`
- **使用者目標**：快速確認自己有沒有預約
- **原本預期**：在選單找到「我的預約」，最好還記得我是誰
- **實際發生**：不在 nav。每次填三欄。空白搜尋被當成「查詢失敗」，錯誤出現兩次，中英混雜。
- **問題**：查詢成本高；驗證當失敗；錯誤重複。學生無登入是業務底線，但不該每次都從零開始。
- **類型**：Form UX、Feedback、Error Prevention、Discoverability
- **嚴重程度**：High
- **影響**：取消困難 → 未到場違規。Persona B 無法 10 秒內回答「星期三有沒有 ET」。
- **改善建議**：
  - Header 加「我的預約」。
  - 前端先擋空白，錯誤只顯示一次、貼在欄位旁。
  - 本機記住上次查詢的學號/Email（明文最小化、可清除）。
  - 搜尋成功後強調下一場、可否取消、2 小時規則。
- **建議修改範圍**：Navigation、Form UX、Copy、Component

#### UX-005

- **頁面**：學習紀錄 / 認證相關（`/course-guide`、`/student/english-learning-passport`、`/regulations-forms`、`/register/english-test`）
- **使用者目標**：我過了沒？還缺什麼？這學期參加了什麼？
- **原本預期**：一個「我的英語進度」頁，上面有狀態與下一步
- **實際發生**：規定、PDF、護照申請、BESTEP 報名拆成四條路。沒有個人 CEFR、沒有活動出席時間軸、沒有「你已完成 x / 還差 y」。護照空送出沒有錯誤提示。
- **問題**：系統在展示行政資料，不是幫助學生理解狀態。
- **類型**：Information Architecture、Cognitive Load、Dead-end UX、Feedback
- **嚴重程度**：High
- **影響**：畢業認證焦慮無法被介面解消；學生會誤點培力英檢。
- **改善建議**：做一頁「我的英語進度」（仍用學號+姓名+Email 驗證，與預約查詢同一套身分）。內容：出席過的活動、護照點數、認證路徑（英檢 **或** 100 點）、下一步 CTA。規定頁降為「了解規則」。
- **建議修改範圍**：Information Architecture、Layout、Backend support、Copy

#### UX-006

- **頁面**：命名與入口重複
- **使用者目標**：判斷該點「活動介紹」還是「立即預約」
- **原本預期**：一個「活動」就好
- **實際發生**：`立即預約活動` → `/events`；`查看活動` → `/activities`；nav `活動介紹` → `/activities`；footer `活動總覽` → `/activities`；日曆 filter 也叫 `活動總覽`。遊戲 breadcrumb 寫「活動總覽」但其實在 `/activities/word-bridge`。
- **問題**：同一詞指兩個 URL。
- **類型**：Consistency、Information Architecture、Content / Copywriting
- **嚴重程度**：High
- **影響**：點錯、來回跳、以為日曆就是介紹頁。
- **改善建議**：對外只留兩句人話：「選活動類型」=`/activities`，「選日期預約」=`/events`。Footer 與 breadcrumb 對齊。Filter 不要再叫「活動總覽」。
- **建議修改範圍**：Copy、Navigation、Information Architecture

### Medium

#### UX-007

- **頁面**：`/events` filter
- **使用者目標**：只看 English Table
- **原本預期**：篩完看到場次；看懂 ET/EC/Job Talk
- **實際發生**：filter 只有英文名；狀態色塊像可點的 filter 但其實是圖例；「問卷」badge 沒解釋。
- **類型**：Affordance、Content / Copywriting、Cognitive Load
- **嚴重程度**：Medium
- **改善建議**：`English Table（英語桌）` 雙語；圖例加「僅說明顏色」或做成真的狀態篩選；問卷加 tooltip。
- **建議修改範圍**：Copy、Component

#### UX-008

- **頁面**：手機 `/events`
- **使用者目標**：單手找場次
- **原本預期**：還能看到月曆，或很好用的週清單
- **實際發生**：`initialView = listWeek`，月曆模式在窄螢幕被拿掉；filter 橫向溢出；漢堡選單三條線在部分畫面幾乎像空白方塊；footer 連結高約 21px。
- **類型**：Mobile UX、Accessibility、Consistency（專案規則要求手機保留月曆）
- **嚴重程度**：Medium（暑假空清單時升為 High）
- **改善建議**：手機保留「月 / 清單」切換，預設可仍是清單但要看得到月。Filter 改成橫向捲動 + 提示，或下拉。漢堡圖示對比加大。主 CTA 可考慮 sticky。
- **建議修改範圍**：Layout、Interaction、Visual Design

#### UX-009

- **頁面**：`/survey/choice`
- **使用者目標**：填問卷才能預約（首頁卡片這樣寫）
- **原本預期**：看到要填哪份、為什麼
- **實際發生**：淡橘提示「目前沒有開放中的活動問卷」，唯一 CTA「返回首頁」。沒有解釋問卷跟 ET/EC 的關係，也沒有連去日曆。
- **類型**：Dead-end UX、Empty state、Content
- **嚴重程度**：Medium
- **改善建議**：說明「現在不用填也能先瀏覽場次；English Table / Club 開放時會需要問卷」。CTA：瀏覽場次、查我的預約。
- **建議修改範圍**：Copy、Component

#### UX-010

- **頁面**：`/learning-resources`
- **使用者目標**：5–10 分鐘練英文
- **原本預期**：立刻知道哪個最好玩、點下去就能開始
- **實際發生**：小遊戲在頁面中段；外部網站卡片文案完全相同；「LEARNING WEBSITES」重複出現；遊戲中文名不易對應。
- **類型**：Discoverability、Visual Hierarchy、Content
- **嚴重程度**：Medium
- **改善建議**：把「5 分鐘小練習」放到首頁與學習資源頂部。外部網站寫一句真正差異（聽力/測驗/閱讀）。遊戲用副標「字彙配對 · 約 8 分鐘」。
- **建議修改範圍**：Layout、Copy

#### UX-011

- **頁面**：`/student/english-learning-passport`
- **使用者目標**：進入我的護照
- **原本預期**：沒填會被擋住並告訴我哪一欄
- **實際發生**：按「進入我的護照」，畫面幾乎沒變，沒有錯誤、沒有 loading。
- **類型**：Feedback、Form UX
- **嚴重程度**：Medium
- **改善建議**：必填驗證、欄位錯誤、按鈕 pending 狀態。
- **建議修改範圍**：Form UX、Component

#### UX-012

- **頁面**：公告 ticker / 公告列表
- **使用者目標**：看有沒有重要消息
- **原本預期**：一則公告出現一次
- **實際發生**：同一則「找學伴一起考英檢」在 ticker 重複兩次；slug 為 `TEST`。日期 2026/03/27 對 8 月的學生像過期或測試資料。
- **類型**：Trust、Content、Consistency
- **嚴重程度**：Medium
- **改善建議**：正式站清測試公告；ticker 去重；過期公告下架或標「已結束」。
- **建議修改範圍**：Content、Backend support

### Low

#### UX-013

- **頁面**：全站 microcopy
- **問題**：FAQ 展開後，「我要怎麼預約」在測試中未穩定展開；部分按鈕「下一步 →」「搜尋」「關閉」脫離任務。培力英檢步驟 1 的下一步在未勾選時 disabled，沒有說明為什麼。
- **類型**：Content / Copywriting、Affordance
- **嚴重程度**：Low–Medium
- **改善建議**：按鈕寫動作：「同意並開始報名」「查詢我的預約」。Disabled 時加一句「請先勾選同意」。
- **建議修改範圍**：Copy

#### UX-014

- **頁面**：`/login`
- **問題**：學生若從 footer「管理員入口」進來，看到「後台登入」，沒有 logo、沒有「學生不用登入、請回首頁預約」。
- **類型**：Error Prevention、Content
- **嚴重程度**：Low
- **改善建議**：加一句「學生無需登入」+ 連回首頁/預約。
- **建議修改範圍**：Copy、Layout

#### UX-015

- **頁面**：無障礙細節
- **問題**：Scroll world 圖片缺 alt；部分 CTA 連結 innerText 為空（靠視覺）；nav 用 `<button>` + `navigate` 而非 `<Link>`（不能開新分頁、中鍵）；漢堡 `aria-label="Menu"` 在中文介面；404 路由仍 HTTP 200；footer 觸控過小。
- **類型**：Accessibility
- **嚴重程度**：Low（累積中等）
- **改善建議**：nav 改 Link；補 alt / 可讀文字；漢堡中文；404 給 404 狀態；footer 加大點擊區。
- **建議修改範圍**：Component、Accessibility

#### UX-016

- **頁面**：遊戲結束後
- **問題**：語彙連橋開始畫面清楚，但（本次未完整打完一局）從頁面結構看，結束後容易停在分數，缺少「去預約一場 ET」「再玩聽力」等 Next Action。
- **類型**：Dead-end UX
- **嚴重程度**：Low
- **改善建議**：結果頁推薦下一場活動或另一個 5 分鐘遊戲。
- **建議修改範圍**：Interaction、Copy

---

## C. User Journey

```
Discover EEARS
    ↓  friction: 桌機 overlay / 手機週報搶第一印象；EEARS 縮寫對新生不直觀
Login（學生其實不用登入）
    ↓  friction: footer 有「管理員入口」；護照/預約又要身分三欄，像「假登入」
Understand Dashboard
    ↓  friction: 沒有 dashboard。桌機 overlay 擋住「學生常用任務」
Find Activity
    ↓  friction: nav 沒有「預約場次」；活動介紹 ≠ 日曆
View Activity
    ↓  friction: 日曆空、共 6 場看不到；英文 empty state；filter 無中文
Reserve
    ↓  friction: 當日無法完成；問卷頁可能是死路
Participate
    ↓  friction: 現場結束後網站沒有「你剛完成了，下一步…」
Learning Record
    ↓  friction: 沒有出席時間軸；護照是另一套申請流程
Understand Progress
    ↓  friction: 修課說明/法規是規定不是狀態；無個人 CEFR
Recommended Next Action
    ↓  friction: 幾乎每個完成點都停住（Dead-end）
```

### Dead-end UX 清單（「然後呢？」）

| 位置 | 使用者心理 | 建議 Next Action |
|---|---|---|
| 空日曆 | 沒活動？壞了？ | 查看已公告場次 / 活動怎麼選 / 5 分鐘練習 / 查我的預約 |
| 完成（或無法）預約後 | 我成功了嗎？要不要填問卷？ | 查看我的預約、行事曆、2 小時取消規則 |
| 問卷無開放 | 那我不能預約？ | 仍可瀏覽場次；說明 ET/EC 才需要 |
| 看完學習紀錄／護照說明 | 我幾點了？ | 驗證後進護照；顯示點數與還差多少 |
| 看完 CEFR/修課公式 | 那我呢？ | 「用學號查看我的進度」 |
| 小遊戲結束 | 很好玩，然後？ | 再玩一輪、聽力遊戲、去預約 |
| 登入後…其實沒有學生登入 | 我要不要申請帳號？ | 永遠說明：學生用學號查詢即可 |
| BESTEP 報名中途 | 這跟畢業認證同一件事嗎？ | 分清「報名考試」vs「認證進度」 |
| 活動介紹按立即預約卻進空日曆 | 我選的類型沒開？ | 該類型無場次時說明，並建議其他類型 |

---

## D. Quick Wins（低工程成本 + 高 UX）

1. **空日曆文案與 CTA**（XS）：中文 empty state + 「查看活動介紹」「查我的預約」「5 分鐘練習」。有 `totalCount > 0` 時顯示「查看全部 N 場」並跳到最近日期。
2. **Header 加「我的預約」「預約場次」**（S）：兩個 link，改 IA 標籤。
3. **預約查詢錯誤只顯示一次、先前端驗證**（S）：不要把 validation 當 API 失敗。
4. **活動名稱雙語**（XS）：English Table（英語桌）等。
5. **對齊「活動總覽」用詞**（XS）：footer 若指介紹頁就叫活動介紹；日曆叫預約場次。
6. **問卷空狀態補下一步**（XS）。
7. **護照空送出驗證**（S）。
8. **週報改非阻擋式**（S）：banner 取代進站 modal。
9. **漢堡圖示對比 + aria-label 中文**（XS）。
10. **後台登入頁加「學生請回首頁」**（XS）。
11. **下架 TEST 公告、ticker 去重**（XS，含內容維運）。
12. **學習資源：小遊戲上移、外部網站一句話差異**（S）。

---

## E. Structural Improvements

### Information Architecture

現況（學生實際能從 UI 摸到的）：

```
EEARS
├─ 首頁（桌機：沉浸式 overlay；手機：週報 modal → 任務型首頁）
├─ 最新公告
├─ 活動介紹（/activities）
│   ├─ 類型說明（ET / EC / Forum / Job Talk / 寫作工坊外連）
│   └─ 小遊戲入口（又複製一份在學習資源）
├─ 預約日曆（/events）← 不在主導覽
├─ 我的預約（/my-reservations）← 不在主導覽
├─ 本學期問卷（/survey/choice）
├─ 學習資源
│   ├─ 外部網站
│   ├─ 語彙連橋 / 聽力字彙階梯
│   └─ 活動英語應答指南
├─ 法規表單（依入學年 PDF）
├─ 修課說明（/course-guide）← 幾乎只在 overlay「修課」
├─ 英語實踐歷程護照
├─ 培力英檢報名 ← header 最顯眼服務按鈕
├─ 關於我們 / FAQ / 隱私 / 條款
└─ 管理員入口
```

建議（依學生目標）：

```
Recommended EEARS IA
├─ 今天要做
│   ├─ 預約場次（日曆）
│   ├─ 我的預約
│   └─ 5 分鐘練習（遊戲）
├─ 搞懂活動
│   └─ 活動怎麼選（原活動介紹）
├─ 我的英語
│   ├─ 我的進度（新：出席 + 點數 + 認證狀態）
│   ├─ 畢業／認證說明（修課說明精簡版）
│   └─ 實踐歷程護照（進階）
├─ 學習資源（外部平台 + 指南）
├─ 公告
└─ 關於中心（法規 PDF、聯絡、FAQ）
     └─ 培力英檢報名（服務，不是一級預設主角）
```

原則：UI 跟後端模組脫鉤。學生不需要知道 survey、passport、eventType、BESTEP 是不同系統。

### Navigation

- 一級最多 5 個學生任務。
- 「培力英檢報名」改為服務區或「考試報名」，不要視覺上壓過「預約」。
- 手機：真正的底部或清晰漢堡，含「預約 / 我的預約 / 學習」。
- Breadcrumb 與 nav active 對齊（遊戲不要顯示成「活動介紹」active 卻 breadcrumb「活動總覽」）。

### Dashboard

現在沒有學生 dashboard。建議用「我的進度」一頁取代四個分散入口，而不是再做一個華麗首頁。

### Activity discovery

日曆應是「場次清單」為主、月曆為輔。空學期要有營運說明。介紹頁負責「選哪一種」，日曆負責「哪一天」。

### Learning Record / Certification / Resources

見 UX-005、UX-010。需要後端把出席、點數、認證狀態讀給同一個學生身分（學號），前端才有辦法從「展示規定」轉成「解釋你的狀況」。

---

## F. Page-by-page Audit

### 首頁 `/`

- **User Goal**：搞懂 EEARS、開始預約或查自己的東西
- **What Works**：有 skip link；FAQ 題目切中真實問題（含 2 小時取消、問卷、培力英檢≠預約）；手機「學生常用任務」方向對；主 CTA 顏色夠強
- **Friction**：雙首頁；overlay/週報搶第一眼；CTA 文案重複（立即預約 vs 查看活動）；培力英檢過重；公告重複
- **Severity**：High
- **Recommendation**：一個任務型首頁。第一屏只回答：這是英語活動預約；主按鈕「看本週場次」；次按鈕「查我的預約」。探索動畫當可選。
- **Expected Impact**：第一次使用者 10 秒內知道下一步

### 活動日曆 `/events`

- **User Goal**：找到場次並預約
- **What Works**：filter、狀態圖例、月/清單切換在桌機存在；有「跳到最近可預約」的程式，但 0 可預約時不出現
- **Friction**：UX-001、007、008；頁面無 h1；無法完成預約
- **Severity**：Critical
- **Recommendation**：空狀態營運化；跳到最近場次不限可預約；手機保留月曆切換
- **Expected Impact**：核心轉換率

### 活動介紹 `/activities`

- **User Goal**：搞懂活動差異、再去預約
- **What Works**：ET/EC/Forum/Job Talk 說明清楚，是本輪少數「幫學生理解」的頁。寫作工坊有標「非 EEARS 預約」。使用流程 4 步概念對。
- **Friction**：立即預約回到空日曆；頁面很長；小遊戲又出現一次；「填寫學習型態」對新生是黑話
- **Severity**：Medium（內容好，連出去的任務壞）
- **Recommendation**：保留說明品質；「立即預約」若該類型無場次，就地說明。學習型態改「30 秒幫你選活動」。
- **Expected Impact**：選對活動類型、減少亂約

### 我的預約 `/my-reservations`

- **User Goal**：確認/取消預約
- **What Works**：查無資料的 empty state 有核對清單與聯絡；2 小時規則在 FAQ 有寫
- **Friction**：不在 nav；三欄每次重填；錯誤雙重且中英混寫；空白=失敗
- **Severity**：High
- **Recommendation**：見 UX-004
- **Expected Impact**：降低未取消未到場

### 問卷 `/survey/choice`

- **User Goal**：填完才能約 ET/EC
- **What Works**：有說明「沒有開放中的問卷」
- **Friction**：死路；首頁還說「填寫學期問卷以開放預約」，暑假會嚇到學生
- **Severity**：Medium
- **Recommendation**：UX-009；首頁卡片在無問卷時改文案或隱藏
- **Expected Impact**：減少誤解

### 英語實踐歷程護照 `/student/english-learning-passport`

- **User Goal**：看點數、申請認證
- **What Works**：有 5 步驟圖；目標「100 點」說得出來
- **Friction**：名稱像學習歷程但其實是認證作業；不在 nav；空送出無回饋；必須先申請再審核，門檻高
- **Severity**：High（對「我的學習」這個目標）
- **Recommendation**：改名或副標「畢業認證點數」；驗證回饋；連到「我的進度」
- **Expected Impact**：找得到認證路徑

### 修課說明 `/course-guide`

- **User Goal**：畢業英文要做什麼
- **What Works**：公式圖「修課 + 認證」是好的 progressive disclosure 起點；可展開入學年
- **Friction**：預設全收合後仍很長；EAP/ESP、入學年是行政知識；沒有「我的」狀態；不在主導覽
- **Severity**：Medium
- **Recommendation**：頂部加「用學號查看我適用哪一版」；預設展開「你可能屬於的」而非全部學年
- **Expected Impact**：降低規章閱讀門檻

### 法規表單 `/regulations-forms`

- **User Goal**：下載我需要的表
- **What Works**：依學年分組、可全展開
- **Friction**：像檔案櫃；nav 一級過重
- **Severity**：Medium
- **Recommendation**：降到「關於／認證」子層；加「我是 113 學年入學」篩選
- **Expected Impact**：減少迷路

### 學習資源 `/learning-resources`

- **User Goal**：短時間練習
- **What Works**：遊戲與指南分區；說明「不是考試」
- **Friction**：遊戲不夠上面；外部卡片同質；英文 eyebrow 重複
- **Severity**：Medium
- **Recommendation**：UX-010
- **Expected Impact**：提高回訪練習

### 語彙連橋 `/activities/word-bridge`

- **User Goal**：玩一下、知道程度
- **What Works**：規則、難度選擇、主 CTA「開始挑戰」清楚；有自我評估免責
- **Friction**：規則 denser；breadcrumb/nav 不一致；結束後缺推薦
- **Severity**：Low–Medium
- **Recommendation**：規則改成 3 條 + 「詳細規則」；結果頁接活動推薦
- **Expected Impact**：願意再玩、再約活動

### 聽力字彙階梯 `/activities/games/listening-ladder`

- **User Goal**：90 秒聽力練習
- **What Works**：怎麼玩條列清楚；「準備開始」
- **Friction**：從日曆誤點「List」可能來到這裡（測試腳本也暴露用詞碰撞）；不在 nav
- **Severity**：Low
- **Recommendation**：入口放首頁「5 分鐘」；結果頁 Next Action
- **Expected Impact**：發現率

### 培力英檢報名 `/register/english-test`

- **User Goal**：報名 BESTEP（或誤以為這是畢業認證）
- **What Works**：步驟 1/4、同意書、disabled 下一步有一點防呆
- **Friction**：header 權重過高；與認證進度混淆；disabled 沒解釋
- **Severity**：Medium（對錯誤目標是 High）
- **Recommendation**：進頁先一句「這是考試報名，不是查畢業門檻」+ 連到進度頁
- **Expected Impact**：減少報錯名、問錯問題

### 關於我們 `/about`

- **User Goal**：這是誰辦的
- **What Works**：平台能幫你做什麼、適合誰
- **Friction**：與首頁 overlay 資訊重複；對趕著預約的人不是第一優先
- **Severity**：Low
- **Recommendation**：維持次要入口即可
- **Expected Impact**：信任，不是轉換

### 後台登入 `/login`

- **User Goal**：管理員登入（學生不該來）
- **What Works**：單純
- **Friction**：無品牌、無學生導流
- **Severity**：Low
- **Recommendation**：UX-014
- **Expected Impact**：減少學生卡在登入

---

## G. Top 10 改進項目

| # | Priority | Issue | User Impact | Proposed Change | Effort |
|---|---|---|---|---|---|
| 1 | P0 | 日曆空、卻寫共 6 場，無法預約 | 核心任務失敗 | 跳到最近場次（含不可預約）；中文 empty state + 暑假文案 + CTA | S |
| 2 | P0 | 主導覽沒有預約場次 / 我的預約 | 找不到最常用功能 | Header 改任務導向，footer 用詞對齊 | S |
| 3 | P0 | 桌機 overlay + 手機週報擋住首屏 | 不知道下一步 | 預設任務型首頁；週報改 banner；overlay 改自願探索 | M |
| 4 | P1 | 沒有「我的英語進度」 | 無法回答做過什麼、還差什麼 | 以學號驗證的一頁進度（出席+點數+認證路徑） | L |
| 5 | P1 | 活動介紹 vs 日曆名稱混亂 | 點錯、來回跳 | 統一「選類型」vs「選日期」；雙語活動名 | XS |
| 6 | P1 | 預約查詢三欄 + 雙重錯誤 | 查不到、不敢取消 | 欄位驗證、單次錯誤、記住身分、nav 入口 | S |
| 7 | P1 | 認證入口是 PDF / BESTEP | 誤以為報名英檢=畢業 | 認證說明頁頂部「你的狀態」；BESTEP 降權重 | M |
| 8 | P2 | 小遊戲發現率低 | 5–10 分鐘需求沒被接住 | 首頁+學習資源頂部「現在就練」 | S |
| 9 | P2 | 手機日曆只剩空清單、漢堡不明 | 單手找不到場次 | 保留月/清單；加大漢堡與 filter | M |
| 10 | P2 | 問卷/護照空狀態死路 | 「然後呢？」 | 補 Next Action；護照表單驗證 | S |

---

## H. Improvement Roadmap

### Phase 1｜Quick Wins（建議先做，不改架構也能過暑假）

- 日曆 empty state、跳到最近場次、中文「沒有可顯示的活動」
- Header：預約場次、我的預約
- 預約查詢錯誤與驗證
- 活動名稱雙語、用詞對齊
- 週報改非阻擋；TEST 公告下架
- 問卷/護照空狀態
- 後台登入學生導流

### Phase 2｜Core UX（主要使用流程）

- 首頁單一任務模型（拿掉預設 overlay）
- 預約成功/查詢成功後的下一場與取消說明
- 手機日曆與 filter 重做
- 學習資源重新排序：遊戲 > 指南 > 外部網站
- 遊戲結果頁推薦活動

### Phase 3｜Information Architecture

- 導覽重組為「今天要做 / 我的英語 / 探索」
- 「我的進度」頁（需 API：出席、護照點數、認證狀態）
- 培力英檢從視覺主角降為服務
- 法規/修課收到認證資訊架構下，用入學年智慧預設

### Phase 4｜Polish（最後才做）

- 沉浸式首頁當彩蛋，不要當預設
- 動畫、view transition、微互動
- 視覺精修、陰影、更 modern  
  （這些不解決「找不到場次」「不知道下一步」，故不進 P0/P1）

---

## Navigation Audit

**學生能否只靠 Navigation 理解整個 EEARS？不能。**

| 觀察 | 例子 |
|---|---|
| 名稱太像 | 活動介紹 / 活動總覽 / 查看活動 / 查看場次 / 立即預約 |
| 名稱太技術 | 沉浸式首頁、學習型態、EAP/ESP、實踐歷程檔案、eventType 英文名 |
| 重複入口 | 遊戲在介紹頁與資源頁各一份；FAQ 在首頁與 `/faq`（`/rules` 還 redirect） |
| 找不到入口 | `/events`、`/my-reservations`、`/course-guide`、護照 |
| 放錯分類 | 遊戲掛在 `/activities/...`，nav 卻亮「活動介紹」 |
| 不必要的一級 | 「法規表單」「關於我們」對第一次預約不是一級；「培力英檢」過重 |
| Nav 實作 | `<button onClick=navigate>` 不是連結：不能開新分頁、無法從 DOM href 發現結構 |
| Active state | 遊戲頁亮「活動介紹」；日曆不在 nav 故無 active |
| 手機 | 漢堡三條空 span，對比弱；選單內容仍是資訊架構不是任務 |
| Back / deep link | 日曆支援 `?type=english-table`（好）；週報與 overlay 不在 URL，無法分享「我看到的第一屏」 |

---

## Visual Hierarchy Audit

進入後 3 秒看到什麼 vs 該頁最重要的資訊：

| 頁 | 3 秒內先看到 | 是否最重要 | 問題 |
|---|---|---|---|
| 桌機首頁 | 沉浸式大標「從這裡開始」+ 四分類 | 只對了一半 | 真正任務卡被藏 |
| 手機首頁 | 週報 modal | 否 | 擋住預約 CTA |
| `/events` | 英文活動名 filter + 空月曆 | 否，應看到場次 | 空狀態視覺重量大但沒資訊 |
| `/activities` | 長頁照片卡 | 是（選類型） | 主 CTA 被折到每張卡底部 |
| `/my-reservations` | 三欄表單 | 是 | 錯誤出現後雙重紅框搶走注意力 |
| `/course-guide` | 畢業公式圖 | 是（規則） | 不是個人狀態 |
| `/learning-resources` | 「LEARNING WEBSITES」重複標題 | 否 | 遊戲才是 5 分鐘目標 |
| 培力英檢 | 長同意書 | 對報名是 | 對「我過了沒」是錯頁 |

全站傾向：每個元素都有邊框卡片，主次不夠。Header 的培力英檢框線讓它看起來像 Primary CTA。

---

## Cognitive Load Audit

- 一次太多：活動介紹長頁 + 流程 + 四類卡 + 表 + 遊戲 + 指南。
- 同頁太多卡：學習資源外部網站 5 張相同描述。
- Filter：日曆 5 個類型 + 4 個狀態圖例，暑假卻全部空。
- 術語：EAP/ESP、CEFR、BESTEP、實踐歷程、學習型態、English Table。
- 重複：公告 ticker 雙份；預約錯誤雙份；LEARNING WEBSITES 多次。
- 步驟多：查預約 3 欄；護照申請 5 步；英檢報名 4 步。
- 可改善：Progressive disclosure（修課已有手風琴，可預設聰明展開）；Grouping（今天要做 vs 規定）；Defaults（跳到最近場次）；Smart recommendation（30 秒選活動、遊戲後推薦場次）。

---

## Microcopy Audit

應改成 action-oriented 的例子：

| 現況 | 問題 | 建議 |
|---|---|---|
| 立即預約 / 立即預約活動 / 查看活動 | 分不清日曆還是介紹 | 「看本週場次」「先了解活動差在哪」 |
| 搜尋 | 沒說搜什麼 | 「查詢我的預約」 |
| 下一步 →（英檢） | 無 context | 「同意並繼續報名」 |
| 進入我的護照 | 還行 | 維持，但失敗時說「請填學號、姓名與 Email」 |
| 返回首頁（問卷空） | 死路 | 「改看活動場次」 |
| No events to display | 英文、無下一步 | 「這個區間沒有場次。查看最近一場 / 活動介紹」 |
| 查詢失敗 + 必填中英混寫 | 像系統故障 | 只在欄位下：「請填學號」 |
| Menu | 中文站英文 aria | 「開啟選單」 |
| 關閉（overlay） | 關閉什麼？ | 「略過動畫，直接使用」 |

避免再使用脫離 context 的「確認」「送出」「下一步」。

---

## 系統回饋 Audit

| 情境 | 成功？收到？狀態？可反悔？下一步？ |
|---|---|
| 空白查預約 | 被當成失敗，不是驗證 | 否 |
| 查無預約 | 空狀態佳，有聯絡 | 可再查；缺「去預約」 |
| 護照空送出 | 無回饋 | 否 |
| 日曆無場次 | 英文 empty；與「共 6 場」矛盾 | 否 |
| 點不可預約場次 | 程式有 toast（本次點不到場次未驗證） | — |
| 問卷無資料 | 有訊息，只有回首頁 | 弱 |
| Loading | 日曆有 skeleton（好） | — |
| 網路失敗 | 預約 lookup 有錯誤字串；日曆有「載入活動失敗」 | 部分好 |
| Disabled 英檢下一步 | 無文字解釋 | 弱 |
| 404 | 畫面有 404，HTTP 仍 200 | 弱 |

學生端無帳號是正確業務。回饋應改成「這一次查詢的狀態」，不要模仿登入失敗。

---

## Mobile UX Audit（375 / 390 / 430）

共同問題，不是單純把桌面縮起來：

- **進站攔截**：週報 modal 佔第一屏，單手還要先處理。
- **Navigation**：漢堡對比不足；選單仍是五個資訊項 + 培力英檢；我的預約不在裡面。
- **日曆**：預設週清單；空的「No events」；filter 橫向溢出；沒有月視圖切換（桌機才有「月」）。這與專案「手機版需保留月曆模式」規則不一致。
- **活動卡**：介紹頁長頁，雙 CTA 在窄屏會很長。
- **Modal**：週報、未來的場次 modal 需注意高度（本次無場次 modal）。
- **表格**：活動時間整理表在介紹頁，手機勢必橫滑或折行。
- **表單**：預約三欄尚可，但鍵盤未測遮擋；建議輸入 `inputmode` / `type=email`。
- **CTA**：首頁紅鈕夠大；日曆頁沒有底部 sticky「查我的預約」。
- **Footer**：連結約 21px 高，不適合拇指。
- **Ticker**：18px 高，難點。
- **應 mobile-first 重做的流程**：活動發現（清單+篩選+一場一卡，而不是 FullCalendar 月曆縮小）；我的預約（一欄一題）；認證進度（一頁狀態，不要 PDF 牆）。

---

## Accessibility Audit

自動化 + 實際操作，不是只跑工具。

- **對比**：整體尚可；漢堡與 ticker 偏弱。
- **Focus**：有可見 outline（測試中為深色 2px），這點比許多站好。
- **鍵盤**：有 skip link；Tab 可走完 header → CTA → 任務卡 → FAQ。Nav 是 button 不是 link，中鍵/新分頁不行。
- **語意**：FAQ 是 button（好）；大量 nav 不是 `<a href>`（不好）。
- **表單 label**：預約查詢三欄有標籤（好）；錯誤未明顯 `aria-describedby` 到欄位。
- **Icon-only**：漢堡三條 span，靠 CSS；部分 hero 連結 text 為空。
- **Target size**：footer、ticker 不足 44px。
- **圖片**：scroll-world 多張無 alt。
- **語系**：`lang="zh-Hant"`（好）；空狀態夾英文。
- **Reduced motion**：沉浸式/GSAP 首頁未在本輪驗證 `prefers-reduced-motion`（風險：前庭負擔）。
- **Zoom**：viewport 未鎖縮放（好）。

---

## Consistency Audit → 可收成 Design System Pattern

同一件事不同做法：

| 模式 | 不一致之處 | 應統一 |
|---|---|---|
| 活動入口 | Link CTA、pill filter、日曆 event、介紹卡「立即預約」 | Primary：去日曆；Secondary：了解類型 |
| 查詢身分 | 預約三欄、護照三欄，錯誤行為不同 | 同一組 IdentityLookup 元件 |
| 空狀態 | 日曆英文、問卷橘框、預約查無（佳）、護照沉默 | EmptyState：原因 + 1–2 CTA |
| 頁首 | PageHeader + breadcrumb 多數頁有；日曆沒 h1 | 所有公開頁要有 h1 |
| 主按鈕 | 紅、橘、深藍、Shimmer 混用 | 一個 primary、一個 secondary |
| 返回 | 「返回首頁」「← 返回公告列表」 | 「回到{上一任務}」 |
| Nav | Header button vs Footer Link vs Overlay 分類 | Header=任務，Footer=地圖 |
| 遊戲路由 | `/activities/word-bridge` vs `/activities/games/listening-ladder` | `/practice/...` 一組 |

建議建立的 pattern：`TaskHeader`、`IdentityLookupForm`、`EmptyState`、`EventTypeLabel`（中英）、`NextActions`、`StatusLegend`（不可點）vs `FilterChip`（可點）。

---

## 19. 為什麼目前 UI 會形成這些 UX 問題（對照實作）

完成操作後才看 repository，對應如下。

### Feature-centered 的導覽

`reservation-frontend/src/components/Header.js` 把 `PRIMARY_NAV` 寫成資訊架構：公告、活動介紹、學習資源、法規、關於我們。註解即「主選單（資訊導覽）」。培力英檢是獨立 service button。`/events` 與 `/my-reservations` 不在內。

Nav 用 `<button>` + `navigate()`，所以使用者（與爬蟲、開新分頁）看不到 href。這解釋了「選單不像網站地圖」。

### 兩套首頁是刻意分流，不是意外

`pages/HomePage.js`：桌機 `min-width: 861px` 且 session 未關閉時，用 `ScrollWorldTestPage` overlay，並把底下真正首頁 `aria-hidden`。關閉鍵寫入 `eears-home-sw-dismissed`。

`App.js`：週報 modal 在桌機 overlay 開啟時被關掉，所以**手機才會先看到週報**。這不是內容策略一致，是兩個實驗互斥。

`ScrollWorld` 仍帶 test 命名（`ScrollWorldTestPage`、`/hometest`），正式站卻當成預設第一印象。

### 活動被拆成兩個產品頁

- `/activities`：`ActivitiesPage` 目錄式說明（做得好）
- `/events`：`EventList` + FullCalendar 預約（核心）

Footer `HomeFooter.js` 的「活動總覽」連到 `/activities`。Hero CTA 連 `/events`。遊戲路由掛在 `/activities/...`，造成 breadcrumb「活動總覽」與 nav「活動介紹」同時亮起。

### 空日曆：資料、視圖、CTA 三層沒接上

`EventList.js` 會算 `bookableCount`、`totalCount`、`nextBookable`。  
`EventCalendarInsights.jsx` **只有** `hasNextBookable` 時才顯示「跳到最近可預約」。暑假 0 可預約 → 按鈕消失，但 `totalCount` 仍顯示 6。FullCalendar 只畫當前月份/週，那 6 場若在別的日期，畫面就是空的。清單空狀態走 FullCalendar 內建英文 `No events to display`。

手機：`EventCalendarSection.js` `initialView={isMobile ? 'listWeek' : 'dayGridMonth'}`，且 `right: isMobile ? 'listWeek' : 'dayGridMonth,listWeek'`，等於拿掉月曆。這與 `.cursor/rules`「手機版需保留月曆模式」衝突。

### 學生沒有 Dashboard 是架構結果

`App.js` 學生路由有護照、修課說明、資源、問卷、預約查詢，**沒有** `/student/dashboard`。Learning Journey v3、班級、BESTEP 分析在 `/admin/...`。學生端被設計成「公開頁 + 三欄查詢」，所以「我的學習狀況」只能拼頁。

護照 `EnglishLearningPassportPage.jsx` 是另一條申請/審核/點數產品線，名稱卻像學習紀錄。

### 預約查詢錯誤重複

`MyReservationsPage.js` 把同一個 `error` 傳進 `ReservationLookupSection` **和** `ReservationResultList`。  
`useReservationLookup.js` 把前端 `validateReservationData` 失敗也 `setError`，於是空白送出 =「查詢失敗」。

這是元件拆分（form vs result）沒有區分 validation vs server error。

### 問卷空頁

`/survey/choice` 在無規則時 fail-empty，只留回首頁。後端 survey gate 仍正確（ET/EC fail-close），但前端沒有把「現在不用填」講成人話，首頁卡片卻仍說「填寫學期問卷以開放預約」。

### 設計系統未收斂

Bootstrap + 自訂 home.css + magic-ui + scroll-world + public-ui + FullCalendar 主題並存。Primary 顏色在紅/橘/藍間切換。這解釋視覺層級不穩，但不該用「換色」當優先修復。

### API / 營運限制

- 學生無登入 → 任何個人化都要三欄或 Email。可以做得更順，不能改成帳號系統（業務底線）。
- 暑假無開放場次 → 後端可能仍回傳 6 筆非可預約；前端必須解釋，而不是只畫空月曆。
- 正式站公告 slug `TEST`、日期 2026/03/27：內容治理問題，不是前端能力問題。

---

## 結論：現在是功能中心，還是目標中心？

**現在是 Feature-centered UI。**

系統確實有：日曆、介紹、問卷、護照、英檢報名、法規、遊戲、週報、沉浸式首頁。每一塊分開看，有的甚至寫得很好（活動差異說明、預約查無的提示、FAQ 題目）。

學生目標卻是：

1. 約一場能練英文的活動  
2. 確認自己有沒有約到、能不能取消  
3. 知道這學期做了什麼、畢業還差什麼  
4. 有 10 分鐘時練一下  

這四件事目前都要使用者自己拼地圖。優化方向應從「再加一個入口」轉成「每個完成點都告訴我下一步」。

---

## 附錄：測試觀察紀錄

- 正式站標題：`EEARS｜英語增能活動預約系統`
- 瀏覽人次測試期間約 63,686 → 63,692
- 鍵盤有 skip-to-content
- 未在正式站送出預約或護照申請
- 本輪 **DO NOT MODIFY CODE**；等待下一指令再改 UI
