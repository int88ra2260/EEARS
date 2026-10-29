import { beforeEach, describe, expect, test, vi } from 'vitest';
import { buildMiniGameCompletePayload } from '../utils/learningEventPayload';
import { buildActivityFunnelPayload } from '../utils/learningFunnelPayload';
import { submitLearningTrace } from './learningTraceApi';

const fetchClient = vi.hoisted(() => vi.fn());
const getStudentToken = vi.hoisted(() => vi.fn());

vi.mock('../utils/fetchClient', () => ({
  fetchClient: (...args) => fetchClient(...args),
}));

vi.mock('../utils/studentSession', () => ({
  getStudentToken: () => getStudentToken(),
  clearStudentSession: vi.fn(),
  loadStudentSession: vi.fn(),
}));

describe('submitLearningTrace student session', () => {
  beforeEach(() => {
    fetchClient.mockReset();
    getStudentToken.mockReset();
    fetchClient.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { created: true, projected: true } }),
    });
  });

  test('sends the student JWT when a session exists and does not retry anonymously', async () => {
    getStudentToken.mockReturnValue('student-jwt');
    const result = await submitLearningTrace({ traceId: 'wb_traceid01', gameId: 'word_bridge' });
    expect(result.ok).toBe(true);
    expect(fetchClient).toHaveBeenCalledTimes(1);
    expect(fetchClient.mock.calls[0][1].headers.Authorization).toBe('Bearer student-jwt');
  });

  test('omits Authorization when no student session exists', async () => {
    getStudentToken.mockReturnValue('');
    await submitLearningTrace({ traceId: 'wb_traceid01' });
    expect(fetchClient.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  test('complete and funnel payloads do not carry a browser-supplied studentId', () => {
    const payload = buildMiniGameCompletePayload('word_bridge', { estimatedLevel: 'A2' }, {
      traceId: 'wb_traceid01',
      studentId: '12345678',
    });
    const funnel = buildActivityFunnelPayload({
      eventType: 'funnel_impression',
      activityKey: 'english-table',
      batchId: 'batch_1',
      studentId: '12345678',
    });
    expect(payload.studentId).toBeUndefined();
    expect(funnel.studentId).toBeUndefined();
  });
});
