import { RULE_FORM_FIELDS } from '../constants/elpFormConfig';

/** 將 metadataJson 轉為審核畫面可讀的標籤列 */
export function formatSubmissionMetadata(ruleCode, metadataJson = {}) {
  const fields = RULE_FORM_FIELDS[ruleCode] || [];
  const rows = [];

  fields.forEach((field) => {
    if (field.type === 'file' || field.key === 'description') return;
    const metaKey = field.metaKey || field.key;
    let val = metadataJson[metaKey];
    if (val === undefined || val === null || val === '') return;

    if (field.key === 'wonAward') {
      val = val === true || val === 'true' ? '是（得獎）' : '否（參賽）';
    } else if (field.type === 'select' && Array.isArray(field.options)) {
      const match = field.options.find((o) => {
        if (typeof o === 'object') return String(o.value) === String(val);
        return String(o) === String(val);
      });
      if (match && typeof match === 'object') val = match.label;
    }

    rows.push({ label: field.label, value: String(val) });
  });

  return rows;
}
