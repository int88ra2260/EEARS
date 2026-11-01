# Phase 6B.6 摘要

管理者可以從既有 `/admin/analytics`，依現有權限進入中心營運、班級 BESTEP 與學習參與，並看到各領域的統計單位、時間與限制。這一頁仍是索引，不是新的全校 KPI。

本階段沒有新的聚合 API、官方達標率、因果模型或 Shadow。後端 SQL、通過率公式、LVA、CEFR、權限定義與資料表都沒有改。

## 實際完成

- Hub 三個領域使用同一層標題、主要入口與其他入口，並各自寫明母體與時間。
- 統計使用說明分開寫預約筆數、既有通過率與學習接觸，並寫明不能合成一個篩選。
- 班級列表、班級 BESTEP、資源覆蓋、技能成長在有 Hub 權限時提供「返回成效分析中心」。營運總覽沿用原有返回連結，沒有第二顆。
- 返回連結不帶 query string，也不改瀏覽器歷史。班級頁的「返回班級列表」仍在。
- Playwright 在同一套 MemoryRouter harness 裡點完三條流程與七種權限。

## 基準

- Phase 6B.5 commit：`10f9a9761e1402d605e867519f709318d175943a`
- 本階段分支：`feature/analytics-integrated-experience`
- 本階段程式保持未提交。
- `main` 與 engineering release candidate 沒有移動。
