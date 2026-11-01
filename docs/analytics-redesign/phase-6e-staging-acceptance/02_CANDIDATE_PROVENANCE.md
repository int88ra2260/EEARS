# Candidate Provenance

## Application Candidate SHA

`610495c5a9c9e0656f894ce19d81f381319d1ae8`

- Branch：`release/analytics-staging-candidate`（本階段**未**移動）
- Message：`test(analytics): verify application integration and release readiness`
- 內容：Hub UX、app harness、phase-6c 文件（應用／整合測試）
- **此 SHA 才是部署來源**

## Acceptance Evidence SHA

`f8323f52c9e951c3554fb6503b0dbbbda2515b7c`

- Message：`test(release): document staging readiness and verify build isolation`
- 內容：phase-6d 文件 00–10 + `productionBuildIsolation.test.mjs`
- **不**改變應用程式行為；**不得**當成新的 Application Candidate

## Related refs（未變）

| Ref | SHA |
|---|---|
| main | `1f41dd5202c5672076ab3181e563effb172823fe` |
| Engineering RC | `174beebb84ced6d99ebd183a826c10b3ad30a512` |
| Product RC | `c2bfd447f5fbe00380c282214df68c3a0514eac9` |

## Build source

- Frontend：正式 `vite.config.js`；`npm run build` → `vite build`
- Lockfile：frontend／backend `lockfileVersion: 3`（6D／6E 未改）
- Node 驗證環境：v20.20.2／npm 10.8.2

## Commit range（Evidence 相對 Application）

`610495c5..f8323f52`：僅 docs + isolation test（12 files）。
