import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getB1PlusPostExamDetail } from './learningAnalyticsService';

const fetchClient = vi.hoisted(() => vi.fn());

vi.mock('../utils/fetchClient', () => ({
  fetchClient: (...args) => fetchClient(...args),
}));

function okResponse(data) {
  return {
    ok: true,
    headers: { get: () => '' },
    json: async () => ({ success: true, data }),
  };
}

describe('getB1PlusPostExamDetail', () => {
  beforeEach(() => {
    fetchClient.mockReset();
  });

  test('打到管理端接近 B2 詳情，並帶上資料版本', async () => {
    fetchClient.mockResolvedValue(okResponse({ courses: [], activities: [] }));

    const detail = await getB1PlusPostExamDetail('token-1', 'b123', 'snap-9');

    expect(detail).toEqual({ courses: [], activities: [] });
    expect(fetchClient).toHaveBeenCalledWith(
      '/api/admin/learning-analytics/b1-plus/students/b123/post-exam-detail?snapshot_version=snap-9',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token-1' },
      }),
    );
  });

  test('沒有資料版本時不附 query', async () => {
    fetchClient.mockResolvedValue(okResponse({ courses: [] }));

    await getB1PlusPostExamDetail('token-1', 'A/1');

    expect(fetchClient).toHaveBeenCalledWith(
      '/api/admin/learning-analytics/b1-plus/students/A%2F1/post-exam-detail',
      expect.any(Object),
    );
  });
});
