import {
  validateStudentId,
  validateName,
  validateIdNumber,
  validateEnglishTestBasicForm,
} from './englishTestRegistrationValidation';

describe('englishTestRegistrationValidation', () => {
  it('returns required messages for empty fields', () => {
    expect(validateStudentId('')).toBe('請填寫學號');
    expect(validateName('')).toBe('請填寫姓名');
    expect(validateIdNumber('')).toBe('請填寫身分證字號');
  });

  it('returns format messages when fields are partially filled', () => {
    expect(validateStudentId('123')).toMatch(/學號必須/);
    expect(validateName('A')).toMatch(/姓名/);
    expect(validateIdNumber('INVALID')).toMatch(/格式錯誤/);
  });

  it('validateEnglishTestBasicForm marks all empty fields as required', () => {
    const errors = validateEnglishTestBasicForm({ studentId: '', name: '', idNumber: '' });
    expect(errors.studentId).toBe('請填寫學號');
    expect(errors.name).toBe('請填寫姓名');
    expect(errors.idNumber).toBe('請填寫身分證字號');
  });
});
