'use strict';

const mockListImportRuns = jest.fn();
const mockGetImportRunDetail = jest.fn();

jest.mock('../services/importRunHistoryService', () => ({
  listImportRuns: (...args) => mockListImportRuns(...args),
  getImportRunDetail: (...args) => mockGetImportRunDetail(...args),
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 200,
}));

const { getImportRuns, getImportRunDetail } = require('../controllers/importRunHistoryController');

describe('importRunHistoryController', () => {
  beforeEach(() => {
    mockListImportRuns.mockReset();
    mockGetImportRunDetail.mockReset();
  });

  it('returns items, warnings, and pagination on success', async () => {
    mockListImportRuns.mockResolvedValue({
      items: [{ id: 'job_run:1', source: 'job_run' }],
      pagination: { limit: 10, offset: 5, returned: 1, totalApprox: 1 },
      warnings: [{ source: 'audit_log', message: 'skipped' }],
    });

    const req = { query: { limit: '10', offset: '5' }, requestId: 'req-ctrl-1' };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await getImportRuns(req, res, next);

    expect(mockListImportRuns).toHaveBeenCalledWith(req.query);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        items: [{ id: 'job_run:1', source: 'job_run' }],
        pagination: { limit: 10, offset: 5, returned: 1, totalApprox: 1 },
      },
      warnings: [{ source: 'audit_log', message: 'skipped' }],
      meta: { defaultLimit: 50, maxLimit: 200 },
      requestId: 'req-ctrl-1',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards errors to next', async () => {
    const err = new Error('unexpected');
    mockListImportRuns.mockRejectedValue(err);

    const req = { query: {} };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await getImportRuns(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.json).not.toHaveBeenCalled();
  });

  it('returns 400 when detail service says unsupported source', async () => {
    mockGetImportRunDetail.mockResolvedValue({ ok: false, status: 400, error: '不支援的 source' });
    const req = { params: { source: 'nope', sourceId: '1' }, requestId: 'req-detail-1' };
    const res = { status: jest.fn(() => res), json: jest.fn() };
    const next = jest.fn();

    await getImportRunDetail(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(next).not.toHaveBeenCalled();
  });
});
