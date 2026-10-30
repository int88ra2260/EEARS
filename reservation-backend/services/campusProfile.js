'use strict';

function clean(value) {
  return String(value || '').trim();
}

function fromStuAttr(profile = {}) {
  return {
    studentId: clean(profile.STUID).toUpperCase(),
    name: clean(profile.CNAME),
    departmentName: clean(profile.DPT_DESC),
    nationalId: clean(profile.T_CID).toUpperCase(),
    grade: clean(profile.GRADE),
    phone: clean(profile.TEL_NO),
    postalCode: clean(profile.ZIP_COD2),
    city: clean(profile.CITY2),
    address: clean(profile.ADDR2),
    email: clean(profile.EMAIL).toLowerCase(),
    birthYear: clean(profile.BIRTH_YR),
    birthMonth: clean(profile.BIRTH_MM),
    birthDay: clean(profile.BIRTH_DD),
    statCod: clean(profile.STAT_COD),
  };
}

module.exports = {
  fromStuAttr,
};
