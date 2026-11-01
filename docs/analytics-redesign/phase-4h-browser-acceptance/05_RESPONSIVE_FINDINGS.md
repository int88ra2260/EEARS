# 響應式結果

五個 viewport 的整頁 `scrollWidth - clientWidth` 都是 0。三張圖都有非零尺寸，軸文字沒有超出圖卡。沒有需要修改 Grid、圖表容器或表格樣式的缺陷，因此沒有 B-OPS 修正。

375×667 的場次表容器 `scrollWidth - clientWidth` 是 15px，類型表是 0。多出來的寬度留在既有 `.table-responsive` 裡，沒有變成整頁橫向捲動。1440、1280、768、390 的兩張表這個差值都是 0。

1440 與 1280 的圖寬相同，原因是既有 `.container-fluid` 最大寬度 1200px。平板以下改為單欄，圖寬跟著變窄，仍然完整落在 viewport 內。

Phase 4G.1 的 `text-break` 仍是預防性樣式。本階段沒有重現 KPI 數字溢出。
