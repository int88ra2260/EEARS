# Open Issues

## Blockers

1. Staging URL／Environment Owner 未提供  
2. Deployment Authorization 未取得（須明文指定 Candidate `610495c5…`）  
3. 專用測試帳號與允許操作範圍未核發  
4. 測試資料集性質與匯出政策未確認  
5. Rollback Owner／Acceptance Owner 未指定  

## Pending verification（授權後）

- 遠端 IIS Deep Link／API JSON  
- Real Staff Login E2E  
- 三領域 Staging 流程  
- Backend 401／403 於 Staging  
- Export（若允許）  
- Screen Reader  

## Governance（不變）

32 metrics／7 domains／9 temporal／2 unimplemented／D1–D11 pending／F-BESTEP-01 pending／`officialUseAllowed=false`／`causalClaimAllowed=false`／Shadows 預設關且 Production 禁用。

## Explicit non-actions this phase

無 Push、無 Staging／Production 部署、無 DB／Migration／L3、無 Phase 6E 自動提交、未移動 Candidate／RC／main。
