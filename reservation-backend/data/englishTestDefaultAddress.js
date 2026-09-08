/**
 * 培力英檢報名：通訊地址預設（西灣學院全英語卓越教學中心）
 * 預設鎖定；管理員可於表單設計將 studentEditable 設為 true 開放修改。
 */
const ENGLISH_TEST_DEFAULT_ADDRESS = Object.freeze({
  postalCode: '804',
  city: '高雄市',
  district: '鼓山區',
  address: '蓮海路70號西灣學院全英語卓越教學中心',
});

module.exports = {
  ENGLISH_TEST_DEFAULT_ADDRESS,
};
