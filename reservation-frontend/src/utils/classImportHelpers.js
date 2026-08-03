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
