import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import SpeakingHostResponseReview from './SpeakingHostResponseReview';

vi.mock('../services/speakingCheckApi', () => ({
  fetchSpeakingHostAudio: vi.fn(() => new Promise(() => {})),
}));

const response = {
  id: 7,
  transcript: 'A young woman working at TSMC',
  fluencyPercent: 82,
  completionPercent: 70,
  pronunciationPercent: 64,
  durationMs: 18000,
  pauseCount: 2,
  hasAudio: true,
  submittedAt: '2026-10-21T14:00:00.000Z',
  wordResults: [
    { index: 0, word: 'young', status: 'matched' },
    { index: 1, word: 'company', status: 'missing' },
  ],
  rating: null,
};

describe('SpeakingHostResponseReview', () => {
  test('shows the recording, the words that differ, and a teacher score', () => {
    render(
      <SpeakingHostResponseReview
        response={response}
        targetText="A young woman working at a company."
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText('A young woman working at a company.')).toBeInTheDocument();
    expect(screen.getByText('正在載入錄音…')).toBeInTheDocument();
    expect(screen.getByText('A young woman working at TSMC')).toBeInTheDocument();
    expect(screen.getByText('company')).toBeInTheDocument();
    expect(screen.getByText('沒念到')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '儲存評分' })).toBeDisabled();
    expect(screen.getByRole('group', { name: /流暢度/ })).toBeInTheDocument();
  });
});
