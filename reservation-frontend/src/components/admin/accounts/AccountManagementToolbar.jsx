import React from 'react';
import { Alert, Badge, Button, Collapse, Stack } from 'react-bootstrap';

export default function AccountManagementToolbar({
  displayedCount,
  totalCount,
  tipsOpen,
  onToggleTips,
}) {
  return (
    <>
      <Stack direction="horizontal" className="flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h4 className="mb-1 fw-semibold">帳號管理</h4>
          <p className="text-muted small mb-0">
            建立與維護後台使用者、角色與權限覆寫。變更後對方通常需重新登入才會套用。
          </p>
        </div>
        <Stack direction="horizontal" gap={2} className="align-items-center flex-shrink-0">
          <Badge bg="secondary" className="fs-6 fw-normal px-3 py-2">
            列表 {displayedCount}
            {displayedCount !== totalCount ? (
              <span className="opacity-75">／載入 {totalCount}</span>
            ) : null}
          </Badge>
        </Stack>
      </Stack>

      <div className="mb-2">
        <Button
          variant="link"
          className="p-0 small text-decoration-none"
          onClick={onToggleTips}
          aria-expanded={tipsOpen}
        >
          {tipsOpen ? '▼ 隱藏' : '▶ 顯示'}維運提示
        </Button>
        <Collapse in={tipsOpen}>
          <div>
            <Alert variant="light" border="secondary" className="small mt-2 mb-0">
              <strong>維運提示：</strong>
              變更角色、權限覆寫、登入帳號、密碼或 scopes 後，使用者需<strong>重新登入</strong>才會套用最新權限與 accessVersion。
              系統<strong>無法顯示或還原既有密碼</strong>（僅儲存雜湊值）；若需協助登入，請使用「重設密碼」取得一次性臨時密碼。
              匯出檔僅供內部審查，請勿置於公開管道；檔內不含密碼雜湊與 token。
            </Alert>
          </div>
        </Collapse>
      </div>
    </>
  );
}
