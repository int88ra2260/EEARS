import React from 'react';
import EventFAQModal from '../../components/events/EventFAQModal';

export default function RulesModalVisualPreview() {
  return (
    <div className="scm-visual-rules">
      <p className="scm-visual-rules__hint">
        以下為學生端「常見問題／活動規定」彈窗的實際樣式；可切換 Tab 後點擊文字編輯。
      </p>
      <EventFAQModal show onClose={() => {}} />
    </div>
  );
}
