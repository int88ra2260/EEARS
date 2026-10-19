'use strict';

/**
 * 學生任務完成率與場次矩陣同一口徑：
 * 已簽到學生以看得到的全部任務為分母（預設全員相同的 5 題）。
 * 未簽到完成率留空，不計入平均。核薪另看必選題。
 */
function computeApplicableCompletion(applicableTasks = [], marks = [], { checkedIn = true } = {}) {
  const scored = applicableTasks.filter((task) => task && task.isActive !== false);
  const total = scored.length;
  if (!checkedIn || !total) {
    return { completed: 0, total, rate: null };
  }
  const completedIds = new Set(
    marks
      .filter((mark) => mark && mark.completed)
      .map((mark) => Number(mark.taskItemId))
  );
  const completed = scored.filter((task) => completedIds.has(Number(task.id))).length;
  return {
    completed,
    total,
    rate: Math.round((completed / total) * 1000) / 10,
  };
}

function isCheckedInStatus(status) {
  return (status || '未簽到') === '已簽到';
}

module.exports = {
  computeApplicableCompletion,
  isCheckedInStatus,
};
