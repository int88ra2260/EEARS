'use strict';

/**
 * 學生任務完成率與場次矩陣同一口徑：
 * 只計該能力帶適用、且標記為必填的任務。
 * 未簽到不可勾選，完成率留空，不計入平均。
 */
function computeApplicableCompletion(applicableTasks = [], marks = [], { checkedIn = true } = {}) {
  const required = applicableTasks.filter((task) => task && task.isRequired);
  const total = required.length;
  if (!checkedIn || !total) {
    return { completed: 0, total, rate: null };
  }
  const completedIds = new Set(
    marks
      .filter((mark) => mark && mark.completed)
      .map((mark) => Number(mark.taskItemId))
  );
  const completed = required.filter((task) => completedIds.has(Number(task.id))).length;
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
