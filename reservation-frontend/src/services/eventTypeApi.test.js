import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchPublicEventTypes, invalidateEventTypeClientCache } from './eventTypeApi';

const fetchClient = vi.hoisted(() => vi.fn());

vi.mock('../utils/fetchClient', () => ({
  fetchClient: (...args) => fetchClient(...args),
}));

function okResponse(data) {
  return {
    ok: true,
    json: async () => ({ data }),
  };
}

describe('fetchPublicEventTypes', () => {
  beforeEach(() => {
    fetchClient.mockReset();
    invalidateEventTypeClientCache();
  });

  test('同時進行的讀取只打一次 API', async () => {
    let resolveResponse;
    fetchClient.mockReturnValue(new Promise((resolve) => {
      resolveResponse = resolve;
    }));

    const first = fetchPublicEventTypes();
    const second = fetchPublicEventTypes();
    resolveResponse(okResponse([{ code: 'english_table', isActive: true }]));

    const [left, right] = await Promise.all([first, second]);
    expect(fetchClient).toHaveBeenCalledTimes(1);
    expect(left).toEqual(right);
    expect(left[0].code).toBe('english_table');
  });

  test('快取有效時不再打 API', async () => {
    fetchClient.mockResolvedValue(okResponse([{ code: 'job_talk' }]));
    await fetchPublicEventTypes();
    await fetchPublicEventTypes();
    expect(fetchClient).toHaveBeenCalledTimes(1);
  });
});
