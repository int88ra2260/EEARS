import {
  validateEnglishTestDetailForm,
  validateEnglishTestEditForm,
  resolveScrollableErrorField,
} from './englishTestFormValidation';

describe('englishTestFormValidation schema awareness', () => {
  const hiddenAddressAndIncome = {
    schemaStrict: true,
    visibleByFieldKey: {
      email: true,
      studentNameZh: true,
      lastNameEn: true,
      firstNameEn: true,
      birthDate: true,
      phone: true,
      postalCode: true,
      city: true,
      district: true,
      address: true,
      degreeLevel: true,
      grade: true,
      college: true,
      department: true,
      addressConfirmed: false,
      isLowIncome: false,
      hasDisabilityCard: true,
      agreedToTerms: true,
      infoSource: true,
      idPhoto: true,
    },
    requiredByFieldKey: {
      email: true,
      studentNameZh: true,
      lastNameEn: true,
      firstNameEn: true,
      birthDate: true,
      phone: true,
      postalCode: false,
      city: false,
      district: false,
      address: false,
      degreeLevel: true,
      grade: true,
      college: true,
      department: true,
      addressConfirmed: false,
      isLowIncome: false,
      hasDisabilityCard: true,
      agreedToTerms: true,
      infoSource: true,
      idPhoto: true,
    },
  };

  const filledVisible = {
    email: 'a@b.com',
    studentNameZh: '王小明',
    lastNameEn: 'WANG',
    firstNameEn: 'MING',
    birthDate: '2000-01-01',
    phone: '0912345678',
    postalCode: '',
    city: '',
    district: '',
    address: '',
    degreeLevel: '學士班',
    grade: '一年級',
    college: '工學院',
    department: '電機',
    addressConfirmed: false,
    isLowIncome: '',
    hasDisabilityCard: '否',
    agreedToTerms: true,
    infoSource: '同學告知',
    idPhoto: new File(['x'], 'a.jpg', { type: 'image/jpeg' }),
  };

  it('does not require hidden addressConfirmed / isLowIncome', () => {
    const result = validateEnglishTestDetailForm(filledVisible, hiddenAddressAndIncome);
    expect(result.isValid).toBe(true);
    expect(result.errors.addressConfirmed).toBeUndefined();
    expect(result.errors.isLowIncome).toBeUndefined();
  });

  it('still requires hidden fields when formOptions absent (legacy)', () => {
    const result = validateEnglishTestDetailForm(filledVisible, null);
    expect(result.isValid).toBe(false);
    expect(result.errors.addressConfirmed).toBeTruthy();
    expect(result.errors.isLowIncome).toBeTruthy();
  });

  it('edit validation also skips hidden fields', () => {
    const result = validateEnglishTestEditForm(
      filledVisible,
      { idPhoto: '/uploads/x.jpg' },
      {},
      hiddenAddressAndIncome
    );
    expect(result.isValid).toBe(true);
  });

  it('resolveScrollableErrorField prefers mounted refs', () => {
    const refs = {
      addressConfirmed: { current: null },
      email: { current: {} },
    };
    const getFieldRef = (name) => refs[name] || { current: null };
    expect(resolveScrollableErrorField(getFieldRef, 'addressConfirmed', ['addressConfirmed', 'email']))
      .toBe('email');
  });
});
