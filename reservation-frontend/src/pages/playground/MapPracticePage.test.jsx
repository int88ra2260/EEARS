import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import MapPracticePage from './MapPracticePage';

vi.mock('@react-three/fiber', () => ({
  Canvas: () => <div data-testid="map-canvas" />,
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  ContactShadows: () => null,
  Html: ({ children }) => <div>{children}</div>,
  useGLTF: () => ({ scene: { clone: () => ({ traverse() {} }) } }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <MapPracticePage />
    </MemoryRouter>,
  );
}

describe('MapPracticePage', () => {
  test('lists the four buildings and switches the summary', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole('heading', { name: '3D 地圖' })).toBeInTheDocument();
    expect(screen.getByText(/mapPracticeBuildings\.js/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '前往預約活動' })).toHaveAttribute('href', '/events');

    await user.click(screen.getByRole('button', { name: '學生活動中心' }));

    expect(screen.getByRole('link', { name: '前往公告' })).toHaveAttribute('href', '/announcements');
    expect(screen.getByText('最新公告、活動異動與中心消息。')).toBeInTheDocument();
  });
});
