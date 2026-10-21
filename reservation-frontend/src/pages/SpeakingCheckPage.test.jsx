import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import SpeakingCheckPage from './SpeakingCheckPage';

vi.mock('../services/speakingCheckApi', () => ({
  fetchSpeakingCheckSession: vi.fn().mockRejectedValue(new Error('none')),
  joinSpeakingCheck: vi.fn(),
  submitSpeakingCheckResponse: vi.fn(),
}));

describe('SpeakingCheckPage', () => {
  test('asks for a join code before showing a question', async () => {
    render(
      <MemoryRouter>
        <SpeakingCheckPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '口說檢測' })).toBeInTheDocument();
    expect(screen.getByLabelText('加入代碼')).toBeInTheDocument();
    expect(screen.getByLabelText('你的名字')).toBeInTheDocument();
    expect(screen.queryByTestId('speaking-check-passage')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/學號/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bA2\b/)).not.toBeInTheDocument();
    expect(screen.queryByText(/適應性/)).not.toBeInTheDocument();
  });
});
