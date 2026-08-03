import React, { useState } from 'react';
import PrivacyPage from '../PrivacyPage';
import TermsPage from '../TermsPage';

export default function LegalVisualPreview() {
  const [tab, setTab] = useState('privacy');

  return (
    <div className="scm-visual-legal">
      <div className="scm-visual-legal__tabs" role="tablist" aria-label="法律文件預覽">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'privacy'}
          className={`scm-visual-legal__tab${tab === 'privacy' ? ' is-active' : ''}`}
          onClick={() => setTab('privacy')}
        >
          隱私權政策
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'terms'}
          className={`scm-visual-legal__tab${tab === 'terms' ? ' is-active' : ''}`}
          onClick={() => setTab('terms')}
        >
          使用條款
        </button>
      </div>
      {tab === 'privacy' ? <PrivacyPage /> : <TermsPage />}
    </div>
  );
}
