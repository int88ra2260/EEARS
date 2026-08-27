import React from 'react';

const TAB_ITEMS = [
  { key: 'grade', label: '年級' },
  { key: 'department', label: '系所' },
  { key: 'cohort', label: '入學屆別' },
];

export default function BreakdownTabs({ activeTab, onChange }) {
  return (
    <ul className="nav nav-tabs">
      {TAB_ITEMS.map((tab) => (
        <li className="nav-item" key={tab.key}>
          <button
            type="button"
            className={`nav-link ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
