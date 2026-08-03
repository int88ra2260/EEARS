import React from 'react';

export default function DetailModalAccordionItem({
  section,
  icon,
  title,
  expandedSections,
  toggleSection,
  children,
}) {
  return (
    <div className="accordion-item">
      <h2 className="accordion-header">
        <button
          className={`accordion-button ${expandedSections[section] ? '' : 'collapsed'}`}
          type="button"
          onClick={() => toggleSection(section)}
        >
          <i className={`fas fa-${icon} me-2`}></i>
          {title}
        </button>
      </h2>
      <div className={`accordion-collapse collapse ${expandedSections[section] ? 'show' : ''}`}>
        <div className="accordion-body">{children}</div>
      </div>
    </div>
  );
}
