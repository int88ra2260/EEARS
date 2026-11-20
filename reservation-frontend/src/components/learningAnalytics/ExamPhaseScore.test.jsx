import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import ExamPhaseScore from './ExamPhaseScore';

describe('ExamPhaseScore', () => {
  test('shows recorded CEFR with the average GSE', () => {
    render(
      <ExamPhaseScore
        side="pre"
        phase={{
          gse: 54,
          cefr: 'B1',
          cefrSource: 'recorded',
          mixedCefr: false,
          instrument: 'IELTS',
          examDate: '2026-03-01',
          skillCount: 2,
          mappedSkillCount: 2,
        }}
        skills={[{
          skill: 'listening',
          pre: { rawScore: 6, cefr: 'B1', gse: 54, invalidScore: false },
        }]}
      />
    );
    expect(screen.getByText('B1 · GSE 54')).toBeTruthy();
    expect(screen.getByText('IELTS · 2026-03-01 · 2 科平均')).toBeTruthy();
    expect(screen.getByTitle(/聽力 6 B1 GSE 54/)).toBeTruthy();
  });

  test('does not present a missing phase or an invalid zero as a score', () => {
    const { rerender } = render(<ExamPhaseScore phase={{ skillCount: 0, gse: null }} />);
    expect(screen.getByText('—')).toBeTruthy();

    rerender(
      <ExamPhaseScore
        side="pre"
        phase={{
          gse: null,
          cefr: null,
          mixedCefr: false,
          skillCount: 1,
          mappedSkillCount: 0,
        }}
        skills={[{
          skill: 'listening',
          pre: { rawScore: 0, invalidScore: true, gse: null, cefr: null },
        }]}
      />
    );
    expect(screen.getByText('沒有 CEFR · GSE 無法換算')).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryByText(/^0$/)).toBeNull();
  });

  test('marks mixed CEFR and a partial average', () => {
    render(
      <ExamPhaseScore
        side="post"
        phase={{
          gse: 60,
          cefr: 'B2',
          cefrSource: 'gse_band',
          mixedCefr: true,
          mixedInstrument: false,
          instrument: 'IELTS',
          skillCount: 3,
          mappedSkillCount: 3,
        }}
      />
    );
    expect(screen.getByText('各科不同 · GSE 60')).toBeTruthy();
    expect(screen.getByText('IELTS · 3 科平均')).toBeTruthy();
  });
});
