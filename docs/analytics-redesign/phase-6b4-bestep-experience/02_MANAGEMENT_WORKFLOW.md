# 操作流程

合成情境。學生是 `SYN-N1-H`，班級是 `SYN-CLASS`。不是正式名冊。

1. **Hub**：`AnalyticsHubPage`，路由 `/admin/analytics`。BESTEP 區只有「班級列表」，`href` 是 `/admin/classes`。沒有個人成績。
2. **班級列表**：`ClassOverview` 讀 `GET /api/admin/classes/overview`。該列 `classId` 是 `SYN-CLASS`。按「查看 BESTEP 分析」。
3. **班級 BESTEP**：`ClassBestepOverview` 導向 `/admin/classes/SYN-CLASS/bestep?semester=...`。`useClassBestepOverview` 讀 query 的學期，並呼叫 `bestep-overview`。
4. **限制**：`ClassBestepDataReading` 寫出 150%、母體不一致、尚未核准為官方達標率。出席列是出席、缺席、未確認。總分 0。
5. **明細**：`ClassBestepStudentModal`。聽力 0 仍是 0。`attended: null` 是未確認。
6. **匯出**：既有「匯出 BESTEP Excel」仍呼叫原本的 export。頁面註明未確認出席在匯出裡可能是空白。
7. **返回**：既有「返回班級列表」回到 `/admin/classes`。

Harness 用 MemoryRouter，瀏覽器網址列不會變成該路徑。看到的是正式元件，不是假 HTML。
