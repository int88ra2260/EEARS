import React from 'react';
import ReservationUsageModal from '../../components/modals/ReservationUsageModal';

export default function ReservationUsageVisualPreview() {
  return (
    <div className="scm-visual-usage">
      <p className="scm-visual-usage__hint">
        學生打開日曆預約頁時會先看到這個視窗。點擊文字即可修改，右側儲存後即生效。
      </p>
      <ReservationUsageModal show embedded onClose={() => {}} />
    </div>
  );
}
