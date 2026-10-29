import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import LearningAnalyticsDataHealth from './LearningAnalyticsDataHealth';
import { presentLearningAnalyticsError } from '../../utils/learningAnalyticsError';
import { getLearningAnalyticsOverview } from '../../services/learningAnalyticsService';
import { fetchClient } from '../../utils/fetchClient';

vi.mock('../../utils/fetchClient', () => ({
  fetchClient: vi.fn(),
}));

const RAW = "Table 'activity_reservation.lj_analytic_students' doesn't exist";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  };
}

describe('learning analytics error presentation', () => {
  test('the health alert does not show a database message', () => {
    render(
      <LearningAnalyticsDataHealth
        error={presentLearningAnalyticsError({ status: 500, message: RAW })}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('目前無法取得學習分析資料');
    expect(screen.getByRole('alert')).not.toHaveTextContent('lj_analytic_students');
  });

  test('overview requests keep 401 separate from a server failure', async () => {
    fetchClient.mockResolvedValueOnce(jsonResponse(500, { success: false, error: RAW }));
    await expect(getLearningAnalyticsOverview('token')).rejects.toMatchObject({
      message: expect.stringContaining('目前無法取得學習分析資料'),
      status: 500,
    });

    fetchClient.mockResolvedValueOnce(jsonResponse(401, { success: false, error: RAW }));
    await expect(getLearningAnalyticsOverview('token')).rejects.toMatchObject({
      message: expect.stringContaining('重新登入'),
      status: 401,
    });

    fetchClient.mockResolvedValueOnce(jsonResponse(200, { success: true, data: { headline: { students: 1 } } }));
    await expect(getLearningAnalyticsOverview('token')).resolves.toEqual({ headline: { students: 1 } });
  });
});
