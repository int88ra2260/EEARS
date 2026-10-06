import { beforeEach, describe, expect, test, vi } from 'vitest';
import { clearSiteContentCache, fetchSiteContent } from './siteContentApi';

const fetchClient = vi.hoisted(() => vi.fn());

vi.mock('../utils/fetchClient', () => ({
  fetchClient: (...args) => fetchClient(...args),
}));

function okResponse(body) {
  return {
    ok: true,
    json: async () => body,
  };
}

describe('fetchSiteContent', () => {
  beforeEach(() => {
    fetchClient.mockReset();
    clearSiteContentCache();
  });

  test('同時進行的讀取只打一次 API', async () => {
    let resolveResponse;
    fetchClient.mockReturnValue(new Promise((resolve) => {
      resolveResponse = resolve;
    }));

    const first = fetchSiteContent();
    const second = fetchSiteContent();
    resolveResponse(okResponse({ textOverrides: { hello: '你好' } }));

    const [left, right] = await Promise.all([first, second]);
    expect(fetchClient).toHaveBeenCalledTimes(1);
    expect(left).toEqual(right);
    expect(left.textOverrides.hello).toBe('你好');
  });

  test('快取有效時不再打 API', async () => {
    fetchClient.mockResolvedValue(okResponse({ textOverrides: {} }));
    await fetchSiteContent();
    await fetchSiteContent();
    expect(fetchClient).toHaveBeenCalledTimes(1);
  });

  test('清除快取後會重新讀取', async () => {
    fetchClient
      .mockResolvedValueOnce(okResponse({ textOverrides: { hello: '舊' } }))
      .mockResolvedValueOnce(okResponse({ textOverrides: { hello: '新' } }));

    const first = await fetchSiteContent();
    clearSiteContentCache();
    const second = await fetchSiteContent();

    expect(fetchClient).toHaveBeenCalledTimes(2);
    expect(first.textOverrides.hello).toBe('舊');
    expect(second.textOverrides.hello).toBe('新');
  });
});
