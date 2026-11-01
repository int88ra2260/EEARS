# 四科與通過

成績欄來自 `bestep_exam_scores`。頁面沒有讀 `exam_attempts` 或 `et_exam_attempts`。

`bestepImportService.js` 的 `isPassed`：四個儲存等級都必須在 A1–C2，而且每一科的序位不低於 B2。少於四科是 false。`normalizeCefrLevel` 在寫入前拿掉加號，所以頁面上看見的 B2 不能還原成 B2+。0 分經 `parseNullableScore` 後仍是 0，平均分用 `totalScore != null`，0 分會留下。

`passed` 是匯入時寫入的布林。班級頁沒有再算一次，也沒有讀報名表的 `hasCEFRB2`。`mapRegistrationForStudent` 沒有這個欄。

`overallLevel` 是匯入時已存在等級的最低項，不是四科通過。

這頁的 `passRate` 不是正式 B2 KPI，也不是名冊成對通過，更不是 `kpiService` 那個「passed 除以 LR/SW 出席人數較大者」。D1、D10、D11 仍是 pending。

到考三態在 `resolveComponentAttended`：布林 true、布林 false、否則 null。缺列是 null，不是缺考。率的分子只加 true，所以 false 與 null 都不進分子，但項目仍在分母。API 沒有另外給未知人數。前端 `formatAttendanceCell` 在物件存在時把 falsy `attended` 顯示成缺席，空物件才顯示未匯入。這是既有顯示，本階段沒有改。
