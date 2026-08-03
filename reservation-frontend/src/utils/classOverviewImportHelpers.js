/** 從班級名冊匯入 API 回傳中保守收集警告與錯誤明細 */
export function collectClassImportIssues(result) {
  const warnings = [];
  const errors = [];
  if (!result || typeof result !== 'object') {
    return { warnings, errors };
  }
  if (Array.isArray(result.warnings)) warnings.push(...result.warnings);
  if (Array.isArray(result.errors)) errors.push(...result.errors);
  if (Array.isArray(result.errorDetails)) errors.push(...result.errorDetails);
  if (Array.isArray(result.validationErrors)) errors.push(...result.validationErrors);
  return { warnings, errors };
}

export const CLASS_OVERVIEW_SEMESTER_OPTIONS = [
  { value: '114-1', label: '114-1學期' },
  { value: '113-2', label: '113-2學期' },
  { value: '114-2', label: '114-2學期' },
  { value: '115-1', label: '115-1學期' },
  { value: '115-2', label: '115-2學期' },
];

export const CLASS_OVERVIEW_SORT_OPTIONS = [
  { value: 'coverage', label: '參與率' },
  { value: 'attends', label: '簽到總次數' },
  { value: 'className', label: '班級名稱' },
];
