// components/english-test/QuickActionButtons.js
import React from 'react';
import useConfirm from '../ui/useConfirm';
import useToast from '../ui/useToast';

// 與統計卡片一致的狀態配色（操作按鈕用）
const BTN_COLORS = {
  pending: { main: '#ffc107', text: '#856404' },
  approved: { main: '#0dcaf0', text: '#087990' },
  revision: { main: '#6f42c1', text: '#fff' },
  success: { main: '#198754', text: '#fff' },
  failed: { main: '#dc3545', text: '#fff' }
};

const btnStyle = (statusKey, isActive) => ({
  backgroundColor: isActive ? BTN_COLORS[statusKey].main : 'transparent',
  color: BTN_COLORS[statusKey].main,
  borderColor: BTN_COLORS[statusKey].main,
  border: '1px solid'
});
const btnStyleActive = (statusKey) => ({
  backgroundColor: BTN_COLORS[statusKey].main,
  color: BTN_COLORS[statusKey].text,
  borderColor: BTN_COLORS[statusKey].main,
  border: '1px solid'
});

export default function QuickActionButtons({
  registration,
  onView,
  onQuickStatusUpdate,
  onDelete,
  onClassBestep
}) {
  const { confirm } = useConfirm();
  const toast = useToast();

  return (
    <div className="btn-group btn-group-sm">
      {/* 主要操作：查看（藍色與總報名人數一致） */}
      <button
        className="btn btn-outline-primary d-flex flex-column align-items-center justify-content-center"
        onClick={onView}
        title="查看詳細資料"
        style={{
          minWidth: '50px',
          padding: '0.375rem 0.5rem',
          fontSize: '0.75rem',
          lineHeight: '1.2'
        }}
      >
        <i className="fas fa-eye mb-1" style={{ fontSize: '0.875rem' }}></i>
        <span style={{ fontSize: '0.7rem', fontWeight: '500' }}>查看</span>
      </button>

      {/* 快速狀態切換：審核中＝黃、已通過＝水藍、請修正＝紫、報名成功＝綠 */}
      <button
        className="btn d-flex flex-column align-items-center justify-content-center"
        style={{
          ...(registration.status === 'pending' ? btnStyleActive('pending') : btnStyle('pending', false)),
          minWidth: '50px',
          padding: '0.375rem 0.5rem',
          fontSize: '0.75rem',
          lineHeight: '1.2'
        }}
        onClick={() => {
          confirm({
            title: '確認更新狀態？',
            description: '確定要將此記錄設為「審核中」嗎？',
            confirmText: '更新',
            cancelText: '取消',
            variant: 'primary',
          }).then((ok) => {
            if (!ok) return;
            onQuickStatusUpdate && onQuickStatusUpdate(registration.id, 'pending');
          });
        }}
        title="設為審核中"
      >
        <i className="fas fa-clock mb-1" style={{ fontSize: '0.875rem' }}></i>
        <span style={{ fontSize: '0.7rem', fontWeight: '500' }}>審核</span>
      </button>
      <button
        className="btn d-flex flex-column align-items-center justify-content-center"
        style={{
          ...(registration.status === 'approved' ? btnStyleActive('approved') : btnStyle('approved', false)),
          minWidth: '50px',
          padding: '0.375rem 0.5rem',
          fontSize: '0.75rem',
          lineHeight: '1.2'
        }}
        onClick={() => {
          confirm({
            title: '確認更新狀態？',
            description: '確定要將此記錄設為「已通過」嗎？',
            confirmText: '更新',
            cancelText: '取消',
            variant: 'primary',
          }).then((ok) => {
            if (!ok) return;
            onQuickStatusUpdate && onQuickStatusUpdate(registration.id, 'approved');
          });
        }}
        title="設為已通過"
      >
        <i className="fas fa-check mb-1" style={{ fontSize: '0.875rem' }}></i>
        <span style={{ fontSize: '0.7rem', fontWeight: '500' }}>通過</span>
      </button>
      <button
        className="btn d-flex flex-column align-items-center justify-content-center"
        style={{
          ...(registration.status === 'revision' ? btnStyleActive('revision') : btnStyle('revision', false)),
          minWidth: '50px',
          padding: '0.375rem 0.5rem',
          fontSize: '0.75rem',
          lineHeight: '1.2'
        }}
        onClick={() => {
          confirm({
            title: '確認更新狀態？',
            description: '確定要將此記錄設為「請修正」嗎？',
            confirmText: '更新',
            cancelText: '取消',
            variant: 'primary',
          }).then((ok) => {
            if (!ok) return;
            onQuickStatusUpdate && onQuickStatusUpdate(registration.id, 'revision');
          });
        }}
        title="設為請修正"
      >
        <i className="fas fa-times mb-1" style={{ fontSize: '0.875rem' }}></i>
        <span style={{ fontSize: '0.7rem', fontWeight: '500' }}>修正</span>
      </button>
      {registration.status === 'approved' && (
        <button
          className="btn d-flex flex-column align-items-center justify-content-center"
          style={{
            ...btnStyle('success', false),
            minWidth: '50px',
            padding: '0.375rem 0.5rem',
            fontSize: '0.75rem',
            lineHeight: '1.2'
          }}
          onClick={() => {
            confirm({
              title: '確認更新狀態？',
              description: '確定要將此筆「已通過」設為「報名成功」嗎？',
              confirmText: '更新',
              cancelText: '取消',
              variant: 'warning',
            }).then((ok) => {
              if (!ok) return;
              onQuickStatusUpdate && onQuickStatusUpdate(registration.id, 'success');
            });
          }}
          title="設為報名成功"
        >
          <i className="fas fa-flag-checkered mb-1" style={{ fontSize: '0.875rem' }}></i>
          <span style={{ fontSize: '0.7rem', fontWeight: '500' }}>成功</span>
        </button>
      )}
      {registration.status === 'failed' && (
        <button
          className="btn d-flex flex-column align-items-center justify-content-center"
          style={{
            ...btnStyleActive('failed'),
            minWidth: '50px',
            padding: '0.375rem 0.5rem',
            fontSize: '0.75rem',
            lineHeight: '1.2'
          }}
          title="報名失敗"
        >
          <i className="fas fa-ban mb-1" style={{ fontSize: '0.875rem' }}></i>
          <span style={{ fontSize: '0.7rem', fontWeight: '500' }}>失敗</span>
        </button>
      )}

      {/* 更多操作（下拉選單） */}
      <div className="btn-group">
        <button
          type="button"
          className="btn btn-outline-secondary dropdown-toggle"
          data-bs-toggle="dropdown"
          aria-expanded="false"
        >
          <i className="fas fa-ellipsis-v"></i>
        </button>
        <ul className="dropdown-menu">
          <li>
            <button
              type="button"
              className="dropdown-item" 
              onClick={() => {
                confirm({
                  title: '確認刪除報名資料？',
                  description: '此操作無法復原。',
                  confirmText: '刪除',
                  cancelText: '取消',
                  variant: 'danger',
                }).then((ok) => {
                  if (!ok) return;
                  onDelete && onDelete(registration.id);
                });
              }}
            >
              <i className="fas fa-trash text-danger me-2"></i>
              刪除
            </button>
          </li>
          {onClassBestep && (
            <li>
              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  onClassBestep(registration.id);
                }}
              >
                <i className="fas fa-graduation-cap me-2 text-info" />
                前往班級 BESTEP
              </button>
            </li>
          )}
          <li>
            <button
              type="button"
              className="dropdown-item" 
              onClick={async () => {
                const url = `${window.location.origin}/admin/english-test?id=${registration.id}`;
                
                try {
                  // 優先使用 Clipboard API（需要 HTTPS 或 localhost）
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(url);
                    toast.success('連結已複製到剪貼簿');
                  } else {
                    // Fallback: 使用傳統方法
                    const textArea = document.createElement('textarea');
                    textArea.value = url;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-999999px';
                    textArea.style.top = '-999999px';
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    
                    try {
                      const successful = document.execCommand('copy');
                      if (successful) {
                        toast.success('連結已複製到剪貼簿');
                      } else {
                        throw new Error('複製失敗');
                      }
                    } catch (err) {
                      toast.warning('無法自動複製，請手動複製連結（已顯示於網址列）');
                    } finally {
                      document.body.removeChild(textArea);
                    }
                  }
                } catch (err) {
                  console.error('複製連結失敗:', err);
                  toast.warning('無法自動複製，請手動複製連結（已顯示於網址列）');
                }
              }}
              title="複製此筆報名的管理後台直連網址（可分享給他人直接開啟該筆詳情）"
            >
              <i className="fas fa-link me-2"></i>
              複製連結
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
