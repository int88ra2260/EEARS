'use strict';

/** EWL（英文寫作工坊）活動 → LVA 資源類型鍵 */
const EWL_RESOURCE_TYPES = Object.freeze({
  WORKSHOP: 'WORKSHOP',
  TUTOR_IN_PERSON: 'TUTOR_IN_PERSON',
  TUTOR_ONLINE: 'TUTOR_ONLINE',
});

const EWL_RESOURCE_LABELS = Object.freeze({
  WORKSHOP: '工作坊',
  TUTOR_IN_PERSON: '實體一對一諮詢',
  TUTOR_ONLINE: '線上一對一諮詢',
});

/**
 * 依 EWL EventName 對應 LVA 資源類型；無法辨識時回傳 null。
 * @param {string|null|undefined} eventName
 * @returns {string|null}
 */
function mapEwlEventNameToResourceType(eventName) {
  const name = String(eventName || '').trim();
  if (!name) return null;
  if (/線上.*一對一|一對一.*線上|online.*(?:tutor|consult)/i.test(name)) {
    return EWL_RESOURCE_TYPES.TUTOR_ONLINE;
  }
  if (/實體.*一對一|一對一.*實體|in[-\s]?person.*(?:tutor|consult)/i.test(name)) {
    return EWL_RESOURCE_TYPES.TUTOR_IN_PERSON;
  }
  if (/工作坊|workshop/i.test(name)) {
    return EWL_RESOURCE_TYPES.WORKSHOP;
  }
  if (/一對一.*諮詢|(?:tutor|consult).*一對一/i.test(name)) {
    return EWL_RESOURCE_TYPES.TUTOR_IN_PERSON;
  }
  return null;
}

module.exports = {
  EWL_RESOURCE_TYPES,
  EWL_RESOURCE_LABELS,
  mapEwlEventNameToResourceType,
};
