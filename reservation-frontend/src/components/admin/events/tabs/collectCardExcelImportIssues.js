export function collectCardExcelImportIssues(result) {
  const warnings = [];
  const errors = [];
  const skipped = [];
  if (!result || typeof result !== 'object') {
    return { warnings, errors, skipped };
  }
  if (Array.isArray(result.warnings)) warnings.push(...result.warnings);
  if (Array.isArray(result.errors)) errors.push(...result.errors);
  if (Array.isArray(result.validationErrors)) errors.push(...result.validationErrors);
  if (Array.isArray(result.errorDetails)) errors.push(...result.errorDetails);
  if (Array.isArray(result.skippedDetails)) skipped.push(...result.skippedDetails);
  if (Array.isArray(result.skipped) && result.skipped.length && typeof result.skipped[0] === 'object') {
    skipped.push(...result.skipped);
  }
  return { warnings, errors, skipped };
}
