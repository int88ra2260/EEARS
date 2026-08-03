import React from 'react';

export function TabPanel({ embedded, children }) {
  if (embedded) return <>{children}</>;
  return <div className="tab-pane fade show active">{children}</div>;
}
