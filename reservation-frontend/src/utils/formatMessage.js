/**
 * 將翻譯字串中的 {{key}} 替換為變數值
 */
export function formatMessage(template, vars = {}) {
  if (typeof template !== 'string') return '';
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value ?? '')),
    template,
  );
}
