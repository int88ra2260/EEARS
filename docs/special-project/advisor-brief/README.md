# 專題提案 PDF（給劉明機教授）

## 檔案

| 檔案 | 說明 |
|------|------|
| `EEARS-advisor-brief-Chen.pdf` | 可直接當 email 附件 |
| `advisor-brief.html` | 網頁版（可瀏覽器開啟預覽） |
| `generate-pdf.js` | 產生 PDF 腳本 |
| `screenshots/` | 放入真實截圖 |

## 產生 PDF

```bat
cd d:\EEARS\docs\special-project\advisor-brief
node generate-pdf.js
```

## 替換真實截圖（強烈建議寄信前完成）

將 PNG 放到 `screenshots/`，檔名需一致：

| 檔名 | 建議畫面 |
|------|----------|
| `01-learning-analytics.png` | 管理端「英語學習成效分析」總覽 |
| `02-student-profile.png` | 學習歷程中心 → 學生檔（**遮罩學號／姓名**） |
| `03-student-portal.png` | https://emieears-siwan.nsysu.edu.tw/ 學生端 |
| `03b-footer-credit.png` | 同站 footer（含「網站開發：陳竑仰」） |

放好後再執行一次 `node generate-pdf.js`。

## 寄信提醒

- 附上本 PDF 即可
- **不要**在 PDF／信件寫正式站帳密
- 可寫：可另開展示帳或約 15–20 分鐘線上 demo
