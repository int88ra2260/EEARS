import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import ActivityFeedbackForm from './ActivityFeedbackForm';

const schema = {
  description: '說明',
  sections: [
    { id: 'about', title: '參加經驗' },
    { id: 'during-et', title: 'English Table' },
  ],
  questions: [
    {
      id: 'af_attended',
      type: 'checkbox',
      label: '本學期你實際出席過哪些？',
      section: 'about',
      required: true,
      exclusiveValue: '都沒有出席過',
      options: ['English Table', '都沒有出席過'],
    },
    {
      id: 'af_et_speak',
      type: 'likert',
      label: '我有足夠機會說英文',
      section: 'during-et',
      required: true,
      scaleLabels: ['非常不同意', '不同意', '普通', '同意', '非常同意'],
      visibleWhen: { questionId: 'af_attended', includesAny: ['English Table'] },
    },
  ],
};

describe('ActivityFeedbackForm', () => {
  test('只在出席 English Table 時顯示活動過程題', async () => {
    const user = userEvent.setup();
    render(<ActivityFeedbackForm schema={schema} onSubmit={vi.fn()} />);

    expect(screen.getByText('本學期你實際出席過哪些？')).toBeInTheDocument();
    expect(screen.queryByText('我有足夠機會說英文')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('English Table'));
    expect(screen.getByText('我有足夠機會說英文')).toBeInTheDocument();

    await user.click(screen.getByLabelText('都沒有出席過'));
    expect(screen.queryByText('我有足夠機會說英文')).not.toBeInTheDocument();
  });
});
