import React, { useState } from 'react';
import LearningAnalyticsPageFrame from '../src/components/learningAnalytics/LearningAnalyticsPageFrame';
import StudentExplorerDetailDrawer from '../src/components/learningAnalytics/StudentExplorerDetailDrawer';
import { saveWorkingSet } from '../src/utils/learningAnalyticsWorkingSet';

export default function WorkingSetProbe() {
  const [semester, setSemester] = useState('114-2');
  const [open, setOpen] = useState(false);
  const scope = { snapshotVersion: 'synthetic-snapshot', semester };

  return (
    <div>
      <h1>群體篩選探針</h1>
      <label>
        學期
        <select aria-label="學期" value={semester} onChange={(event) => setSemester(event.target.value)}>
          <option value="114-2">114-2</option>
          <option value="115-1">115-1</option>
        </select>
      </label>
      <LearningAnalyticsPageFrame
        title="探針頁"
        question="確認這批人是否仍套用在目前學期。"
        showWorkingSet
        workingSetScope={scope}
      >
        <button
          type="button"
          onClick={() => saveWorkingSet({
            label: '課Ａ學生',
            studentIds: ['S100'],
            total: 1,
            context: { snapshotVersion: 'synthetic-snapshot', semester: '114-2' },
          })}
        >
          帶入群體
        </button>
        <button type="button" onClick={() => setOpen(true)}>打開抽屜</button>
        <p>名單仍在這一頁。</p>
      </LearningAnalyticsPageFrame>
      {open ? (
        <StudentExplorerDetailDrawer
          studentId="S100"
          token="analytics-browser-harness"
          snapshotVersion="synthetic-snapshot"
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
