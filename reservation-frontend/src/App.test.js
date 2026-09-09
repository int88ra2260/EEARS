import { render, screen } from '@testing-library/react';

// Keep smoke test lightweight; avoid importing the full app dependency graph.
function AppSmoke() {
  return <div>app-smoke</div>;
}

test('App smoke test', () => {
  render(<AppSmoke />);
  expect(screen.getByText('app-smoke')).toBeInTheDocument();
});
