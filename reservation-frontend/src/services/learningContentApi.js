import * as seed from '../data/learningContent';

const USE_API = false;

/**
 * @param {{ level?: string, topic?: string }} [filters]
 */
export async function fetchListeningLadderBank(filters = {}) {
  if (!USE_API) {
    return seed.getListeningLadderItems(filters);
  }
  const { fetchClient } = await import('../utils/fetchClient');
  const params = new URLSearchParams();
  if (filters.level) params.set('level', filters.level);
  if (filters.topic) params.set('topic', filters.topic);
  const qs = params.toString();
  return fetchClient(`/api/learning-content/listening-ladder${qs ? `?${qs}` : ''}`);
}

/**
 * @param {{ activityType?: string }} [filters]
 */
export async function fetchPhrasebookItems(filters = {}) {
  if (!USE_API) {
    return seed.getPhrasebookItems(filters);
  }
  const { fetchClient } = await import('../utils/fetchClient');
  const params = new URLSearchParams();
  if (filters.activityType) params.set('activityType', filters.activityType);
  const qs = params.toString();
  return fetchClient(`/api/learning-content/phrasebook${qs ? `?${qs}` : ''}`);
}
