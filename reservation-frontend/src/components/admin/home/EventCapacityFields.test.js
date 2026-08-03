import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import EventCapacityFields from './EventCapacityFields';
import { getDefaultCapacityFields } from '../../../utils/eventCapacityFields';

function Harness({ layout = 'compact' }) {
  const [fields, setFields] = useState(getDefaultCapacityFields('English Table'));
  return (
    <EventCapacityFields
      eventType="English Table"
      fields={fields}
      onFieldsChange={setFields}
      size="sm"
      layout={layout}
    />
  );
}

describe('EventCapacityFields labeled（批量新增卡片）', () => {
  test('預設顯示組/人/總標籤，且組、人可輸入', () => {
    render(<Harness layout="labeled" />);

    const groupInput = screen.getByTitle('組數');
    const perGroupInput = screen.getByTitle('每組人數');
    const totalInput = screen.getByTitle('總人數');

    expect(screen.getByText('組數 *')).toBeInTheDocument();
    expect(screen.getByText('每組人數 *')).toBeInTheDocument();
    expect(groupInput).toHaveValue(9);
    expect(perGroupInput).toHaveValue(4);
    expect(totalInput).toHaveValue(36);
    expect(totalInput).toHaveAttribute('readonly');

    fireEvent.change(groupInput, { target: { value: '10' } });
    expect(groupInput).toHaveValue(10);
    expect(totalInput).toHaveValue(40);

    fireEvent.change(perGroupInput, { target: { value: '5' } });
    expect(perGroupInput).toHaveValue(5);
    expect(totalInput).toHaveValue(50);
  });
});

describe('EventCapacityFields compact（相容）', () => {
  test('預設顯示組/人/總，且組、人可輸入', () => {
    render(<Harness />);

    const groupInput = screen.getByTitle('組數');
    const perGroupInput = screen.getByTitle('每組人數');
    const totalInput = screen.getByTitle('總人數');

    expect(groupInput).toHaveValue(9);
    expect(perGroupInput).toHaveValue(4);
    expect(totalInput).toHaveValue(36);
    expect(totalInput).toHaveAttribute('readonly');

    fireEvent.change(groupInput, { target: { value: '10' } });
    expect(groupInput).toHaveValue(10);
    expect(totalInput).toHaveValue(40);

    fireEvent.change(perGroupInput, { target: { value: '5' } });
    expect(perGroupInput).toHaveValue(5);
    expect(totalInput).toHaveValue(50);
  });

  test('清空後可再輸入（模擬刪除再打字）', () => {
    render(<Harness />);
    const groupInput = screen.getByTitle('組數');

    fireEvent.change(groupInput, { target: { value: '' } });
    expect(groupInput).toHaveValue(null);

    fireEvent.change(groupInput, { target: { value: '7' } });
    expect(groupInput).toHaveValue(7);
  });

  test('箭頭加減：由 9→10→9', () => {
    render(<Harness />);
    const groupInput = screen.getByTitle('組數');

    fireEvent.change(groupInput, { target: { value: '10' } });
    expect(groupInput).toHaveValue(10);

    fireEvent.change(groupInput, { target: { value: '9' } });
    expect(groupInput).toHaveValue(9);
  });
});
