import {
  buildTimelineColumns,
  compareTermKeys,
  resolveEventColumnKey,
} from './timelineLayout';
import { semesterIdFromDate } from '../../utils/semesterUtils';

describe('timelineLayout', () => {
  it('sorts semester keys chronologically', () => {
    expect(compareTermKeys('114-1', '114-2')).toBeLessThan(0);
    expect(compareTermKeys('114-2', '115-1')).toBeLessThan(0);
  });

  it('places events into matching semester columns', () => {
    const timeline = [
      { lane: 'activity', title: 'English Table', termLabel: '114-2', eventDate: '2026-04-20' },
      { lane: 'exam', title: 'BESTEP', termLabel: '114-1', instrument: 'BESTEP' },
    ];
    const columns = buildTimelineColumns(timeline, '114-1');
    expect(columns.map((c) => c.key)).toEqual(['114-1', '114-2', '畢業門檻']);
    expect(resolveEventColumnKey(timeline[0], '114-1')).toBe('114-2');
  });

  it('labels enrollment column', () => {
    const columns = buildTimelineColumns(
      [{ lane: 'baseline', title: '入學基準', termLabel: '114-1' }],
      '114-1'
    );
    expect(columns[0].label).toBe('114-1（入學）');
  });

  it('maps exam event date to semester column instead of YYYY-MM', () => {
    expect(semesterIdFromDate('2022-07-31')).toBe('110-2');
    const exam = {
      lane: 'exam',
      title: 'TOEIC',
      instrument: 'TOEIC',
      termLabel: '2022-07',
      eventDate: '2022-07-31',
    };
    expect(resolveEventColumnKey(exam, '111-1')).toBe('110-2');
    const columns = buildTimelineColumns(
      [
        { lane: 'baseline', title: '入學基準', termLabel: '111-1' },
        exam,
        { lane: 'course', title: 'Course', termLabel: '114-2', eventDate: '2026-02-01' },
      ],
      '111-1'
    );
    expect(columns.map((c) => c.key)).toEqual(['110-2', '111-1', '114-2', '畢業門檻']);
  });
});
