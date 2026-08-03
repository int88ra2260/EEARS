'use strict';

const {
  EWL_RESOURCE_TYPES,
  mapEwlEventNameToResourceType,
} = require('../services/learningAnalytics/ewlResourceTypes');

describe('ewlResourceTypes', () => {
  it('maps EWL EventName values to LVA resource types', () => {
    expect(mapEwlEventNameToResourceType('工作坊')).toBe(EWL_RESOURCE_TYPES.WORKSHOP);
    expect(mapEwlEventNameToResourceType('實體一對一諮詢')).toBe(EWL_RESOURCE_TYPES.TUTOR_IN_PERSON);
    expect(mapEwlEventNameToResourceType('線上一對一諮詢')).toBe(EWL_RESOURCE_TYPES.TUTOR_ONLINE);
  });

  it('returns null for unknown event names', () => {
    expect(mapEwlEventNameToResourceType('EWL 活動')).toBeNull();
    expect(mapEwlEventNameToResourceType('')).toBeNull();
  });
});
