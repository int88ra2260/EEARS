import React from 'react';

export default function DetailModalEditingAlert() {
  return (
    <div className="alert alert-warning mb-3">
      <i className="fas fa-exclamation-triangle me-2"></i>
      <strong>後台編輯模式</strong>：您正在修改報名資料，修改後請點擊「儲存」按鈕。
    </div>
  );
}
