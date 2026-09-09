// components/english-test/QuickActionButtons.js
import React, { memo } from 'react';
import { Dropdown } from 'react-bootstrap';
import useConfirm from '../ui/useConfirm';
import useToast from '../ui/useToast';

/** 避免列表 overflow-auto 裁切選單（與帳號管理列操作一致） */
const MORE_MENU_POPPER = {
  strategy: 'fixed',
  placement: 'bottom-end',
  modifiers: [
    { name: 'preventOverflow', options: { boundary: 'viewport', padding: 8 } },
    { name: 'flip', options: { fallbackPlacements: ['top-end', 'bottom-start'] } },
  ],
};

/**
 * 精簡列上操作：主動作依目前狀態顯示，其餘收進「更多」。
 * 注意：不要 renderOnMount，否則每列都會掛 Popper，列表一多會明顯卡頓。
 */
function QuickActionButtons({
  registration,
  onView,
  onQuickStatusUpdate,
  onDelete,
  onClassBestep,
}) {
  const { confirm } = useConfirm();
  const toast = useToast();
  const status = registration.status;

  const runStatus = async (nextStatus, label) => {
    if (nextStatus === 'revision' || nextStatus === 'failed') {
      onQuickStatusUpdate?.(registration.id, nextStatus);
      return;
    }
    const ok = await confirm({
      title: '確認更新狀態？',
      description: `確定要將此記錄設為「${label}」嗎？`,
      confirmText: '更新',
      cancelText: '取消',
      variant: 'primary',
    });
    if (!ok) return;
    onQuickStatusUpdate?.(registration.id, nextStatus);
  };

  const primaryActions = [];
  if (status === 'pending') {
    primaryActions.push(
      { key: 'approved', label: '通過', icon: 'fa-check', className: 'btn-outline-info', run: () => runStatus('approved', '已通過') },
      { key: 'revision', label: '請修正', icon: 'fa-pen', className: 'btn-outline-secondary', run: () => runStatus('revision', '請修正') }
    );
  } else if (status === 'approved') {
    primaryActions.push(
      { key: 'success', label: '設成功', icon: 'fa-flag-checkered', className: 'btn-outline-success', run: () => runStatus('success', '報名成功') },
      { key: 'failed', label: '失敗', icon: 'fa-ban', className: 'btn-outline-danger', run: () => runStatus('failed', '報名失敗') }
    );
  } else if (status === 'revision') {
    primaryActions.push(
      { key: 'approved', label: '通過', icon: 'fa-check', className: 'btn-outline-info', run: () => runStatus('approved', '已通過') },
      { key: 'pending', label: '審核中', icon: 'fa-clock', className: 'btn-outline-warning', run: () => runStatus('pending', '審核中') }
    );
  } else if (status === 'success') {
    primaryActions.push(
      { key: 'approved', label: '退回已通過', icon: 'fa-undo', className: 'btn-outline-secondary', run: () => runStatus('approved', '已通過') }
    );
  } else if (status === 'failed') {
    primaryActions.push(
      { key: 'pending', label: '重審', icon: 'fa-clock', className: 'btn-outline-warning', run: () => runStatus('pending', '審核中') }
    );
  }

  const copyLink = async () => {
    const url = `${window.location.origin}/admin/english-test?tab=individual&id=${registration.id}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success('連結已複製到剪貼簿');
      } else {
        throw new Error('clipboard unavailable');
      }
    } catch {
      toast.warning('無法自動複製，請手動複製網址列連結');
    }
  };

  return (
    <div className="d-flex flex-wrap gap-1 align-items-center">
      <button
        type="button"
        className="btn btn-sm btn-primary"
        onClick={onView}
        title="查看詳細資料（建議由此改狀態／編輯）"
      >
        <i className="fas fa-eye me-1" aria-hidden />
        查看
      </button>

      {primaryActions.map((action) => (
        <button
          key={action.key}
          type="button"
          className={`btn btn-sm ${action.className}`}
          onClick={action.run}
          title={action.label}
        >
          <i className={`fas ${action.icon} me-1`} aria-hidden />
          {action.label}
        </button>
      ))}

      <Dropdown align="end">
        <Dropdown.Toggle
          variant="outline-secondary"
          size="sm"
          id={`et-more-actions-${registration.id}`}
          aria-label="更多操作"
        >
          更多
        </Dropdown.Toggle>
        <Dropdown.Menu popperConfig={MORE_MENU_POPPER} style={{ zIndex: 1080 }}>
          {status !== 'pending' && (
            <Dropdown.Item onClick={() => runStatus('pending', '審核中')}>
              設為審核中
            </Dropdown.Item>
          )}
          {status !== 'approved' && (
            <Dropdown.Item onClick={() => runStatus('approved', '已通過')}>
              設為已通過
            </Dropdown.Item>
          )}
          {status !== 'revision' && (
            <Dropdown.Item onClick={() => runStatus('revision', '請修正')}>
              設為請修正
            </Dropdown.Item>
          )}
          {status !== 'success' && (
            <Dropdown.Item onClick={() => runStatus('success', '報名成功')}>
              設為報名成功
            </Dropdown.Item>
          )}
          {status !== 'failed' && (
            <Dropdown.Item onClick={() => runStatus('failed', '報名失敗')}>
              設為報名失敗
            </Dropdown.Item>
          )}
          <Dropdown.Divider />
          <Dropdown.Item onClick={copyLink}>複製詳情連結</Dropdown.Item>
          {onClassBestep ? (
            <Dropdown.Item onClick={() => onClassBestep(registration.id)}>
              前往班級 BESTEP
            </Dropdown.Item>
          ) : null}
          <Dropdown.Item className="text-danger" onClick={() => onDelete?.()}>
            刪除
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}

export default memo(QuickActionButtons);
