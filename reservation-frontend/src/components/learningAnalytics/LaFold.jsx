import React, { useId, useState } from 'react';

/**
 * 預設收合的短說明。畫面先給數字，需要時再展開。
 */
export default function LaFold({ label = '這是什麼？', children, className = '' }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={`la-fold ${className}`.trim()}>
      <button
        type="button"
        className="la-fold-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '收合說明' : label}
      </button>
      {open ? (
        <div id={panelId} className="la-fold-body">
          {children}
        </div>
      ) : null}
    </div>
  );
}
