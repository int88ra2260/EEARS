const {
  maskIdNumber,
  maskPhone,
  maskEmail,
  maskStudentId,
} = require('../utils/piiMask');
const { maskEnglishTestRegistrationForAdminApi } = require('../utils/englishTestRegistrationApiMask');
const {
  maskSurveyResponseForAdminApi,
  maskSurveyResponseDetailForAdminApi,
} = require('../utils/surveyResponseApiMask');
const { sanitizeForAudit } = require('../utils/logSanitizer');

describe('piiMask', () => {
  it('maskIdNumber keeps head 3 and tail 3', () => {
    expect(maskIdNumber('A123456789')).toBe('A12****789');
  });

  it('maskIdNumber short values', () => {
    expect(maskIdNumber('AB')).toBe('**');
    expect(maskIdNumber('')).toBe('');
    expect(maskIdNumber(null)).toBe(null);
  });

  it('maskEnglishTestRegistrationForAdminApi masks id fields', () => {
    const out = maskEnglishTestRegistrationForAdminApi({
      id: 1,
      idNumber: 'A123456789',
      nationalId: 'A123456789',
      name: '測試',
    });
    expect(out.idNumber).toBe('A12****789');
    expect(out.nationalId).toBe('A12****789');
    expect(out.idNumberMasked).toBe('A12****789');
  });

  it('sanitizeForAudit masks idNumber key', () => {
    const out = sanitizeForAudit({ idNumber: 'A123456789', nationalId: 'B987654321' });
    expect(out.idNumber).toBe('A12****789');
    expect(out.nationalId).toBe('B98****321');
  });

  it('sanitizeForAudit masks studentEmail and respondentEmail', () => {
    const out = sanitizeForAudit({
      studentEmail: 'student@nsysu.edu.tw',
      respondentEmail: 'other@example.com',
    });
    expect(out.studentEmail).toBe('st***@nsysu.edu.tw');
    expect(out.respondentEmail).toBe('ot***@example.com');
  });

  it('maskSurveyResponseForAdminApi masks email fields', () => {
    const out = maskSurveyResponseForAdminApi({
      id: 1,
      studentEmail: 'alice@student.nsysu.edu.tw',
    });
    expect(out.studentEmail).toBe('al***@student.nsysu.edu.tw');
    expect(out.studentEmailMasked).toBe('al***@student.nsysu.edu.tw');
  });

  it('maskSurveyResponseDetailForAdminApi masks email answers', () => {
    const out = maskSurveyResponseDetailForAdminApi({
      response: { id: 1, studentEmail: 'a@b.co' },
      answers: [{
        questionKey: 'studentEmail',
        questionType: 'email',
        displayAnswer: 'secret@nsysu.edu.tw',
        rawAnswer: { answerText: 'secret@nsysu.edu.tw' },
      }],
    });
    expect(out.response.studentEmail).toBe('a***@b.co');
    expect(out.answers[0].displayAnswer).toBe('se***@nsysu.edu.tw');
  });
});
