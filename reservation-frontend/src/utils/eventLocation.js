/**
 * 活動地點：與 EventBookingSummary 邏輯一致，供日曆 hover 等處共用
 */
export function getDefaultLocation(eventType) {
  return '地點待公告';
}

/**
 * @param {{ location?: string, eventType?: string }} event
 */
export function getEventLocationDisplay(event) {
  if (!event) return '';
  return event.location?.trim() || getDefaultLocation(event.eventType);
}
