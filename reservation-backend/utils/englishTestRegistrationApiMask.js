const { maskIdNumber } = require('./piiMask');

/**
 * 培力英檢後台一般 API：遮蔽身分證字號欄位。
 * 完整 idNumber / nationalId 僅限 CAN_EXPORT_ENGLISH_TEST_DATA 匯出端點或伺服器內部流程。
 */
function maskEnglishTestRegistrationForAdminApi(record) {
  if (record == null) return record;
  const data = record && typeof record.toJSON === 'function' ? record.toJSON() : { ...record };
  const raw = data.idNumber || data.nationalId || '';
  const idNumberMasked = maskIdNumber(raw);
  return {
    ...data,
    idNumber: idNumberMasked,
    nationalId: idNumberMasked,
    idNumberMasked,
  };
}

function maskEnglishTestRegistrationListForAdminApi(records) {
  if (!Array.isArray(records)) return records;
  return records.map(maskEnglishTestRegistrationForAdminApi);
}

module.exports = {
  maskEnglishTestRegistrationForAdminApi,
  maskEnglishTestRegistrationListForAdminApi,
};
