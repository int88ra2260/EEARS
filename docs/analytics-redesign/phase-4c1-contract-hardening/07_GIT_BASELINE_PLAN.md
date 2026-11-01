# 安全提交與版本基準

檢查時間：本次 Phase 4C.1 完成時。沒有執行 `git add`、`git commit`、`git clean`、`git reset`。

## 目前基準

- Branch：`analytics/phase-4b-temporal-context`
- HEAD：`1f41dd5202c5672076ab3181e563effb172823fe`
- `git diff` 與 `git diff --cached` 是空的。Phase 1–4C.1 的產出仍是未追蹤檔案，所以不能用 diff 判斷工作區是否乾淨。

## 不要納入版本庫

- `.mysql-data/`：資料檔與憑證。
- SQL dump，包含 `eears_2026-09-18_18-29.sql.gz`。
- `presentation-build/`。
- `.env`、私鑰、連線字串。

禁止使用 `git add .` 與 `git add -A`。

## 為什麼不能硬拆成三個可執行提交

`reservation-backend/analytics-contracts/index.js` 同時載入 Phase 4A、4B、4C 的模組。把現在的 `index.js` 放進只有 4A 或 4A+4B 的提交，載入會找不到 4C 檔案。測試也會一起失敗。

因此可執行的切分是兩段，而不是三個各自都能 `require` 的提交。

## 建議提交 1：研究文件

只含 Phase 1–3，沒有執行期相依。

```powershell
git add -- `
  docs/analytics-redesign/00_EXECUTIVE_SUMMARY.md `
  docs/analytics-redesign/01_ANALYTICS_INVENTORY.md `
  docs/analytics-redesign/02_DATA_LINEAGE.md `
  docs/analytics-redesign/03_TIME_SEMANTICS_AUDIT.md `
  docs/analytics-redesign/04_METRIC_CONSISTENCY_AUDIT.md `
  docs/analytics-redesign/05_EVALUATION_METHODS.md `
  docs/analytics-redesign/06_ARCHITECTURE_OPTIONS.md `
  docs/analytics-redesign/07_GAPS_AND_RISKS.md `
  docs/analytics-redesign/08_RECOMMENDED_BLUEPRINT.md `
  docs/analytics-redesign/09_MIGRATION_CONSIDERATIONS.md `
  docs/analytics-redesign/phase-2-semantic-contracts `
  docs/analytics-redesign/phase-3-target-architecture
```

## 建議提交 2：可載入的契約基準

含 4A、4B、4C、4C.1。這一個提交可以離線載入並跑完契約測試。

```powershell
git add -- `
  reservation-backend/analytics-contracts `
  reservation-backend/tests/analytics-contracts `
  docs/analytics-redesign/phase-4a-contract-foundation `
  docs/analytics-redesign/phase-4b-temporal-context `
  docs/analytics-redesign/phase-4c-assessment-source `
  docs/analytics-redesign/phase-4c1-contract-hardening
```

提交前用 `git diff --cached --stat` 與 `git status` 確認暫存區沒有 `.mysql-data`、dump、`presentation-build`。

若以後仍要把 4A+4B 與 4C 分成兩個可執行提交，必須先做出一個不 `require` 評量模組的 `index.js`，連同 4A+4B 檔案一起提交，下一筆再加入 4C 與 4C.1。以目前檔案內容直接拆，中間那一筆無法載入。

## 安全檢查

預定納入的契約程式、契約測試與 `docs/analytics-redesign` 使用合成識別碼。檢查時沒有把憑證內容寫進紀錄。`.mysql-data/`、SQL dump 與 `presentation-build/` 維持未追蹤，不在上面的 `git add --` 清單裡。
