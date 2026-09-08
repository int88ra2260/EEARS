import {
  buildFormOptionsFromMeta,
  fieldStudentEditable,
  fieldDefaultValue,
} from './englishTestFormSchemaMeta';

describe('fieldStudentEditable / defaultValue', () => {
  test('studentEditable false locks field; undefined defaults to editable', () => {
    const formOptions = buildFormOptionsFromMeta({
      questions: [
        {
          fieldKey: 'postalCode',
          type: 'text',
          defaultValue: '804',
          studentEditable: false,
          visible: true,
        },
        {
          fieldKey: 'phone',
          type: 'text',
          visible: true,
        },
      ],
    });

    expect(fieldStudentEditable(formOptions, 'postalCode', true)).toBe(false);
    expect(fieldStudentEditable(formOptions, 'phone', true)).toBe(true);
    expect(fieldDefaultValue(formOptions, 'postalCode')).toBe('804');
  });

  test('address fallback false when no schema marker', () => {
    expect(fieldStudentEditable(null, 'address', false)).toBe(false);
    expect(fieldStudentEditable(null, 'phone', true)).toBe(true);
  });
});
