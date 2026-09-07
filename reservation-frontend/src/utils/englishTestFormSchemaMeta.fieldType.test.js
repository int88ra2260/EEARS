import { buildFormOptionsFromMeta, fieldType, fieldOptionPairs } from './englishTestFormSchemaMeta';

describe('fieldType / select options from schema', () => {
  test('reads type and options from questions for address fields', () => {
    const formOptions = buildFormOptionsFromMeta({
      questions: [
        {
          fieldKey: 'postalCode',
          type: 'select',
          label: '郵遞區號',
          required: true,
          visible: true,
          options: [{ label: '804', value: '804' }],
        },
        {
          fieldKey: 'city',
          type: 'select',
          label: '縣市',
          options: ['高雄市'],
        },
      ],
    });

    expect(fieldType(formOptions, 'postalCode', 'text')).toBe('select');
    expect(fieldType(formOptions, 'city', 'text')).toBe('select');
    expect(fieldType(formOptions, 'unknown', 'text')).toBe('text');
    expect(fieldOptionPairs(formOptions, 'postalCode')).toEqual([{ value: '804', label: '804' }]);
    expect(fieldOptionPairs(formOptions, 'city')).toEqual([{ value: '高雄市', label: '高雄市' }]);
  });
});
