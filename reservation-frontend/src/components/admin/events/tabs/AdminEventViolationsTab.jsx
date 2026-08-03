import React, { memo } from 'react';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import dayjs from 'dayjs';
import { EVENT_DETAIL_COPY } from '../../../../constants/adminEventDetailCopy';

function AdminEventViolationsTab({ tabProps }) {
  const p = tabProps;

  if (p.vioBlocking) {
    return (
      <div className="pt-3">
        <div className="text-center py-5 text-muted">
          <Spinner animation="border" size="sm" className="me-2" />
          {EVENT_DETAIL_COPY.listAndViolationsLoading}
        </div>
      </div>
    );
  }

  if (p.reservationsError || p.violationsError) {
    return (
      <div className="pt-3">
        <Alert variant="danger">{p.reservationsError || p.violationsError}</Alert>
      </div>
    );
  }

  return (
    <div className="pt-3">
      <Alert variant="danger" className="small py-2 mb-3">
        <strong>違規中心同步：</strong>
        以下「批次未到」「現場違規登記」「活動結束檢查」會寫入本活動紀錄，並同步至<strong>合規與違規中心</strong>（含黑名單關聯）。請謹慎操作。
      </Alert>

      <div className="rounded border border-danger p-3 mb-4 bg-light">
        <div className="small text-danger fw-semibold mb-2">高影響操作</div>
        <div className="d-flex flex-wrap gap-2 mb-2">
          {p.canManageViolations && (
            <Button variant="danger" size="sm" onClick={() => p.openViolationModal()}>
              現場違規登記
            </Button>
          )}
          {p.canManageViolations && (
            <Button
              variant="outline-danger"
              size="sm"
              onClick={p.handleBatchMarkNoShow}
              disabled={p.batchMarkNoShowLoading || !p.currentEventId || p.noShowReservationCount === 0}
            >
              {p.batchMarkNoShowLoading
                ? '處理中…'
                : `批次登記預約未到（${p.noShowReservationCount}）`}
            </Button>
          )}
        </div>
        <p className="small text-muted mb-0">以上將直接影響學生違規狀態與後續管制。</p>
      </div>

      {p.canManageBlacklist && (
        <div className="rounded border border-warning p-3 mb-4">
          <div className="small text-dark fw-semibold mb-2">管理員：活動結束檢查</div>
          <p className="small text-muted mb-2">
            將活動期間違規與未簽到同步至黑名單流程（執行前請確認現場作業已完成）。
          </p>
          <Button
            variant="warning"
            size="sm"
            className="text-dark"
            onClick={p.handleAutoCheck}
            disabled={p.autoCheckLoading || !p.currentEventId || p.currentEventAutoCheckCompleted}
          >
            {p.autoCheckLoading ? '檢查中…' : p.currentEventAutoCheckCompleted ? '已執行檢查' : '活動結束檢查'}
          </Button>
        </div>
      )}

      {p.eventViolations.length > 0 ? (
        <div>
          <h6 className="text-secondary fw-semibold mb-2">本活動違規紀錄（僅供查閱）</h6>
          <div className="table-responsive">
            <table className="table table-sm table-bordered">
              <thead className="table-danger">
                <tr>
                  <th>學號</th>
                  <th>姓名</th>
                  <th>違規類型</th>
                  <th>描述</th>
                  <th>記錄時間</th>
                  <th>記錄者</th>
                </tr>
              </thead>
              <tbody>
                {p.eventViolations.map((violation) => (
                  <tr key={violation.id}>
                    <td>{violation.User?.studentId}</td>
                    <td>{violation.User?.name}</td>
                    <td>
                      <span className="badge bg-danger">{violation.violationType}</span>
                    </td>
                    <td>{violation.description || '—'}</td>
                    <td>{dayjs(violation.recordedAt).format('MM/DD HH:mm')}</td>
                    <td>{violation.recordedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="small text-muted mb-0">{EVENT_DETAIL_COPY.emptyViolations}</p>
      )}
    </div>
  );
}

export default memo(AdminEventViolationsTab);
