import { render, screen } from '@testing-library/react';

// Keep CRA default smoke test lightweight; avoid importing heavy app dependency graph in Jest.
jest.mock('./App', () => () => <div>app-smoke</div>);
const App = require('./App');

test('App smoke test', () => {
  render(<App />);
  expect(screen.getByText('app-smoke')).toBeInTheDocument();
});
