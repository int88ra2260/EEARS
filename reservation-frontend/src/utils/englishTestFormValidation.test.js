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
      {
        ...filledVisible,
        examType: 'LRSW',
        hasCEFRB2: '否',
      },
      { idPhoto: '/uploads/x.jpg' },
      {},
      hiddenAddressAndIncome
    );
    expect(result.isValid).toBe(true);
  });

  it('edit allows changing examType and requires B2 scores when hasCEFRB2 is 是', () => {
    const result = validateEnglishTestEditForm(
      {
        ...filledVisible,
        examType: 'LR',
        hasCEFRB2: '是',
        listeningExamType: '',
        b2CertificateFiles: [],
      },
      { idPhoto: '/uploads/x.jpg', b2CertificateFile: null },
      {},
      hiddenAddressAndIncome
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.listeningExamType).toBeTruthy();
  });

  it('edit accepts existing B2 certificate without re-upload', () => {
    const result = validateEnglishTestEditForm(
      {
        ...filledVisible,
        examType: 'LRSW',
        hasCEFRB2: '是',
        listeningExamType: 'IELTS',
        listeningScore: '6.0',
        b2CertificateFiles: [],
      },
      { idPhoto: '/uploads/x.jpg', b2CertificateFile: '/uploads/b2.pdf' },
      {},
      hiddenAddressAndIncome
    );
    expect(result.isValid).toBe(true);
  });

  it('edit NON without B2 only requires exam fields', () => {
    const result = validateEnglishTestEditForm(
      {
        examType: 'NON',
        hasCEFRB2: '否',
        email: '',
      },
      { idPhoto: null },
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
