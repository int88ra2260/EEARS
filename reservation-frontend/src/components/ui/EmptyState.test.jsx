import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  test('renders title and description', () => {
    render(<EmptyState title="目前沒有通知" description="新的通知會出現在這裡。" />);
    expect(screen.getByRole('status')).toHaveTextContent('目前沒有通知');
    expect(screen.getByRole('status')).toHaveTextContent('新的通知會出現在這裡。');
  });

  test('renders an optional icon without giving it a name', () => {
    const { container } = render(<EmptyState icon="calendar" title="尚未有活動" />);
    expect(container.querySelector('.eears-empty-state__icon svg')).toBeTruthy();
    expect(container.querySelector('.eears-empty-state__icon')).toHaveAttribute('aria-hidden', 'true');
  });

  test('runs an optional action from the keyboard-reachable button', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="尚未有活動"
        actions={<button type="button" onClick={onClick}>前往建立第一個活動</button>}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '前往建立第一個活動' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('keeps a React description used by existing pages', () => {
    render(
      <EmptyState
        icon="search"
        description={(
          <div>
            <div>目前尚未找到符合的預約紀錄</div>
            <ul>
              <li>學號格式是否與報名時一致</li>
            </ul>
          </div>
        )}
      />
    );
    expect(screen.getByText('目前尚未找到符合的預約紀錄')).toBeInTheDocument();
    expect(screen.getByText('學號格式是否與報名時一致')).toBeInTheDocument();
  });

  test('renders with only the defaults used by existing pages', () => {
    render(<EmptyState icon="🔔" title="目前沒有通知" />);
    expect(screen.getByRole('status')).toHaveTextContent('目前沒有通知');
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('does not render an empty action row', () => {
    const { container } = render(<EmptyState title="目前沒有待辦事項。" actions={null} />);
    expect(container.querySelector('.eears-empty-state__actions')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('does not render blank title or description text', () => {
    render(<EmptyState title="   " description={null} />);
    const status = screen.getByRole('status');
    expect(status).not.toHaveTextContent('undefined');
    expect(status).not.toHaveTextContent('null');
    expect(status.textContent.trim()).toBe('');
  });

  test('an unknown icon still renders the status', () => {
    render(<EmptyState icon="not-a-real-icon" title="目前沒有待辦事項。" />);
    expect(screen.getByRole('status')).toHaveTextContent('目前沒有待辦事項。');
  });

  test('an unknown variant falls back without dropping the title', () => {
    const { container } = render(<EmptyState variant="not-a-variant" title="尚未有活動" />);
    expect(container.querySelector('.eears-empty-state--default')).toBeTruthy();
    expect(screen.getByRole('status')).toHaveTextContent('尚未有活動');
  });
});
